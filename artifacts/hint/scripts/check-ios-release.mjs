import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const staticOnly = process.argv.includes("--static");
const shouldBuild = process.argv.includes("--build");

if (!staticOnly && !shouldBuild) {
  console.error("Usage: node scripts/check-ios-release.mjs --static|--build");
  process.exit(1);
}

const failures = [];

function read(relativePath) {
  const path = resolve(root, relativePath);
  if (!existsSync(path)) {
    failures.push(`Missing ${relativePath}`);
    return "";
  }
  return readFileSync(path, "utf8");
}

function requireText(relativePath, text, label) {
  const source = read(relativePath);
  if (!source.includes(text)) failures.push(`${label} is missing from ${relativePath}`);
}

const capacitorConfig = JSON.parse(read("capacitor.config.json") || "{}");
if (capacitorConfig.appId !== "com.mydailyhint.app") {
  failures.push("capacitor.config.json must use the Hint iOS bundle identifier");
}
if (capacitorConfig.webDir !== "dist/public") {
  failures.push("capacitor.config.json must point iOS at dist/public");
}

requireText("ios/App/App/Info.plist", "NSMicrophoneUsageDescription", "Microphone permission copy");
requireText("ios/App/App/Info.plist", "NSSpeechRecognitionUsageDescription", "Speech permission copy");
requireText("ios/App/App/HintSpeechRecognitionPlugin.swift", "SFSpeechRecognizer", "Native speech recognition");
requireText("ios/App/App/HintSpeechRecognitionPlugin.swift", "AVAudioEngine", "Native microphone capture");
requireText("ios/App/App/HintSpeechRecognitionPlugin.swift", "format.sampleRate > 0", "Microphone format guard");
requireText("ios/App/App/HintSpeechRecognitionPlugin.swift", "DispatchQueue.main.async", "Main-thread speech callbacks");
requireText("ios/App/App/HintSpeechRecognitionPlugin.swift", "didEnterBackgroundNotification", "Background recording cleanup");
requireText("ios/App/App/HintSpeechRecognitionPlugin.swift", "interruptionNotification", "Audio interruption cleanup");
requireText("ios/App/App/Base.lproj/Main.storyboard", "HintBridgeViewController", "Custom Capacitor bridge");
requireText("ios/App/App.xcodeproj/project.pbxproj", "HintSpeechRecognitionPlugin.swift in Sources", "Speech plugin build membership");
requireText("ios/App/App/HintDeviceCredentialPlugin.swift", "kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly", "Device-only Keychain credential protection");
requireText("ios/App/App/HintSpeechRecognitionPlugin.swift", "registerPluginInstance(HintDeviceCredentialPlugin())", "Credential plugin registration");
requireText("ios/App/App.xcodeproj/project.pbxproj", "HintDeviceCredentialPlugin.swift in Sources", "Credential plugin build membership");
requireText("ios/App/App.xcodeproj/project.pbxproj", "PrivacyInfo.xcprivacy in Resources", "Bundled privacy manifest");
requireText("ios/App/App/Hint.entitlements", "com.apple.developer.associated-domains", "Associated domains entitlement");
requireText("src/lib/mobile/deepLinks.ts", '"appUrlOpen"', "Universal-link handler");
requireText("package.json", '"@capacitor/app"', "Native app lifecycle dependency");
requireText("src/lib/mobile/appLifecycle.ts", '"appStateChange"', "Native app-state listener");
requireText("ios/App/CapApp-SPM/Package.swift", "CapacitorHaptics", "Native haptics package");
requireText("ios/App/CapApp-SPM/Package.swift", "CapacitorApp", "Native app lifecycle package");
requireText("ios/App/CapApp-SPM/Package.swift", "CapacitorShare", "Native share package");
requireText("ios/App/CapApp-SPM/Package.swift", "CapacitorFilesystem", "Receipt file package");
const deploymentTargets = [...read("ios/App/App.xcodeproj/project.pbxproj").matchAll(/IPHONEOS_DEPLOYMENT_TARGET\s*=\s*([\d.]+);/g)];
if (!deploymentTargets.length || deploymentTargets.some(([, value]) => {
  const [major, minor = 0] = value.split(".").map(Number);
  return major < 16 || (major === 16 && minor < 4);
})) failures.push("The Tailwind 4 interface requires every app deployment target to be iOS 16.4 or later");

if (failures.length > 0) {
  console.error("iOS release source preflight failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("iOS release source preflight passed.");
if (staticOnly) process.exit(0);

function output(command, args) {
  try {
    return execFileSync(command, args, { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

const developerPath = output("xcode-select", ["-p"]);
const xcodeVersion = output("xcodebuild", ["-version"]);
const simulatorSdk = output("xcrun", ["--sdk", "iphonesimulator", "--show-sdk-path"]);
const toolchainFailures = [];

if (!developerPath.includes(".app/Contents/Developer")) {
  toolchainFailures.push(`Full Xcode is not selected (current path: ${developerPath || "unavailable"})`);
}
if (!xcodeVersion) toolchainFailures.push("xcodebuild is unavailable");
if (!simulatorSdk) toolchainFailures.push("The iPhone Simulator SDK is unavailable");

if (toolchainFailures.length > 0) {
  console.error("iOS simulator validation is blocked:");
  toolchainFailures.forEach((failure) => console.error(`- ${failure}`));
  console.error("Install Xcode, select it with xcode-select, then rerun mobile:ios:check.");
  process.exit(2);
}

console.log(xcodeVersion.split("\n")[0]);
console.log(`iPhone Simulator SDK: ${simulatorSdk}`);

const build = spawnSync(
  "xcodebuild",
  [
    "-project",
    "ios/App/App.xcodeproj",
    "-scheme",
    "App",
    "-configuration",
    "Debug",
    "-destination",
    "generic/platform=iOS Simulator",
    "-derivedDataPath",
    "tmp/ios-derived-data",
    "CODE_SIGNING_ALLOWED=NO",
    `HINT_ASSOCIATED_DOMAIN=${process.env.HINT_ASSOCIATED_DOMAIN || ""}`,
    "build",
  ],
  { cwd: root, stdio: "inherit" },
);

if (build.status !== 0) {
  console.error("iOS Simulator build failed.");
  process.exit(build.status || 1);
}

console.log("iOS Simulator build passed.");
