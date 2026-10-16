"""Draws the app icons into web/public/icons/ (run once; the PNGs are committed).

A blue rounded square with a white 3x4 timetable grid and two colored
"classes". No text, so no Persian shaping is needed.
Usage: python web/scripts/make-icons.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / "public" / "icons"
BLUE = (47, 91, 211, 255)
WHITE = (255, 255, 255, 255)
CELL = (255, 255, 255, 70)
ORANGE = (255, 196, 140, 255)
GREEN = (150, 226, 180, 255)


def draw(size: int, maskable: bool) -> Image.Image:
    s = 4 * size  # draw large, then downsample for smooth edges
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if maskable:
        d.rectangle([0, 0, s, s], fill=BLUE)
        pad = 0.24 * s  # keep the drawing inside the 80% safe zone
    else:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(0.22 * s), fill=BLUE)
        pad = 0.17 * s
    cols, rows = 3, 4
    gap = 0.035 * s
    top = pad + 0.10 * s  # room for the header bar
    w = (s - 2 * pad - (cols - 1) * gap) / cols
    h = (s - top - pad - (rows - 1) * gap) / rows
    r = int(0.025 * s)
    d.rounded_rectangle([pad, pad, s - pad, pad + 0.07 * s], radius=r, fill=WHITE)
    filled = {(0, 0): ORANGE, (2, 1): GREEN, (1, 2): ORANGE, (0, 3): GREEN}
    for i in range(cols):
        for j in range(rows):
            x = s - pad - (i + 1) * w - i * gap  # right to left, like the app
            y = top + j * (h + gap)
            d.rounded_rectangle([x, y, x + w, y + h], radius=r, fill=filled.get((i, j), CELL))
    return img.resize((size, size), Image.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for size in (192, 512):
        draw(size, False).save(OUT / f"icon-{size}.png", optimize=True)
    draw(512, True).save(OUT / "maskable-512.png", optimize=True)
    draw(180, True).convert("RGB").save(OUT / "apple-touch-180.png", optimize=True)
    draw(64, False).save(OUT / "favicon-64.png", optimize=True)
    print("icons written to", OUT)


if __name__ == "__main__":
    main()
