"""Crop all 9 face variants (happy/scared/sad) to circles into hatpicker2/assets."""

from pathlib import Path
from PIL import Image, ImageDraw

SRC = Path("/Users/jkahlberg/Documents/Dev/hatpicker")
DST = Path(__file__).parent / "assets"
DST.mkdir(exist_ok=True)

variants = ["happy", "scared", "sad"]

for i in (1, 2, 3):
    for v in variants:
        src_file = SRC / f"ISMS Officer {i}_{v}.png"
        out_file = DST / f"officer{i}_{v}.png"

        img = Image.open(src_file).convert("RGBA")
        w, h = img.size
        side = min(w, h)
        left = (w - side) // 2
        top = (h - side) // 2
        img = img.crop((left, top, left + side, top + side))

        mask = Image.new("L", (side, side), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, side - 1, side - 1), fill=255)

        out = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        out.paste(img, (0, 0), mask=mask)
        out.save(out_file, "PNG", optimize=True)
        print(f"  {out_file.name} ({side}x{side})")
