import { createRoot } from "react-dom/client";
import App from "./App";
import { configureApiClient } from "./lib/api";
import { configureMobileRuntime } from "./lib/mobile/runtime";
import { configureNativeDeepLinks } from "./lib/mobile/deepLinks";
import { initializeLocalIdentity } from "./lib/identity";
import { DevicePreview, shouldShowDevicePreview } from "./components/dev/DevicePreview";
import { IdentityRecovery } from "./components/app/IdentityRecovery";
import "./index.css";

configureMobileRuntime();
void initializeLocalIdentity().then(() => {
  configureApiClient();
  void configureNativeDeepLinks().catch(() => {
    // Routes remain usable manually if the native bridge cannot register a listener.
  });
  createRoot(document.getElementById("root")!).render(
    shouldShowDevicePreview() ? <DevicePreview /> : <App />,
  );
}).catch(() => {
  createRoot(document.getElementById("root")!).render(<IdentityRecovery />);
});
