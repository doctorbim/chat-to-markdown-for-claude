"""Draws the extension icon (an "M" plus a download arrow on a rounded tile).

Run from the extension folder:  python tools/make_icons.py
Writes icons/icon16.png, icon32.png, icon48.png, icon128.png and store/promo-440x280.png.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
BG_TOP, BG_BOTTOM = (196, 108, 72), (148, 74, 46)   # warm terracotta gradient
FG = (255, 250, 242)
S = 1024  # draw large, then downsample


def tile(size_px: int) -> Image.Image:
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    # Chrome's guidance: 128px icon = 96px artwork + 16px transparent padding per side.
    pad = S * 16 // 128 if size_px >= 48 else S // 32
    box = (pad, pad, S - pad, S - pad)
    grad = Image.new("RGBA", (S, S))
    gd = ImageDraw.Draw(grad)
    for y in range(S):
        t = y / (S - 1)
        gd.line([(0, y), (S, y)], fill=tuple(round(a + (b - a) * t) for a, b in zip(BG_TOP, BG_BOTTOM)) + (255,))
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle(box, radius=(box[2] - box[0]) * 0.22, fill=255)
    img.paste(grad, (0, 0), mask)

    d = ImageDraw.Draw(img)
    inner = box[2] - box[0]
    cx0, cy0 = box[0], box[1]
    # Thicker strokes at small sizes so the mark survives downsampling.
    w = inner * (0.15 if size_px <= 16 else 0.12 if size_px <= 32 else 0.10)

    def p(x, y):  # coordinates in 0..1 of the inner tile
        return (cx0 + x * inner, cy0 + y * inner)

    top, bot = 0.30, 0.72
    # "M": two verticals and a V between them.
    d.line([p(0.17, bot), p(0.17, top), p(0.34, 0.52), p(0.51, top), p(0.51, bot)],
           fill=FG, width=round(w), joint="curve")
    for x, y in [(0.17, bot), (0.17, top), (0.51, top), (0.51, bot)]:
        r = w / 2
        cx, cy = p(x, y)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=FG)
    # Down arrow.
    ax = 0.71
    d.line([p(ax, top), p(ax, bot - 0.10)], fill=FG, width=round(w))
    cx, cy = p(ax, top)
    d.ellipse([cx - w / 2, cy - w / 2, cx + w / 2, cy + w / 2], fill=FG)
    d.polygon([p(ax - 0.15, bot - 0.15), p(ax + 0.15, bot - 0.15), p(ax, bot + 0.02)], fill=FG)
    return img.resize((size_px, size_px), Image.LANCZOS)


def promo() -> Image.Image:
    W, H = 440, 280
    img = Image.new("RGB", (W, H), (250, 249, 245))
    img.paste(tile(128), (40, 76), tile(128))
    d = ImageDraw.Draw(img)
    try:
        bold = ImageFont.truetype("segoeuib.ttf", 30)
        reg = ImageFont.truetype("segoeui.ttf", 16)
    except OSError:
        bold = reg = ImageFont.load_default()
    d.text((186, 100), "Chat to", font=bold, fill=(41, 39, 36))
    d.text((186, 136), "Markdown", font=bold, fill=(153, 86, 60))
    d.text((188, 178), "One click. Saved locally.", font=reg, fill=(107, 102, 93))
    return img


if __name__ == "__main__":
    (ROOT / "icons").mkdir(exist_ok=True)
    (ROOT / "store").mkdir(exist_ok=True)
    for n in (16, 32, 48, 128):
        tile(n).save(ROOT / "icons" / f"icon{n}.png")
    promo().save(ROOT / "store" / "promo-440x280.png")
    # Large preview for checking the design by eye.
    tile(512).save(ROOT / "store" / "icon-preview-512.png")
    print("icons written")
