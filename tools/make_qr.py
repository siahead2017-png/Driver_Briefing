# -*- coding: utf-8 -*-
"""QR-коды для шпаргалки водителя.

Генерируются один раз в SVG и коммитятся — тянуть на страницу
рантайм-генератор ради двух статичных ссылок незачем.

Запуск:  py tools/make_qr.py
"""
import io
import json
import os

import segno

HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, '..', 'assets', 'qr')
DATA = os.path.join(HERE, '..', 'data', 'briefing.json')

# Коррекция 'm': запас на случай, если лист помнётся или засветится.
CODES = {'fuel': 'fuel', 'kb': 'kb', 'contacts': 'contacts'}


def main():
    with io.open(DATA, encoding='utf-8') as f:
        links = json.load(f)['links']

    os.makedirs(OUT, exist_ok=True)
    for name, key in CODES.items():
        url = links[key]
        path = os.path.join(OUT, f'{name}.svg')
        segno.make(url, error='m').save(path, scale=1, border=2, dark='#10151c')
        print(f'{name:5} -> {url}')

    print('Готово:', os.path.abspath(OUT))


if __name__ == '__main__':
    main()
