from engine import *
from quad import quad, stripes, spots


def perro():
    return quad("#b9793a", body=(14, 19, 8, 4), belly="#dcb27a", head=(23, 15, 4, 3.6),
                snout=(3.2, 1.6, 2.6, 1.9, "#e4c08f"), ears=[("floppy", "#6a3f1c")], nose=(5.4, 0.5, "#1b1417"),
                tail={"pts": [(7, 18), (4, 15), (4.5, 12)], "r0": 1.5, "r1": 1.0}, foot="#e4c08f")


def gato():
    return quad("#e08a2b", body=(14, 20, 7.5, 4), belly="#f6d7a0", head=(22, 15, 4, 3.5), lt=2,
                snout=(3, 1.6, 2, 1.5, "#f6d7a0"), ears=[("point", "#e08a2b")], nose=(4.2, 0.7, "#e8667a"),
                tail={"pts": [(7, 20), (2, 19), (3, 12), (6, 9)], "r0": 1.5, "r1": 1.1},
                pat=lambda s: (stripes(s, [10, 13, 16], 16, 24, "#a8561a"), stripes(s, [21], 12, 14, "#a8561a")))


def caballo():
    return quad("#8a4f26", body=(13, 15, 9, 5), lt=2, foot="#2a1a12", head=(26, 8, 3.5, 3),
                neck=(2.8, [(19, 12), (22, 8), (24, 7)]), snout=(2.4, 1.6, 2.6, 2, "#6f3d1c"),
                ears=[("horse", "#8a4f26")],
                tail={"pts": [(5, 13), (2, 17), (3, 24)], "r0": 1.6, "r1": 1.2, "c": "#2a1a12"},
                back=lambda s: s.stroke([(20, 8), (21, 5), (22, 8)], 1, 1, C("#2a1a12")),
                pat=lambda s: s.stroke([(21, 6), (19, 10), (18, 12)], 1, 1, C("#2a1a12")))


def vaca():
    def pat(s):
        spots(s, [(10, 16), (11, 17), (12, 16), (18, 20), (19, 19), (17, 19)], "#2b2623", r=1.6)
        s.ell(24, 14, 2, 1.6, C("#2b2623"), on=True)
    return quad("#f2efe9", body=(14, 17, 9, 5.5), lt=3, foot="#2b2623", head=(25, 13, 3.6, 3.6),
                snout=(2.6, 1.8, 2.4, 2, "#f0b4b4"), ears=[("flat", "#2b2623")], nose=(3.9, 1.6, "#b5707a"),
                tail={"pts": [(5, 14), (4, 18), (4, 24)], "r0": 1, "r1": .8, "c": "#d9d4cb"},
                belly="#f0b4b4", pat=pat,
                post=lambda s: (s.rect(23, 8, 23, 9, C("#e8dcc0")), s.rect(27, 8, 27, 9, C("#e8dcc0"))))


def cerdo():
    return quad("#f2a3b5", body=(14, 20, 9, 5), lt=2, foot="#c77a8c", head=(24, 17, 4.4, 3.8),
                snout=(3.5, 1.5, 2.2, 2.2, "#e07d95"), ears=[("point", "#e88aa0")], nose=(4.5, 1.4, "#8c3a52"),
                tail={"pts": [(5, 17), (3, 15), (5, 14), (4, 12)], "r0": 1, "r1": .8, "c": "#e88aa0"})


def elefante():
    def trunk(s):
        s.stroke([(27.5, 13), (30.5, 18), (30, 24), (27.5, 26)], 2.3, 1.1, C("#8d97a6"))
    return quad("#8d97a6", body=(14, 17, 10, 7), lt=4, foot="#d9dde3", head=(24, 12, 5, 4.6),
                snout=None, ears=[], eye=(26, 11),
                post=lambda s: (s.ell(20, 12, 3.6, 4.6, C("#7a8494")), trunk(s), s.px(26, 16, C("#f4f1e6")),
                                s.px(27, 17, C("#f4f1e6"))),
                tail={"pts": [(4, 14), (2, 19)], "r0": 1, "r1": .8, "c": "#6f7888"})


def jirafa():
    def pat(s):
        spots(s, [(10, 15), (14, 17), (18, 14), (12, 19), (21, 11), (22, 7), (21, 4)], "#7a4a1d", r=1.3)
    return quad("#e8b95a", body=(13, 16, 8, 4.5), lt=2, foot="#5a3612", head=(26, 3.6, 3.4, 2.6),
                neck=(2.4, [(19, 14), (22, 8), (24, 5)]), snout=(2.4, 1, 2.2, 1.7, "#d9a24a"),
                ears=[("point", "#e8b95a")], pat=pat, eye=(27, 3),
                tail={"pts": [(5, 14), (3, 20)], "r0": 1, "r1": .8, "c": "#7a4a1d"},
                post=lambda s: (s.rect(24, 0, 24, 1, C("#5a3612")), s.rect(27, 0, 27, 1, C("#5a3612"))))


def leon():
    def back(s):
        s.ell(24, 14, 6.2, 6.2, C("#8a4a1a"))
    return quad("#d9a23a", body=(14, 20, 9, 4.6), lt=2, foot="#b57a22", head=(24, 15, 3.6, 3.3),
                snout=(2.4, 1.6, 2.2, 1.7, "#f0d49a"), ears=[("round", "#8a4a1a")], nose=(4, .5, "#5a2f1c"),
                tail={"pts": [(5, 19), (2, 21), (3, 26)], "r0": 1, "r1": .8, "tip": "#6a3a14", "tr": 1.5},
                back=back)


def cebra():
    def pat(s):
        stripes(s, [8, 11, 14, 17, 20], 12, 24, "#201c24", w=1, lean=.2)
        stripes(s, [23, 25], 8, 14, "#201c24", w=1)
        stripes(s, [8, 11, 14, 17, 20], 28, 29, "#201c24")
    return quad("#f3f1ee", body=(13, 16, 9, 5), lt=2, foot="#201c24", head=(26, 9, 3.4, 3),
                neck=(2.8, [(19, 13), (22, 10), (24, 9)]), snout=(2.4, 1.6, 2.5, 2, "#bdb9b4"),
                ears=[("horse", "#201c24")], pat=pat,
                tail={"pts": [(5, 14), (2, 18), (3, 24)], "r0": 1.2, "r1": 1, "c": "#201c24"},
                back=lambda s: s.stroke([(21, 6), (20, 10), (19, 12)], 1.1, 1, C("#201c24")))


def oso():
    return quad("#7a4c2a", body=(14, 17, 9.5, 6.5), lt=3, foot="#3b2412", head=(25, 14, 4.5, 4),
                snout=(3.2, 1.6, 2.6, 2.2, "#c79a6c"), ears=[("round", "#7a4c2a")], nose=(5, .8, "#18121a"),
                tail={"pts": [(5, 15), (3, 16)], "r0": 1.3, "r1": 1, "c": "#6a3f22"})


def conejo():
    return quad("#d8d2cb", body=(14, 21, 7, 4.5), lt=2, foot="#f2ede7", head=(21, 16, 3.6, 3.3),
                snout=(2.4, 1.4, 1.8, 1.5, "#f2ede7"), ears=[("long", "#d8d2cb")], nose=(3.8, .5, "#e8667a"),
                tail={"pts": [(6, 20), (5, 20)], "r0": 2, "r1": 2, "c": "#f4f1ec"},
                belly="#f2ede7", post=lambda s: s.ell(20, 12, .8, 2.4, C("#f0b4b4"), ang=-10, on=True))


def oveja():
    def back(s):
        for x, y in [(8, 17), (12, 14), (17, 14), (21, 17), (10, 21), (17, 21)]:
            s.ell(x, y, 4, 3.6, C("#f4f1ec"))
    return quad("#f4f1ec", body=(14, 18, 9, 5.5), lt=2, foot="#2b2623", head=(25, 15, 3.6, 3.6), headc="#3a3236",
                snout=(1.6, 1.4, 2, 1.8, "#4a4046"), ears=[("flat", "#2b2623")], legc="#3a3236",
                back=back, eye=(26, 14), nose=None,
                tail={"pts": [(5, 17), (4, 18)], "r0": 1.6, "r1": 1.6, "c": "#f4f1ec"})
