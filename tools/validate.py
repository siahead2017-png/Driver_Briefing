# -*- coding: utf-8 -*-
"""Линтер data/briefing.json.

Ловит то, что ломается молча: дубли id, опечатку в level и — главное —
ссылку на карточку базы знаний, которой там больше нет. Битая ссылка
обнаруживается только когда её при водителе открываешь, поэтому проверяем
заранее.

Запуск:  py tools/validate.py
Код возврата 1, если найдены ошибки.
"""
import io
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'data', 'briefing.json')

# Локальная копия базы знаний. Лежит рядом только на машине разработки —
# если её нет, проверку ссылок пропускаем, но об этом говорим вслух.
KB = os.path.join(HERE, '..', '..', 'Dashboard_Instructions', 'data', 'instructions.json')

LEVELS = {'say', 'show', 'skip'}

errors = []
warnings = []


def load_kb_ids():
    if not os.path.exists(KB):
        return None
    with io.open(KB, encoding='utf-8') as f:
        return {it['id'] for it in json.load(f)['items']}


def main():
    with io.open(DATA, encoding='utf-8') as f:
        data = json.load(f)

    kb_ids = load_kb_ids()
    if kb_ids is None:
        warnings.append(
            'Базы знаний нет рядом ({}), ссылки в неё не проверены.'.format(
                os.path.normpath(KB)))

    seen_blocks, seen_items = set(), set()
    total_items = 0
    total_minutes = 0

    for b in data['blocks']:
        if b['id'] in seen_blocks:
            errors.append(f'Дубль id блока: {b["id"]}')
        seen_blocks.add(b['id'])
        total_minutes += b['minutes']

        for it in b['items']:
            total_items += 1
            if it['id'] in seen_items:
                errors.append(f'Дубль id пункта: {it["id"]}')
            seen_items.add(it['id'])

            if it['level'] not in LEVELS:
                errors.append(
                    f'{it["id"]}: неизвестный level "{it["level"]}", '
                    f'допустимы {sorted(LEVELS)}')

            if not it.get('text', '').strip():
                errors.append(f'{it["id"]}: пустой text')

            # Ссылки в базу знаний
            refs = []
            if it.get('link'):
                refs.append(it['link'])
            refs += [l['id'] for l in it.get('links', [])]

            if kb_ids is not None:
                for r in refs:
                    if r not in kb_ids:
                        errors.append(
                            f'{it["id"]}: карточки "{r}" нет в базе знаний')

            # Таблица: у всех строк должно быть столько же колонок, сколько в шапке
            t = it.get('table')
            if t:
                w = len(t['head'])
                for i, row in enumerate(t['rows']):
                    if len(row) != w:
                        errors.append(
                            f'{it["id"]}: строка таблицы {i + 1} — '
                            f'{len(row)} колонок вместо {w}')

    # Легенда должна описывать ровно те уровни, которые используются
    if set(data['legend']) != LEVELS:
        errors.append('legend не совпадает с набором уровней')

    print(f'Блоков: {len(data["blocks"])}, пунктов: {total_items}, '
          f'план: {total_minutes} мин')

    for w in warnings:
        print('  ! ' + w)
    for e in errors:
        print('  ОШИБКА: ' + e)

    if errors:
        print(f'\nНайдено ошибок: {len(errors)}')
        return 1

    print('Ошибок нет.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
