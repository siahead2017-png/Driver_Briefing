# -*- coding: utf-8 -*-
"""Линтер data/briefing.json.

Содержимое правят руками в веб-редакторе GitHub, поэтому проверка написана
для человека, а не для программиста: она НЕ падает трейсбеком, а собирает
все проблемы за один прогон и называет их по-русски.

Ловит то, что ломается молча:
  * сломанный синтаксис JSON — с номером строки;
  * пропавший ключ (страница молча падает на первом обращении);
  * ссылку на карточку базы знаний, которой там больше нет;
  * пункт с link, но без linkTitle — он исчезнет с бумаги;
  * QR, для которого нет файла;
  * непарные фигурные скобки в слотах {имя};
  * «голый» пункт, где ведущему нечего сказать кроме заголовка.

Запуск:  py -X utf8 tools/validate.py
Код возврата 1, если найдены ошибки (предупреждения не считаются).
"""
import datetime as dt
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..'))
DATA = os.path.join(ROOT, 'data', 'briefing.json')
QR_DIR = os.path.join(ROOT, 'assets', 'qr')

# Локальная копия базы знаний. Лежит рядом только на машине разработки —
# если её нет, проверку ссылок пропускаем, но об этом говорим вслух.
KB = os.path.join(ROOT, '..', 'Dashboard_Instructions', 'data', 'instructions.json')

LEVELS = {'say', 'show', 'skip'}

errors = []
warnings = []


def err(msg):
    errors.append(msg)


def warn(msg):
    warnings.append(msg)


def need(obj, key, where):
    """Обязательный ключ. Возвращает значение или None — тогда проверки
    по этому объекту дальше пропускаются, но остальные продолжают идти."""
    if not isinstance(obj, dict) or key not in obj:
        err(f'{where}: нет обязательного поля "{key}"')
        return None
    return obj[key]


def load_kb_ids():
    if not os.path.exists(KB):
        return None
    with open(KB, encoding='utf-8') as f:
        return {it['id'] for it in json.load(f)['items']}


def check_slots(text, where):
    """Слот — это {имя} внутри текста: место, которое ведущий подставляет
    голосом. Незакрытая скобка выведется на экран как есть."""
    if text.count('{') != text.count('}'):
        err(f'{where}: непарные фигурные скобки — слот {{…}} не закрыт')
    if '{}' in text.replace(' ', ''):
        err(f'{where}: пустой слот {{}} — внутри должно быть слово, например {{имя}}')


def check_blocks(data, kb_ids):
    blocks = need(data, 'blocks', 'корень файла')
    if not isinstance(blocks, list) or not blocks:
        err('раздел "blocks" пуст или это не список')
        return 0, 0

    seen_blocks, seen_items = set(), set()
    total_items = total_minutes = 0

    for i, b in enumerate(blocks):
        bid = b.get('id') or f'блок №{i + 1}'
        where = f'блок "{bid}"'

        if need(b, 'id', where) and b['id'] in seen_blocks:
            err(f'{where}: дубль id блока')
        seen_blocks.add(b.get('id'))

        need(b, 'title', where)
        need(b, 'num', where)

        minutes = need(b, 'minutes', where)
        if minutes is not None:
            if isinstance(minutes, (int, float)):
                total_minutes += minutes
            else:
                err(f'{where}: "minutes" должно быть числом, а не текстом')

        items = need(b, 'items', where)
        if not isinstance(items, list):
            continue
        if not items:
            warn(f'{where}: пустой список пунктов — блок сразу считается пройденным')

        for it in items:
            total_items += 1
            check_item(it, where, seen_items, kb_ids)

    return total_items, total_minutes


def check_item(it, block_where, seen_items, kb_ids):
    iid = it.get('id') or '(пункт без id)'
    where = f'пункт "{iid}"'

    if need(it, 'id', block_where) and it['id'] in seen_items:
        err(f'{where}: дубль id пункта')
    seen_items.add(it.get('id'))

    level = need(it, 'level', where)
    if level is not None and level not in LEVELS:
        err(f'{where}: неизвестный level "{level}", допустимы {sorted(LEVELS)}')

    text = need(it, 'text', where)
    if text is not None and not str(text).strip():
        err(f'{where}: пустой text')

    for field in ('text', 'quote'):
        if isinstance(it.get(field), str):
            check_slots(it[field], f'{where}, поле "{field}"')

    # На бумаге печатается linkTitle. Без него пункт молча терял ссылку —
    # теперь есть фолбэк на id, но писать так всё равно не надо.
    if it.get('link') and not it.get('linkTitle'):
        err(f'{where}: есть "link", но нет "linkTitle" — на бумаге будет виден id карточки')
    if it.get('href') and not it.get('linkTitle'):
        warn(f'{where}: есть "href", но нет "linkTitle"')

    refs = []
    if it.get('link'):
        refs.append(it['link'])
    for l in it.get('links', []):
        if not l.get('id'):
            err(f'{where}: в "links" есть запись без "id"')
        elif not l.get('title'):
            err(f'{where}: в "links" у "{l["id"]}" нет "title"')
        else:
            refs.append(l['id'])

    if kb_ids is not None:
        for r in refs:
            if r not in kb_ids:
                err(f'{where}: карточки "{r}" нет в базе знаний')

    t = it.get('table')
    if t:
        head = need(t, 'head', f'{where}, таблица')
        rows = t.get('rows')
        if head is not None and isinstance(rows, list):
            for n, row in enumerate(rows):
                if len(row) != len(head):
                    err(f'{where}: строка таблицы {n + 1} — '
                        f'{len(row)} колонок вместо {len(head)}')

    # Ведущему нечего сказать, кроме заголовка
    has_body = any(it.get(k) for k in
                   ('note', 'quote', 'checklist', 'table', 'link', 'href', 'links'))
    if not has_body:
        warn(f'{where}: голый пункт — ни пояснения, ни ссылки, ведущему нечего добавить')
    elif it.get('level') == 'show' and not (
            it.get('note') or it.get('checklist') or it.get('link') or it.get('href')):
        # note тоже годится: в нём ведущему объясняют, что именно показывать.
        warn(f'{where}: level "show" (показать руками), но не сказано, что именно показывать')


def check_cheatsheet(data):
    cs = need(data, 'cheatsheet', 'корень файла')
    if not isinstance(cs, dict):
        return

    need(cs, 'title', 'cheatsheet')
    for g in cs.get('groups', []):
        gt = g.get('title', '(без названия)')
        for n, r in enumerate(g.get('rows', [])):
            if not str(r.get('text', '')).strip():
                err(f'памятка, группа "{gt}", строка {n + 1}: пустой текст')

    for q in cs.get('qr', []):
        f = q.get('file')
        if not f:
            err('памятка: в разделе "qr" есть запись без "file"')
        elif not os.path.exists(os.path.join(QR_DIR, f + '.svg')):
            err(f'памятка: нет файла assets/qr/{f}.svg — в PDF будет битая картинка')


def check_contacts(data):
    c = need(data, 'contacts', 'корень файла')
    if not isinstance(c, dict):
        return
    for g in c.get('groups', []):
        gt = g.get('title', '(без названия)')
        for n, r in enumerate(g.get('rows', [])):
            if not str(r.get('phone', '')).strip():
                err(f'контакты, группа "{gt}", строка {n + 1}: пустой телефон')
            if not str(r.get('name', '')).strip():
                err(f'контакты, группа "{gt}", строка {n + 1}: пустое имя')


def check_guide(data):
    g = data.get('guide')
    if g is None:
        warn('нет раздела "guide" — коллеге негде прочитать, как вести инструктаж')
        return

    need(g, 'title', 'guide')
    sections = g.get('sections')
    if not isinstance(sections, list) or not sections:
        err('guide: нет разделов "sections" или список пуст')
        return

    for n, s in enumerate(sections):
        where = f'guide, раздел {n + 1}'
        if not str(s.get('title', '')).strip():
            warn(f'{where}: нет заголовка')
        if not str(s.get('text', '')).strip() and not s.get('items'):
            warn(f'{where}: пустой — ни текста, ни списка')
        for field in ('title', 'text'):
            if isinstance(s.get(field), str):
                check_slots(s[field], f'{where}, поле "{field}"')
        for i in s.get('items', []):
            if isinstance(i, str):
                check_slots(i, where)


def check_updated(data):
    """Дата в шапке сайта и всех PDF. Легко забыть при правке содержимого."""
    u = data.get('updated')
    if not u:
        err('нет поля "updated" — дата не попадёт в шапку')
        return
    if not re.fullmatch(r'\d{2}\.\d{2}\.\d{4}', str(u)):
        err(f'"updated": ожидается формат ДД.ММ.ГГГГ, а не "{u}"')
        return

    try:
        stated = dt.datetime.strptime(u, '%d.%m.%Y').date()
    except ValueError:
        err(f'"updated": несуществующая дата "{u}"')
        return

    changed = dt.date.fromtimestamp(os.path.getmtime(DATA))
    if stated < changed:
        warn(f'"updated" = {u}, а файл менялся {changed.strftime("%d.%m.%Y")} — '
             f'дата в шапке сайта и во всех PDF устарела')


def main():
    try:
        with open(DATA, encoding='utf-8') as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        print(f'Файл data/briefing.json сломан: строка {e.lineno}, символ {e.colno} — {e.msg}.')
        print('Чаще всего это лишняя или пропущенная запятая. Откройте файл на GitHub,')
        print('вкладка History → предыдущий коммит, и сравните.')
        return 1
    except OSError as e:
        print(f'Не удалось открыть {DATA}: {e}')
        return 1

    kb_ids = load_kb_ids()
    if kb_ids is None:
        warn(f'Базы знаний нет рядом ({os.path.normpath(KB)}), ссылки в неё не проверены.')

    for key in ('title', 'subtitle', 'kbBase'):
        need(data, key, 'корень файла')

    legend = data.get('legend')
    if not isinstance(legend, dict) or set(legend) != LEVELS:
        err(f'"legend" должен описывать ровно уровни {sorted(LEVELS)}')

    check_updated(data)
    total_items, total_minutes = check_blocks(data, kb_ids)
    check_guide(data)
    check_cheatsheet(data)
    check_contacts(data)

    blocks_n = len(data['blocks']) if isinstance(data.get('blocks'), list) else 0
    print(f'Блоков: {blocks_n}, пунктов: {total_items}, план: {total_minutes} мин')

    for w in warnings:
        print('  ! ' + w)
    for e in errors:
        print('  ОШИБКА: ' + e)

    if errors:
        print(f'\nНайдено ошибок: {len(errors)}. Их нужно исправить.')
        return 1

    if warnings:
        print(f'\nОшибок нет. Предупреждений: {len(warnings)} — можно жить, но лучше посмотреть.')
    else:
        print('Ошибок нет.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
