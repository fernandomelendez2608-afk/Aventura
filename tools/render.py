"""Utilidades para guardar PNG y generar vistas previas."""
import sys
from PIL import Image, ImageDraw, ImageFont

from engine import W, H


def to_image(grid):
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for y in range(H):
        for x in range(W):
            c = grid[y][x]
            if c is not None:
                im.putpixel((x, y), (*c, 255))
    return im


def preview(items, path, cols=10, scale=4, labels=True, bg=(238, 235, 226)):
    """items: lista de (nombre, grid)."""
    rows = (len(items) + cols - 1) // cols
    cw, ch = W * scale, H * scale + (14 if labels else 0)
    sheet = Image.new("RGB", (cols * cw, rows * ch), bg)
    d = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 10)
    except OSError:
        font = None
    for i, (name, grid) in enumerate(items):
        im = to_image(grid).resize((W * scale, H * scale), Image.NEAREST)
        x, y = (i % cols) * cw, (i // cols) * ch
        sheet.paste(im, (x, y), im)
        if labels:
            d.text((x + 2, y + H * scale + 1), f"{i + 1} {name}"[:18], fill=(40, 40, 40), font=font)
    sheet.save(path)
