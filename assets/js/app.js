import * as store from './store.js';

const $ = sel => document.querySelector(sel);
const app = $('#app');

let data = null;

/* ---------- Утилиты ---------- */

// Весь текст приходит из JSON и вставляется через innerHTML — экранируем.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// «1 пункт», «2 пункта», «5 пунктов»
function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

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
  const quote = item.quote ? `<p class="quote">${esc(item.quote)}</p>` : '';
  const list = item.checklist
    ? `<ul class="check">${item.checklist.map(c => `<li>${esc(c)}</li>`).join('')}</ul>`
    : '';

  return `
    <div class="${cls}" data-item="${esc(item.id)}">
      <button class="item__box" type="button" aria-label="Отметить пройденным"
              aria-pressed="${store.isChecked(item.id)}">
        <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
      </button>
      <div class="item__main">
        <div class="item__text">${esc(item.text)}${money}</div>
        ${list}${renderTable(item.table)}${quote}${note}${renderLinks(item)}
      </div>
    </div>`;
}

function blockStats(block) {
  const total = block.items.length;
  const done = block.items.filter(i => store.isChecked(i.id)).length;
  return { total, done };
}

function renderBlock(block) {
  const { total, done } = blockStats(block);
  const cls = [
    'block',
    store.isOpen(block.id) ? 'is-open' : '',
    done === total ? 'is-done' : ''
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

function renderProgress() {
  const items = data.blocks.flatMap(b => b.items);
  const done = items.filter(i => store.isChecked(i.id)).length;
  const total = items.length;
  const minutes = data.blocks.reduce((s, b) => s + b.minutes, 0);

  $('#barFill').style.width = total ? `${(done / total) * 100}%` : '0';
  $('#stat').textContent =
    `${done} из ${total} ${plural(total, 'пункта', 'пунктов', 'пунктов')} · план ${minutes} мин`;
}

function renderAll() {
  app.innerHTML = data.blocks.map(renderBlock).join('');
  renderProgress();
}

/* Точечное обновление — не перерисовываем всё дерево при каждом клике,
   иначе закрывается раскрытый блок и теряется позиция скролла. */
function refreshBlockMeta(blockEl) {
  const block = data.blocks.find(b => b.id === blockEl.dataset.block);
  const { total, done } = blockStats(block);
  blockEl.querySelector('.block__meta').textContent = `${block.minutes} мин · ${done} из ${total}`;
  blockEl.classList.toggle('is-done', done === total);
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
    renderProgress();
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
}

$('#timer').addEventListener('click', () => {
  store.toggleTimer();
  paintTimer();
});

setInterval(() => { if (store.isRunning()) paintTimer(); }, 1000);

/* ---------- Старт ---------- */

(async function init() {
  try {
    // Браузер агрессивно кеширует JSON — версия в query даёт свежий файл после правок.
    const res = await fetch(`data/briefing.json?v=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    app.innerHTML = `<p class="note">Не удалось загрузить данные инструктажа: ${esc(err.message)}.<br>
      Страницу нужно открывать через сервер (<code>.\\serve.ps1</code>), а не двойным щелчком по файлу.</p>`;
    return;
  }

  document.title = `${data.title} — HEAD, HDLG`;
  $('#sub').textContent = `${data.subtitle} · обновлено ${data.updated}`;
  renderLegend();
  renderAll();
  paintTimer();
})();
