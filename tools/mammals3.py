"""Correcciones y más cuadrúpedos. Las funciones con el mismo nombre que en mammals2 las reemplazan."""
from engine import *
from quad import quad, stripes, spots


def llama():
    def back(s):
        for x, y in [(8, 16), (12, 14), (17, 15), (20, 18), (10, 20), (16, 20)]:
            s.ell(x, y, 3.6, 3.4, C("#efe3cf"))
    return quad("#efe3cf", body=(13, 18, 8.5, 4.5), lt=2, foot="#8a6a4a", head=(26, 12, 3, 2.7),
                neck=(2.2, [(19, 16), (23, 15), (25, 13)]), snout=(2, 1, 2, 1.6, "#d9bf9a"),
                ears=[("banana", "#efe3cf")], back=back, eye=(27, 11),
                tail={"pts": [(5, 15), (4, 17)], "r0": 1.2, "r1": 1, "c": "#efe3cf"})


def mapache():
    def pat(s):
        s.rect(21, 14, 27, 16, C("#2a2630"), on=True)
        s.px(22, 15, C("#f4f4f2")), s.px(25, 15, C("#f4f4f2"))
        for y in (20, 22, 24, 26):
            s.rect(0, y, 7, y, C("#2a2630"), on=True)
    return quad("#8f8a92", body=(14, 19, 8, 4.6), lt=2, foot="#2a2630", head=(23, 15, 3.8, 3.2),
                snout=(3, 1.6, 2.2, 1.6, "#d9d4d0"), ears=[("round", "#6a6670")], nose=(4.6, .8, "#14121a"),
                belly="#b8b4b8", pat=pat, eye=(24, 14.5),
                tail={"pts": [(6, 18), (2, 20), (2.5, 26)], "r0": 2, "r1": 2.2, "c": "#a8a4aa"})


def capibara():
    return quad("#9a6a3c", body=(14, 20, 9.5, 5), lt=2, foot="#5a3a20", head=(24, 17, 4.4, 3.7),
                snout=(3.4, 1, 2.7, 2.7, "#8a5a30"), ears=[("round", "#7a4a28")], nose=(5.8, .4, "#2a1a10"),
                belly="#c9a070", eye=(25, 16))


def tapir():
    def post(s):
        s.stroke([(25, 16), (28.5, 18), (29.5, 21)], 2.4, 1.6, C("#26242a"))
        s.px(29, 21.5, C("#f0ece4")), s.px(30, 21, C("#f0ece4"))
    def pat(s):
        s.ell(9.5, 19, 7, 6, C("#e8e6e2"), on=True)
        s.rect(5, 24, 12, 29, C("#e8e6e2"), on=True)
        s.rect(10, 22, 13, 29, C("#cfcdca"), on=True)
    return quad("#26242a", body=(14, 19, 9, 5.5), lt=2, foot="#14121a", head=(23, 15, 3.8, 3.6),
                ears=[("round", "#e8e6e2")], post=post, pat=pat, eye=(24, 14),
                tail={"pts": [(5, 17), (4, 18)], "r0": 1, "r1": .8, "c": "#e8e6e2"})

def oso_hormiguero():
    def pat(s):
        s.poly([(19, 14), (21.5, 14), (19, 23), (16.5, 23)], C("#1e1a20"), on=True)
        s.line(21.5, 14, 19, 23, C("#f0ece4"), on=True)
    return quad("#8a7a70", body=(13, 18, 8, 4.6), lt=2, foot="#4a3a34", head=(24, 19, 2.8, 2.4),
                snout=(3.6, .4, 4.2, 1.2, "#7a6a60"), ears=[("round", "#6a5a50")], nose=(7.6, .2, "#14121a"),
                belly="#a89a90", pat=pat, eye=(25, 18),
                tail={"pts": [(7, 17), (3, 15), (3, 9)], "r0": 3, "r1": 4, "c": "#5a4a42"})


def armadillo():
    def pat(s):
        stripes(s, [9, 12, 15, 18], 15, 23, "#6a5c58")
        s.line(8, 16, 20, 16, C("#6a5c58"), on=True)
    return quad("#a89a94", body=(14, 20, 9, 5), lt=2, foot="#6a5c58", head=(24, 21, 3.4, 2.8),
                snout=(3, .8, 2.8, 1.6, "#c9bab0"), ears=[("point", "#a89a94")], nose=(5.8, .6, "#2a2024"),
                belly="#d9ccc2", pat=pat, eye=(25, 20),
                tail={"pts": [(5, 21), (1, 24), (1, 27)], "r0": 1.6, "r1": .9, "c": "#8a7c76"})
