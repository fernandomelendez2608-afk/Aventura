from engine import *
from quad import quad, stripes, spots


def burro():
    return quad("#9a8f86", body=(14, 17, 8.5, 5), lt=2, foot="#4a4440", head=(25, 12, 3.6, 3.2),
                neck=(2.6, [(19, 14), (22, 13), (24, 12)]), snout=(2.6, 1.8, 2.5, 2, "#e8dfd4"),
                ears=[("big", "#9a8f86")], nose=(4.7, 1.2, "#3a3030"),
                belly="#e8dfd4",
                tail={"pts": [(6, 14), (4, 19), (4.5, 22)], "r0": 1, "r1": .8, "c": "#4a4440"},
                back=lambda s: s.stroke([(21, 8), (19, 11)], 1, 1, C("#4a4440")))


def llama():
    def back(s):
        for x, y in [(8, 15), (12, 13), (17, 14), (20, 17), (10, 19), (16, 19)]:
            s.ell(x, y, 3.6, 3.4, C("#efe3cf"))
    return quad("#efe3cf", body=(13, 17, 8.5, 4.5), lt=2, foot="#8a6a4a", head=(26, 7, 3, 2.7),
                neck=(2.2, [(19, 14), (23, 10), (25, 8)]), snout=(2, 1, 2, 1.6, "#d9bf9a"),
                ears=[("banana", "#efe3cf")], back=back, eye=(27, 6),
                tail={"pts": [(5, 14), (4, 16)], "r0": 1.2, "r1": 1, "c": "#efe3cf"},
                pat=lambda s: s.ell(23, 12, 3.4, 4, C("#efe3cf"), on=False))


def cuy():
    def pat(s):
        s.ell(9, 22, 4.5, 3.4, C("#f6efe3"), on=True)
        s.ell(15, 19, 4.4, 2.5, C("#c9692a"), on=True)
        s.ell(20, 23, 3.4, 3.2, C("#5a3a22"), on=True)
        s.ell(23, 19, 3, 2.4, C("#f6efe3"), on=True)
    return quad("#f6efe3", body=(15, 23, 9, 4.6), lt=2, foot="#e8a8a0", head=(23, 21, 4.2, 3.9),
                snout=(3, 1.4, 2, 1.8, "#f6efe3"), ears=[("round", "#c9692a")], nose=(4.8, 1, "#e8667a"),
                pat=pat, eye=(25, 19))


def jaguar():
    def pat(s):
        for x, y in [(8, 17), (11, 20), (14, 17), (17, 20), (20, 17), (10, 22), (15, 22)]:
            s.ell(x, y, 1.3, 1.3, C("#2a1c14"), on=True)
            s.px(x, y, C("#e0a73a"), on=True)
        for x, y in [(22, 12), (25, 12), (24, 18)]:
            s.px(x, y, C("#2a1c14"), on=True)
    return quad("#e0a73a", body=(14, 19, 9.5, 4.8), lt=2.5 and 3, foot="#c28a22", head=(24, 15, 4, 3.6),
                belly="#f6e0a8", snout=(3, 1.6, 2.2, 1.8, "#f6e0a8"), ears=[("round", "#c28a22")],
                nose=(4.6, .6, "#2a1c14"), pat=pat,
                tail={"pts": [(5, 18), (2, 21), (3, 26)], "r0": 1.5, "r1": 1.2, "c": "#c28a22"})


def puma():
    return quad("#c9a06a", body=(14, 19, 9, 4.3), lt=2, foot="#8a6a44", head=(24, 15, 3.4, 3.1),
                belly="#ecd9b8", snout=(2.6, 1.4, 2.1, 1.6, "#ecd9b8"), ears=[("round", "#8a6a44")],
                nose=(4.2, .6, "#d86a7a"),
                tail={"pts": [(5, 19), (1.5, 21), (3, 27)], "r0": 1.7, "r1": 1.3, "c": "#c9a06a", "tip": "#3a2a1c", "tr": 1.6})


def guepardo():
    def pat(s):
        spots(s, [(8, 14), (11, 16), (14, 14), (17, 16), (9, 18), (13, 19), (16, 19), (21, 12), (23, 9)], "#2a1c14", r=.7)
        s.line(23, 13, 22, 15, C("#2a1c14"), on=True)
    return quad("#e6b455", body=(14, 15, 8.5, 3.8), lt=2, foot="#c28a30", head=(23, 10, 3, 2.8),
                neck=(2.2, [(19, 13), (21, 11), (22, 10)]), snout=(2.2, 1, 1.8, 1.4, "#f6e3b0"),
                ears=[("round", "#c28a30")], belly="#f6e3b0", nose=(3.6, .3, "#2a1c14"), pat=pat,
                tail={"pts": [(6, 14), (2, 18), (3, 25)], "r0": 1.3, "r1": 1, "c": "#e6b455", "tip": "#2a1c14", "tr": 1.3})


def tigre():
    def pat(s):
        stripes(s, [8, 11, 14, 17, 20], 13, 23, "#241812", w=1, lean=.25)
        stripes(s, [22, 25], 11, 14, "#241812", w=1)
    return quad("#e8812c", body=(14, 19, 9.5, 5), lt=3, foot="#f6ead8", head=(24, 15, 4.3, 3.8),
                belly="#f6ead8", snout=(3, 1.6, 2.4, 1.8, "#f6ead8"), ears=[("round", "#e8812c")],
                nose=(4.8, .5, "#e8667a"), pat=pat,
                tail={"pts": [(5, 18), (2, 21), (3, 26)], "r0": 1.5, "r1": 1.2, "c": "#e8812c", "tip": "#241812", "tr": 1.5})


def lobo():
    return quad("#8f939b", body=(14, 18, 9, 4.6), lt=2, foot="#4a4d55", head=(24, 14, 3.8, 3.2),
                belly="#d6d6d6", snout=(3.6, 1.5, 3, 1.7, "#cfcbc6"), ears=[("point", "#6a6e76")],
                nose=(6.3, .6, "#14121a"),
                tail={"pts": [(5, 17), (2, 21), (3.5, 26)], "r0": 2, "r1": 2.2, "c": "#8f939b"})


def zorro():
    return quad("#e2732a", body=(14, 20, 8.5, 4), lt=2, foot="#2a1c1c", legc="#3a2a2a", head=(23, 16, 3.8, 3.2),
                belly="#f6ead8", snout=(3.6, 1.5, 3, 1.6, "#f6ead8"), ears=[("point", "#2a1c1c")],
                nose=(6.4, .6, "#14121a"),
                tail={"pts": [(6, 19), (2, 21), (2, 26)], "r0": 2.2, "r1": 2.6, "c": "#e2732a", "tip": "#f6ead8", "tr": 2.4})


def oso_polar():
    return quad("#ecf0f3", body=(14, 18, 10.5, 6), lt=3, foot="#cfd8de", head=(25, 15, 4, 3.5),
                snout=(3.4, 1.4, 2.6, 2, "#dde5ea"), ears=[("round", "#ecf0f3")], nose=(5.8, .6, "#14121a"),
                tail={"pts": [(4, 16), (3, 17)], "r0": 1.2, "r1": 1, "c": "#ecf0f3"})


def oso_anteojos():
    def pat(s):
        s.ell(25, 14, 1.8, 1.6, C("#f2ead8"), on=True)
        s.ell(23, 21, 3.6, 2.2, C("#f2ead8"), on=True)
        s.ell(27, 15, 2, 1.8, C("#d9c29a"), on=True)
    return quad("#241e22", body=(14, 17, 9.5, 6.3), lt=3, foot="#14101a", head=(25, 14, 4.4, 4),
                snout=(3, 1.6, 2.6, 2.2, "#d9c29a"), ears=[("round", "#241e22")], nose=(5.2, .6, "#0e0a10"),
                pat=pat, eye=(26, 13))


def panda():
    def pat(s):
        s.ell(13, 17, 5.6, 6, C("#f4f4f2"), on=True)
        s.ell(23, 13, 1.6, 1.4, C("#1c1a1e"), on=True)
        s.rect(18, 11, 20, 24, C("#1c1a1e"), on=True)
    return quad("#f4f4f2", body=(14, 18, 9.5, 6.3), lt=3, foot="#1c1a1e", legc="#1c1a1e",
                head=(25, 14, 4.4, 4), snout=(3, 1.6, 2.3, 1.9, "#f4f4f2"), ears=[("round", "#1c1a1e")],
                nose=(5.4, .6, "#1c1a1e"), pat=pat, eye=(26, 13),
                tail={"pts": [(5, 16), (4, 17)], "r0": 1.2, "r1": 1, "c": "#f4f4f2"})


def rinoceronte():
    def post(s):
        s.poly([(27, 18), (30, 12), (31, 18)], C("#d9d4c6"))
        s.poly([(24, 16), (26, 12.5), (27.5, 16)], C("#a8a3a8"))
    return quad("#9a9aa2", body=(14, 18, 10, 6.5), lt=3, foot="#6a6a72", head=(25, 18, 4.4, 3.6),
                snout=(3.6, 1.2, 2.4, 2.4, "#8a8a92"), ears=[("round", "#7a7a82")], post=post, eye=(26, 16.5),
                tail={"pts": [(4, 15), (3, 20)], "r0": 1, "r1": .8, "c": "#6a6a72"})


def hipopotamo():
    return quad("#9a8a9c", body=(14, 21, 10.5, 5.5), lt=3, foot="#7a6a7c", head=(25, 19, 5, 4.2),
                snout=(3.2, 1.6, 3.6, 3, "#c9a8b0"), ears=[("round", "#8a7a8c")], nose=(5.6, .2, "#4a3a4c"),
                belly="#c9a8b0", eye=(26, 16.5),
                tail={"pts": [(4, 19), (3, 21)], "r0": 1, "r1": .8, "c": "#8a7a8c"},
                post=lambda s: s.px(30, 18, C("#4a3a4c")))


def gorila():
    def post(s):
        s.stroke([(19, 14), (21, 22), (22, 28)], 2.6, 2.4, C("#2e2a30"))
        s.ell(22, 28, 2.2, 1.4, C("#1e1a20"))
    return quad("#38333a", body=(13, 15, 8, 6.5), lt=3, foot="#1e1a20", head=(22, 13, 4, 3.8), headc="#38333a",
                snout=(2.6, 1.2, 2.6, 2.4, "#6a5a52"), ears=[("round", "#38333a")], nose=(4.4, .6, "#14121a"),
                belly="#4a444c", post=post, eye=(23, 12),
                back=lambda s: s.ell(14, 11, 6, 3, C("#4a444c")))


def mono():
    return quad("#8a5a32", body=(14, 20, 7, 4.2), lt=2, foot="#5a3a20", head=(21, 15, 3.8, 3.8),
                snout=(1.6, 1.6, 2.5, 2.2, "#ecc9a0"), ears=[("round", "#8a5a32")], nose=(2.8, 1, "#3a2a1c"),
                belly="#d9b88a", eye=(22, 14),
                tail={"pts": [(7, 20), (1, 22), (1, 14), (6, 11)], "r0": 1.2, "r1": 1, "c": "#8a5a32"},
                pat=lambda s: s.ell(21, 16, 2.6, 2.2, C("#ecc9a0"), on=True))


def orangutan():
    def post(s):
        s.stroke([(18, 14), (20, 22), (21, 28)], 2.6, 2.4, C("#c8622a"))
        s.ell(21, 28, 2.2, 1.4, C("#a84a1c"))
    return quad("#c8622a", body=(13, 15, 8, 6.5), lt=3, foot="#a84a1c", head=(22, 13, 4.2, 4),
                snout=(2.2, 1.6, 2.6, 2.3, "#6a4a3a"), ears=[("round", "#a84a1c")], nose=(4, 1, "#2a1c14"),
                post=post, eye=(23, 12),
                pat=lambda s: s.ell(22, 14, 3, 2.8, C("#8a5a44"), on=True),
                back=lambda s: s.ell(13, 11, 7, 3.4, C("#e0793a")))


def mapache():
    def pat(s):
        s.rect(21, 14, 27, 16, C("#2a2630"), on=True)
        s.px(22, 15, C("#f4f4f2")), s.px(25, 15, C("#f4f4f2"))
        stripes(s, [2, 4], 17, 25, "#2a2630", w=1)
    return quad("#8f8a92", body=(14, 19, 8, 4.6), lt=2, foot="#2a2630", head=(23, 15, 3.8, 3.2),
                snout=(3, 1.6, 2.2, 1.6, "#d9d4d0"), ears=[("round", "#6a6670")], nose=(4.6, .8, "#14121a"),
                belly="#b8b4b8", pat=pat, eye=(24, 14.5),
                tail={"pts": [(6, 18), (2, 20), (2.5, 26)], "r0": 2, "r1": 2.2, "c": "#8f8a92"},
                post=lambda s: stripes(s, [2, 2, 3], 18, 24, "#8f8a92") if False else None)


def ciervo():
    def post(s):
        for (x0, y0, x1, y1) in [(24, 7, 23, 2), (24, 5, 26, 3), (27, 7, 28, 2), (27, 5, 29.5, 3.5)]:
            s.line(x0, y0, x1, y1, C("#e8d7b8"), t=1)
    def pat(s):
        spots(s, [(9, 15), (12, 14), (15, 15), (11, 18), (17, 18)], "#f6ead8", r=.6)
    return quad("#b9783a", body=(14, 18, 8.5, 4.4), lt=2, foot="#3a2418", head=(26, 9, 3.2, 2.8),
                neck=(2.2, [(20, 15), (23, 12), (25, 10)]), snout=(2.4, 1, 2, 1.6, "#d9a87a"),
                ears=[("point", "#b9783a")], nose=(4.4, .3, "#14121a"), post=post, pat=pat, belly="#f1dfc2",
                tail={"pts": [(5, 16), (4, 18)], "r0": 1.3, "r1": 1, "c": "#f6ead8"}, eye=(27, 8))


def bisonte():
    def back(s):
        s.ell(11, 11, 7, 5.5, C("#6a4426"))
        s.ell(23, 17, 5.5, 6.5, C("#4a2c18"))
    return quad("#6a4426", body=(15, 18, 9.5, 5.6), lt=3, foot="#2a1a10", legc="#6a4426",
                head=(25, 19, 3.8, 3.6), headc="#4a2c18", snout=(2.4, 1.6, 2, 2, "#3a2414"),
                ears=[("round", "#3a2414")], back=back, eye=(26, 18),
                tail={"pts": [(5, 16), (3, 21)], "r0": 1, "r1": .8, "c": "#4a2c18", "tip": "#2a1a10", "tr": 1.3},
                post=lambda s: (s.line(25, 14, 24, 12, C("#e8dcc0")), s.line(28, 14, 29, 12, C("#e8dcc0"))))


def camello():
    def back(s):
        s.ell(9, 11, 2.8, 3.4, C("#c9a070"))
        s.ell(16, 11, 2.8, 3.4, C("#c9a070"))
    return quad("#c9a070", body=(13, 17, 9, 4.4), lt=2, foot="#8a6a40", head=(27, 8, 2.8, 2.4),
                neck=(2.2, [(20, 15), (24, 12), (25, 8)]), snout=(2, 1, 2, 1.6, "#b58c5c"),
                ears=[("round", "#c9a070")], back=back, belly="#e0c8a0", eye=(28, 7),
                tail={"pts": [(4, 15), (3, 20)], "r0": 1, "r1": .8, "c": "#8a6a40"})


def jabali():
    def post(s):
        s.px(29, 19, C("#f4efe0")), s.px(30, 18, C("#f4efe0"))
    return quad("#5a4a42", body=(14, 19, 9, 5), lt=2, foot="#2a1c1c", head=(24, 17, 4.2, 3.6),
                snout=(3.4, 1.8, 2.4, 2, "#3a2c2c"), ears=[("point", "#4a3a34")], nose=(5.4, 1.6, "#14101a"),
                post=post, eye=(25, 16),
                tail={"pts": [(5, 18), (3, 19)], "r0": 1, "r1": .8, "c": "#3a2c2c"},
                back=lambda s: s.poly([(7, 15), (10, 11), (13, 14), (16, 10), (19, 14), (22, 12), (22, 17), (7, 17)], C("#2a1c1c")))


def raton():
    return quad("#9a9aa4", body=(13, 22, 7, 4), lt=2, foot="#e8a8b0", head=(20, 19, 3.4, 3), headc="#9a9aa4",
                snout=(3, 1.2, 2.4, 1.6, "#c9c9d0"), ears=[("round", "#e8a8b0")], nose=(4.8, .6, "#e8667a"),
                belly="#d9d9e0", eye=(21, 18),
                tail={"pts": [(6, 24), (2, 26), (1, 22), (3, 20)], "r0": .75, "r1": .75, "c": "#e8a8b0"})
