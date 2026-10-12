from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
import json
import stat
import sys
import zipfile


root = Path(__file__).resolve().parent.parent
study = sys.argv[1] if len(sys.argv) == 2 else ""
if not study or any(char not in "abcdefghijklmnopqrstuvwxyz0123456789-" for char in study):
    raise SystemExit("Pass a new lowercase study name.")
destination = root / "iterations" / study
if destination.exists():
    raise SystemExit("This study already exists. Save a new study instead of replacing it.")

description = """Hint v3.2 — welcome, letter and conversation study

Open preview/journey.html for the complete welcome, profile, letter and reading
flow. The page contains its assets and works without a server. Tap Hint during
the greeting to wink while the wave continues. A later tap uses the other eye.
Continue remains usable during the animation. Use Replay, Pause and Playback
to review the motion.

Open preview/conversation.html for Ask Hint and voice state previews. Text,
microphone and audio states are simulated. Hint moves between the invitation,
conversation avatar and voice position without being recreated. Speech only
animates during the playing state. Pause, reduced motion and background
visibility stop motion. A static image covers an unavailable renderer.

Open preview/letter.html for the isolated handoff and preview/index.html for
the existing 20-gesture inspector. The inspector still uses the earlier letter
receiver layout; the reviewed foreground handoff is in the journey and letter
studies. Form values stay in this preview. The Star is a fixed sample card.

The app adapter is off by default. A local development session can opt in with
/app?hintGuide=v3.2. Add onboarding=reset to preview the first welcome again.
A build can opt in with VITE_HINT_GUIDE_V32=1. The current adapter covers the
welcome, profile form, Ask Hint and Tarot voice. One character moves from the
welcome to the form; early continuation, skipped introductions, image failures,
reduced motion and the existing profile save flow have browser checks.
Integration contains snapshots of the
affected app files for review; it is not a patch to apply over newer app work.

This is an interactive prototype. The full v3.2 gesture review,
daily-letter app integration, resource profiling and native iPhone verification
remain in progress. Browser voice checks use simulated microphone and audio.
This archive is not a finished release candidate.

Source, drawings, approved comparisons and review evidence are included.
MANIFEST.json contains SHA-256 checksums of the saved files. The approved
greeting remains read-only. Save improvements in a separate version.
"""
paths = [root / "package.json", root / "iterations/work-state.json"]
for folder in ["src", "assets", "scripts", "approved", "baseline", "preview", "evidence"]:
    paths.extend(
        file for file in (root / folder).rglob("*")
        if file.is_file() and file.name != ".DS_Store"
        and not {"raw", "frames", "__pycache__"}.intersection(file.relative_to(root).parts)
    )
files = {file.relative_to(root).as_posix(): file.read_bytes() for file in sorted(set(paths))}
app = root.parents[2]
app_files = ["src/App.tsx", "src/AppShell.tsx", "src/components/app/OnboardingGate.tsx", "src/modules/ask/AskHint.tsx",
             "src/modules/tarot/components/TarotVoiceConversation.tsx", "vite.config.ts"]
mascot = app / "src/components/mascot"
if mascot.is_dir():
    app_files.extend(file.relative_to(app).as_posix() for file in mascot.iterdir() if file.is_file())
    for name in sorted(app_files):
        files[f"integration/app/{name}"] = (app / name).read_bytes()
files["STUDY.txt"] = description.encode()
manifest = {
    "study": study,
    "status": "prototype-in-progress",
    "createdAt": datetime.now(timezone.utc).isoformat(),
    "files": {name: sha256(data).hexdigest() for name, data in files.items()},
}
manifest_bytes = (json.dumps(manifest, indent=2) + "\n").encode()
destination.mkdir(parents=True)
archive = destination / f"hint-v3.2-{study}.zip"
with zipfile.ZipFile(archive, "x", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as saved:
    for name, data in files.items():
        entry = zipfile.ZipInfo(f"{study}/{name}")
        entry.create_system = 3
        mode = 0o444 if name.startswith("approved/") else 0o644
        entry.external_attr = (stat.S_IFREG | mode) << 16
        entry.compress_type = zipfile.ZIP_DEFLATED
        saved.writestr(entry, data)
    saved.writestr(f"{study}/MANIFEST.json", manifest_bytes)

with zipfile.ZipFile(archive) as saved:
    if saved.testzip() is not None:
        raise SystemExit("Archive integrity check failed.")
    for name, expected in manifest["files"].items():
        if sha256(saved.read(f"{study}/{name}")).hexdigest() != expected:
            raise SystemExit(f"Archive checksum mismatch: {name}")
        if name.startswith("approved/") and (saved.getinfo(f"{study}/{name}").external_attr >> 16) & 0o222:
            raise SystemExit(f"Approved file became writable: {name}")

(destination / "MANIFEST.json").write_bytes(manifest_bytes)
digest = sha256(archive.read_bytes()).hexdigest()
(destination / "archive.sha256").write_text(f"{digest}  {archive.name}\n")
for file in destination.iterdir():
    file.chmod(0o444)
destination.chmod(0o555)
print(json.dumps({"archive": str(archive), "files": len(files), "bytes": archive.stat().st_size, "sha256": digest, "verified": True}))
