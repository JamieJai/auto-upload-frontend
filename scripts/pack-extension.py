#!/usr/bin/env python3
"""extension/ 을 public/autoreg-extension.zip 으로 묶는다. 대시보드에서 내려받아 크롬에 '압축해제된 확장'으로 올린다."""
import pathlib, zipfile
root = pathlib.Path(__file__).resolve().parent.parent
src = root / "extension"
out = root / "public" / "autoreg-extension.zip"
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for f in sorted(src.iterdir()):
        z.write(f, f"autoreg-extension/{f.name}")
print(out, out.stat().st_size, "bytes")
