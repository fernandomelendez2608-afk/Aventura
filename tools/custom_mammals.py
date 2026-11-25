import math
from engine import *


def koala():
    s = Sprite()
    g, gd, lt = C("#8f959e"), C("#6d737c"), C("#dde1e6")
    s.ell(16, 24, 6.8, 6, g)
    s.ell(8.5, 9, 4.2, 4.2, g); s.ell(23.5, 9, 4.2, 4.2, g)
    s.ell(8.5, 9, 2.3, 2.3, lt); s.ell(23.5, 9, 2.3, 2.3, lt)
    s.ell(16, 13.5, 7.5, 6.5, g)
    s.ell(16, 26, 4.2, 3.8, lt)
    s.ell(8, 23, 2.3, 4.2, gd, ang=12); s.ell(24, 23, 2.3, 4.2, gd, ang=-12)
    s.ell(11, 29, 3, 1.5, gd); s.ell(21, 29, 3, 1.5, gd)
    s.ell(16, 15, 2.3, 3, C("#26222c"))
    s.eye(10, 12, 1); s.eye(21, 12, 1)
    s.eye(10, 12, 1); s.dot(21, 12, "#14121c")
    return s.finish()


def canguro():
    s = Sprite()
    c, cd, lt = C("#c98f58"), C("#a8703c"), C("#ecd2a8")
    s.stroke([(9, 24), (4, 27), (1, 28)], 2.6, 1.0, cd)
    s.ell(14, 19, 5.2, 7.6, c, ang=-12)
    s.ell(15, 21, 3, 4.5, lt, on=True)
    s.ell(11, 24, 4.4, 4.6, cd)
    s.rect(11, 28, 18, 29, cd)
    s.poly([(18, 14), (23, 8), (24, 11), (20, 17)], c)
    s.ell(22, 8, 3, 2.7, c)
    s.ell(25.5, 9.8, 2.6, 1.6, c)
    s.poly([(19.5, 7), (19, 1), (21.8, 6)], cd)
    s.poly([(21.5, 6.5), (22.5, 1), (24, 6.8)], c)
    s.px(27.5, 9, C("#241812"))
    s.stroke([(18, 15), (21, 17.5)], 1.2, 1.0, cd)
    s.eye(23, 7)
    return s.finish()


def ardilla():
    s = Sprite()
    c, cd, lt = C("#c9702e"), C("#9a4a1c"), C("#f0d9b8")
    s.stroke([(9, 27), (2, 23), (3, 11), (9, 6)], 3.0, 4.6, cd)
    s.stroke([(9, 27), (3.5, 23), (4.5, 12), (8.5, 8)], 1.5, 2.6, c, on=True)
    s.ell(14, 22, 5.2, 6.5, c)
    s.ell(15.5, 23.5, 3, 4.5, lt, on=True)
    s.ell(19, 14, 3.9, 3.6, c)
    s.ell(22, 15.5, 2.2, 1.7, lt)
    s.poly([(16, 11), (16.5, 6.5), (19, 10.5)], c)
    s.poly([(19, 10.5), (20.5, 6.5), (22, 11)], cd)
    s.px(24, 14.5, C("#2a1a14"))
    s.rect(13, 28, 20, 29, cd)
    s.ell(19.5, 20, 2, 2.4, C("#8a5a2a"))
    s.rect(18.5, 17.8, 20.5, 18.6, C("#5a3a1a"))
    s.eye(21, 13)
    return s.finish()


def erizo():
    s = Sprite()
    sp, spl = C("#6a4a34"), C("#a8825c")
    cx, cy = 14, 21
    for i in range(0, 15):
        a = math.radians(188 + i * 12.5)
        x0, y0 = cx + 9.5 * math.cos(a), cy + 6.8 * math.sin(a)
        x1, y1 = cx + 13.2 * math.cos(a), cy + 10 * math.sin(a)
        s.line(x0, y0, x1, y1, sp, t=2)
    s.ell(cx, cy, 10, 7, sp)
    for x, y in [(9, 16), (13, 14), (17, 15), (20, 18), (11, 19), (16, 19), (7, 21)]:
        s.px(x, y, spl, on=True)
    s.ell(25, 23.5, 4.6, 3.6, C("#d9b88a"))
    s.poly([(27, 22), (31, 24.5), (27, 26)], C("#d9b88a"))
    s.px(30, 24, C("#1a1418"))
    s.eye(26, 22)
    s.rect(11, 27, 13, 29, C("#a8825c")); s.rect(20, 27, 22, 29, C("#a8825c"))
    return s.finish()


def murcielago():
    s = Sprite()
    w, wl, b = C("#5a4a6e"), C("#7a6a90"), C("#3e3250")
    s.poly([(14, 14), (6, 8), (1, 12), (2, 21), (5, 18), (8, 24), (11, 19), (14, 25)], w)
    s.poly([(18, 14), (26, 8), (31, 12), (30, 21), (27, 18), (24, 24), (21, 19), (18, 25)], w)
    for pts in ([(14, 15), (6, 14)], [(14, 17), (8, 21)], [(18, 15), (26, 14)], [(18, 17), (24, 21)]):
        s.line(*pts[0], *pts[1], wl, on=True)
    s.ell(16, 19, 3, 5.5, b)
    s.ell(16, 12.5, 3.4, 3.2, b)
    s.poly([(12.8, 11), (12, 5.5), (15, 9.5)], b)
    s.poly([(19.2, 11), (20, 5.5), (17, 9.5)], b)
    s.ell(16, 14, 1.5, 1.1, C("#7a6a90"))
    s.eye(14, 11); s.eye(18, 11)
    s.dot(14, 11, "#ffd24a"); s.dot(18, 11, "#ffd24a")
    s.dot(15, 15, "#f4f4f2"); s.dot(17, 15, "#f4f4f2")
    return s.finish()


def perezoso():
    s = Sprite()
    br, c, cd, lt = C("#6a4a2c"), C("#b49a76"), C("#8a7050"), C("#e4d4b4")
    s.rect(0, 5, 31, 7, br)
    s.line(5, 4, 7, 2, C("#4a7a3a"), t=2); s.line(24, 4, 27, 2, C("#4a7a3a"), t=2)
    s.stroke([(10, 13), (8, 9), (8, 7)], 1.6, 1.4, cd)
    s.stroke([(21, 13), (23, 9), (24, 7)], 1.6, 1.4, cd)
    s.ell(16, 16, 8.5, 5.5, c)
    s.ell(17, 18, 5, 3, lt, on=True)
    s.stroke([(10, 19), (9, 23), (9, 26)], 1.6, 1.3, cd)
    s.stroke([(21, 19), (22, 23), (22, 26)], 1.6, 1.3, cd)
    s.ell(24, 17.5, 3.8, 3.4, lt)
    s.rect(21, 16, 27, 17, C("#5a4630"), on=True)
    s.px(26, 19.5, C("#5a4630")); s.px(27, 19, C("#5a4630"))
    s.eye(23, 16); s.eye(26, 16)
    s.dot(23, 16, "#ffffff"); s.dot(26, 16, "#ffffff")
    s.dot(23, 17, "#14121c"); s.dot(26, 17, "#14121c")
    return s.finish()


def suricata():
    s = Sprite()
    c, cd, lt = C("#d9b88a"), C("#3a2a1c"), C("#f0dcb8")
    s.stroke([(19, 27), (26, 27), (28, 22)], 1.6, 1.0, C("#b8946a"))
    s.ell(16, 21, 4.8, 7.2, c)
    s.ell(16, 23, 3, 4.6, lt, on=True)
    for y in (19, 22, 25):
        s.line(14.5, y, 17.5, y, C("#b8946a"), on=True)
    s.ell(12.3, 20, 1.3, 2.6, c, ang=10); s.ell(19.7, 20, 1.3, 2.6, c, ang=-10)
    s.rect(11, 29, 14, 29, cd); s.rect(18, 29, 21, 29, cd)
    s.ell(16, 12.5, 3.8, 3.5, c)
    s.ell(13, 9.5, 1.3, 1.3, cd); s.ell(19, 9.5, 1.3, 1.3, cd)
    s.ell(13.3, 12.3, 1.5, 1.7, cd, on=True); s.ell(18.7, 12.3, 1.5, 1.7, cd, on=True)
    s.ell(16, 15, 1.8, 1.4, lt)
    s.px(16, 14.5, C("#14121c"))
    s.eye(13, 12); s.eye(19, 12)
    s.dot(13, 12, "#ffffff"); s.dot(19, 12, "#ffffff")
    return s.finish()


def foca():
    s = Sprite()
    c, cd, lt = C("#8d97a6"), C("#6a7484"), C("#d6dce4")
    s.poly([(4, 21), (0, 17), (1, 24), (0, 27), (5, 26)], cd)
    s.ell(15, 23, 12.5, 5.5, c)
    s.ell(16, 26, 9, 2.4, lt, on=True)
    s.ell(23, 17.5, 4, 5.2, c)
    s.ell(26, 15, 4, 3.4, c)
    s.ell(29, 16.2, 2.2, 1.8, lt)
    s.px(30, 15, C("#1a1620"))
    for x, y in [(8, 20), (12, 19), (17, 20), (10, 23), (15, 24)]:
        s.px(x, y, cd, on=True)
    s.ell(21, 28, 3.2, 1.4, cd)
    s.dot(30, 18, "#f4f4f4"); s.dot(31, 19, "#f4f4f4"); s.dot(31, 17, "#f4f4f4")
    s.eye(26, 13, 2, shine=True)
    return s.finish()


def morsa():
    s = Sprite()
    c, cd, lt = C("#a8724a"), C("#82522e"), C("#d9b890")
    s.poly([(4, 22), (0, 18), (1, 25), (0, 28), (5, 27)], cd)
    s.ell(15, 22, 12.5, 6.5, c)
    s.ell(24, 17.5, 4.8, 5, c)
    s.ell(27, 20, 4, 3, lt)
    s.rect(26, 21, 29, 28, C("#f4efe2")); s.rect(23, 21, 25, 27, C("#f4efe2"))
    s.ell(21, 27, 3.4, 1.5, cd)
    for x, y in [(26, 19), (28, 20), (29, 19), (27, 21)]:
        s.px(x, y, cd, on=True)
    s.px(30, 18, C("#1a1418"))
    for x, y in [(10, 17), (14, 16), (18, 17), (12, 20)]:
        s.px(x, y, cd, on=True)
    s.eye(25, 14, 2, shine=True)
    return s.finish()


def delfin():
    s = Sprite()
    c, cd, lt = C("#6b8fb8"), C("#4a6a92"), C("#e4edf5")
    s.poly([(7, 19), (1, 12), (3, 18), (1, 25), (8, 21)], cd)
    s.ell(15, 17, 12.5, 5.6, c, ang=-14)
    s.ell(16, 20.5, 9.5, 2.6, lt, ang=-14, on=True)
    s.poly([(14, 11), (17, 5), (20, 12)], cd)
    s.poly([(20, 21), (16, 27), (23, 23)], cd)
    s.ell(28.5, 13.5, 3.6, 1.6, c, ang=-12)
    s.ell(28.5, 14.5, 3.4, 1, lt, ang=-12)
    s.eye(24, 13)
    return s.finish()


def ballena():
    s = Sprite()
    c, cd, lt = C("#4f77a8"), C("#3a5a86"), C("#d6e4f2")
    s.stroke([(7, 21), (3, 17), (3, 11)], 3.4, 2.2, c)
    s.poly([(3, 11), (-1, 7), (2, 9), (3, 6), (4, 9), (8, 7), (5, 11)], cd)
    s.ell(15, 21, 14, 7.5, c)
    s.ell(16, 25, 11, 3.2, lt, on=True)
    for x in (12, 15, 18, 21):
        s.line(x, 24, x, 27, c, on=True)
    s.poly([(18, 26), (14, 30), (22, 28)], cd)
    s.line(23, 24, 29, 23, cd)
    s.eye(25, 20)
    for x, y0 in [(20, 9), (22, 7), (24, 9)]:
        s.line(x, y0, x - 1, y0 + 3, C("#a8d4f0"))
    return s.finish()


def orca():
    s = Sprite()
    c, lt = C("#26262e"), C("#f4f4f4")
    s.poly([(6, 18), (0, 11), (2, 17), (0, 24), (7, 20)], c)
    s.ell(15, 18, 13, 6.2, c, ang=-6)
    s.ell(15, 22.5, 9.5, 2.4, lt, on=True)
    s.poly([(13, 12), (16, 3), (20, 12)], c)
    s.poly([(20, 22), (17, 28), (24, 24)], c)
    s.ell(23.5, 15.2, 2.4, 1.2, lt, ang=-15)
    s.ell(14, 19, 2, 1, lt, on=True)
    s.eye(22, 16)
    return s.finish()


def gorila():
    s = Sprite()
    c, cd, lt, fc = C("#3a363f"), C("#2a262e"), C("#4e4a56"), C("#6a5a54")
    s.ell(11, 28.5, 4, 1.8, cd); s.ell(21, 28.5, 4, 1.8, cd)
    s.ell(16, 21, 9.5, 8, c)
    s.ell(16, 22, 5.5, 5.5, lt, on=True)
    s.ell(6.5, 21, 3.6, 7.4, c, ang=8); s.ell(25.5, 21, 3.6, 7.4, c, ang=-8)
    s.ell(5.5, 27.8, 3.2, 1.8, cd); s.ell(26.5, 27.8, 3.2, 1.8, cd)
    s.ell(16, 7.4, 3.6, 2.6, c)
    s.ell(16, 12, 5.8, 5.2, c)
    s.ell(16, 13.5, 4, 3.6, fc)
    s.rect(11, 10, 21, 10, cd)
    s.px(14, 15, C("#14121a")); s.px(18, 15, C("#14121a"))
    s.line(14, 17, 18, 17, C("#14121a"), on=True)
    s.eye(12, 12); s.eye(19, 12)
    s.dot(12, 12, "#e8d8a0"); s.dot(19, 12, "#e8d8a0")
    return s.finish()


def orangutan():
    s = Sprite()
    c, cd, lt, fc = C("#d0662a"), C("#a84a1c"), C("#e8863e"), C("#9a6a52")
    s.ell(11, 28.5, 3.6, 1.8, cd); s.ell(21, 28.5, 3.6, 1.8, cd)
    s.ell(16, 21, 9, 8, c)
    s.ell(16, 22, 5, 5.5, lt, on=True)
    s.ell(6, 21, 3.4, 8, lt, ang=6); s.ell(26, 21, 3.4, 8, lt, ang=-6)
    s.ell(5.5, 28, 3.2, 1.8, cd); s.ell(26.5, 28, 3.2, 1.8, cd)
    s.ell(16, 11.5, 6.8, 6.4, c)
    s.ell(10, 13, 2.2, 3, fc); s.ell(22, 13, 2.2, 3, fc)
    s.ell(16, 13, 4.6, 4.4, fc)
    s.ell(16, 17.5, 3, 2, C("#c2561e"))
    s.px(15, 15, C("#14121a")); s.px(17, 15, C("#14121a"))
    s.eye(13, 12); s.eye(19, 12)
    s.dot(13, 12, "#fff3d8"); s.dot(19, 12, "#fff3d8")
    return s.finish()
