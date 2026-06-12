"""build_photo_album — make the bridge/culvert photo album work on the DEPLOYED site.

Scans S:\\PHOTOS (the 13 GB structure-photo archive, folders B*/C*), keeps the
most recent MAX_PER photos per structure, writes compressed thumbnails to
public/s-photos/<folder>/<original filename> (same names, so local dev probing
still matches) and a manifest at public/data/photo_manifest.json so the app
loads exact files instead of blind-probing.
"""
import json, os, re, sys
from PIL import Image

SRC = r'S:\PHOTOS'
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, '..'))
OUT_PHOTOS = os.path.join(REPO, 'public', 's-photos')
OUT_MANIFEST = os.path.join(REPO, 'public', 'data', 'photo_manifest.json')

MAX_PER = 8          # newest photos kept per structure
MAX_EDGE = 640       # thumbnail bound (px)
QUALITY = 63

pat = re.compile(r'^(?P<folder>[A-Z]\w+)_(?P<yy>\d{2})_(?P<n>\d+)\.(jpe?g)(\.(jpe?g))?$', re.I)

manifest = {}
made = skipped = errors = 0
folders = sorted(f for f in os.listdir(SRC)
                 if re.fullmatch(r'[BC]\w+', f) and os.path.isdir(os.path.join(SRC, f)))
print(f'{len(folders)} structure folders', flush=True)

for i, folder in enumerate(folders):
    src_dir = os.path.join(SRC, folder)
    entries = []
    try:
        names = os.listdir(src_dir)
    except OSError:
        continue
    for fn in names:
        m = pat.match(fn)
        if not m or m.group('folder').upper() != folder.upper():
            continue
        yy, n = int(m.group('yy')), int(m.group('n'))
        year = 2000 + yy if yy < 70 else 1900 + yy
        entries.append((year, n, fn))
    if not entries:
        continue
    entries.sort(key=lambda e: (-e[0], e[1]))
    keep = entries[:MAX_PER]
    dst_dir = os.path.join(OUT_PHOTOS, folder)
    os.makedirs(dst_dir, exist_ok=True)
    kept_list = []
    for year, n, fn in keep:
        dst = os.path.join(dst_dir, fn)
        if not os.path.exists(dst):
            try:
                with Image.open(os.path.join(src_dir, fn)) as im:
                    im = im.convert('RGB')
                    im.thumbnail((MAX_EDGE, MAX_EDGE))
                    im.save(dst, 'JPEG', quality=QUALITY, optimize=True)
                made += 1
            except Exception:
                errors += 1
                continue
        else:
            skipped += 1
        kept_list.append({'f': fn, 'y': year})
    if kept_list:
        manifest[folder] = kept_list
    if (i + 1) % 100 == 0:
        print(f'  {i+1}/{len(folders)} folders · {made} thumbs', flush=True)

os.makedirs(os.path.dirname(OUT_MANIFEST), exist_ok=True)
json.dump(manifest, open(OUT_MANIFEST, 'w', encoding='utf-8'), ensure_ascii=False)

size = 0
for root, _, files in os.walk(OUT_PHOTOS):
    for f in files:
        size += os.path.getsize(os.path.join(root, f))
print(f'DONE: {len(manifest)} structures · {made} new thumbs ({skipped} cached, {errors} errors) · {size/1e6:.0f} MB total', flush=True)
