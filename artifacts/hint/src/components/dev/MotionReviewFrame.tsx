import { createRoot } from "react-dom/client";
import { DevicePreview, shouldShowDevicePreview } from "./DevicePreview";

// The review tools use the same device, safe areas, and frame as the app.
// Load the animator only inside the phone, so there is just one WebGL player.
if (import.meta.env.DEV) {
  if (shouldShowDevicePreview()) {
    document.getElementById("review-styles")?.remove();
    const root = document.createElement("div");
    document.body.replaceChildren(root);
    createRoot(root).render(<DevicePreview />);
  } else if (document.body.dataset.review === "catalogue") {
    void import("./motionCatalogue.js");
  } else {
    void import("./motionReview.js");
  }
}
