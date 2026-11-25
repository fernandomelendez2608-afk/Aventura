import math
from engine import *


def bez(pts, t):
    q = [tuple(p) for p in pts]
    while len(q) > 1:
        q = [((1 - t) * a[0] + t * b[0], (1 - t) * a[1] + t * b[1]) for a, b in zip(q, q[1:])]
    return q[0]


# ------------------------------------------------------------- reptiles y anfibios
def tortuga_marina():
    s = Sprite()
    g, gd, sh, shl, shd = C("#5a9a5a"), C("#3e7a44"), C("#8a7a3a"), C("#b0a050"), C("#5e5226")
    s.ell(5.5, 11, 5.8, 2.5, g, ang=-32); s.ell(26.5, 11, 5.8, 2.5, g, ang=32)
    s.ell(9, 26, 3.8, 2, g, ang=32); s.ell(23, 26, 3.8, 2, g, ang=-32)
    s.ell(16, 5.2, 3.5, 3.6, g)
    s.ell(16, 17.5, 8, 10.5, sh)
    s.ell(16, 16, 4.6, 6.2, shl, on=True)
    s.line(16, 8, 16, 27, shd, on=True)
    for y in (12, 17, 22):
        s.line(9, y, 23, y, shd, on=True)
    s.line(12, 8, 11, 27, shd, on=True); s.line(20, 8, 21, 27, shd, on=True)
    s.eye(13.5, 4); s.eye(18, 4)
    s.dot(16, 8, "#e8e0a0")
    return s.finish()


def tortuga_gigante():
    s = Sprite()
    g, gd = C("#8a9a6a"), C("#6a7a50")
    sh, shl, shd = C("#7a6a3e"), C("#a89458"), C("#4e4226")
    s.ell(7.5, 27, 3.4, 2.4, gd); s.ell(20.5, 27, 3.4, 2.4, gd)
    s.ell(10.5, 27.4, 3.4, 2.2, g); s.ell(23.5, 27.4, 3.4, 2.2, g)
    s.stroke([(24, 22), (27, 18), (28, 16)], 2.6, 2.2, g)
    s.ell(29, 15, 2.5, 2.3, g)
    s.ell(15, 20, 11.5, 8.6, sh)
    s.ell(15, 18, 7.5, 5, shl, on=True)
    for a in (-150, -120, -90, -60, -30):
        x = 15 + 11 * math.cos(math.radians(a)); y = 25 + 12 * math.sin(math.radians(a))
        s.line(15, 24, x, y, shd, on=True)
    s.line(5, 20, 25, 20, shd, on=True)
    s.rect(4, 26, 26, 26, C("#c9b878"))
    s.poly([(3, 23), (0, 25), (3, 26)], g)
    s.eye(29, 14)
    return s.finish()


def serpiente():
    s = Sprite()
    g, gd, lt = C("#5aa83a"), C("#2e6a2a"), C("#c8e08a")
    pts = [(2, 26), (8, 13), (14, 33), (21, 17), (25, 11)]
    s.stroke(pts, 2.5, 2.1, g)
    for i in range(3, 47, 4):
        x, y = bez(pts, i / 48)
        s.ell(x, y, 1.1, 1.1, gd, on=True)
    for i in range(1, 47, 4):
        x, y = bez(pts, i / 48)
        s.px(x, y + 1.3, lt, on=True)
    s.ell(26.5, 9.5, 3.2, 2.6, g, ang=-20)
    s.line(29, 9.5, 31, 8, C("#d8283a")); s.line(29, 9.5, 31, 11, C("#d8283a"))
    s.eye(26, 8)
    s.dot(26, 8, "#f4d020")
    return s.finish()


def cocodrilo():
    s = Sprite()
    g, gd, lt = C("#4a8a3a"), C("#2e5e2a"), C("#c8d890")
    s.stroke([(14, 22), (7, 22), (1, 20)], 3.6, .9, gd)
    s.ell(9.5, 27, 2.6, 2.2, gd); s.ell(21.5, 27, 2.6, 2.2, gd)
    s.ell(14, 22, 9.5, 4.2, g)
    s.ell(15, 25, 8, 1.6, lt, on=True)
    for x in range(6, 22, 2):
        s.px(x, 18.5, gd, on=True)
    s.ell(12, 27.4, 2.6, 2, g); s.ell(23, 27.4, 2.6, 2, g)
    s.poly([(21, 19), (31, 21), (31, 24.5), (21, 25)], g)
    s.line(23, 23, 31, 23, C("#1a1a14"))
    for x in (24, 26, 28, 30):
        s.px(x, 22, C("#f4f4ec")); s.px(x + .0, 24, C("#f4f4ec"))
    s.ell(23.5, 18.3, 1.8, 1.6, g)
    s.px(30.5, 21, C("#1a1a14"))
    s.eye(23, 18)
    s.dot(23, 18, "#f4d020")
    return s.finish()


def iguana():
    s = Sprite()
    g, gd, lt, sp = C("#5aa844"), C("#3a7a2e"), C("#9ad060"), C("#c8e890")
    s.stroke([(11, 20), (4, 22), (2, 27)], 2.8, .9, g)
    for x in range(1, 12):
        pass
    s.stroke([(19, 21), (21, 25), (24, 28)], 1.6, 1.4, gd)
    s.stroke([(9, 21), (7, 25), (5, 28)], 1.8, 1.4, gd)
    s.ell(14, 19, 7.5, 3.8, g)
    for x in range(7, 21, 2):
        s.poly([(x, 16.5), (x + 1, 12.5), (x + 2, 16.5)], sp)
    s.ell(15, 21, 6, 1.6, lt, on=True)
    s.stroke([(19, 21), (21, 25), (23, 28)], 1.8, 1.5, g)
    s.stroke([(9, 21), (8, 25), (6, 28)], 2, 1.5, g)
    s.ell(23, 17, 3.8, 2.9, g)
    s.ell(26.5, 18, 2.2, 1.6, g)
    s.poly([(23, 19), (28, 19), (26, 24)], C("#e0883a"))
    s.poly([(21, 14.5), (22, 12), (24, 14.5)], sp)
    s.eye(24, 16)
    s.dot(24, 16, "#e8a020")
    return s.finish()


def camaleon():
    s = Sprite()
    g, gd, lt, y = C("#5ab04a"), C("#3a8a3a"), C("#a8d870"), C("#e8c030")
    s.rect(6, 24, 27, 25, C("#6a4a2c"))
    s.stroke([(10, 19), (3, 20), (2, 26), (6, 28), (7, 25)], 2.4, .9, g)
    s.ell(15, 18, 7, 5.6, g)
    s.ell(15, 20, 4.6, 3, lt, on=True)
    for x in (11, 14, 17):
        s.line(x, 14, x - 1, 22, y, on=True)
    s.line(11, 22, 11, 25, gd); s.line(18, 22, 18, 25, gd)
    s.ell(22, 15.5, 3.6, 3.2, g)
    s.poly([(19.5, 13), (22, 8.5), (25, 13)], gd)
    s.ell(23.5, 13.5, 2.3, 2.3, g)
    s.ell(23.5, 13.5, 1.2, 1.2, C("#f4f0d0"))
    s.ell(26, 17, 1.6, 1.2, g)
    s.eye(23, 13)
    return s.finish()


def _frog(body, dark, belly, spots, eyec):
    s = Sprite()
    s.ell(5.5, 28.6, 3.6, 1.4, dark); s.ell(26.5, 28.6, 3.6, 1.4, dark)
    s.ell(7, 24, 4.8, 4.2, dark, ang=-20); s.ell(25, 24, 4.8, 4.2, dark, ang=20)
    s.ell(16, 22, 8.6, 6.6, body)
    s.ell(16, 24.5, 5.8, 3.6, belly, on=True)
    s.rect(10, 26, 11, 28, body); s.rect(21, 26, 22, 28, body)
    s.rect(9, 29, 12, 29, body); s.rect(20, 29, 23, 29, body)
    s.ell(16, 16, 8.2, 5.2, body)
    s.ell(10.5, 11.5, 3.2, 3.2, body); s.ell(21.5, 11.5, 3.2, 3.2, body)
    s.ell(10.5, 11.5, 2.2, 2.2, eyec); s.ell(21.5, 11.5, 2.2, 2.2, eyec)
    s.line(9, 17.5, 15, 18.5, dark, on=True); s.line(23, 17.5, 17, 18.5, dark, on=True)
    s.px(15, 18.5, dark, on=True); s.px(16, 18.5, dark, on=True); s.px(17, 18.5, dark, on=True)
    s.px(14, 14, dark); s.px(18, 14, dark)
    for x, y, r in spots:
        s.ell(x, y, r, r, C("#14121a"), on=True)
    s.eye(10, 11, 2); s.eye(21, 11, 2)
    return s.finish()


def rana():
    return _frog(C("#4aa83a"), C("#2e7a2e"), C("#d8e8a0"), [(13, 21, .9), (19, 22, .9), (16, 19, .7), (7, 24, .8), (25, 24, .8)], C("#f4e8a0"))


def rana_dardo():
    return _frog(C("#2a7ae0"), C("#1c4aa8"), C("#8ac0f0"),
                 [(12, 20, 1.3), (20, 21, 1.4), (16, 24, 1.1), (8, 23, 1.2), (24, 24, 1.2), (14, 16, 1), (19, 16, 1)], C("#1a1a2a"))


# ------------------------------------------------------------- marinos
def pez_payaso():
    s = Sprite()
    o, k, w = C("#f2801a"), C("#1a1418"), C("#f8f4ec")
    s.poly([(7, 14), (1, 9), (1, 23), (7, 19)], o)
    s.poly([(10, 11), (15, 4), (22, 10)], o)
    s.ell(15, 16.5, 10.5, 7.2, o)
    s.ell(19, 22, 3, 1.6, o)
    for x, wd in ((21, 2), (14, 3), (7, 2)):
        s.rect(x - 1, 3, x + wd, 29, k, on=True)
        s.rect(x, 3, x + wd - 1, 29, w, on=True)
    s.ell(17.5, 20.5, 3.4, 1.8, o, ang=30)
    s.ell(24, 14.5, 2, 2, w); s.px(25, 19, k)
    s.eye(24, 14, 1)
    return s.finish()


def pez_globo():
    s = Sprite()
    y, yd, lt = C("#f0d040"), C("#c89a20"), C("#fff4c0")
    s.poly([(7, 16), (2, 11), (2, 22), (7, 19)], yd)
    s.ell(16, 16, 9.6, 8.8, y)
    s.ell(16, 21, 6.8, 4.4, lt, on=True)
    for a in range(0, 360, 24):
        x = 16 + 11.4 * math.cos(math.radians(a)); yy = 16 + 10.6 * math.sin(math.radians(a))
        s.px(x, yy, lt)
    for x, yy in [(12, 12), (16, 10), (20, 12), (10, 16), (14, 15), (8, 19)]:
        s.px(x, yy, yd, on=True)
    s.ell(9.5, 19, 1.6, 2.4, yd, ang=20)
    s.ell(22, 13, 2.8, 2.8, C("#f8f4ec"))
    s.ell(27, 18, 2.2, 1.8, C("#f08a3a"))
    s.px(27, 18, C("#1a1418"))
    s.eye(22, 13, 2)
    return s.finish()


def tiburon():
    s = Sprite()
    g, gd, lt = C("#7a8aa0"), C("#566680"), C("#e6ecf2")
    s.poly([(6, 17), (0, 7), (3.5, 15)], gd); s.poly([(6, 17), (0, 26), (3.5, 18)], gd)
    s.ell(15, 17, 12.6, 5.2, g, ang=-3)
    s.poly([(25, 13), (31.5, 18), (25, 21)], g)
    s.ell(16, 20, 11, 2.4, lt, on=True)
    s.poly([(12, 12.5), (15, 3.5), (21, 12.5)], gd)
    s.poly([(18, 20), (14, 27), (23, 21.5)], gd)
    for x in (19, 21, 23):
        s.line(x, 14, x, 17, gd, on=True)
    s.line(25, 20, 30.5, 19.6, C("#14121a"))
    for x in (26, 28, 30):
        s.px(x, 19, C("#f4f4ec"))
    s.eye(25, 15)
    return s.finish()


def pulpo():
    s = Sprite()
    c, cd, lt = C("#b04aa8"), C("#7a2e78"), C("#e098d8")
    for pts in ([(9, 17), (4, 21), (2, 26), (6, 29)], [(12, 18), (8, 24), (9, 30)], [(15.5, 19), (15, 25), (18, 30)],
                [(19, 18), (23, 24), (21, 30)], [(23, 17), (28, 21), (30, 26), (26, 29)], [(6, 15), (1, 17), (2, 21)]):
        s.stroke(pts, 2.2, .9, c)
        for i in range(8, 46, 7):
            x, y = bez(pts, i / 48)
            s.px(x, y, lt, on=True)
    s.ell(16, 12, 8.6, 8, c)
    s.ell(14, 8, 4, 2.4, lt, ang=-20, on=True)
    s.ell(12.5, 14, 2.5, 3, C("#f8f4ec")); s.ell(19.5, 14, 2.5, 3, C("#f8f4ec"))
    s.eye(12, 14, 2); s.eye(19, 14, 2)
    s.line(14, 19, 18, 19, cd, on=True)
    return s.finish()


def medusa():
    s = Sprite()
    c, cd, lt = C("#d29ae8"), C("#a468c8"), C("#f0d4f8")
    for x in (9, 12, 16, 20, 23):
        pts = [(x, 17), (x + 2, 22), (x - 2, 26), (x + 1, 30)]
        s.stroke(pts, .8, .8, C("#9ac8f0"))
    for x, pts in ((13, [(13, 17), (11, 23), (14, 28)]), (19, [(19, 17), (21, 23), (18, 28)])):
        s.stroke(pts, 1.4, 1, lt)
    s.ell(16, 11, 10, 8, c)
    s.rect(6, 12, 26, 18, c)
    s.ell(16, 18, 10.4, 2.6, c)
    for x in range(7, 26, 3):
        s.ell(x + 0.5, 18.6, 1.6, 1.4, cd)
    s.ell(13, 7, 4.5, 2.4, lt, ang=-20, on=True)
    for x, y in [(11, 12), (16, 10), (21, 12), (14, 15), (19, 15)]:
        s.px(x, y, cd, on=True)
    return s.finish()


def cangrejo():
    s = Sprite()
    c, cd, lt = C("#e04a2a"), C("#a82a18"), C("#f08a6a")
    for pts in ([(8, 20), (3, 23), (2, 27)], [(9, 22), (5, 26), (4, 29)], [(10, 23), (8, 27), (8, 29)],
                [(24, 20), (29, 23), (30, 27)], [(23, 22), (27, 26), (28, 29)], [(22, 23), (24, 27), (24, 29)]):
        s.line(*pts[0], *pts[1], cd, t=2); s.line(*pts[1], *pts[2], cd, t=2)
    s.stroke([(10, 17), (6, 13), (5, 9)], 1.6, 1.4, c)
    s.stroke([(22, 17), (26, 13), (27, 9)], 1.6, 1.4, c)
    s.ell(5, 6.5, 4, 3.6, c); s.ell(27, 6.5, 4, 3.6, c)
    s.poly([(2, 3), (5, 6), (3, 8)], C("#1a1418")); s.poly([(30, 3), (27, 6), (29, 8)], C("#1a1418"))
    s.ell(16, 19.5, 9.4, 6, c)
    s.ell(16, 18, 5.6, 2.6, lt, on=True)
    for x, y in [(11, 20), (21, 20), (16, 22)]:
        s.px(x, y, cd, on=True)
    s.line(13, 15, 12.5, 12, C("#e8dcd0")); s.line(19, 15, 19.5, 12, C("#e8dcd0"))
    s.eye(12, 11); s.eye(19, 11)
    return s.finish()


def estrella_mar():
    s = Sprite()
    c, lt, cd = C("#f2803a"), C("#ffc080"), C("#c85a1c")
    cx, cy = 16, 17
    for k in range(5):
        a = math.radians(-90 + 72 * k)
        x, y = cx + 14 * math.cos(a), cy + 14 * math.sin(a)
        s.stroke([(cx, cy), (x, y)], 4.2, 1.0, c)
    s.ell(cx, cy, 4.8, 4.8, c)
    for k in range(5):
        a = math.radians(-90 + 72 * k)
        for r in (4, 7, 10):
            s.px(cx + r * math.cos(a), cy + r * math.sin(a), lt, on=True)
    s.px(cx, cy, cd, on=True)
    return s.finish()


def caballito_mar():
    s = Sprite()
    c, cd, lt = C("#f2b030"), C("#d07a1c"), C("#fff0a0")
    s.stroke([(14, 22), (17, 27), (23, 27), (24, 22), (21, 22)], 2.4, .9, c)
    s.stroke([(15, 8), (10, 14), (12, 21)], 3.8, 3.4, c)
    for x, y in [(11, 12), (10, 15), (11, 18), (12, 21)]:
        s.px(x, y, cd, on=True)
    s.px(14, 13, lt, on=True); s.px(14, 16, lt, on=True); s.px(15, 19, lt, on=True)
    s.ell(7.5, 15, 1.4, 3.2, lt, ang=15)
    s.ell(17, 6.5, 3.6, 3.2, c)
    s.stroke([(19, 7), (27, 9)], 1.3, 1.3, c)
    s.poly([(14, 4), (15, 0.8), (17, 3)], cd); s.poly([(16, 3.4), (18, 1), (19, 4)], cd)
    s.eye(18, 5.5)
    return s.finish()


def mantarraya():
    s = Sprite()
    c, cd, lt = C("#4e6e92"), C("#34506e"), C("#9ab8d8")
    s.stroke([(16, 21), (16, 30)], 1.5, .8, cd)
    s.ell(8.5, 17, 9, 4.6, c, ang=-14); s.ell(23.5, 17, 9, 4.6, c, ang=14)
    s.ell(16, 15, 5.4, 7.4, c)
    s.ell(12.5, 6.8, 1.6, 2, c, ang=20); s.ell(19.5, 6.8, 1.6, 2, c, ang=-20)
    for x, y in [(7, 17), (11, 15), (21, 15), (25, 17), (16, 18), (13, 20), (19, 20), (4, 15), (28, 15)]:
        s.px(x, y, lt, on=True)
    s.eye(13.5, 10); s.eye(18.5, 10)
    return s.finish()


def langosta():
    s = Sprite()
    c, cd, lt = C("#d8402a"), C("#9a2a1a"), C("#f08060")
    s.stroke([(24, 14), (28, 8), (31, 3)], .9, .8, cd)
    s.stroke([(24, 15), (29, 12), (31, 11)], .9, .8, cd)
    for pts in ([(15, 22), (13, 26), (12, 29)], [(18, 22), (17, 26), (17, 29)], [(21, 22), (21, 26), (22, 29)]):
        s.line(*pts[0], *pts[1], cd, t=2); s.line(*pts[1], *pts[2], cd, t=2)
    s.poly([(4, 20), (0, 15), (0, 25)], c)
    s.poly([(4, 20), (0, 20), (1, 27)], cd)
    for x, rx, ry in ((6.5, 2.6, 3.4), (9.5, 2.8, 3.8), (13, 3, 4.2)):
        s.ell(x, 19, rx, ry, c)
        s.line(x + 1.5, 16, x + 1.5, 22, cd, on=True)
    s.ell(19.5, 17, 6, 4.8, c)
    s.ell(19, 15, 3.4, 1.6, lt, on=True)
    s.stroke([(24, 19), (28, 22)], 1.8, 1.6, c)
    s.ell(29, 24.5, 2.6, 2, c)
    s.line(27, 24, 30.5, 25, C("#1a1418"))
    s.eye(24, 15)
    return s.finish()
