/* Печатная версия. Один JSON — три разные бумаги:
   ?doc=script — сценарий ведущего, ?doc=cheat — памятка водителю,
   ?doc=contacts — контакты офиса. */

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// «1 минуту», «32 минуты», «35 минут»
function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

const DOCS = ['script', 'cheat', 'contacts'];
const rawDoc = new URLSearchParams(location.search).get('doc');
const doc = DOCS.includes(rawDoc) ? rawDoc : 'script';

function headTag(data, title) {
  return `<div class="head">
    <h1>${esc(title)}</h1>
    <div class="who">${esc(data.subtitle)}<br>обновлено ${esc(data.updated)}</div>
  </div>`;
}

/* ---------- Сценарий ведущего ---------- */

function renderRow(item) {
  const cls = ['row', `row--${item.level}`, item.critical ? 'row--critical' : ''].filter(Boolean).join(' ');
  const tag = item.money ? `<span class="tag">${esc(item.money)}</span>` : '';

  const list = item.checklist
    ? `<ul class="sub">${item.checklist.map(c => `<li>${esc(c)}</li>`).join('')}</ul>` : '';

  const table = item.table
    ? `<table><thead><tr>${item.table.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
       <tbody>${item.table.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '';

  const quote = item.quote ? `<p class="q">${esc(item.quote)}</p>` : '';
  const note = item.note ? `<p class="nt">${esc(item.note)}</p>` : '';

  // На бумаге URL бесполезен — печатаем название карточки, искать её водитель
  // будет поиском в базе.
  const refs = [];
  if (item.linkTitle) refs.push(item.linkTitle);
  for (const l of item.links || []) refs.push(l.title);
  const ref = refs.length ? `<p class="ref">${esc(refs.join(' · '))}</p>` : '';

  return `<div class="${cls}">
    <span class="box"></span>
    <div class="row__b"><span class="row__t">${esc(item.text)}${tag}</span>${list}${table}${quote}${note}${ref}</div>
  </div>`;
}

function renderScript(data) {
  const l = data.legend;
  const legend = [['say', l.say], ['show', l.show], ['skip', l.skip]]
    .map(([k, t]) => {
      const color = { say: 'var(--say)', show: 'var(--show)', skip: 'var(--line)' }[k];
      return `<span><i style="background:${color}"></i>${esc(t)}</span>`;
    }).join('');

  const minutes = data.blocks.reduce((s, b) => s + b.minutes, 0);

  const blocks = data.blocks.map(b => `
    <div class="blk">
      <div class="blk__h">
        <span class="blk__n">${b.num}</span>
        <span class="blk__t">${esc(b.title)}</span>
        <span class="blk__m">${b.minutes} мин</span>
      </div>
      ${b.goal ? `<p class="blk__goal">${esc(b.goal)}</p>` : ''}
      ${b.items.map(renderRow).join('')}
    </div>`).join('');

  return `<div class="sheet">
    ${headTag(data, data.title)}
    <p class="lead">Сценарий на ${minutes} ${plural(minutes, 'минуту', 'минуты', 'минут')}.
       Отмечайте пройденное. Пункты со сплошной рамкой — обязательны к проговариванию,
       серые — только назвать раздел базы знаний.</p>
    <div class="leg">${legend}</div>
    ${blocks}
    <p class="foot">Полные инструкции, видео и калькулятор топлива — в базе знаний HEAD, HDLG.</p>
  </div>`;
}

/* ---------- Памятка водителя ---------- */

function renderCheat(data) {
  const cs = data.cheatsheet;
  let n = 0;

  const groups = cs.groups.map(g => `
    <div class="grp">
      <div class="grp__t">${esc(g.title)}</div>
      ${g.rows.map(r => {
        n++;
        const tag = r.tag ? `<span class="tag">${esc(r.tag)}</span>` : '';
        return `<div class="cs"><span class="cs__n">${n}</span><span>${esc(r.text)}${tag}</span></div>`;
      }).join('')}
    </div>`).join('');

  const qr = cs.qr.map(q => `
    <div class="qr">
      <img src="assets/qr/${esc(q.file)}.svg" alt="QR: ${esc(q.title)}">
      <span><b>${esc(q.title)}</b>${esc(q.caption)}</span>
    </div>`).join('');

  return `<div class="sheet">
    ${headTag(data, cs.title)}
    <p class="lead">${esc(cs.lead)}</p>
    ${groups}
    <div class="qr-wrap">${qr}</div>
    <p class="foot">Наведите камеру телефона на QR — откроется сайт. Добавьте его на рабочий экран.</p>
  </div>`;
}

/* ---------- Контакты офиса ---------- */

function renderContacts(data) {
  const c = data.contacts;

  const groups = c.groups.map(g => `
    <div class="grp">
      <div class="grp__t">${esc(g.title)}</div>
      ${g.rows.map(r => `
        <div class="ct">
          <span class="ct__phone">${esc(r.phone)}</span>
          <span class="ct__b"><b>${esc(r.name)}</b>${r.note ? `<span class="ct__n">${esc(r.note)}</span>` : ''}</span>
        </div>`).join('')}
    </div>`).join('');

  return `<div class="sheet">
    ${headTag(data, c.title)}
    <p class="lead">${esc(c.lead)}</p>
    ${groups}
    ${c.note ? `<p class="foot">${esc(c.note)}</p>` : ''}
  </div>`;
}

/* ---------- Старт ---------- */

const RENDERERS = { script: renderScript, cheat: renderCheat, contacts: renderContacts };
const TITLE_OF = { script: d => d.title, cheat: d => d.cheatsheet.title, contacts: d => d.contacts.title };
const TAB_ID = { script: 'tabScript', cheat: 'tabCheat', contacts: 'tabContacts' };

(async function init() {
  const res = await fetch(`data/briefing.json?v=${Date.now()}`);
  const data = await res.json();

  document.getElementById('doc').innerHTML = RENDERERS[doc](data);
  document.title = TITLE_OF[doc](data) + ' — печать';
  document.getElementById(TAB_ID[doc])?.classList.add('is-active');

  // Сигнал для build_pdf.py: вёрстка готова, можно печатать.
  document.body.dataset.ready = '1';
})();
