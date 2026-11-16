package com.mydailyhint.app;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;
import java.io.IOException;
import java.io.OutputStream;
import java.util.UUID;

@CapacitorPlugin(name = "HintPhotoLibrary", permissions = {
    @Permission(alias = "legacyPhotos", strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE })
})
public class HintPhotoLibraryPlugin extends Plugin {
    private boolean canSave() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q || getPermissionState("legacyPhotos") == PermissionState.GRANTED;
    }

    @PluginMethod
    public void requestSavePermission(PluginCall call) {
        if (canSave()) permissionResult(call);
        else requestPermissionForAlias("legacyPhotos", call, "permissionResult");
    }

    @PermissionCallback
    private void permissionResult(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", canSave());
        call.resolve(result);
    }

    @SuppressWarnings("deprecation")
    @PluginMethod
    public void saveImage(PluginCall call) {
        if (!canSave()) {
            call.reject("Photo permission denied", "PHOTO_PERMISSION_DENIED");
            return;
        }
        Uri uri = null;
        ContentResolver resolver = getContext().getContentResolver();
        try {
            String base64 = call.getString("base64");
            if (base64 == null || base64.length() > 28000000) throw new IOException("Invalid image");
            byte[] data = Base64.decode(base64, Base64.DEFAULT);
            byte[] signature = { (byte) 137, 80, 78, 71, 13, 10, 26, 10 };
            if (data.length < signature.length) throw new IOException("Invalid PNG");
            for (int i = 0; i < signature.length; i++) {
                if (data[i] != signature[i]) throw new IOException("Invalid PNG");
            }
            String name = new File(call.getString("fileName", "hint-receipt.png")).getName();
            ContentValues values = new ContentValues();
            values.put(MediaStore.Images.Media.DISPLAY_NAME, name);
            values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/Hint");
                values.put(MediaStore.Images.Media.IS_PENDING, 1);
            } else {
                File folder = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "Hint");
                if (!folder.isDirectory() && !folder.mkdirs()) throw new IOException("Photo folder unavailable");
                values.put(MediaStore.Images.Media.DATA, new File(folder, UUID.randomUUID() + "-" + name).getAbsolutePath());
            }
            uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
            if (uri == null) throw new IOException("Photo entry unavailable");
            try (OutputStream output = resolver.openOutputStream(uri)) {
                if (output == null) throw new IOException("Photo storage unavailable");
                output.write(data);
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues completed = new ContentValues();
                completed.put(MediaStore.Images.Media.IS_PENDING, 0);
                if (resolver.update(uri, completed, null, null) != 1) throw new IOException("Could not publish photo");
            }
            call.resolve();
        } catch (Exception error) {
            if (uri != null) {
                try { resolver.delete(uri, null, null); } catch (Exception ignored) { }
            }
            call.reject("Could not save receipt to Photos", "PHOTO_SAVE_FAILED", error);
        }
    }
}
