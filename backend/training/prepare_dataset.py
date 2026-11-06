"""Turn raw images into the folder layout the trainer expects:

    dataset/<class_name>/<image>.jpg

Two input styles are supported:
  1. A flat folder + a labels file mapping each filename to a class:
       python training/prepare_dataset.py --source training/source --labels training/source_labels.json
  2. A folder that is already split into one sub-folder per class (e.g. an
     extracted public dataset):
       python training/prepare_dataset.py --source ~/Downloads/my_dataset

Every image is validated, converted to RGB JPEG (this accepts .jfif, .png, .webp
...), stripped of metadata, and duplicates (identical pixels) are skipped.
Existing files in dataset/ are kept, so you can run this repeatedly to ADD data.
"""
import argparse
import hashlib
import json
import os
import re
import sys

from PIL import Image, UnidentifiedImageError

EXTS = {'.jpg', '.jpeg', '.jfif', '.jpe', '.png', '.webp', '.bmp'}


def slug(name):
    return re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_')


def iter_sources(source, labels):
    if labels:
        mapping = json.load(open(labels, encoding='utf-8'))
        for fname, cls in mapping.items():
            path = os.path.join(source, fname)
            if not os.path.isfile(path):
                print('  ! missing file listed in labels: %s' % fname)
                continue
            yield path, slug(cls)
    else:
        for cls in sorted(os.listdir(source)):
            d = os.path.join(source, cls)
            if not os.path.isdir(d):
                continue
            for root, _, files in os.walk(d):
                for f in sorted(files):
                    yield os.path.join(root, f), slug(cls)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--source', required=True)
    ap.add_argument('--labels', help='JSON {filename: class}. Omit if source has one folder per class.')
    ap.add_argument('--out', default=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'dataset'))
    a = ap.parse_args()

    seen = set()
    for cls in os.listdir(a.out) if os.path.isdir(a.out) else []:
        for f in os.listdir(os.path.join(a.out, cls)):
            seen.add(f.rsplit('.', 1)[0].rsplit('_', 1)[-1])      # hash suffix of earlier runs

    added, skipped = {}, 0
    for path, cls in iter_sources(a.source, a.labels):
        if os.path.splitext(path)[1].lower() not in EXTS:
            continue
        try:
            with Image.open(path) as im:
                im.load()
                im = im.convert('RGB')
        except (UnidentifiedImageError, OSError, ValueError):
            print('  ! unreadable, skipped: %s' % path)
            skipped += 1
            continue
        digest = hashlib.sha1(im.tobytes()).hexdigest()[:12]
        if digest in seen:
            skipped += 1
            continue
        seen.add(digest)
        os.makedirs(os.path.join(a.out, cls), exist_ok=True)
        im.save(os.path.join(a.out, cls, '%s_%s.jpg' % (cls, digest)), 'JPEG', quality=95)
        added[cls] = added.get(cls, 0) + 1

    print('\nAdded this run:', json.dumps(added, indent=2) if added else 'nothing new')
    print('Skipped (duplicates/unreadable): %d' % skipped)
    print('\nDataset now contains:')
    total = 0
    for cls in sorted(os.listdir(a.out)):
        n = len([f for f in os.listdir(os.path.join(a.out, cls)) if f.endswith('.jpg')])
        total += n
        print('  %-28s %5d images' % (cls, n))
    print('  %-28s %5d' % ('TOTAL', total))


if __name__ == '__main__':
    sys.exit(main())
