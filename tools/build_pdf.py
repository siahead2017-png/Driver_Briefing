# -*- coding: utf-8 -*-
"""Сборка PDF из print.html через Playwright.

Один источник правды: правится data/briefing.json — и экран, и бумага
меняются вместе. Ручной Ctrl+P для этого не годится, он забывается.

Страница читает JSON через fetch(), а из file:// браузер это запрещает,
поэтому поднимаем временный localhost на время сборки.

Запуск:  py tools/build_pdf.py
Требуется:  py -m pip install playwright  &&  py -m playwright install chromium
"""
import functools
import http.server
import os
import socket
import socketserver
import threading

from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..'))
DIST = os.path.join(ROOT, 'dist')

DOCS = [
    ('script', 'Инструктаж-сценарий.pdf'),
    ('cheat', 'Памятка-водителя.pdf'),
    # ASCII-имя намеренно: этот файл открывают по QR-коду, а не по клику —
    # кириллица в URL надёжно работает не во всех сканерах камеры.
    ('contacts', 'office-contacts.pdf'),
]


def free_port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    """Тот же статический сервер, но без лога каждого запроса в консоль."""

    def log_message(self, *args):
        pass


def serve(port):
    handler = functools.partial(QuietHandler, directory=ROOT)
    httpd = socketserver.TCPServer(('127.0.0.1', port), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def main():
    os.makedirs(DIST, exist_ok=True)
    port = free_port()
    httpd = serve(port)

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()

            for doc, filename in DOCS:
                page.goto(f'http://127.0.0.1:{port}/print.html?doc={doc}',
                          wait_until='networkidle')
                # print.js выставляет флаг, когда вёрстка собрана
                page.wait_for_selector('body[data-ready="1"]')

                out = os.path.join(DIST, filename)
                page.pdf(
                    path=out,
                    print_background=True,
                    prefer_css_page_size=True,  # размер и поля берём из @page
                )
                size_kb = os.path.getsize(out) // 1024
                print(f'  {filename}  ({size_kb} КБ)')

            browser.close()
    finally:
        httpd.shutdown()

    print('Готово:', DIST)


if __name__ == '__main__':
    main()
