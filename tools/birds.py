import math
from engine import *


def _legs(s, xs, y0, col, toe=3):
    for x in xs:
        s.line(x, y0, x, GY - 1, C(col))
        s.rect(x, GY, x + toe - 1, GY, C(col))


def _branch(s, y=28, x0=3, x1=28, col="#6a4a2c"):
    s.rect(x0, y, x1, y + 1, C(col))


def gallina():
    s = Sprite()
    c, cd, lt = C("#c98a4a"), C("#8a5428"), C("#e8b878")
    _legs(s, [12, 17], 25, "#e8b030")
    s.ell(6.5, 16, 2.4, 5.6, cd, ang=35); s.ell(8.5, 15.5, 2, 5, c, ang=20)
    s.ell(14, 21, 8.5, 6, c)
    s.ell(15, 23, 5, 3, lt, on=True)
    s.stroke([(18, 18), (21, 14)], 2.4, 2.2, c)
    s.ell(22, 12, 3.4, 3.4, c)
    s.poly([(20, 9.5), (20.5, 6), (22, 8), (23, 5.5), (24, 9)], C("#d8283a"))
    s.ell(25, 15.5, 1, 1.8, C("#d8283a"))
    s.poly([(24.5, 11.2), (28.5, 12.4), (24.5, 13.8)], C("#f0b030"))
    s.ell(13, 21, 5.2, 3.6, cd, ang=-8)
    s.eye(23, 11)
    return s.finish()


def gallo():
    s = Sprite()
    c, cd, gold = C("#b8421e"), C("#6a1e12"), C("#e8a02a")
    _legs(s, [12, 17], 25, "#e8b030")
    s.stroke([(8, 19), (2, 14), (3, 6), (9, 3)], 1.8, 1.4, C("#1e5a3a"))
    s.stroke([(8, 20), (3, 17), (5, 10), (10, 8)], 1.6, 1.2, C("#2a7a4a"))
    s.stroke([(8, 18), (4, 12), (5, 8)], 1.2, 1, C("#d8283a"))
    s.ell(14, 21, 8.5, 6, c)
    s.ell(14, 22, 5.5, 3.5, C("#d8782a"), on=True)
    s.stroke([(18, 17), (21, 12)], 2.8, 2.4, gold)
    s.ell(22, 11, 3.5, 3.5, c)
    s.ell(19.5, 13, 2.4, 3, gold)
    s.poly([(19.5, 8.5), (20, 3.5), (21.5, 6), (23, 3), (24, 8.5)], C("#d8283a"))
    s.ell(25, 14.8, 1.2, 2, C("#d8283a"))
    s.poly([(24.8, 10.2), (28.8, 11.4), (24.8, 12.8)], C("#f0b030"))
    s.ell(13, 21, 5.2, 3.6, cd, ang=-8)
    s.eye(23, 10)
    return s.finish()


def pato():
    s = Sprite()
    c, cd, br, gr = C("#a8a49c"), C("#7a766e"), C("#8a4a2a"), C("#1e8a4a")
    for x in (12, 17):
        s.line(x, 26, x, GY - 1, C("#f08a2a"))
        s.rect(x, GY, x + 3, GY, C("#f08a2a"))
    s.poly([(7, 20), (2, 15), (3, 20), (7, 24)], cd)
    s.ell(14, 21, 9, 5.2, c)
    s.ell(20.5, 20, 4.2, 4.5, br)
    s.stroke([(21, 17), (23, 13)], 2.6, 2.4, gr)
    s.rect(20, 17, 23, 17, C("#f4f4f2"))
    s.ell(23, 12.5, 3.4, 3.2, gr)
    s.poly([(25.5, 12.8), (30.5, 13.8), (30, 15.5), (25.5, 15.6)], C("#f0c030"))
    s.ell(12, 21, 5, 3, cd, ang=-5)
    s.rect(9, 20, 15, 20, C("#3a5a9a"), on=True)
    s.eye(24, 11)
    return s.finish()


def cisne():
    s = Sprite()
    w, wd = C("#f6f6f4"), C("#c8ccd4")
    s.line(10, 28, 10, 29, C("#2a2a30")); s.line(16, 28, 16, 29, C("#2a2a30"))
    s.poly([(5, 22), (1, 15), (4, 17), (8, 18)], wd)
    s.ell(13, 23, 9.5, 5, w)
    s.ell(11.5, 20, 6, 4, wd, ang=-12)
    s.stroke([(19, 21), (25, 19), (21, 11), (24.5, 7)], 1.9, 1.7, w)
    s.ell(25, 7, 2.5, 2.2, w)
    s.poly([(26.5, 6.4), (30.5, 8), (26.5, 9)], C("#f08a2a"))
    s.rect(26, 6, 26, 8, C("#14121a"))
    s.eye(25, 6)
    return s.finish()


def pavo():
    s = Sprite()
    c, cd, lt = C("#7a4a28"), C("#4a2c18"), C("#c9a070")
    _legs(s, [14, 19], 26, "#d87a6a")
    s.ell(10, 14, 9, 10.5, cd)
    for a in range(-150, -20, 14):
        x = 10 + 9 * math.cos(math.radians(a)); y = 17 + 10 * math.sin(math.radians(a))
        s.line(10, 17, x, y, lt, on=True)
    s.ell(15, 22, 7.5, 5.5, c)
    s.ell(15, 22, 5, 3, lt, on=True)
    s.stroke([(19, 18), (22, 13)], 2.2, 1.8, C("#4a8ac8"))
    s.ell(23, 11, 2.4, 2.4, C("#4a8ac8"))
    s.ell(22, 15.5, 1, 2.2, C("#d8283a"))
    s.poly([(24.5, 10.5), (27.5, 11.5), (24.5, 12.5)], C("#d8a02a"))
    s.eye(23, 10)
    return s.finish()


def paloma():
    s = Sprite()
    c, cd, lt = C("#8a94a8"), C("#5a647a"), C("#b8c0d0")
    _legs(s, [13, 17], 24, "#e07a8a")
    s.poly([(8, 20), (1, 25), (3, 28), (10, 24)], cd)
    s.ell(15, 20, 8, 5.4, c, ang=-14)
    s.ell(21.5, 14.5, 3.2, 3.2, c)
    s.stroke([(19, 18), (21, 15)], 2.6, 2.4, C("#4a9a8a"))
    s.ell(14, 20, 5.5, 3.2, cd, ang=-10)
    s.line(10, 19, 15, 18, C("#14121a"), on=True); s.line(9, 21, 14, 20, C("#14121a"), on=True)
    s.poly([(23.5, 13.5), (27, 14.5), (23.5, 15.5)], C("#d8c0b0"))
    s.eye(22, 13)
    s.dot(22, 13, "#f0a020")
    return s.finish()


def cuervo():
    s = Sprite()
    c, cd, sh = C("#26242e"), C("#14121a"), C("#4a4a6a")
    _legs(s, [13, 17], 24, "#3a3640")
    s.poly([(8, 20), (1, 26), (3, 29), (10, 24)], cd)
    s.ell(15, 20, 8, 5.6, c, ang=-14)
    s.ell(21.5, 14, 3.6, 3.4, c)
    s.ell(14, 19.5, 5.5, 3.2, sh, ang=-10, on=True)
    s.poly([(23.5, 12), (30.5, 14.2), (23.5, 16)], C("#14121a"))
    s.eye(22, 12)
    s.dot(22, 12, "#e8e8f0")
    return s.finish()


def buho():
    s = Sprite()
    c, cd, lt = C("#9a6a3a"), C("#6a4424"), C("#e4cfa8")
    s.rect(2, 29, 29, 30, C("#5a3e24"))
    s.ell(16, 20, 8.6, 9.6, c)
    s.ell(16, 22, 5.5, 6.6, lt, on=True)
    for x, y in [(14, 19), (18, 19), (12, 22), (16, 22), (20, 22), (14, 25), (18, 25)]:
        s.px(x, y, cd, on=True)
    s.ell(7.2, 20, 2.6, 7.2, cd, ang=8); s.ell(24.8, 20, 2.6, 7.2, cd, ang=-8)
    s.poly([(7, 11), (8, 3), (12, 8)], c); s.poly([(25, 11), (24, 3), (20, 8)], c)
    s.ell(16, 12.5, 8.3, 6.6, c)
    s.ell(11.8, 12.5, 4.2, 4.2, lt); s.ell(20.2, 12.5, 4.2, 4.2, lt)
    s.ell(11.8, 12.5, 2.8, 2.8, C("#f4c430")); s.ell(20.2, 12.5, 2.8, 2.8, C("#f4c430"))
    s.poly([(14.6, 13), (17.4, 13), (16, 17)], C("#f08a2a"))
    s.eye(11, 12, 2); s.eye(20, 12, 2)
    s.dot(11, 12, "#ffffff"); s.dot(20, 12, "#ffffff")
    s.rect(11, 28, 13, 29, C("#e8b030")); s.rect(19, 28, 21, 29, C("#e8b030"))
    return s.finish()


def aguila():
    s = Sprite()
    c, cd, w = C("#6a4424"), C("#3e2614"), C("#f6f6f2")
    _branch(s, 28, 4, 27)
    s.poly([(9, 25), (15, 25), (16, 30), (10, 30)], w)
    s.ell(14, 19, 6.4, 8.8, c)
    s.ell(15.5, 21, 3.4, 5.4, C("#8a5c34"), on=True)
    s.ell(11.5, 19.5, 3.6, 7.6, cd, ang=4)
    s.ell(17, 9.5, 4, 3.8, w)
    s.stroke([(15, 15), (16.5, 11)], 3, 2.6, w)
    s.poly([(19.5, 8), (24.5, 9), (24, 12), (21.5, 11.5), (19.5, 12)], C("#f0c030"))
    s.rect(15, 8, 18, 8, C("#d8c8a0"), on=True)
    s.rect(14, 27, 17, 28, C("#f0c030"))
    s.eye(18, 9)
    s.dot(18, 9, "#14121a")
    return s.finish()


def condor():
    s = Sprite()
    c, cd, w = C("#26242c"), C("#14121a"), C("#f0f0f0")
    _branch(s, 28, 4, 27)
    s.poly([(9, 25), (15, 25), (16, 30), (10, 30)], cd)
    s.ell(14, 19, 6.8, 9, c)
    s.ell(11.5, 19.5, 3.8, 7.6, cd, ang=4)
    s.poly([(9, 14), (13, 16), (13, 21), (9, 22)], w, on=True)
    s.ell(17, 13.5, 5, 2.4, w)
    s.stroke([(15, 14), (17, 10.5)], 2.8, 2.5, C("#b8807a"))
    s.ell(17, 9, 3.2, 3.4, C("#b8807a"))
    s.ell(16, 5.8, 2.1, 1.6, C("#9a2a2a"))
    s.poly([(19.5, 8), (24.5, 9.5), (23.5, 12.5), (21, 11.5), (19.5, 12)], C("#e8e0cc"))
    s.rect(14, 27, 17, 28, C("#8a7a6a"))
    s.eye(18, 8.5)
    return s.finish()


def guacamayo():
    s = Sprite()
    r, bl, ye = C("#d8281e"), C("#2a6ad8"), C("#f4c430")
    _branch(s, 27, 4, 27)
    s.poly([(10, 22), (4, 31), (8, 31), (14, 24)], bl)
    s.poly([(11, 22), (7, 30), (9, 30), (13, 23)], r)
    s.ell(14, 17, 5.2, 7.6, r, ang=8)
    s.ell(12.5, 17, 3.2, 6.6, bl, ang=8)
    s.ell(12, 13, 2.3, 2.8, ye, ang=8)
    s.ell(18, 8.5, 4.2, 3.9, r)
    s.ell(20, 9.5, 2.3, 2.3, C("#f6f6f2"))
    s.poly([(21, 5.5), (27.5, 8), (26, 13), (23, 14), (22.5, 10)], C("#f0e6d0"))
    s.poly([(22.5, 10), (26, 13), (23, 14.5)], C("#2a2630"))
    s.rect(15, 25, 17, 26, C("#6a6a72"))
    s.eye(20, 8)
    return s.finish()


def tucan():
    s = Sprite()
    c, cd = C("#1e1c26"), C("#0e0c14")
    _branch(s, 27, 4, 27)
    s.poly([(10, 22), (6, 29), (12, 29), (14, 24)], cd)
    s.rect(8, 25, 11, 26, C("#d8283a"), on=True)
    s.ell(14, 18.5, 5.4, 7.6, c, ang=8)
    s.ell(18, 14.5, 3.4, 3.4, C("#f6e04a"))
    s.ell(17, 10.5, 4.6, 4.2, c)
    s.ell(18.5, 9.8, 1.9, 1.9, C("#4a9ae8"))
    s.poly([(20.5, 8), (31, 10.8), (30.5, 15.2), (21, 14)], C("#f09a1a"))
    s.poly([(20.5, 8), (31, 10.8), (30.2, 12.4), (21, 10.5)], C("#f6d020"))
    s.rect(29, 11, 31, 15, C("#d8283a"), on=True)
    s.line(21, 13.6, 30, 14.8, C("#1e1c26"), on=True)
    s.rect(15, 25, 17, 26, C("#6a8aa8"))
    s.eye(18.5, 9.5)
    return s.finish()


def flamenco():
    s = Sprite()
    p, pd, pl = C("#f07a98"), C("#d85478"), C("#f8a8bc")
    leg = C("#e0607a")
    s.line(14, 17, 14, GY - 1, leg); s.rect(14, GY, 17, GY, leg)
    s.line(11, 17, 11, 21, leg); s.line(11, 21, 15, 22, leg)
    s.poly([(7, 13), (2, 9), (3, 14), (7, 17)], pl)
    s.ell(13, 13.5, 7.5, 4.6, p)
    s.poly([(7, 14), (12, 16), (16, 17), (11, 18)], C("#1e1c26"), on=True)
    s.ell(12, 13, 4.6, 2.6, pd, ang=-8, on=True)
    s.stroke([(18, 11), (25, 10), (22, 4), (26, 3)], 1.4, 1.4, p)
    s.ell(26, 3.4, 2.2, 1.9, p)
    s.poly([(27, 2.4), (31, 5), (28, 6.4), (27, 5)], C("#f6e0e0"))
    s.poly([(29, 4), (31, 5), (28, 6.4)], C("#1e1c26"))
    s.eye(26, 2.6)
    return s.finish()


def pinguino():
    s = Sprite()
    k, w = C("#24242e"), C("#f6f6f4")
    s.ell(11.5, 29, 3.4, 1.4, C("#f09a2a")); s.ell(20.5, 29, 3.4, 1.4, C("#f09a2a"))
    s.ell(16, 19.5, 7.8, 10, k)
    s.ell(16, 20.8, 5.2, 8.2, w)
    s.ell(8.3, 19.5, 2.4, 6.4, k, ang=12); s.ell(23.7, 19.5, 2.4, 6.4, k, ang=-12)
    s.ell(16, 9.5, 5.4, 5, k)
    s.ell(12.2, 12.5, 1.5, 2.6, C("#f4b830")); s.ell(19.8, 12.5, 1.5, 2.6, C("#f4b830"))
    s.poly([(14, 11.5), (18, 11.5), (16, 15.5)], C("#f09a2a"))
    s.eye(13, 9); s.eye(19, 9)
    s.dot(13, 8, "#ffffff"); s.dot(19, 8, "#ffffff")
    return s.finish()


def colibri():
    s = Sprite()
    g, gd, lt = C("#2eaa6a"), C("#1c7a4a"), C("#bfe0f4")
    s.ell(10, 9, 2.2, 6.4, lt, ang=-35); s.ell(15, 7.5, 2, 6, lt, ang=-10)
    s.poly([(10, 19), (3, 26), (6, 29), (12, 23)], gd)
    s.ell(14, 17, 5.2, 3.4, g, ang=-32)
    s.ell(15.5, 19, 3, 2, C("#f4f0e4"), ang=-32, on=True)
    s.ell(19.5, 13.5, 3, 2.8, g)
    s.ell(19.5, 16, 1.8, 1.4, C("#e0283a"))
    s.line(22, 13.5, 30, 16.5, C("#24202c"))
    s.eye(20, 12.5)
    return s.finish()


def pavo_real():
    s = Sprite()
    gr, grd = C("#2a8a5a"), C("#1c5a3e")
    s.ell(13, 16, 13, 11.5, grd)
    for a in range(-160, -15, 16):
        x = 13 + 9.5 * math.cos(math.radians(a)); y = 20 + 10.5 * math.sin(math.radians(a))
        s.ell(x, y, 1.7, 2, C("#d8b030")); s.ell(x, y, .9, 1.1, C("#2a6ad8"))
    s.ell(18, 23, 5.8, 4.6, C("#2a5ad8"))
    s.ell(18, 24, 3.4, 2.8, C("#4a8af0"), on=True)
    s.stroke([(21, 20), (24, 14), (24, 11)], 1.9, 1.5, C("#2a6ad8"))
    s.ell(24, 10, 2.2, 2, C("#2a6ad8"))
    for x, y in [(23, 6), (24.5, 5), (26, 6)]:
        s.line(24, 8, x, y, C("#2a3a9a")); s.px(x, y - 1, C("#2a9ad8"))
    s.poly([(25.5, 9.5), (28.5, 10.5), (25.5, 11.5)], C("#d8c8a0"))
    s.rect(15, 27, 15, GY - 1, C("#8a7a6a")); s.rect(20, 27, 20, GY - 1, C("#8a7a6a"))
    s.rect(15, GY, 17, GY, C("#8a7a6a")); s.rect(20, GY, 22, GY, C("#8a7a6a"))
    s.eye(24.5, 9)
    return s.finish()


def gaviota():
    s = Sprite()
    w, g, gd = C("#f6f6f4"), C("#9aa4b4"), C("#6a7488")
    _legs(s, [13, 17], 24, "#f08a2a")
    s.poly([(7, 19), (1, 22), (3, 24), (9, 23)], w)
    s.ell(14, 19.5, 8.4, 4.8, w, ang=-8)
    s.ell(13, 18, 6.6, 3.2, g, ang=-6)
    s.poly([(7, 17.5), (2, 20), (4, 21.5), (8, 20)], C("#26242e"))
    s.ell(21.5, 13.5, 3.4, 3.2, w)
    s.stroke([(19, 17), (21, 14)], 2.6, 2.3, w)
    s.poly([(23.5, 12.5), (28.5, 13.8), (28, 15.4), (23.5, 15)], C("#f0c030"))
    s.px(28, 15, C("#d8283a"))
    s.eye(22.5, 12)
    return s.finish()


def pelicano():
    s = Sprite()
    w, wd = C("#f2f0ea"), C("#c8c4bc")
    _legs(s, [12, 16], 24, "#f0a050")
    s.poly([(6, 19), (1, 23), (3, 26), (8, 23)], wd)
    s.ell(13, 19, 8.6, 5.6, w, ang=-6)
    s.ell(12, 18.5, 5.6, 3.4, wd, ang=-6, on=True)
    s.stroke([(18, 17), (22, 14), (21, 10)], 2.2, 2.0, w)
    s.ell(21, 9, 3, 2.8, w)
    s.ell(25.5, 14, 5.8, 2.4, C("#f0a050"), ang=12)
    s.poly([(22.5, 8.8), (31, 12.8), (30.5, 13.6), (22.5, 12)], C("#f6d060"))
    s.eye(21.5, 8)
    return s.finish()


def avestruz():
    s = Sprite()
    k, w, nk = C("#26242c"), C("#f6f6f2"), C("#d8a0a0")
    s.rect(11, 20, 12, GY - 1, nk); s.rect(11, GY, 14, GY, nk)
    s.rect(16, 20, 17, GY - 1, nk); s.rect(16, GY, 19, GY, nk)
    s.stroke([(7, 15), (3, 13), (2, 18)], 2.4, 1.8, w)
    s.ell(13, 15, 8, 6, k)
    s.ell(8, 12, 4.4, 3.4, w, ang=-20)
    s.stroke([(19, 12), (22, 6), (23, 3)], 1.5, 1.3, nk)
    s.ell(23.5, 2.6, 2.1, 1.7, nk)
    s.poly([(25, 2), (28.5, 3), (25, 4)], C("#e0b8a0"))
    s.eye(24, 2)
    return s.finish()


def piquero():
    s = Sprite()
    br, brd, w, bl = C("#7a5a3e"), C("#5a3e28"), C("#f4f0e6"), C("#2a8ae0")
    s.ell(10.5, 28, 4.2, 1.6, bl); s.ell(19.5, 28, 4.2, 1.6, bl)
    s.rect(10, 25, 11, 27, bl); s.rect(19, 25, 20, 27, bl)
    s.poly([(7, 18), (1, 24), (4, 27), (10, 22)], brd)
    s.ell(14, 19, 8, 6, br, ang=-14)
    s.ell(16, 21, 5.5, 3.6, w, ang=-14, on=True)
    s.ell(13, 18, 5, 3.2, brd, ang=-10, on=True)
    s.ell(21, 12.5, 3.6, 3.2, w)
    s.stroke([(18, 16), (20, 14)], 2.6, 2.4, w)
    s.poly([(23.5, 11.5), (31, 13.6), (23.5, 14)], C("#7aa0b8"))
    s.ell(22, 11.5, 1.8, 1.4, C("#3a4a6a"))
    s.eye(22, 11)
    s.dot(22, 11, "#f6e04a")
    return s.finish()


def canario():
    s = Sprite()
    y, yd, yl = C("#f6d82a"), C("#d8a818"), C("#fff0a0")
    s.rect(4, 27, 27, 28, C("#6a4a2c"))
    s.rect(12, 25, 12, 27, C("#e8a050")); s.rect(17, 25, 17, 27, C("#e8a050"))
    s.poly([(8, 20), (1, 26), (4, 28), (11, 24)], yd)
    s.ell(15, 19.5, 7, 6.6, y)
    s.ell(16.5, 22, 4, 3.4, yl, on=True)
    s.ell(19.5, 12.5, 4.6, 4.2, y)
    s.ell(13, 19, 4.4, 3.4, yd, ang=-10)
    s.poly([(23.5, 11.8), (27, 13), (23.5, 14.4)], C("#f08a2a"))
    s.eye(21.5, 11)
    return s.finish()
