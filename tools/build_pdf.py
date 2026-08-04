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
import shutil
import socket
import socketserver
import sys
import threading

from playwright.sync_api import TimeoutError as PlaywrightTimeout
from playwright.sync_api import sync_playwright
from pypdf import PdfReader

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..'))
DIST = os.path.join(ROOT, 'dist')

# QR "Контакты офиса" ведёт на этот адрес (см. data/briefing.json -> links.contacts),
# чтобы водитель при сканировании видел домен Driver_Instructions (знакомое ему
# приложение), а не Driver_Briefing (внутренний инструмент, не для водителя).
# Копия — мягкая: если соседней папки нет (перенесли/переименовали), просто пропускаем.
KB_CONTACTS_PDF = os.path.join(ROOT, '..', 'Dashboard_Instructions', 'assets', 'docs', 'office-contacts.pdf')

# Последнее число — сколько листов документ занимать НЕ должен. «Один лист»
# у памятки — жёсткое требование: её отдают водителю на руки. Считать
# страницы глазами после каждой правки текста никто не будет.
DOCS = [
    ('guide', 'Как-вести-инструктаж.pdf', 2),
    # Было 3 листа. Стало 4 после 02.08.2026, когда девять «голых» пунктов
    # наполнили подсказками ведущему — это осознанная плата за содержание,
    # а не расползание вёрстки. Ужимать дальше нельзя: документ читают
    # во время разговора.
    ('script', 'Инструктаж-сценарий.pdf', 4),
    ('cheat', 'Памятка-водителя.pdf', 1),
    # ASCII-имя намеренно: этот файл открывают по QR-коду, а не по клику —
    # кириллица в URL надёжно работает не во всех сканерах камеры.
    ('contacts', 'office-contacts.pdf', 1),
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
    over = []   # документы, вылезшие за отведённое число листов

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()

            for doc, filename, max_pages in DOCS:
                page.goto(f'http://127.0.0.1:{port}/print.html?doc={doc}',
                          wait_until='networkidle')

                # print.js выставляет data-ready: '1' — собралось, 'error' —
                # сломались данные. Ждём любое значение, иначе при ошибке
                # висим до таймаута и падаем трейсбеком вместо объяснения.
                try:
                    page.wait_for_selector('body[data-ready]', timeout=15000)
                except PlaywrightTimeout:
                    raise SystemExit(
                        f'Документ "{doc}" не собрался за 15 секунд.\n'
                        f'Скорее всего сломан data/briefing.json — проверьте:\n'
                        f'  py -X utf8 tools/validate.py')

                if page.get_attribute('body', 'data-ready') != '1':
                    raise SystemExit(
                        f'Документ "{doc}" не собрался:\n'
                        f'{page.inner_text("#doc")[:300]}')

                out = os.path.join(DIST, filename)
                page.pdf(
                    path=out,
                    print_background=True,
                    prefer_css_page_size=True,  # размер и поля берём из @page
                )
                size_kb = os.path.getsize(out) // 1024
                pages = len(PdfReader(out).pages)
                warn = '' if pages <= max_pages else f'  <-- ВНИМАНИЕ: было не больше {max_pages}'
                print(f'  {filename}  ({pages} стр., {size_kb} КБ){warn}')
                if pages > max_pages:
                    over.append(filename)

            browser.close()
    finally:
        httpd.shutdown()

    kb_docs_dir = os.path.dirname(KB_CONTACTS_PDF)
    if os.path.isdir(kb_docs_dir):
        shutil.copy(os.path.join(DIST, 'office-contacts.pdf'), KB_CONTACTS_PDF)
        print('Скопировано в Driver_Instructions:', KB_CONTACTS_PDF)
    else:
        print(f'! Папка {kb_docs_dir} не найдена — office-contacts.pdf в Driver_Instructions '
              f'не обновлён, скопируйте вручную.')

    print('Готово:', DIST)
    if over:
        print('\nСтало больше листов, чем задумано: ' + ', '.join(over))
        print('Проверьте вёрстку, прежде чем отдавать документ.')
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
