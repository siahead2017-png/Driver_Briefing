/* index.html подключает этот файл с ?v=… ради обхода кэша PWA. Статический
   import той же версии не наследует и приезжает из кэша — поэтому импортируем
   динамически, передавая дальше ту же версию (import.meta.url её уже содержит).
   Иначе правки store.js и util.js не доедут до телефона. */
const v = new URL(import.meta.url).search;
const store = await import('./store.js' + v);
const { esc, plural, slots } = await import('./util.js' + v);

const $ = sel => document.querySelector(sel);
const app = $('#app');

let data = null;

/* Высота шапки сайта плавает (заголовок переносится на узких экранах,
   subtitle разной длины) — прилипающая шапка раскрытой карточки должна
   останавливаться точно под ней, а не под фиксированным числом. */
function syncHeaderHeight() {
  document.documentElement.style.setProperty('--hdr-h', `${$('.hdr').offsetHeight}px`);
}
new ResizeObserver(syncHeaderHeight).observe($('.hdr'));
syncHeaderHeight();

/* ---------- Утилиты ---------- */

const mmss = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/* Ссылка в базу знаний: id карточки -> прямой URL на неё. */
const kbUrl = id => data.kbBase + id;

function linkTag(href, title) {
  return `<a class="lnk" href="${esc(href)}" target="_blank" rel="noopener">${esc(title)}</a>`;
}

/* ---------- Рендер ---------- */

function renderLinks(item) {
  const out = [];
  if (item.link) out.push(linkTag(kbUrl(item.link), item.linkTitle || item.link));
  if (item.href) out.push(linkTag(item.href, item.linkTitle || item.href));
  for (const l of item.links || []) out.push(linkTag(kbUrl(l.id), l.title));
  return out.length ? `<div class="links">${out.join('')}</div>` : '';
}

function renderTable(t) {
  if (!t) return '';
  const head = t.head.map(h => `<th>${esc(h)}</th>`).join('');
  const rows = t.rows
    .map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`)
    .join('');
  return `<div class="tbl-wrap"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderItem(item) {
  const cls = [
    'item',
    `item--${item.level}`,
    item.critical ? 'item--critical' : '',
    store.isChecked(item.id) ? 'is-checked' : ''
  ].filter(Boolean).join(' ');

  const money = item.money ? `<span class="money">${esc(item.money)}</span>` : '';
  const note = item.note ? `<p class="note">${esc(item.note)}</p>` : '';
  const quote = item.quote ? `<p class="quote">${slots(item.quote)}</p>` : '';
  const list = item.checklist
    ? `<ul class="check">${item.checklist.map(c => `<li>${esc(c)}</li>`).join('')}</ul>`
    : '';

  return `
    <div class="${cls}" data-item="${esc(item.id)}">
      <button class="item__box" type="button" aria-label="Отметить: ${esc(item.text)}"
              aria-pressed="${store.isChecked(item.id)}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
      </button>
      <div class="item__main">
        <div class="item__text">${slots(item.text)}${money}</div>
        ${list}${renderTable(item.table)}${quote}${note}${renderLinks(item)}
      </div>
    </div>`;
}

function blockStats(block) {
  const total = block.items.length;
  const done = block.items.filter(i => store.isChecked(i.id)).length;
  // Пустой блок (заготовка «наполню потом») иначе сразу зелёный: 0 === 0.
  return { total, done, isDone: total > 0 && done === total };
}

function renderBlock(block) {
  const { total, done, isDone } = blockStats(block);
  const cls = [
    'block',
    store.isOpen(block.id) ? 'is-open' : '',
    isDone ? 'is-done' : ''
  ].filter(Boolean).join(' ');

  return `
    <section class="${cls}" data-block="${esc(block.id)}">
      <button class="block__head" type="button" aria-expanded="${store.isOpen(block.id)}">
        <span class="block__num">${block.num}</span>
        <span class="block__t">
          <span class="block__title">${esc(block.title)}</span>
          <span class="block__meta">${block.minutes} мин · ${done} из ${total}</span>
        </span>
        <svg class="block__chev" viewBox="0 0 24 24" width="20" height="20"
             fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="block__body">
        ${block.goal ? `<p class="goal"><b>Задача блока:</b> ${esc(block.goal)}</p>` : ''}
        ${block.note ? `<p class="goal">${esc(block.note)}</p>` : ''}
        ${block.items.map(renderItem).join('')}
      </div>
    </section>`;
}

function renderLegend() {
  const l = data.legend;
  $('#legend').innerHTML = [
    ['say', l.say], ['show', l.show], ['skip', l.skip]
  ].map(([k, t]) => `<span><i class="dot dot--${k}"></i>${esc(t)}</span>`).join('');
}

/* Карточка «Как вести инструктаж» — для коллеги, который проводит впервые.
   Свёрнута по умолчанию и состояние намеренно не сохраняется: во время
   инструктажа она гарантированно не занимает экран. */
function renderGuide() {
  const g = data.guide;

  // Раздела нет — говорим об этом вслух, а не молчим. checkShape() сюда не
  // достаёт намеренно: без "guide" инструктаж вести всё ещё можно, ронять из-за
  // него всю страницу неправильно. Но и тихо исчезать нельзя — владелец правит
  // JSON в веб-редакторе GitHub, и удалённый ключ он замечал бы только тогда,
  // когда коллега перед первым инструктажем не найдёт, что читать.
  if (!g || !Array.isArray(g.sections)) {
    $('#guide').innerHTML = `<p class="note">В <code>data/briefing.json</code> нет
      раздела <b>"guide"</b> (или в нём нет списка <b>"sections"</b>) — карточка
      «Как вести инструктаж» не собралась. Сам сценарий ниже работает.</p>`;
    $('#guide').hidden = false;
    return;
  }

  const sections = g.sections.map(s => `
    <div class="guide__sec">
      ${s.title ? `<h3>${esc(s.title)}</h3>` : ''}
      ${s.text ? `<p>${slots(s.text)}</p>` : ''}
      ${(s.items || []).length
        ? `<ul class="check">${s.items.map(i => `<li>${slots(i)}</li>`).join('')}</ul>`
        : ''}
    </div>`).join('');

  $('#guide').innerHTML = `
    <details class="guide">
      <summary><b>${esc(g.title)}</b> — прочитайте один раз</summary>
      <div class="guide__body">
        ${g.lead ? `<p class="guide__lead">${esc(g.lead)}</p>` : ''}
        ${sections}
      </div>
    </details>`;
  $('#guide').hidden = false;
}

function renderStat() {
  if (!data) return;   // setInterval может опередить загрузку

  const items = data.blocks.flatMap(b => b.items);
  const done = items.filter(i => store.isChecked(i.id)).length;
  const total = items.length;
  const plan = data.blocks.reduce((s, b) => s + b.minutes, 0);
  const pct = total ? (done / total) * 100 : 0;

  const bar = $('#bar');
  bar.setAttribute('aria-valuenow', String(Math.round(pct)));
  bar.setAttribute('aria-valuetext',
    `${done} из ${total} ${plural(total, 'пункта', 'пунктов', 'пунктов')}`);
  $('#barFill').style.width = `${pct}%`;

  // Пока таймер не трогали — показываем план, а не пугающий ноль.
  const spent = Math.floor(store.seconds() / 60);
  const time = store.seconds() > 0
    ? `прошло ${spent} из ${plan} мин`
    : `план ${plan} мин`;

  $('#stat').textContent =
    `${done} из ${total} ${plural(total, 'пункта', 'пунктов', 'пунктов')} · ${time}`;
}

function renderAll() {
  app.innerHTML = data.blocks.map(renderBlock).join('');
  renderStat();
}

/* Точечное обновление — не перерисовываем всё дерево при каждом клике,
   иначе закрывается раскрытый блок и теряется позиция скролла. */
function refreshBlockMeta(blockEl) {
  const block = data.blocks.find(b => b.id === blockEl.dataset.block);
  const { total, done, isDone } = blockStats(block);
  blockEl.querySelector('.block__meta').textContent = `${block.minutes} мин · ${done} из ${total}`;
  blockEl.classList.toggle('is-done', isDone);
}

/* ---------- События ---------- */

app.addEventListener('click', e => {
  const head = e.target.closest('.block__head');
  if (head) {
    const el = head.closest('.block');
    const open = !el.classList.contains('is-open');
    el.classList.toggle('is-open', open);
    head.setAttribute('aria-expanded', String(open));
    store.setOpen(el.dataset.block, open);
    return;
  }

  const box = e.target.closest('.item__box');
  if (box) {
    const item = box.closest('.item');
    const on = store.toggle(item.dataset.item);
    item.classList.toggle('is-checked', on);
    box.setAttribute('aria-pressed', String(on));
    refreshBlockMeta(item.closest('.block'));
    renderStat();
  }
});

$('#reset').addEventListener('click', () => {
  if (!confirm('Сбросить все отметки и таймер — начать инструктаж с новым водителем?')) return;
  store.resetAll();
  renderAll();
  paintTimer();
});

/* ---------- Таймер ---------- */

function paintTimer() {
  const el = $('#timer');
  el.textContent = mmss(store.seconds());
  el.classList.toggle('is-running', store.isRunning());
  renderStat();   // в строке статистики живут те же минуты
}

/* Долгое нажатие сбрасывает только время, отметки не трогает. Нужно, когда
   таймер запустили заранее, пока водитель шёл: «Сбросить для нового водителя»
   для этого не годится — она заодно снимает все галочки. */
const timerEl = $('#timer');
let holdTimer = null;
let didHold = false;

timerEl.addEventListener('pointerdown', () => {
  didHold = false;
  holdTimer = setTimeout(() => {
    didHold = true;
    if (confirm('Сбросить время? Отметки останутся.')) {
      store.resetTimer();
      paintTimer();
    }
  }, 600);
});

for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) {
  timerEl.addEventListener(ev, () => clearTimeout(holdTimer));
}

timerEl.addEventListener('click', () => {
  // После долгого нажатия браузер всё равно шлёт click — иначе таймер
  // сбросился бы и тут же запустился заново.
  if (didHold) { didHold = false; return; }
  store.toggleTimer();
  paintTimer();
});

setInterval(() => { if (store.isRunning()) paintTimer(); }, 1000);

/* ---------- Старт ---------- */

/* Содержимое правят руками в веб-редакторе GitHub. Сломанный синтаксис там
   подсветит сам GitHub, а вот «удалил или переименовал ключ» не поймает никто:
   JSON остаётся валидным, а страница молча падает на первом же обращении.
   Поэтому проверяем форму заранее и называем недостающий ключ по имени. */
function checkShape(d) {
  const need = (ok, msg) => { if (!ok) throw new Error(msg); };

  need(d && typeof d === 'object', 'файл пустой или это не объект');
  need(Array.isArray(d.blocks) && d.blocks.length, 'нет раздела "blocks" или он пуст');
  need(d.legend && d.legend.say && d.legend.show && d.legend.skip,
       'в разделе "legend" не хватает say / show / skip');
  need(typeof d.kbBase === 'string', 'нет "kbBase" — ссылки в базу знаний не соберутся');

  d.blocks.forEach((b, i) => {
    need(b.id, `у блока №${i + 1} нет "id"`);
    need(Array.isArray(b.items), `у блока "${b.id}" нет списка "items"`);
    need(typeof b.minutes === 'number', `у блока "${b.id}" нет числа "minutes"`);
  });
}

const fail = html => { app.innerHTML = `<p class="note">${html}</p>`; };

(async function init() {
  let raw;
  try {
    // Браузер агрессивно кеширует JSON — версия в query даёт свежий файл после правок.
    const res = await fetch(`data/briefing.json?v=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    raw = await res.json();
  } catch (err) {
    fail(`Не удалось загрузить данные инструктажа: ${esc(err.message)}.<br>
      Страницу нужно открывать через сервер (<code>.\\serve.ps1</code>), а не двойным щелчком по файлу.`);
    return;
  }

  // Отдельная ветка: файл загрузился, но внутри что-то не то. Здесь нужен
  // не «проверьте сервер», а «идите в файл и сравните с прошлой версией».
  try {
    checkShape(raw);
    data = raw;

    document.title = `${data.title} — HEAD, HDLG`;
    $('#sub').textContent = `${data.subtitle} · обновлено ${data.updated}`;
    renderLegend();
    renderGuide();
    renderAll();
    paintTimer();
    $('#reset').disabled = false;
  } catch (err) {
    fail(`Файл <code>data/briefing.json</code> загрузился, но в нём ошибка:<br>
      <b>${esc(err.message)}</b>.<br><br>
      Откройте <code>data/briefing.json</code> на GitHub и сравните с предыдущей
      версией: вкладка History → предыдущий коммит.`);
  }
})();
