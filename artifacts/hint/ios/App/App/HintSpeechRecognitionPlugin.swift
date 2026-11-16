import AVFoundation
import Capacitor
import Speech
import UIKit

@objc(HintSpeechRecognitionPlugin)
public class HintSpeechRecognitionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HintSpeechRecognitionPlugin"
    public let jsName = "HintSpeechRecognition"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "available", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise)
    ]

    private let audioEngine = AVAudioEngine()
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private var tapInstalled = false
    private var audioInputEnded = true
    private var activeRecognitionId: UUID?
    private var activeClientSessionId: String?
    private var gracefulStopTimeout: DispatchWorkItem?
    // Bridge calls can be cancelled before their queued main-thread work runs.
    private let speechCommandLock = NSLock()
    private var speechCommandGeneration: UInt64 = 0
    private var speechCommandSessionId: String?
    /// The app's audio category before dictation switched it to record-only.
    private var previousAudioCategory: (category: AVAudioSession.Category, mode: AVAudioSession.Mode, options: AVAudioSession.CategoryOptions)?

    public override func load() {
        super.load()
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleAppDidEnterBackground),
            name: UIApplication.didEnterBackgroundNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleAudioSessionInterruption(_:)),
            name: AVAudioSession.interruptionNotification,
            object: nil
        )
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
        stopRecognition(notify: false)
    }

    @objc public func available(_ call: CAPPluginCall) {
        let locale = call.getString("language") ?? Locale.current.identifier
        let recognizer = SFSpeechRecognizer(locale: Locale(identifier: locale))
        call.resolve(["available": recognizer?.isAvailable == true])
    }

    @objc public func requestPermissions(_ call: CAPPluginCall) {
        SFSpeechRecognizer.requestAuthorization { speechStatus in
            AVAudioSession.sharedInstance().requestRecordPermission { microphoneGranted in
                let speechGranted = speechStatus == .authorized
                DispatchQueue.main.async {
                    call.resolve([
                        "speechRecognition": speechGranted ? "granted" : "denied",
                        "microphone": microphoneGranted ? "granted" : "denied"
                    ])
                }
            }
        }
    }

    @objc public func start(_ call: CAPPluginCall) {
        let sessionId = call.getString("sessionId") ?? UUID().uuidString
        let command = nextSpeechCommand(sessionId: sessionId)
        DispatchQueue.main.async { [weak self] in
            guard let self else {
                call.reject("Speech recognition is unavailable")
                return
            }
            guard self.isCurrentSpeechCommand(command) else {
                call.reject("Speech recognition startup was cancelled")
                return
            }
            self.stopRecognition(notify: false)
            guard UIApplication.shared.applicationState == .active else {
                call.reject("Speech recognition startup was cancelled")
                return
            }
            self.startRecognition(call, sessionId: sessionId)
        }
    }

    private func nextSpeechCommand(sessionId: String? = nil) -> UInt64 {
        speechCommandLock.lock()
        defer { speechCommandLock.unlock() }
        speechCommandGeneration &+= 1
        if let sessionId { speechCommandSessionId = sessionId }
        return speechCommandGeneration
    }

    private func nextSpeechCommand(matching sessionId: String?) -> UInt64? {
        speechCommandLock.lock()
        defer { speechCommandLock.unlock() }
        // A late Stop/cancel from an older web session must not invalidate a
        // newer start, including while that start is queued on the main thread.
        guard sessionId == nil || speechCommandSessionId == sessionId else { return nil }
        speechCommandGeneration &+= 1
        return speechCommandGeneration
    }

    private func isCurrentSpeechCommand(_ command: UInt64) -> Bool {
        speechCommandLock.lock()
        defer { speechCommandLock.unlock() }
        return speechCommandGeneration == command
    }

    private func startRecognition(_ call: CAPPluginCall, sessionId: String) {
        guard SFSpeechRecognizer.authorizationStatus() == .authorized,
              AVAudioSession.sharedInstance().recordPermission == .granted else {
            call.reject("Speech recognition permission is required")
            return
        }

        let locale = call.getString("language") ?? Locale.current.identifier
        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: locale)),
              recognizer.isAvailable else {
            call.reject("Speech recognition is unavailable")
            return
        }

        let recognitionId = UUID()
        activeRecognitionId = recognitionId
        activeClientSessionId = sessionId
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        recognitionRequest = request
        audioInputEnded = false

        do {
            let session = AVAudioSession.sharedInstance()
            if previousAudioCategory == nil {
                previousAudioCategory = (session.category, session.mode, session.categoryOptions)
            }
            try session.setCategory(.record, mode: .measurement, options: [.duckOthers])
            try session.setActive(true, options: .notifyOthersOnDeactivation)

            let inputNode = audioEngine.inputNode
            let format = inputNode.outputFormat(forBus: 0)
            guard format.sampleRate > 0, format.channelCount > 0 else {
                stopRecognition(notify: false)
                call.reject("Microphone input is unavailable")
                return
            }
            inputNode.installTap(onBus: 0, bufferSize: 1_024, format: format) { buffer, _ in
                request.append(buffer)
            }
            tapInstalled = true
            audioEngine.prepare()
            try audioEngine.start()

            recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
                DispatchQueue.main.async {
                    guard let self, self.activeRecognitionId == recognitionId else { return }
                    guard UIApplication.shared.applicationState == .active else {
                        self.stopRecognition(notify: true)
                        return
                    }
                    if let transcript = result?.bestTranscription.formattedString,
                       !transcript.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        self.notifyListeners("partialResults", data: [
                            "matches": [transcript],
                            "isFinal": result?.isFinal ?? false,
                            "sessionId": sessionId
                        ])
                    }
                    if let error, result?.isFinal != true {
                        self.notifyListeners("speechError", data: ["message": error.localizedDescription, "sessionId": sessionId])
                    }
                    if result?.isFinal == true || error != nil {
                        self.stopRecognition(notify: true, cancelTask: result?.isFinal != true)
                    }
                }
            }
            notifyListeners("listeningState", data: ["status": "started", "sessionId": sessionId])
            call.resolve(["matches": []])
        } catch {
            stopRecognition(notify: false)
            call.reject("Could not start speech recognition", nil, error)
        }
    }

    @objc public func stop(_ call: CAPPluginCall) {
        guard let command = nextSpeechCommand(matching: call.getString("sessionId")) else {
            call.resolve()
            return
        }
        DispatchQueue.main.async { [weak self] in
            if let self, self.isCurrentSpeechCommand(command) {
                self.finishRecognition()
            }
            call.resolve()
        }
    }

    @objc public func cancel(_ call: CAPPluginCall) {
        guard let command = nextSpeechCommand(matching: call.getString("sessionId")) else {
            call.resolve()
            return
        }
        DispatchQueue.main.async { [weak self] in
            if let self, self.isCurrentSpeechCommand(command) {
                self.stopRecognition(notify: true)
            }
            call.resolve()
        }
    }

    @objc private func handleAppDidEnterBackground() {
        stopForLifecycleChange()
    }

    @objc private func handleAudioSessionInterruption(_ notification: Notification) {
        guard
            let rawValue = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
            AVAudioSession.InterruptionType(rawValue: rawValue) == .began
        else {
            return
        }
        stopForLifecycleChange()
    }

    private func stopForLifecycleChange() {
        let command = nextSpeechCommand()
        DispatchQueue.main.async { [weak self] in
            guard let self,
                  self.isCurrentSpeechCommand(command),
                  self.audioEngine.isRunning || self.recognitionTask != nil else {
                return
            }
            self.stopRecognition(notify: true)
        }
    }

    private func finishRecognition() {
        guard let recognitionId = activeRecognitionId, recognitionTask != nil else {
            stopRecognition(notify: true)
            return
        }
        if gracefulStopTimeout != nil { return }
        // Stop microphone input now; keep this task alive for its final words.
        stopAudioInput()
        recognitionTask?.finish()
        let timeout = DispatchWorkItem { [weak self] in
            guard let self, self.activeRecognitionId == recognitionId else { return }
            self.stopRecognition(notify: true)
        }
        gracefulStopTimeout = timeout
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5, execute: timeout)
    }

    private func stopAudioInput() {
        if audioEngine.isRunning {
            audioEngine.stop()
        }
        if tapInstalled {
            audioEngine.inputNode.removeTap(onBus: 0)
            tapInstalled = false
        }
        if !audioInputEnded {
            audioInputEnded = true
            recognitionRequest?.endAudio()
        }
        if previousAudioCategory != nil {
            try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
            restoreAudioCategory()
        }
    }

    private func stopRecognition(notify: Bool, cancelTask: Bool = true) {
        // A cancelled task can report results after the next recording has started.
        let sessionId = activeClientSessionId
        activeRecognitionId = nil
        activeClientSessionId = nil
        gracefulStopTimeout?.cancel()
        gracefulStopTimeout = nil
        stopAudioInput()
        if cancelTask { recognitionTask?.cancel() }
        recognitionTask = nil
        recognitionRequest = nil
        if notify, let sessionId {
            notifyListeners("listeningState", data: ["status": "stopped", "sessionId": sessionId])
        }
    }

    /// The web view plays Hint's spoken reply through this app's audio session, so the
    /// record-only category must not outlive dictation or the voice reply stays silent.
    private func restoreAudioCategory() {
        guard let previous = previousAudioCategory else { return }
        previousAudioCategory = nil
        let session = AVAudioSession.sharedInstance()
        if previous.category == .record {
            try? session.setCategory(.playback, mode: .spokenAudio, options: [])
        } else {
            try? session.setCategory(previous.category, mode: previous.mode, options: previous.options)
        }
    }
}

@objc(HintBridgeViewController)
class HintBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(HintSpeechRecognitionPlugin())
        bridge?.registerPluginInstance(HintDeviceCredentialPlugin())
        bridge?.registerPluginInstance(HintPhotoLibraryPlugin())
    }
}
