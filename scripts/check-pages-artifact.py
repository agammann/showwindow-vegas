from pathlib import Path
import sys
import tarfile

root = Path(sys.argv[1])
expected = {
    p.relative_to(root).as_posix(): p.read_bytes()
    for p in root.rglob("*")
    if p.is_file() and not any(part.startswith(".") for part in p.relative_to(root).parts)
}
with tarfile.open(sys.argv[2], "r") as archive:
    actual = {}
    for member in archive.getmembers():
        name = member.name.removeprefix("./")
        if member.isdir():
            continue
        if not member.isfile() or name in actual or name not in expected:
            raise ValueError(f"Unexpected archive member: {member.name}")
        actual[name] = archive.extractfile(member).read()
if actual != expected:
    raise ValueError("Pages artifact does not match the clean build")
print(f"Verified {len(actual)} Pages artifact files against the clean build")
