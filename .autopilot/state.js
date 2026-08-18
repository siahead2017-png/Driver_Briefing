window.STATE =
{
  "slug": "driver-briefing-rework",
  "title": "Пересмотр сценария инструктажа по новой записи",
  "mode": "interview",
  "depth": "normal",
  "polish": null,
  "tier": "T0",
  "briefFile": "2026-08-18-brief.md",
  "memoryFile": "CLAUDE.md",
  "startedAt": "2026-08-18T12:50:35+03:00",
  "updatedAt": "2026-08-18T13:22:48+03:00",
  "finishedAt": "2026-08-18T13:22:48+03:00",
  "stages": [
    { "id": "preflight", "status": "done", "startedAt": "2026-08-18T12:50:35+03:00", "finishedAt": "2026-08-18T12:52:10+03:00" },
    { "id": "manifest",  "status": "done", "startedAt": "2026-08-18T12:52:10+03:00", "finishedAt": "2026-08-18T12:56:40+03:00" },
    { "id": "briefing",  "status": "done", "startedAt": "2026-08-18T12:56:40+03:00", "finishedAt": "2026-08-18T13:18:00+03:00" },
    { "id": "spec",      "status": "done", "startedAt": "2026-08-18T13:18:00+03:00", "finishedAt": "2026-08-18T13:35:00+03:00" },
    { "id": "plan",      "status": "skipped", "note": "ярус T0 — без разбивки на таски" },
    { "id": "build",     "status": "done", "startedAt": "2026-08-18T13:35:00+03:00", "finishedAt": "2026-08-18T13:19:45+03:00" },
    { "id": "review",    "status": "done", "note": "T0 — все три оси инлайн, коммит a8bfc4c" },
    { "id": "final",     "status": "done", "startedAt": "2026-08-18T13:19:45+03:00", "finishedAt": "2026-08-18T13:22:48+03:00" }
  ],
  "requirements": {
    "total": 10, "done": 7, "inTicket": 0, "inSpec": 0,
    "placeholder": 0, "deferred": 3, "dropped": 0
  },
  "tickets": [],
  "singlePass": {
    "files": ["data/briefing.json", "CLAUDE.md"],
    "tests": "py -X utf8 tools/validate.py -> 6 блоков, 42 пункта, 30 мин, ошибок нет",
    "commit": "a8bfc4c"
  },
  "tests": "green",
  "debt": { "placeholders": [], "assumptions": [], "emptyEnv": [] },
  "additions": [],
  "coverage": { "findings": 11, "action": "spec переписан: конкретный текст для калькулятора/боксов/EUROVIGNETTE, строка-предохранитель в checklist, critical на блоке 0, checklist для показа видео, явное пояснение по блоку 4" },
  "blind": {
    "agreed": ["R03i (лимиты видимые)", "G01 (таблица карт)", "G02 (фраза про отдел контроля убрана)", "блок 0/5 (рамка и что-сделать-после видимые)"],
    "drift": ["R04 «объединим или уберём»: слияние блоков сделано, но пунктов не убавилось — объём скорее вырос (независимая проверка: «признаков удаления пунктов не найдено»)"],
    "expectedMismatch": ["G01 vs исходная формулировка брифа «2 основные + 2 ловушки» — пользователь сам отменил это решение в интервью (18.08), это не потеряно, а сознательно переигранная договорённость, брифу не противоречит по построению (манифест ей и не был gated)"]
  }
}
