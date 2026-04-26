from __future__ import annotations

import argparse
import os
import tempfile
from pathlib import Path

from PIL import Image, ImageOps


SOURCE_EXTENSIONS = {'.jpg', '.jpeg', '.png'}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='Create WebP copies for raster images under a folder.'
    )
    parser.add_argument(
        '--root',
        default='static/images',
        help='Root folder to scan for images. Default: static/images',
    )
    parser.add_argument(
        '--quality',
        type=int,
        default=82,
        help='WebP quality from 0-100. Default: 82',
    )
    parser.add_argument(
        '--max-dimension',
        type=int,
        default=2200,
        help='Downscale images larger than this many pixels on the longest edge. Default: 2200',
    )
    parser.add_argument(
        '--force',
        action='store_true',
        help='Rebuild WebP files even when they are newer than the source image.',
    )
    parser.add_argument(
        '--keep-larger',
        action='store_true',
        help='Keep a generated WebP even when it is larger than the source image.',
    )
    return parser.parse_args()


def iter_source_images(root: Path):
    for path in root.rglob('*'):
        if not path.is_file():
            continue
        if path.suffix.lower() not in SOURCE_EXTENSIONS:
            continue
        yield path


def convert_image(source: Path, quality: int, max_dimension: int) -> Path:
    destination = source.with_suffix('.webp')
    destination.parent.mkdir(parents=True, exist_ok=True)

    fd, temp_name = tempfile.mkstemp(suffix='.webp', dir=str(destination.parent))
    os.close(fd)
    temp_path = Path(temp_name)

    with Image.open(source) as img:
        img = ImageOps.exif_transpose(img)
        if max(img.size) > max_dimension:
            img.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)

        if img.mode not in ('RGB', 'RGBA'):
            img = img.convert('RGBA' if 'A' in img.getbands() else 'RGB')

        save_kwargs = {
            'format': 'WEBP',
            'quality': quality,
            'method': 6,
        }
        img.save(temp_path, **save_kwargs)

    return temp_path


def main() -> int:
    args = parse_args()
    root = Path(args.root)
    if not root.exists():
        print(f'Root folder not found: {root}')
        return 1

    converted = 0
    skipped = 0
    saved_bytes = 0

    for source in iter_source_images(root):
        destination = source.with_suffix('.webp')
        if (
            destination.exists()
            and not args.force
            and destination.stat().st_mtime >= source.stat().st_mtime
        ):
            skipped += 1
            continue

        temp_path = convert_image(source, args.quality, args.max_dimension)
        source_size = source.stat().st_size
        webp_size = temp_path.stat().st_size

        if webp_size >= source_size and not args.keep_larger:
            temp_path.unlink(missing_ok=True)
            skipped += 1
            continue

        temp_path.replace(destination)
        converted += 1
        saved_bytes += source_size - destination.stat().st_size
        print(f'{source} -> {destination} ({source_size} -> {destination.stat().st_size} bytes)')

    print(
        f'Converted: {converted} | Skipped: {skipped} | '
        f'Net bytes saved: {saved_bytes}'
    )
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
