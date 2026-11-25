"""Plantilla de cuadrúpedo de perfil mirando a la derecha."""
from engine import *


def stripes(s, xs, y0, y1, c, w=1, lean=0):
    for x in xs:
        for y in range(y0, y1 + 1):
            for k in range(w):
                s.px(x + k + int((y - y0) * lean), y, c, on=True)


def spots(s, pts, c, r=.8):
    for x, y in pts:
        s.ell(x, y, r, r, c, on=True)


def quad(c, body=(15, 18, 9, 5), lt=2, foot=None, head=None, snout=None, ears=(), neck=None,
         tail=None, belly=None, legc=None, pre=None, pat=None, post=None, eye=None, far=.72,
         nose=None, hind=None, back=None, headc=None):
    s = Sprite()
    c = C(c)
    cx, cy, rx, ry = body
    hx, hy, hrx, hry = head or (cx + rx + 1, cy - 3, 4, 3.5)
    lc = C(legc) if legc else c
    fc = C(foot) if foot else None
    top_leg = int(cy + ry - 2)
    fx = int(cx + rx - 3)
    bx = int(cx - rx + 1)

    def leg(x, col):
        s.rect(x, top_leg, x + lt - 1, GY, col)
        if fc:
            s.rect(x, GY - 1, x + lt - 1, GY, fc)

    if pre:
        pre(s)
    leg(bx + 3, mul(lc, far))
    leg(fx - 3, mul(lc, far))
    if tail:
        s.stroke(tail["pts"], tail.get("r0", 1.2), tail.get("r1", 1), C(tail.get("c", c)))
        if tail.get("tip"):
            x, y = tail["pts"][-1]
            s.ell(x, y, tail.get("tr", 1.6), tail.get("tr", 1.6), C(tail["tip"]))
    if back:
        back(s)
    s.ell(cx, cy, rx, ry, c)
    if hind:
        s.ell(cx - rx + 3, cy + 1, 4.5, ry - 0.5, C(hind) if not isinstance(hind, bool) else c)
    if belly:
        s.ell(cx + 1, cy + ry - 1.2, rx - 2.5, 2.4, C(belly), on=True)
    if neck:
        nr, pts = neck[0], neck[1]
        s.stroke(pts, nr, nr, c)
    leg(bx, lc)
    leg(fx, lc)
    # orejas lejanas
    for kind, col in ears:
        _ear(s, kind, hx, hy, hrx, hry, mul(C(col), .75), far=True)
    s.ell(hx, hy, hrx, hry, C(headc) if headc else c)
    if snout:
        dx, dy, sx, sy, scol = snout
        s.ell(hx + dx, hy + dy, sx, sy, C(scol))
    for kind, col in ears:
        _ear(s, kind, hx, hy, hrx, hry, C(col), far=False)
    if nose:
        nx, ny, ncol = nose
        s.px(hx + nx, hy + ny, C(ncol))
    if pat:
        pat(s)
    if post:
        post(s)
    ex, ey = eye or (int(hx + hrx * .3), int(hy - 1))
    s.eye(ex, ey)
    return s.finish()


def _ear(s, kind, hx, hy, hrx, hry, col, far):
    o = 2.5 if far else 0
    tx, ty = hx - 1.5 + o, hy - hry
    if kind == "point":
        s.poly([(tx - 1.5, ty + 1.8), (tx - .5, ty - 3.2), (tx + 2.2, ty + 1.8)], col)
    elif kind == "round":
        s.ell(tx, ty + .6, 1.9, 1.9, col)
    elif kind == "long":
        s.ell(tx - 1 + o * .4, ty - 3, 1.3, 4.3, col, ang=-12 if not far else 8)
    elif kind == "big":
        s.ell(tx - .5 + o * .5, ty - 2.5, 1.4, 3.8, col, ang=-15 if not far else 10)
    elif kind == "floppy":
        if not far:
            s.ell(hx - .8, hy + .6, 1.8, 3.3, col)
    elif kind == "horse":
        s.poly([(tx - 1, ty + 1.5), (tx - .5, ty - 3.5), (tx + 1.5, ty + 1.5)], col)
    elif kind == "flat":  # vaca: orejas horizontales
        s.ell(tx - 2.2 + o * .6, ty + 1.5, 2.2, 1.1, col)
    elif kind == "banana":
        s.ell(tx - .5 + o * .5, ty - 2.6, 1.1, 3.4, col, ang=-20 if not far else 5)
