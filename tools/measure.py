# -*- coding: utf-8 -*-
"""Насколько документ не влезает в лист — в миллиметрах.

build_pdf.py говорит только «два листа вместо одного». Этого мало: непонятно,
резать одну строку или пять. Здесь видно точную высоту и остаток до листа.

Ширина окна обязана быть 703 px (A4 186 мм при 96 dpi) — на широком окне текст
переносится иначе, и высота выходит обманчиво маленькой.

Запуск:  py -X utf8 tools/measure.py
"""
import functools
import http.server
import os
import socket
import socketserver
import sys
import threading

from playwright.sync_api import sync_playwright

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

PAGE_MM = 297 - 11 * 2      # A4 минус поля из @page в print.css
WIDTH_PX = 703              # A4 минус боковые поля, при 96 dpi

DOCS = [('cheat', 'Памятка водителя', 1),
        ('guide', 'Как вести инструктаж', 2),
        ('script', 'Инструктаж-сценарий', 5),
        ('contacts', 'Контакты офиса', 1)]


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        port = s.getsockname()[1]

    httpd = socketserver.TCPServer(('127.0.0.1', port),
                                   functools.partial(Quiet, directory=ROOT))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    over = False

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page(viewport={'width': WIDTH_PX, 'height': 1000})

            for doc, title, max_pages in DOCS:
                page.goto(f'http://127.0.0.1:{port}/print.html?doc={doc}',
                          wait_until='networkidle')
                page.wait_for_selector('body[data-ready]', timeout=15000)
                page.emulate_media(media='print')

                mm = page.evaluate(
                    "() => document.querySelector('#doc')"
                    ".getBoundingClientRect().height * 25.4 / 96")
                limit = PAGE_MM * max_pages
                left = limit - mm
                mark = '' if left >= 0 else f'  <-- не влезает на {-left:.0f} мм'
                print(f'  {title}: {mm:.0f} мм из {limit} мм '
                      f'({max_pages} л.), запас {left:.0f} мм{mark}')
                over = over or left < 0

            browser.close()
    finally:
        httpd.shutdown()

    if over:
        # Проверено 12.08.2026: восемь правок по 15–25 знаков внутри строк дали
        # ровно 0 мм — число перенесённых строк не изменилось. Высоту меняет
        # только слияние строк в одну (−4…5 мм за штуку) или удаление строки.
        print('\nРезать контент, а не шрифт: кегль 9.5pt и QR 25 мм не трогать.')
        print('Сокращать слова внутри строки бесполезно — сливать строки.')
    return 1 if over else 0


if __name__ == '__main__':
    sys.exit(main())
