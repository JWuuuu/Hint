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
if archive.exists() or manifest_file.exists():
    raise SystemExit("This release already exists. Create a new version instead of replacing it.")

paths = [root / "README.md", root / "package.json"]
for folder in ["approved", "assets", "src", "scripts", "preview"]:
    paths.extend(p for p in (root / folder).rglob("*") if p.is_file())
for filename in [
    "browser-checks.json", "chromium-checks.json", "webkit-checks.json",
    "frame-audit.json", "slow-playback.json", "verification.md",
    "chromium-preview.png", "webkit-preview.png", "webkit-delivered.png",
]:
    paths.append(root / "evidence" / filename)
paths.extend((root / "evidence").glob("*-review.png"))
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

manifest_file.write_bytes(manifest_bytes)
archive.chmod(stat.S_IRUSR | stat.S_IRGRP | stat.S_IROTH)
manifest_file.chmod(stat.S_IRUSR | stat.S_IRGRP | stat.S_IROTH)
print(json.dumps({"archive": str(archive), "files": len(paths), "bytes": archive.stat().st_size, "verified": True}))
