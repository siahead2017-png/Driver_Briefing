# -*- coding: utf-8 -*-
"""Иконки приложения: планшет с чек-листом.

Сюжет выбран так, чтобы на рабочем экране телефона не путаться с базой
знаний (там раскрытая книга). Палитра общая — оранжевый круг и синий
контур, три сайта должны читаться как одна семья.

Запуск:  py tools/make_icons.py
Результат коммитится, повторно запускать не нужно.
"""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'icons')

ORANGE = (212, 87, 31)
BLUE = (31, 78, 140)
ACCENT = (31, 111, 235)
GREEN = (23, 163, 74)
WHITE = (255, 255, 255)
GREY = (200, 209, 219)

SS = 4  # супер-сэмплинг: рисуем крупно, потом уменьшаем — края выходят гладкими


def draw_icon(size, maskable):
    S = size * SS
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    if maskable:
        # Маска может срезать до круга диаметром 80% — фон заливает всё,
        # а содержимое ужимаем в безопасную зону.
        d.rectangle([0, 0, S, S], fill=ORANGE)
        scale = 0.60
    else:
        d.ellipse([S * .01, S * .01, S * .99, S * .99], fill=ORANGE)
        scale = 0.78

    # --- Планшет ---
    w, h = S * scale * .80, S * scale * .96
    x0, y0 = (S - w) / 2, (S - h) / 2 + S * .02
    x1, y1 = x0 + w, y0 + h
    r = w * .12
    stroke = max(2, int(S * .018))

    d.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=WHITE, outline=BLUE, width=stroke)

    # --- Клипса сверху ---
    cw, ch = w * .42, h * .13
    cx0, cy0 = (S - cw) / 2, y0 - ch * .45
    d.rounded_rectangle([cx0, cy0, cx0 + cw, cy0 + ch], radius=ch * .35,
                        fill=BLUE)

    # --- Три строки чек-листа ---
    pad = w * .15
    row_h = h * .17
    top = y0 + h * .30
    box = row_h * .62
    lw = max(2, int(S * .013))

    for i in range(3):
        cy = top + i * row_h
        bx0, by0 = x0 + pad, cy
        bx1, by1 = bx0 + box, cy + box

        if i < 2:
            # Отмеченные пункты — залитый квадрат с белой галочкой
            d.rounded_rectangle([bx0, by0, bx1, by1], radius=box * .25, fill=GREEN)
            d.line([bx0 + box * .24, by0 + box * .52,
                    bx0 + box * .43, by0 + box * .72,
                    bx0 + box * .78, by0 + box * .28],
                   fill=WHITE, width=lw, joint='curve')
        else:
            d.rounded_rectangle([bx0, by0, bx1, by1], radius=box * .25,
                                outline=GREY, width=lw)

        # Линия текста справа от квадрата
        ly = by0 + box * .5
        d.line([bx1 + box * .55, ly, x1 - pad, ly],
               fill=ACCENT if i < 2 else GREY, width=lw)

    return img.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    for size in (192, 512):
        draw_icon(size, False).save(os.path.join(OUT, f'icon-{size}.png'))
        draw_icon(size, True).save(os.path.join(OUT, f'icon-maskable-{size}.png'))
    print('Готово:', os.path.abspath(OUT))


if __name__ == '__main__':
    main()
