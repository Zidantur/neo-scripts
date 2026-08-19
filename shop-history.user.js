// ==UserScript==
// @name         Neopets Sales History (sort + filter)
// @namespace    https://github.com/
// @version      1.0
// @description  Adds click-to-sort columns and a live search filter to your shop's Sales History
// @updateURL    https://github.com/Zidantur/neo-scripts/raw/refs/heads/main/shop-history.user.js
// @downloadURL  https://github.com/Zidantur/neo-scripts/raw/refs/heads/main/shop-history.user.js
// @match        https://www.neopets.com/market.phtml*
// @match        https://neopets.com/market.phtml*
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

// URL https://www.neopets.com/market.phtml?type=sales

(function () {
  'use strict';

  const HEADERS  = ['date', 'item', 'buyer', 'price'];
  const SORT_KEY = 'shist-sort';
  const DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;   // Neopets prints DD/MM/YYYY
  const NUM_RE  = /^-?[\d,]+(?:\.\d+)?(?:\s*NP)?$/i;

  const intl = new Intl.NumberFormat();

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const cellText = (td) => (td.textContent || '').trim();

  /** Locates the Sales History table by matching its header row labels. */
  function findTable() {
    for (const table of document.querySelectorAll('table')) {
      const head = table.rows[0];
      if (!head || head.cells.length !== HEADERS.length) continue;
      const labels = [...head.cells].map(td => cellText(td).toLowerCase());
      if (HEADERS.every((h, i) => labels[i] === h)) return table;
    }
    return null;
  }

  /**
   * Decides how a column should be compared, based on its own values.
   * Falls back to text so a single odd cell can never break the sort.
   */
  function columnType(values) {
    if (!values.length) return 'text';
    if (values.every(v => DATE_RE.test(v))) return 'date';
    if (values.every(v => NUM_RE.test(v)))  return 'number';
    return 'text';
  }

  function sortKey(value, type) {
    if (type === 'date') {
      const [, d, m, y] = value.match(DATE_RE);
      return Number(y) * 10000 + Number(m) * 100 + Number(d);
    }
    if (type === 'number') return parseFloat(value.replace(/[^\d.-]/g, '')) || 0;
    return value.toLowerCase();
  }

  /** The chosen column sticks until it is changed, across page loads. */
  function saveSort(col, dir) {
    GM_setValue(SORT_KEY, JSON.stringify({ col, dir }));
  }

  function loadSort(columns) {
    try {
      const { col, dir } = JSON.parse(GM_getValue(SORT_KEY, ''));
      if (Number.isInteger(col) && col >= 0 && col < columns && (dir === 1 || dir === -1)) {
        return { col, dir };
      }
    } catch (_) { /* nothing saved yet, or the stored value is unusable */ }
    return null;
  }

  // ─── Setup ────────────────────────────────────────────────────────────────

  function init() {
    const table = findTable();
    if (!table) return;

    const head = table.rows[0];
    const rest = [...table.rows].slice(1);
    const rows = rest.filter(r => r.cells.length === HEADERS.length);
    // The "Clear Sales History" row spans all columns — keep it pinned last
    const footer = rest.find(r => r.cells.length !== HEADERS.length) || null;
    if (!rows.length) return;

    const parent = rows[0].parentNode;

    // Per-cell search text, built once. Each cell also indexes a comma-free
    // copy so typing "97200" still finds "97,200 NP".
    const haystacks = rows.map(row => [...row.cells].map(td => {
      const text = cellText(td).toLowerCase();
      const bare = text.replace(/,/g, '');
      return bare === text ? text : `${text} ${bare}`;
    }));

    // ─── Filter bar ─────────────────────────────────────────────────────────

    const bar = document.createElement('div');
    bar.style.cssText = 'width:530px; margin:8px auto; box-sizing:border-box; display:flex;'
                      + 'align-items:center; gap:8px; border:1px solid #bbb; border-radius:6px;'
                      + 'padding:8px 10px; font-size:14px;';

    const input = document.createElement('input');
    input.type        = 'search';
    input.placeholder = 'Filter by date, item, buyer or price…';
    input.style.cssText = 'flex:1; min-width:0; font-size:14px; padding:4px 6px; box-sizing:border-box;';

    const count = document.createElement('span');
    count.style.cssText = 'font-size:12px; color:#666; white-space:nowrap;';

    bar.append(input, count);
    table.parentNode.insertBefore(bar, table);

    function applyFilter() {
      const terms = input.value.toLowerCase().split(/\s+/).filter(Boolean);
      let shown = 0;

      rows.forEach((row, i) => {
        // Every term has to turn up in at least one cell of the row
        const match = terms.every(term => haystacks[i].some(text => text.includes(term)));
        row.style.display = match ? '' : 'none';
        if (match) shown++;
      });

      count.textContent = shown === rows.length
        ? `${intl.format(rows.length)} sales`
        : `${intl.format(shown)} of ${intl.format(rows.length)} sales`;
    }

    input.addEventListener('input', applyFilter);
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      input.value = '';
      applyFilter();
    });

    // ─── Column sorting ─────────────────────────────────────────────────────

    let sortCol = -1;
    let sortDir = 1;

    const types = [...head.cells].map((_, idx) =>
      columnType(rows.map(r => cellText(r.cells[idx])).filter(Boolean)));

    const arrows = [...head.cells].map((th, idx) => {
      th.style.cursor     = 'pointer';
      th.style.userSelect = 'none';
      th.title            = 'Click to sort';

      const arrow = document.createElement('span');
      arrow.style.cssText = 'font-size:10px; margin-left:4px; visibility:hidden;';
      arrow.textContent   = '▲';
      th.appendChild(arrow);

      th.addEventListener('click', () => {
        // Re-clicking a column flips it; a new column starts A→Z for text,
        // newest / priciest first for dates and prices
        const dir = sortCol === idx ? -sortDir : (types[idx] === 'text' ? 1 : -1);
        applySort(idx, dir);
        saveSort(idx, dir);
      });
      return arrow;
    });

    function applySort(idx, dir) {
      sortCol = idx;
      sortDir = dir;

      rows
        .map((row, i) => ({ row, i, key: sortKey(cellText(row.cells[idx]), types[idx]) }))
        .sort((a, b) => {
          if (a.key < b.key) return -dir;
          if (a.key > b.key) return  dir;
          return a.i - b.i;               // ties keep their original order
        })
        .forEach(({ row }) => parent.insertBefore(row, footer));

      arrows.forEach((arrow, i) => {
        arrow.style.visibility = i === idx ? 'visible' : 'hidden';
        if (i === idx) arrow.textContent = dir === 1 ? '▲' : '▼';
      });
    }

    const saved = loadSort(head.cells.length);
    if (saved) applySort(saved.col, saved.dir);

    applyFilter();
  }

  // ─── Bootstrap ────────────────────────────────────────────────────────────

  init();

})();
