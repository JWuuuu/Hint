from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
import json
import stat
import zipfile


root = Path(__file__).resolve().parent.parent
version = json.loads((root / "package.json").read_text())["version"]
name = f"hint-gestures-v{version}"
archive = root / "releases" / f"{name}.zip"
manifest_file = root / "releases" / f"{name}-manifest.json"
checksum_file = root / "releases" / f"{name}.sha256"
if archive.exists() or manifest_file.exists() or checksum_file.exists():
    raise SystemExit("This release already exists. Create a new version instead of replacing it.")

(root / "releases").mkdir(exist_ok=True)
paths = [root / "README.md", root / "package.json"]
for folder in ["approved", "baseline", "assets", "src", "scripts", "preview", "samples"]:
    paths.extend(p for p in (root / folder).rglob("*") if p.is_file() and p.name != ".DS_Store")
required = [
    "browser-checks.json", "chromium-checks.json", "webkit-checks.json",
    "chromium-controller.json", "webkit-controller.json", "scene-checks.json", "gallery-checks.json",
    "frame-audit.json", "body-mesh-audit.json", "slow-playback.json", "transition-review.json",
    "verification.md", "gesture-review.json", "protected-checksums.json", "test-results.txt",
    "expression-inspection.json", "facial-expressions.png", "unlabeled-poses.png",
    "unlabeled-small.png", "unlabeled-avatar.png", "empty-paw-poses.png",
]
paths.extend(root / "evidence" / filename for filename in required)
for pattern in ["*-review.png", "*-normal.png", "*-slow.png", "*-playback.json", "*-activity.png", "chromium-*.png", "webkit-*.png"]:
    paths.extend((root / "evidence").glob(pattern))
for folder in ["activities", "scenes", "videos"]:
    paths.extend(p for p in (root / "evidence" / folder).rglob("*") if p.is_file() and "raw" not in p.relative_to(root / "evidence").parts and p.suffix in [".json", ".png", ".webm", ".mp4"])
paths = sorted(set(paths))
for file in paths:
    if not file.is_file():
        raise SystemExit(f"Missing release file: {file.relative_to(root)}")

manifest = {
    "version": version,
    "createdAt": datetime.now(timezone.utc).isoformat(),
    "approvedGreetingSha256": "fbda0c5e0722a0a9f706b1323336f3d4a704d2cb91252e28e5eca42725200191",
    "files": {p.relative_to(root).as_posix(): sha256(p.read_bytes()).hexdigest() for p in paths},
}
manifest_bytes = (json.dumps(manifest, indent=2) + "\n").encode()
with zipfile.ZipFile(archive, "x", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as out:
    for directory in [root / "approved", *sorted(p for p in (root / "approved").rglob("*") if p.is_dir())]:
        entry = zipfile.ZipInfo.from_file(directory, name + "/" + directory.relative_to(root).as_posix() + "/")
        if "/approved/v1/" in entry.filename:
            entry.external_attr = ((stat.S_IFDIR | 0o555) << 16) | 0x10
        out.writestr(entry, b"")
    for file in paths:
        out.write(file, name + "/" + file.relative_to(root).as_posix())
    out.writestr(name + "/MANIFEST.json", manifest_bytes)

with zipfile.ZipFile(archive) as saved:
    if saved.testzip() is not None:
        raise SystemExit("The archive failed its integrity check.")
    for filename, expected in manifest["files"].items():
        if sha256(saved.read(name + "/" + filename)).hexdigest() != expected:
            raise SystemExit(f"Archive checksum mismatch: {filename}")
    protected = saved.getinfo(name + "/approved/v1/hint-drawn-paw.html")
    if (protected.external_attr >> 16) & 0o222:
        raise SystemExit("The archived approved greeting lost its read-only permissions.")
    for entry in saved.infolist():
        if entry.is_dir() and "/approved/v1/" in entry.filename and (entry.external_attr >> 16) & 0o222:
            raise SystemExit("An approved directory lost its read-only permissions.")

manifest_file.write_bytes(manifest_bytes)
checksum_file.write_text(sha256(archive.read_bytes()).hexdigest() + "  " + archive.name + "\n")
archive.chmod(stat.S_IRUSR | stat.S_IRGRP | stat.S_IROTH)
manifest_file.chmod(stat.S_IRUSR | stat.S_IRGRP | stat.S_IROTH)
checksum_file.chmod(stat.S_IRUSR | stat.S_IRGRP | stat.S_IROTH)
print(json.dumps({"archive": str(archive), "files": len(paths), "bytes": archive.stat().st_size, "verified": True}))
