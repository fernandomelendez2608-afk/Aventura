"""Motor mínimo de pixel art: lienzo de 32x32, formas básicas, sombreado y contorno automáticos."""
import math

W = H = 32
GY = 29  # línea del suelo (último píxel de las patas)


def rgb(h):
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def mul(c, f):
    return tuple(max(0, min(255, int(round(v * f)))) for v in c)


def mix(a, b, t):
    return tuple(int(round(a[i] * (1 - t) + b[i] * t)) for i in range(3))


def C(h):
    return rgb(h) if isinstance(h, str) else h


class Sprite:
    def __init__(self):
        self.g = [[None] * W for _ in range(H)]
        self.top = []  # píxeles que se dibujan al final (ojos, brillos)

    # ---- básicos
    def get(self, x, y):
        x, y = int(x), int(y)
        if 0 <= x < W and 0 <= y < H:
            return self.g[y][x]
        return None

    def px(self, x, y, c, on=False):
        x, y = int(math.floor(x)), int(math.floor(y))
        if c is None or not (0 <= x < W and 0 <= y < H):
            return
        if on and self.g[y][x] is None:
            return
        self.g[y][x] = C(c)

    def rect(self, x0, y0, x1, y1, c, on=False):
        for y in range(int(y0), int(y1) + 1):
            for x in range(int(x0), int(x1) + 1):
                self.px(x, y, c, on)

    def ell(self, cx, cy, rx, ry, c, ang=0, on=False):
        ca, sa = math.cos(math.radians(ang)), math.sin(math.radians(ang))
        b = max(rx, ry) + 1
        for y in range(int(cy - b) - 1, int(cy + b) + 2):
            for x in range(int(cx - b) - 1, int(cx + b) + 2):
                dx, dy = x + .5 - cx, y + .5 - cy
                u, v = dx * ca + dy * sa, -dx * sa + dy * ca
                if (u / rx) ** 2 + (v / ry) ** 2 <= 1.0:
                    self.px(x, y, c, on)

    def poly(self, pts, c, on=False):
        ys = [p[1] for p in pts]
        xs = [p[0] for p in pts]
        n = len(pts)
        for y in range(int(min(ys)) - 1, int(max(ys)) + 2):
            for x in range(int(min(xs)) - 1, int(max(xs)) + 2):
                px_, py_ = x + .5, y + .5
                inside = False
                j = n - 1
                for i in range(n):
                    xi, yi = pts[i]
                    xj, yj = pts[j]
                    if (yi > py_) != (yj > py_) and px_ < (xj - xi) * (py_ - yi) / (yj - yi + 1e-9) + xi:
                        inside = not inside
                    j = i
                if inside:
                    self.px(x, y, c, on)

    def line(self, x0, y0, x1, y1, c, t=1, on=False):
        n = int(max(abs(x1 - x0), abs(y1 - y0))) * 2 + 1
        for i in range(n + 1):
            x = x0 + (x1 - x0) * i / n
            y = y0 + (y1 - y0) * i / n
            if t <= 1:
                self.px(x, y, c, on)
            else:
                self.ell(x, y, t / 2, t / 2, c, on=on)

    def stroke(self, pts, r0, r1, c, on=False):
        """Curva de Bézier por los puntos dados; el grosor cambia de r0 a r1."""
        steps = 48
        for i in range(steps + 1):
            t = i / steps
            q = [tuple(p) for p in pts]
            while len(q) > 1:
                q = [((1 - t) * a[0] + t * b[0], (1 - t) * a[1] + t * b[1]) for a, b in zip(q, q[1:])]
            r = max(.75, r0 + (r1 - r0) * t)
            self.ell(q[0][0], q[0][1], r, r, c, on=on)

    def eye(self, x, y, size=1, c="#14121c", shine=False):
        for dy in range(size):
            for dx in range(size):
                self.top.append((x + dx, y + dy, C(c)))
        if shine and size > 1:
            self.top.append((x, y, (255, 255, 255)))

    def dot(self, x, y, c):
        self.top.append((x, y, C(c)))

    # ---- acabado
    def finish(self):
        g = self.g
        shape = [[g[y][x] is not None for x in range(W)] for y in range(H)]
        out = [[None] * W for _ in range(H)]
        for y in range(H):
            for x in range(W):
                c = g[y][x]
                if c is None:
                    continue
                up = y == 0 or not shape[y - 1][x]
                dn = y == H - 1 or not shape[y + 1][x]
                if up and not dn:
                    c = mix(c, (255, 255, 255), .16)
                elif dn and not up:
                    c = mul(c, .8)
                out[y][x] = c
        for y in range(H):
            for x in range(W):
                if shape[y][x]:
                    continue
                best = None
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < W and 0 <= ny < H and shape[ny][nx]:
                        cc = g[ny][nx]
                        if best is None or sum(cc) < sum(best):
                            best = cc
                if best is not None:
                    out[y][x] = mul(mix(best, (30, 20, 50), .35), .42)
        for x, y, c in self.top:
            if 0 <= x < W and 0 <= y < H:
                out[int(y)][int(x)] = c
        return out
