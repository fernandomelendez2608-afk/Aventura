import math
from engine import *
from herp_sea import bez


def abeja():
    s = Sprite()
    y, k, w = C("#f4c030"), C("#2a2018"), C("#cfe6f6")
    s.ell(10, 10, 5.4, 2.8, w, ang=-35); s.ell(16.5, 8.5, 5.6, 2.6, w, ang=-12)
    s.line(9, 12, 13, 8, C("#ffffff"), on=True); s.line(12, 10, 19, 8, C("#ffffff"), on=True)
    for pts in ([(15, 23), (14, 27), (13, 29)], [(18, 23), (19, 27), (21, 29)], [(12, 22), (9, 26), (8, 29)]):
        s.line(*pts[0], *pts[1], k); s.line(*pts[1], *pts[2], k)
    s.poly([(4, 20), (0, 22), (4, 23)], k)
    s.ell(10, 19.5, 6.8, 4.8, y)
    for x in (7, 11):
        s.rect(x, 15, x + 1, 24, k, on=True)
    s.ell(17.5, 18.5, 4, 4, C("#8a6a30"))
    s.ell(22.5, 18.5, 3, 2.8, k)
    s.line(23, 15.5, 26, 11, k); s.line(25, 16, 29, 13, k)
    s.ell(23.5, 17.5, 1.3, 1.3, C("#f4f4f4"))
    s.eye(23, 17)
    return s.finish()


def mariposa():
    s = Sprite()
    o, k, w = C("#f08a1c"), C("#1a1418"), C("#f8f4ec")
    for (cx, cy, rx, ry, ang) in ((8.5, 10, 8, 6.4, -28), (23.5, 10, 8, 6.4, 28), (10, 21, 6, 5.4, 28), (22, 21, 6, 5.4, -28)):
        s.ell(cx, cy, rx, ry, k, ang=ang)
    for (cx, cy, rx, ry, ang) in ((9, 10.5, 6.2, 4.6, -28), (23, 10.5, 6.2, 4.6, 28), (10.2, 21, 4.4, 3.6, 28), (21.8, 21, 4.4, 3.6, -28)):
        s.ell(cx, cy, rx, ry, o, ang=ang, on=True)
    for (x0, y0, x1, y1) in ((15, 15, 4, 8), (15, 15, 3, 12), (17, 15, 28, 8), (17, 15, 29, 12), (15, 18, 9, 22), (17, 18, 23, 22)):
        s.line(x0, y0, x1, y1, k, on=True)
    for x, y in [(2, 9), (3, 14), (5, 5), (29, 9), (28, 14), (26, 5), (6, 25), (26, 25), (8, 27), (24, 27)]:
        s.px(x, y, w, on=True)
    s.stroke([(16, 8), (16, 27)], 1.3, 1.1, k)
    s.line(15, 8, 11, 2, k); s.line(17, 8, 21, 2, k)
    s.px(11, 1.5, k); s.px(21, 1.5, k)
    return s.finish()


def mariquita():
    s = Sprite()
    r, k = C("#e02a22"), C("#1a1418")
    for yy in (13, 18, 23):
        s.line(8, yy, 2, yy + 2, k, t=1); s.line(24, yy, 30, yy + 2, k, t=1)
    s.line(13, 6, 10, 2, k); s.line(19, 6, 22, 2, k)
    s.ell(16, 8.5, 4.4, 3, k)
    s.ell(16, 19, 9.8, 10.2, r)
    s.line(16, 10, 16, 29, k, on=True)
    for x, y, rr in [(11, 14, 1.8), (21, 14, 1.8), (9, 20, 1.8), (23, 20, 1.8), (12, 25, 1.6), (20, 25, 1.6)]:
        s.ell(x, y, rr, rr, k, on=True)
    s.ell(13, 12, 2, 1.2, C("#ff7a6a"), ang=-30, on=True)
    s.dot(14, 7, "#f4f4f4"); s.dot(18, 7, "#f4f4f4")
    return s.finish()


def hormiga():
    s = Sprite()
    c, cd = C("#7a2a18"), C("#4a1a10")
    for pts in ([(16, 20), (18, 25), (21, 28)], [(15, 20), (13, 25), (11, 28)], [(17, 20), (22, 23), (26, 27)],
                [(14, 20), (9, 24), (5, 27)], [(16, 20), (15, 26), (16, 29)], [(18, 20), (24, 26), (27, 29)]):
        s.line(*pts[0], *pts[1], cd, t=2); s.line(*pts[1], *pts[2], cd, t=1)
    s.ell(8.5, 18.5, 6, 4.6, c)
    s.ell(8.5, 17, 3.2, 1.6, C("#a8482a"), on=True)
    s.ell(16, 18, 3.4, 2.8, c)
    s.ell(23, 16, 3.6, 3.2, c)
    s.poly([(25.5, 17.5), (28, 20), (26, 20)], cd)
    s.line(24, 13.5, 27, 8, cd); s.line(27, 8, 30, 9, cd)
    s.line(22, 13.5, 22, 8, cd); s.line(22, 8, 25, 6, cd)
    s.eye(24, 15)
    s.dot(24, 15, "#f4e8d0")
    return s.finish()


def libelula():
    s = Sprite()
    bl, bd, w, wv = C("#2a8ad8"), C("#1a5aa0"), C("#d4ecf8"), C("#8ac0e0")
    s.ell(15, 9.5, 6, 2.2, w, ang=-14); s.ell(12.5, 12, 6, 2, w, ang=-6)
    s.line(10, 10.5, 19, 8, wv, on=True)
    s.ell(15, 22.5, 6, 2.2, w, ang=14); s.ell(12.5, 20, 6, 2, w, ang=6)
    s.line(10, 21.5, 19, 24, wv, on=True)
    s.stroke([(19, 16), (11, 16), (1, 15.5)], 2.0, 1.2, bl)
    for x in (3, 6, 9, 12, 15):
        s.px(x, 16, bd, on=True); s.px(x, 15, bd, on=True)
    s.ell(20, 15.5, 3.2, 3, bl)
    s.ell(25.5, 15, 3.4, 3.2, C("#2ab898"))
    s.eye(26.5, 14, 2)
    s.dot(26.5, 14, "#ffffff")
    return s.finish()

def arana():
    s = Sprite()
    c, cd, lt = C("#4a3030"), C("#2a1c1c"), C("#c8a070")
    legs = [
        [(13, 14), (8, 8), (3, 10), (2, 15)], [(13, 15), (6, 13), (2, 17), (2, 22)],
        [(13, 17), (6, 18), (3, 23), (4, 28)], [(13, 18), (8, 23), (7, 28), (8, 30)],
        [(19, 14), (24, 8), (29, 10), (30, 15)], [(19, 15), (26, 13), (30, 17), (30, 22)],
        [(19, 17), (26, 18), (29, 23), (28, 28)], [(19, 18), (24, 23), (25, 28), (24, 30)],
    ]
    for pts in legs:
        for a, b in zip(pts, pts[1:]):
            s.line(a[0], a[1], b[0], b[1], cd)
    s.ell(16, 14.5, 3.6, 3.2, c)
    s.ell(16, 21.5, 5.2, 5.8, c)
    s.ell(16, 21, 2.6, 4, lt, on=True)
    s.line(16, 18, 16, 25, cd, on=True); s.line(14, 21, 18, 21, cd, on=True)
    s.dot(14.5, 13.5, "#f4f4f4"); s.dot(17.5, 13.5, "#f4f4f4")
    s.dot(15.5, 15.5, "#d8283a"); s.dot(16.5, 15.5, "#d8283a")
    return s.finish()


def escorpion():
    s = Sprite()
    c, cd, cl, st = C("#6a4a2a"), C("#3e2a16"), C("#b8782e"), C("#d8b050")
    for x in (12, 16, 20, 24):
        s.line(x, 24, x - 2, 28, cd); s.line(x - 2, 28, x - 3, 29.5, cd)
    s.stroke([(9, 23), (2, 20), (2, 10), (9, 5), (15, 8)], 2.4, 1.5, c)
    s.poly([(13.5, 9.5), (16.5, 5.5), (18.5, 10.5)], st)
    s.ell(14, 23, 5, 3, c)
    s.ell(9.5, 23.3, 3.4, 2.4, c)
    s.ell(21, 21.5, 5, 3.6, c)
    for x in (12, 15, 18):
        s.line(x, 20.5, x, 25, cd, on=True)
    s.stroke([(24, 20), (27, 19)], 1.6, 1.4, cl)
    s.ell(28.8, 17.6, 2.6, 2.2, cl)
    s.ell(29.2, 21.2, 2.2, 1.4, cl)
    s.px(30, 19.4, C("#14121a"), on=True); s.px(29, 19.4, C("#14121a"), on=True)
    s.eye(23, 20)
    s.dot(23, 20, "#f4d020")
    return s.finish()

def caracol():
    s = Sprite()
    c, cl, cd, b, bl = C("#c9803a"), C("#e8a860"), C("#8a4a1c"), C("#9aa87a"), C("#c2cc9a")
    s.stroke([(3, 26), (14, 27), (24, 25)], 2.6, 2.4, b)
    s.stroke([(22, 26), (27, 22), (27, 17)], 2.6, 2.2, b)
    s.line(27, 17, 25, 11, b); s.line(29, 18, 31, 12, b)
    s.px(25, 10.5, C("#14121a")); s.px(31, 11.5, C("#14121a"))
    s.ell(12, 16, 9, 9, c)
    s.ell(12, 16, 6, 6, cl, on=True)
    s.ell(12, 16, 3.4, 3.4, c, on=True)
    s.ell(12, 16, 1.2, 1.2, cd, on=True)
    s.ell(8.5, 11, 3, 1.6, C("#fff0d0"), ang=-30, on=True)
    s.ell(15, 26.2, 7, 1, bl, on=True)
    s.eye(27, 18)
    return s.finish()


def saltamontes():
    s = Sprite()
    g, gd, lt = C("#6ab83a"), C("#3e8a2a"), C("#b0e070")
    s.stroke([(24, 14), (28, 8), (31, 4)], .8, .8, gd)
    s.stroke([(24, 15), (29, 11), (31, 9)], .8, .8, gd)
    s.line(18, 19, 20, 24, gd); s.line(20, 24, 22, 29, gd)
    s.line(15, 19, 14, 24, gd); s.line(14, 24, 13, 29, gd)
    s.stroke([(14, 17), (8, 12)], 2.2, 1.8, g)
    s.stroke([(8, 12), (4, 22), (3, 28)], 1.3, .8, gd)
    s.rect(2, 29, 5, 29, gd)
    s.stroke([(4, 20), (10, 18), (16, 16.5)], 1.8, 2.4, g)
    s.ell(10, 15, 8, 2, C("#8a9a4a"), ang=-12)
    s.ell(17.5, 16.5, 3.2, 2.8, g)
    s.ell(23, 15, 3.4, 3.2, g)
    s.ell(24, 13.5, 1.8, 1.8, lt)
    s.eye(24, 13)
    return s.finish()


def escarabajo():
    s = Sprite()
    c, cd, hl = C("#5a3220"), C("#3a1e12"), C("#9a6a46")
    for pts in ([(8, 25), (5, 28), (3, 29)], [(14, 26), (13, 29)], [(20, 25), (23, 28), (25, 29)]):
        for a, b in zip(pts, pts[1:]):
            s.line(a[0], a[1], b[0], b[1], cd, t=2)
    s.ell(14, 20.5, 10, 6.6, c)
    s.rect(4, 22, 24, 26, c, on=True)
    s.ell(12, 16.5, 5, 1.8, hl, ang=-8, on=True)
    s.line(14, 14.5, 14, 25, cd, on=True)
    s.ell(24, 20.5, 3.2, 3.2, cd)
    s.stroke([(24, 18.5), (27.5, 12), (24, 7)], 2.2, 1.0, cd)
    s.stroke([(26, 19), (29, 16)], 1.2, 1, cd)
    s.eye(25, 20)
    s.dot(25, 20, "#e8d8a0")
    return s.finish()
