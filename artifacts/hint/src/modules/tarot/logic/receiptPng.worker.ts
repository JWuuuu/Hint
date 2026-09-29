// Only encoding runs here. Text, artwork, orientation and layout are drawn by
// the existing renderer before its pixels are transferred to this worker.
self.onmessage = async ({ data }: MessageEvent<{ bitmap: ImageBitmap }>) => {
  const { bitmap } = data;
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  try {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const blob = await canvas.convertToBlob({ type: "image/png" });
    self.postMessage({ blob });
  } catch {
    self.postMessage({ error: "Receipt export failed" });
  } finally {
    bitmap.close();
    canvas.width = canvas.height = 0;
  }
};

export {};
