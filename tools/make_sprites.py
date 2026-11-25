"""Genera static/sprites.png, static/sprites.css y animals.py a partir de los dibujos en código.

Uso (solo hace falta al cambiar un dibujo; requiere Pillow):
    cd tools && python make_sprites.py
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from PIL import Image  # noqa: E402

import registry  # noqa: E402
from engine import H, W  # noqa: E402
from render import to_image  # noqa: E402

ROOT = os.path.dirname(HERE)
COLS = 10

items = registry.ordered()
assert len(items) == 100

sheet = Image.new("RGBA", (COLS * W, COLS * H), (0, 0, 0, 0))
css = [
    "/* Generado por tools/make_sprites.py. No editar a mano. */",
    ".sprite{--s:64px;--c:0;--r:0;display:inline-block;flex:none;width:var(--s);height:var(--s);"
    "background:url(\"sprites.png\") no-repeat;"
    "background-size:calc(var(--s)*%d) calc(var(--s)*%d);" % (COLS, COLS) +
    "background-position:calc(var(--s)*var(--c)*-1) calc(var(--s)*var(--r)*-1);"
    "image-rendering:pixelated;image-rendering:crisp-edges;vertical-align:middle}",
    ".sprite.sm{--s:32px}.sprite.lg{--s:96px}.sprite.xl{--s:128px}",
]
names = []
for i, (key, name) in enumerate(items):
    sheet.paste(to_image(registry.find(key)()), ((i % COLS) * W, (i // COLS) * H))
    css.append(".a%d{--c:%d;--r:%d}" % (i + 1, i % COLS, i // COLS))
    names.append(name)

sheet.save(os.path.join(ROOT, "static", "sprites.png"), optimize=True)
with open(os.path.join(ROOT, "static", "sprites.css"), "w", encoding="utf-8") as fh:
    fh.write("\n".join(css) + "\n")

lines = ['"""Un animal real por número (1 a 100), en el orden de la hoja static/sprites.png.',
         '',
         'Generado por tools/make_sprites.py. Para cambiar un dibujo edita su función en tools/ y vuelve a generarlo.',
         '"""',
         '', 'ANIMALS = [']
for i in range(0, 100, 5):
    lines.append("    " + ", ".join(repr(n) for n in names[i:i + 5]) + ",")
lines.append("]")
with open(os.path.join(ROOT, "animals.py"), "w", encoding="utf-8") as fh:
    fh.write("\n".join(lines) + "\n")
print("listo:", len(names), "animales")
