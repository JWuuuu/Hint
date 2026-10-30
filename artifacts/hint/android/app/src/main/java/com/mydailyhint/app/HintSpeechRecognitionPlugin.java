package com.mydailyhint.app;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;
import java.util.Locale;

/**
 * Android counterpart of HintSpeechRecognitionPlugin.swift, with the same
 * JavaScript contract (src/lib/speechRecognition.ts):
 *
 *   available({ language })  -> { available }
 *   requestPermissions()     -> { speechRecognition, microphone }
 *   start({ language })      -> { matches: [] }
 *   stop() / cancel()
 *   events: partialResults { matches, isFinal }, listeningState { status }, speechError { message }
 *
 * Android has no separate speech permission, so both answers follow
 * RECORD_AUDIO. When this device has no recognition service, available()
 * reports false and the web layer records the turn for server transcription.
 */
@CapacitorPlugin(
    name = "HintSpeechRecognition",
    permissions = { @Permission(alias = HintSpeechRecognitionPlugin.MICROPHONE, strings = { Manifest.permission.RECORD_AUDIO }) }
)
public class HintSpeechRecognitionPlugin extends Plugin {

    static final String MICROPHONE = "microphone";

    private final Handler main = new Handler(Looper.getMainLooper());
    private SpeechRecognizer recognizer;
    /** Callbacks from a cancelled recognizer can arrive after the next one starts. */
    private int activeSession = 0;

    @PluginMethod
    public void available(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", SpeechRecognizer.isRecognitionAvailable(getContext()));
        call.resolve(result);
    }

    @Override
    @PluginMethod
    public void requestPermissions(PluginCall call) {
        if (getPermissionState(MICROPHONE) == PermissionState.GRANTED) {
            resolvePermissions(call);
            return;
        }
        requestPermissionForAlias(MICROPHONE, call, "microphonePermissionCallback");
    }

    @PermissionCallback
    private void microphonePermissionCallback(PluginCall call) {
        resolvePermissions(call);
    }

    private void resolvePermissions(PluginCall call) {
        String state = getPermissionState(MICROPHONE) == PermissionState.GRANTED ? "granted" : "denied";
        JSObject result = new JSObject();
        result.put("speechRecognition", state);
        result.put("microphone", state);
        call.resolve(result);
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState(MICROPHONE) != PermissionState.GRANTED) {
            call.reject("Speech recognition permission is required");
            return;
        }
        String language = call.getString("language", Locale.getDefault().toLanguageTag());
        // SpeechRecognizer must be created and driven from the main thread.
        main.post(() -> startRecognition(call, language));
    }

    @PluginMethod
    public void stop(PluginCall call) {
        main.post(() -> {
            stopRecognition(true);
            call.resolve();
        });
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        stop(call);
    }

    @Override
    protected void handleOnPause() {
        // Never keep the microphone open behind another app.
        main.post(() -> {
            if (recognizer != null) stopRecognition(true);
        });
    }

    @Override
    protected void handleOnDestroy() {
        main.post(() -> stopRecognition(false));
    }

    private void startRecognition(PluginCall call, String language) {
        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
            call.reject("Speech recognition is unavailable");
            return;
        }
        stopRecognition(false);
        final int session = ++activeSession;
        SpeechRecognizer next;
        try {
            next = SpeechRecognizer.createSpeechRecognizer(getContext());
        } catch (RuntimeException error) {
            call.reject("Could not start speech recognition", error);
            return;
        }
        recognizer = next;
        next.setRecognitionListener(new SessionListener(session));

        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, language);
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        intent.putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, getContext().getPackageName());
        try {
            next.startListening(intent);
        } catch (RuntimeException error) {
            stopRecognition(false);
            call.reject("Could not start speech recognition", error);
            return;
        }
        notifyListeners("listeningState", status("started"));
        JSObject result = new JSObject();
        result.put("matches", new JSArray());
        call.resolve(result);
    }

    private void stopRecognition(boolean notify) {
        activeSession++;
        SpeechRecognizer current = recognizer;
        recognizer = null;
        if (current != null) {
            try {
                current.cancel();
            } catch (RuntimeException ignored) {
                // The service may already have released the session.
            }
            current.destroy();
        }
        if (notify) notifyListeners("listeningState", status("stopped"));
    }

    private static JSObject status(String value) {
        JSObject result = new JSObject();
        result.put("status", value);
        return result;
    }

    private static String describe(int error) {
        switch (error) {
            case SpeechRecognizer.ERROR_AUDIO:
                return "Microphone audio could not be recorded";
            case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS:
                return "Microphone permission is required";
            case SpeechRecognizer.ERROR_NETWORK:
            case SpeechRecognizer.ERROR_NETWORK_TIMEOUT:
                return "The speech service could not be reached";
            case SpeechRecognizer.ERROR_RECOGNIZER_BUSY:
                return "The speech service is busy";
            case SpeechRecognizer.ERROR_SERVER:
                return "The speech service failed";
            default:
                return "Speech recognition failed (" + error + ")";
        }
    }

    private final class SessionListener implements RecognitionListener {

        private final int session;

        SessionListener(int session) {
            this.session = session;
        }

        private boolean current() {
            return session == activeSession;
        }

        private void emit(Bundle results, boolean isFinal) {
            ArrayList<String> matches = results == null ? null : results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
            if (matches == null || matches.isEmpty()) return;
            String transcript = matches.get(0);
            if (transcript == null || transcript.trim().isEmpty()) return;
            JSArray values = new JSArray();
            values.put(transcript);
            JSObject data = new JSObject();
            data.put("matches", values);
            data.put("isFinal", isFinal);
            notifyListeners("partialResults", data);
        }

        @Override
        public void onReadyForSpeech(Bundle params) {}

        @Override
        public void onBeginningOfSpeech() {}

        @Override
        public void onRmsChanged(float rmsdB) {}

        @Override
        public void onBufferReceived(byte[] buffer) {}

        @Override
        public void onEndOfSpeech() {}

        @Override
        public void onError(int error) {
            if (!current()) return;
            // Silence is not a failure: end quietly so the room can offer to listen again.
            if (error != SpeechRecognizer.ERROR_NO_MATCH && error != SpeechRecognizer.ERROR_SPEECH_TIMEOUT) {
                JSObject data = new JSObject();
                data.put("message", describe(error));
                data.put("code", error);
                notifyListeners("speechError", data);
            }
            stopRecognition(true);
        }

        @Override
        public void onResults(Bundle results) {
            if (!current()) return;
            emit(results, true);
            stopRecognition(true);
        }

        @Override
        public void onPartialResults(Bundle partialResults) {
            if (!current()) return;
            emit(partialResults, false);
        }

        @Override
        public void onEvent(int eventType, Bundle params) {}
    }
}
