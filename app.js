const STORAGE_KEY = 'fecha-a-conta';

const items = loadJSON(STORAGE_KEY, []);
const advancePayments = loadJSON(STORAGE_KEY + '-advance', []);

const form = document.getElementById('item-form');
const tbody = document.getElementById('items-body');
const table = document.getElementById('items-table');
const emptyMsg = document.getElementById('empty-msg');
const btnCalc = document.getElementById('btn-calculate');
const summaryDiv = document.getElementById('summary');
const combinationsSummary = document.getElementById('combinations-summary');
const totalValue = document.getElementById('total-value');
const btnReset = document.getElementById('btn-reset');
const btnWhatsapp = document.getElementById('btn-whatsapp');
const advanceForm = document.getElementById('advance-form');
const advanceAllocGrid = document.getElementById('advance-alloc-grid');
const advanceSumEl = document.getElementById('advance-sum');
const advanceList = document.getElementById('advance-list');
const noItemsMsg = document.getElementById('no-items-msg');

function init() {
  if (items.length > 0) renderItems();
  renderAdvanceForm();
  renderAdvanceList();
}

// ── Item form ──

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('item-name').value.trim();
  const price = parseFloat(document.getElementById('item-price').value);
  const qty = parseInt(document.getElementById('item-qty').value);
  const people = parseInt(document.getElementById('item-people').value);
  if (!name || isNaN(price) || isNaN(qty) || isNaN(people)) return;
  if (price <= 0 || qty <= 0 || people <= 0) return;

  items.push({ name, price, qty, people });
  saveJSON(STORAGE_KEY, items);
  renderItems();
  renderAdvanceForm();
  form.reset();
  document.getElementById('item-qty').value = 1;
  document.getElementById('item-people').value = 1;
  document.getElementById('item-name').focus();
});

function renderItems() {
  tbody.innerHTML = '';
  if (items.length === 0) {
    emptyMsg.classList.remove('hidden');
    table.classList.add('hidden');
    btnCalc.disabled = true;
    summaryDiv.classList.add('hidden');
    return;
  }
  emptyMsg.classList.add('hidden');
  table.classList.remove('hidden');
  btnCalc.disabled = false;

  items.forEach((item, index) => {
    const total = item.price * item.qty;
    const perPerson = total / item.people;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${esc(item.name)}</td>
      <td>R$ ${fmt(item.price)}</td>
      <td>${item.qty}</td>
      <td>${item.people}</td>
      <td>R$ ${fmt(total)}</td>
      <td>R$ ${fmt(perPerson)}</td>
      <td><button class="btn-remove" data-index="${index}">&times;</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.btn-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      items.splice(idx, 1);
      advancePayments.forEach((ap) => { ap.allocations.splice(idx, 1); });
      cleanAdvancePayments();
      saveJSON(STORAGE_KEY, items);
      saveJSON(STORAGE_KEY + '-advance', advancePayments);
      renderItems();
      renderAdvanceForm();
      renderAdvanceList();
    });
  });
}

// ── Advance payments form ──

function renderAdvanceForm() {
  if (items.length === 0) {
    noItemsMsg.classList.remove('hidden');
    advanceForm.classList.add('hidden');
    return;
  }
  noItemsMsg.classList.add('hidden');
  advanceForm.classList.remove('hidden');

  advanceAllocGrid.innerHTML = '';
  items.forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'advance-alloc-row';
    row.innerHTML = `
      <span class="alloc-name">${esc(item.name)} (R$ ${fmt(item.price * item.qty)})</span>
      <input type="number" class="alloc-input" data-index="${i}" min="0" step="0.01" placeholder="0,00" value="0">
    `;
    advanceAllocGrid.appendChild(row);
  });

  advanceAllocGrid.querySelectorAll('.alloc-input').forEach((input) => {
    input.addEventListener('input', updateAdvanceSum);
  });
  updateAdvanceSum();
}

function updateAdvanceSum() {
  let sum = 0;
  advanceAllocGrid.querySelectorAll('.alloc-input').forEach((input) => {
    sum += parseFloat(input.value) || 0;
  });
  advanceSumEl.textContent = `R$ ${fmt(sum)}`;
}

advanceForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('advance-name').value.trim();
  const allocations = [];
  let total = 0;
  advanceAllocGrid.querySelectorAll('.alloc-input').forEach((input) => {
    const val = parseFloat(input.value) || 0;
    allocations.push(val);
    total += val;
  });
  if (total <= 0) return;

  advancePayments.push({ name, value: total, allocations });
  saveJSON(STORAGE_KEY + '-advance', advancePayments);
  renderAdvanceList();
  advanceForm.reset();
  advanceAllocGrid.querySelectorAll('.alloc-input').forEach((input) => { input.value = '0'; });
  updateAdvanceSum();
});

function renderAdvanceList() {
  advanceList.innerHTML = '';
  advancePayments.forEach((ap, i) => {
    const div = document.createElement('div');
    div.className = 'advance-item';

    const breakdown = ap.allocations
      .map((amt, j) => amt > 0 ? `${items[j]?.name || '?'} R$ ${fmt(amt)}` : null)
      .filter(Boolean)
      .join(' + ');

    div.innerHTML = `
      <div class="advance-item-top">
        <span class="advance-name">${ap.name ? esc(ap.name) + ' — ' : ''}<span class="advance-total">R$ ${fmt(ap.value)}</span></span>
        <button class="btn-remove" data-index="${i}">&times;</button>
      </div>
      ${breakdown ? `<div class="advance-item-breakdown">${esc(breakdown)}</div>` : ''}
    `;
    advanceList.appendChild(div);
  });

  advanceList.querySelectorAll('.btn-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      advancePayments.splice(parseInt(btn.dataset.index), 1);
      saveJSON(STORAGE_KEY + '-advance', advancePayments);
      renderAdvanceList();
    });
  });
}

function cleanAdvancePayments() {
  for (let i = advancePayments.length - 1; i >= 0; i--) {
    if (advancePayments[i].allocations.length !== items.length) {
      advancePayments.splice(i, 1);
    }
  }
}

// ── Calculate ──

btnCalc.addEventListener('click', calculate);

function calculate() {
  const itemAdv = items.map(() => 0);

  advancePayments.forEach((ap) => {
    ap.allocations.forEach((amt, i) => {
      itemAdv[i] += amt;
    });
  });

  const perPerson = items.map((item, i) => {
    const remaining = (item.price * item.qty) - itemAdv[i];
    return { name: item.name, cost: remaining / item.people };
  });

  const grandTotal = items.reduce((s, item) => s + item.price * item.qty, 0);
  totalValue.textContent = `R$ ${fmt(grandTotal)}`;

  const combos = [];
  const n = perPerson.length;
  for (let mask = 1; mask < (1 << n); mask++) {
    const names = [];
    let total = 0;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        names.push(perPerson[i].name);
        total += perPerson[i].cost;
      }
    }
    combos.push({ names, total });
  }
  combos.sort((a, b) => a.names.length - b.names.length || a.total - b.total);

  combinationsSummary.innerHTML = '';
  combos.forEach((combo, i) => {
    const card = document.createElement('div');
    card.className = 'combo-card';
    const tags = combo.names.map((n) => `<span class="combo-tag">${esc(n)}</span>`).join('<span class="combo-arrow">+</span>');
    card.innerHTML = `
      <div class="combo-left">
        <div class="combo-label">${tags}</div>
        <div class="combo-cost-line">
          <span class="combo-counter-value" data-index="${i}">0</span>
          <span class="combo-cost-text">pessoa(s) × R$ ${fmt(combo.total)} = </span>
          <span class="combo-subtotal" data-index="${i}">R$ 0,00</span>
        </div>
      </div>
      <div class="combo-right">
        <div class="combo-counter">
          <button class="btn-counter btn-minus" data-index="${i}" data-dir="-1">−</button>
          <span class="combo-count" data-index="${i}">0</span>
          <button class="btn-counter btn-plus" data-index="${i}" data-dir="1">+</button>
        </div>
        <div class="combo-total">R$ ${fmt(combo.total)}</div>
      </div>
    `;
    combinationsSummary.appendChild(card);
  });

  const totalAdvancePaid = advancePayments.reduce((s, ap) => s + ap.value, 0);
  const paidDiv = document.createElement('div');
  paidDiv.className = 'paid-bar';
  paidDiv.innerHTML = `
    ${totalAdvancePaid > 0 ? `
    <div class="paid-row">
      <span>Pago Antecipado:</span>
      <strong class="diff-over">− R$ ${fmt(totalAdvancePaid)}</strong>
    </div>
    <div class="paid-row paid-divider"><span></span></div>
    ` : ''}
    <div class="paid-row">
      <span>Total Pago (Rateio):</span>
      <strong id="paid-value">R$ 0,00</strong>
    </div>
    <div class="paid-row">
      <span>Diferença:</span>
      <strong id="diff-value">R$ 0,00</strong>
    </div>
  `;
  combinationsSummary.appendChild(paidDiv);

  combinationsSummary.querySelectorAll('.btn-counter').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      updateCounter(parseInt(e.currentTarget.dataset.index), parseInt(e.currentTarget.dataset.dir), combos);
    });
  });

  summaryDiv.classList.remove('hidden');
  summaryDiv.scrollIntoView({ behavior: 'smooth' });

  loadCounters(combos);
}

function updateCounter(index, dir, combos) {
  const counterEl = document.querySelector(`.combo-count[data-index="${index}"]`);
  let val = parseInt(counterEl.textContent) + dir;
  if (val < 0) val = 0;
  counterEl.textContent = val;

  document.querySelector(`.combo-counter-value[data-index="${index}"]`).textContent = val;
  document.querySelector(`.combo-subtotal[data-index="${index}"]`).textContent = `R$ ${fmt(combos[index].total * val)}`;

  saveCounters(combos);
  updatePaidBar(combos);
}

function updatePaidBar(combos) {
  let totalPaid = 0;
  combos.forEach((combo, i) => {
    const count = parseInt(document.querySelector(`.combo-count[data-index="${i}"]`).textContent);
    totalPaid += combo.total * count;
  });

  const totalAdvancePaid = advancePayments.reduce((s, ap) => s + ap.value, 0);
  const grandTotal = items.reduce((s, item) => s + item.price * item.qty, 0);
  const remaining = grandTotal - totalAdvancePaid;
  const diff = totalPaid - remaining;

  document.getElementById('paid-value').textContent = `R$ ${fmt(totalPaid)}`;
  const diffEl = document.getElementById('diff-value');
  diffEl.textContent = `R$ ${fmt(Math.abs(diff))}`;
  diffEl.className = diff === 0 ? 'diff-ok' : diff > 0 ? 'diff-over' : 'diff-under';
}

// ── Reset ──

btnReset.addEventListener('click', () => {
  items.length = 0;
  advancePayments.length = 0;
  saveJSON(STORAGE_KEY, items);
  saveJSON(STORAGE_KEY + '-advance', advancePayments);
  renderItems();
  renderAdvanceForm();
  renderAdvanceList();
  summaryDiv.classList.add('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ── Helpers ──

function fmt(n) { return n.toFixed(2).replace('.', ','); }
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function saveJSON(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
function loadJSON(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } }

function comboKey(names) { return names.slice().sort().join('||'); }

function saveCounters(combos) {
  const counters = {};
  combos.forEach((combo, i) => {
    const count = parseInt(document.querySelector(`.combo-count[data-index="${i}"]`).textContent);
    if (count > 0) counters[comboKey(combo.names)] = count;
  });
  saveJSON(STORAGE_KEY + '-counters', counters);
}

function loadCounters(combos) {
  const counters = loadJSON(STORAGE_KEY + '-counters', {});
  combos.forEach((combo, i) => {
    const key = comboKey(combo.names);
    if (counters[key]) {
      document.querySelector(`.combo-count[data-index="${i}"]`).textContent = counters[key];
      document.querySelector(`.combo-counter-value[data-index="${i}"]`).textContent = counters[key];
      document.querySelector(`.combo-subtotal[data-index="${i}"]`).textContent = `R$ ${fmt(combo.total * counters[key])}`;
    }
  });
  updatePaidBar(combos);
}

// ── WhatsApp ──

btnWhatsapp.addEventListener('click', shareWhatsApp);

function shareWhatsApp() {
  const grandTotal = items.reduce((s, item) => s + item.price * item.qty, 0);
  const totalAdvancePaid = advancePayments.reduce((s, ap) => s + ap.value, 0);
  const remaining = grandTotal - totalAdvancePaid;

  let msg = '*Fecha a Conta!*\n\n';
  msg += '*Itens:*\n';
  items.forEach((item) => {
    const total = item.price * item.qty;
    msg += `- ${item.name}: R$ ${fmt(total)} (${item.qty}x R$ ${fmt(item.price)} / ${item.people} pessoas)\n`;
  });

  if (totalAdvancePaid > 0) {
    msg += `\n*Pagamentos Antecipados:*\n`;
    advancePayments.forEach((ap) => {
      const name = ap.name ? `${ap.name}: ` : '';
      const parts = ap.allocations
        .map((amt, j) => amt > 0 ? `${items[j]?.name || '?'} R$ ${fmt(amt)}` : null)
        .filter(Boolean)
        .join(', ');
      msg += `- ${name}R$ ${fmt(ap.value)}${parts ? ' (' + parts + ')' : ''}\n`;
    });
  }

  msg += `\n*Total:* R$ ${fmt(grandTotal)}\n`;
  if (totalAdvancePaid > 0) {
    msg += `*Restante:* R$ ${fmt(remaining)}\n`;
  }

  msg += `\n*Por pessoa (combinações):*\n`;
  items.forEach((item) => {
    const itemAdvTotal = advancePayments.reduce((s, ap) => s + (ap.allocations[items.indexOf(item)] || 0), 0);
    const remainingItem = (item.price * item.qty) - itemAdvTotal;
    msg += `- Só ${item.name}: R$ ${fmt(remainingItem / item.people)}\n`;
  });

  const combos = [];
  const n = items.length;
  for (let mask = 3; mask < (1 << n); mask++) {
    const names = [];
    let total = 0;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        names.push(items[i].name);
        const itemAdvTotal = advancePayments.reduce((s, ap) => s + (ap.allocations[i] || 0), 0);
        total += ((items[i].price * items[i].qty) - itemAdvTotal) / items[i].people;
      }
    }
    combos.push({ names, total });
  }

  if (combos.length > 0) {
    combos.forEach((combo) => {
      msg += `- ${combo.names.join(' + ')}: R$ ${fmt(combo.total)}\n`;
    });
  }

  const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

init();
