"""
scripts/crop-photos.py
Run this once to auto-crop white borders from all downloaded photos.
Usage: python scripts/crop-photos.py
"""
import os, sys
from pathlib import Path

try:
    from PIL import Image
    import numpy as np
except ImportError:
    print("Installing required packages...")
    os.system("pip install Pillow numpy")
    from PIL import Image
    import numpy as np

PHOTOS_DIR = Path(__file__).parent.parent / 'public' / 'photos'
THRESHOLD  = 240  # pixels brighter than this are considered white

def crop_white_borders(img_path: Path) -> bool:
    """Returns True if the image was cropped."""
    try:
        img = Image.open(img_path).convert('RGB')
        arr = np.array(img)

        # Find pixels that are NOT white (any channel below threshold)
        is_content = (arr < THRESHOLD).any(axis=2)

        rows = is_content.any(axis=1)
        cols = is_content.any(axis=0)

        if not rows.any() or not cols.any():
            return False  # Entirely white image

        top    = int(rows.argmax())
        bottom = int(len(rows) - rows[::-1].argmax())
        left   = int(cols.argmax())
        right  = int(len(cols) - cols[::-1].argmax())

        # Add small padding
        pad    = 6
        top    = max(0, top - pad)
        bottom = min(img.height, bottom + pad)
        left   = max(0, left - pad)
        right  = min(img.width, right + pad)

        orig_area    = img.width * img.height
        cropped_area = (right - left) * (bottom - top)

        # Only crop if we removed more than 10% of the image
        if cropped_area < orig_area * 0.90:
            cropped = img.crop((left, top, right, bottom))
            cropped.save(img_path, quality=92, optimize=True)
            return True

        return False

    except Exception as e:
        print(f"  Error processing {img_path.name}: {e}")
        return False

def main():
    if not PHOTOS_DIR.exists():
        print(f"Photos directory not found: {PHOTOS_DIR}")
        sys.exit(1)

    photos = list(PHOTOS_DIR.glob('*.jpg')) + list(PHOTOS_DIR.glob('*.jpeg')) + \
             list(PHOTOS_DIR.glob('*.png'))

    print(f"Found {len(photos)} photos in {PHOTOS_DIR}")
    print("Cropping white borders...\n")

    cropped_count = 0
    for i, photo in enumerate(photos, 1):
        was_cropped = crop_white_borders(photo)
        if was_cropped:
            cropped_count += 1
            print(f"  [{i}/{len(photos)}] ✂ Cropped: {photo.name}")
        else:
            if i % 20 == 0:
                print(f"  [{i}/{len(photos)}] Checked {i} photos...")

    print(f"\nDone! Cropped {cropped_count} of {len(photos)} photos.")
    print("Restart the Next.js server to see the changes.")

if __name__ == '__main__':
    main()
