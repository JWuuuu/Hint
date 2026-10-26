package com.mydailyhint.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyStore;
import javax.crypto.AEADBadTagException;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Android counterpart of HintDeviceCredentialPlugin.swift: keeps this
 * installation's API device-session token out of WebView storage.
 *
 * The token is sealed with an AES-256-GCM key that lives in the Android
 * Keystore and never leaves this device. A sealed value restored onto another
 * device (Auto Backup) cannot be opened there, so it reads as absent and the
 * app enrols a fresh session, matching the iOS "this device only" Keychain item.
 */
@CapacitorPlugin(name = "HintDeviceCredential")
public class HintDeviceCredentialPlugin extends Plugin {

    private static final String KEY_PREFIX = "hint_device_session_v1:";
    private static final int MAX_KEY_LENGTH = 1024;
    private static final int MAX_VALUE_BYTES = 4096;
    private static final String KEYSTORE = "AndroidKeyStore";
    private static final String KEY_ALIAS = "com.mydailyhint.app.device-session";
    private static final String PREFERENCES = "com.mydailyhint.app.device-session";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;

    /** Thrown when stored bytes can never be opened on this device. */
    private static final class UnreadableCredential extends Exception {

        private static final long serialVersionUID = 1L;

        UnreadableCredential(String message) {
            super(message);
        }
    }

    @PluginMethod
    public void read(PluginCall call) {
        String key = validKey(call);
        if (key == null) return;
        JSObject result = new JSObject();
        String stored = preferences().getString(key, null);
        if (stored == null) {
            result.put("value", JSObject.NULL);
            call.resolve(result);
            return;
        }
        try {
            result.put("value", open(stored));
            call.resolve(result);
        } catch (UnreadableCredential error) {
            preferences().edit().remove(key).apply();
            result.put("value", JSObject.NULL);
            call.resolve(result);
        } catch (GeneralSecurityException | IOException error) {
            call.reject("Device credential is temporarily unavailable");
        }
    }

    @PluginMethod
    public void write(PluginCall call) {
        String key = validKey(call);
        if (key == null) return;
        String value = call.getString("value");
        byte[] plain = value == null ? null : value.getBytes(StandardCharsets.UTF_8);
        if (plain == null || plain.length > MAX_VALUE_BYTES) {
            call.reject("Invalid device credential");
            return;
        }
        try {
            String sealed = seal(plain);
            if (!preferences().edit().putString(key, sealed).commit()) {
                call.reject("Device credential could not be saved");
                return;
            }
            call.resolve();
        } catch (GeneralSecurityException | IOException error) {
            call.reject("Device credential could not be saved");
        }
    }

    private String validKey(PluginCall call) {
        String key = call.getString("key");
        if (key == null || !key.startsWith(KEY_PREFIX) || key.length() > MAX_KEY_LENGTH) {
            call.reject("Invalid credential key");
            return null;
        }
        return key;
    }

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
    }

    private KeyStore keyStore() throws GeneralSecurityException, IOException {
        KeyStore keyStore = KeyStore.getInstance(KEYSTORE);
        keyStore.load(null);
        return keyStore;
    }

    private SecretKey existingKey() throws GeneralSecurityException, IOException {
        KeyStore.Entry entry = keyStore().getEntry(KEY_ALIAS, null);
        return entry instanceof KeyStore.SecretKeyEntry ? ((KeyStore.SecretKeyEntry) entry).getSecretKey() : null;
    }

    private SecretKey sealingKey() throws GeneralSecurityException, IOException {
        SecretKey existing = existingKey();
        if (existing != null) return existing;
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE);
        generator.init(
            new KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build()
        );
        return generator.generateKey();
    }

    private String seal(byte[] plain) throws GeneralSecurityException, IOException {
        Cipher cipher = Cipher.getInstance(TRANSFORMATION);
        cipher.init(Cipher.ENCRYPT_MODE, sealingKey());
        byte[] iv = cipher.getIV();
        if (iv == null || iv.length != IV_BYTES) throw new GeneralSecurityException("Unexpected GCM nonce");
        byte[] sealed = cipher.doFinal(plain);
        byte[] payload = new byte[iv.length + sealed.length];
        System.arraycopy(iv, 0, payload, 0, iv.length);
        System.arraycopy(sealed, 0, payload, iv.length, sealed.length);
        return Base64.encodeToString(payload, Base64.NO_WRAP);
    }

    private String open(String stored) throws UnreadableCredential, GeneralSecurityException, IOException {
        byte[] payload;
        try {
            payload = Base64.decode(stored, Base64.NO_WRAP);
        } catch (IllegalArgumentException error) {
            throw new UnreadableCredential("Corrupt credential");
        }
        if (payload.length <= IV_BYTES) throw new UnreadableCredential("Truncated credential");
        SecretKey key = existingKey();
        if (key == null) throw new UnreadableCredential("Credential sealed on another device");
        try {
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, payload, 0, IV_BYTES));
            byte[] plain = cipher.doFinal(payload, IV_BYTES, payload.length - IV_BYTES);
            return new String(plain, StandardCharsets.UTF_8);
        } catch (AEADBadTagException error) {
            throw new UnreadableCredential("Credential sealed with a different key");
        }
    }
}
