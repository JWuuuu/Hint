import { registerPlugin } from "@capacitor/core";

export const photoLibrary = registerPlugin<{
  requestSavePermission(): Promise<{ granted: boolean }>;
  saveImage(options: { base64: string; fileName: string }): Promise<void>;
}>("HintPhotoLibrary");
