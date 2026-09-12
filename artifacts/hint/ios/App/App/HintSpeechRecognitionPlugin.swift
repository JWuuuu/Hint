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
    private var activeRecognitionId: UUID?

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
        DispatchQueue.main.async { [weak self] in
            self?.startRecognition(call)
        }
    }

    private func startRecognition(_ call: CAPPluginCall) {
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

        stopRecognition(notify: false)
        let recognitionId = UUID()
        activeRecognitionId = recognitionId
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        recognitionRequest = request

        do {
            let session = AVAudioSession.sharedInstance()
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
                    if let transcript = result?.bestTranscription.formattedString,
                       !transcript.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        self.notifyListeners("partialResults", data: [
                            "matches": [transcript],
                            "isFinal": result?.isFinal ?? false
                        ])
                    }
                    if let error {
                        self.notifyListeners("speechError", data: ["message": error.localizedDescription])
                    }
                    if result?.isFinal == true || error != nil {
                        self.stopRecognition(notify: true)
                    }
                }
            }
            notifyListeners("listeningState", data: ["status": "started"])
            call.resolve(["matches": []])
        } catch {
            stopRecognition(notify: false)
            call.reject("Could not start speech recognition", nil, error)
        }
    }

    @objc public func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            self?.stopRecognition(notify: true)
            call.resolve()
        }
    }

    @objc public func cancel(_ call: CAPPluginCall) {
        stop(call)
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
        DispatchQueue.main.async { [weak self] in
            guard let self,
                  self.audioEngine.isRunning || self.recognitionTask != nil else {
                return
            }
            self.stopRecognition(notify: true)
        }
    }

    private func stopRecognition(notify: Bool) {
        // A cancelled task can report results after the next recording has started.
        activeRecognitionId = nil
        if audioEngine.isRunning {
            audioEngine.stop()
        }
        if tapInstalled {
            audioEngine.inputNode.removeTap(onBus: 0)
            tapInstalled = false
        }
        recognitionRequest?.endAudio()
        recognitionTask?.cancel()
        recognitionTask = nil
        recognitionRequest = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        if notify {
            notifyListeners("listeningState", data: ["status": "stopped"])
        }
    }
}

@objc(HintBridgeViewController)
class HintBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(HintSpeechRecognitionPlugin())
        bridge?.registerPluginInstance(HintDeviceCredentialPlugin())
    }
}
