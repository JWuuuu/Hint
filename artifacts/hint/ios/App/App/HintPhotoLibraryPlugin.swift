import Capacitor
import Photos
import UIKit

@objc(HintPhotoLibraryPlugin)
public class HintPhotoLibraryPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HintPhotoLibraryPlugin"
    public let jsName = "HintPhotoLibrary"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestSavePermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveImage", returnType: CAPPluginReturnPromise)
    ]

    @objc public func requestSavePermission(_ call: CAPPluginCall) {
        // Adding a receipt does not require access to the user's existing photos.
        PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
            call.resolve(["granted": status == .authorized || status == .limited])
        }
    }

    @objc public func saveImage(_ call: CAPPluginCall) {
        let status = PHPhotoLibrary.authorizationStatus(for: .addOnly)
        guard status == .authorized || status == .limited else {
            call.reject("Photo permission denied", "PHOTO_PERMISSION_DENIED")
            return
        }
        guard let base64 = call.getString("base64"), base64.count <= 28_000_000,
              let data = Data(base64Encoded: base64), UIImage(data: data) != nil else {
            call.reject("Invalid receipt image")
            return
        }
        let filename = (call.getString("fileName") ?? "hint-receipt.png") as NSString
        let options = PHAssetResourceCreationOptions()
        options.originalFilename = filename.lastPathComponent
        PHPhotoLibrary.shared().performChanges({
            let request = PHAssetCreationRequest.forAsset()
            request.addResource(with: .photo, data: data, options: options)
        }) { success, error in
            if success { call.resolve() }
            else { call.reject("Could not save receipt to Photos", "PHOTO_SAVE_FAILED", error) }
        }
    }
}
