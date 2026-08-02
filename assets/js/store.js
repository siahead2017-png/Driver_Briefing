/* Состояние инструктажа в localStorage.
   Хранится ровно то, что нужно пережить перезагрузку страницы:
   отмеченные пункты, раскрытые блоки и накопленное время таймера. */

const KEY = 'briefing.v1';

const empty = () => ({
  checked: {},     // id пункта -> true
  open: {},        // id блока  -> true
  elapsed: 0,      // накоплено секунд
  startedAt: null  // timestamp запуска, null если на паузе
});

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    return Object.assign(empty(), JSON.parse(raw));
  } catch {
    // Битый или недоступный localStorage не должен ронять страницу:
    // инструктаж важнее сохранённого прогресса.
    return empty();
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch { /* приватный режим — работаем без сохранения */ }
}

export const isChecked = id => !!state.checked[id];

export function toggle(id) {
  if (state.checked[id]) delete state.checked[id];
  else state.checked[id] = true;
  save();
  return isChecked(id);
}

export const isOpen = id => !!state.open[id];

export function setOpen(id, open) {
  if (open) state.open[id] = true;
  else delete state.open[id];
  save();
}

/* ---------- Таймер ---------- */

export function seconds() {
  const extra = state.startedAt ? (Date.now() - state.startedAt) / 1000 : 0;
  return Math.floor(state.elapsed + extra);
}

export const isRunning = () => state.startedAt !== null;

export function toggleTimer() {
  if (state.startedAt) {
    state.elapsed += (Date.now() - state.startedAt) / 1000;
    state.startedAt = null;
  } else {
    state.startedAt = Date.now();
  }
  save();
  return isRunning();
}

/* Только время. Отдельно от resetAll: таймер часто запускают заранее,
   пока водитель идёт, и сбрасывать вместе с ним все отметки не нужно. */
export function resetTimer() {
  state.elapsed = 0;
  state.startedAt = null;
  save();
}

export function resetAll() {
  state = empty();
  save();
}
