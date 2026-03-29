// ==UserScript==
// @name         Neopets Shop Pricer (itemdb)
// @namespace    https://github.com/
// @version      1.0
// @description  Prices your Neopets shop using itemdb.com.br prices
// @match        https://www.neopets.com/market.phtml*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      itemdb.com.br
// ==/UserScript==

(function () {
  'use strict';

  function URLHas(str) {
    return window.location.href.includes(str);
  }

  // Only run on "your shop" management pages.
  // The subbynext check covers POST-navigated pages (clicking Prev/Next 30).
  if (!URLHas('type=your') && !URLHas('market_your') && $('[name=subbynext]').length !== 2) return;

  const intl = new Intl.NumberFormat();
  let cachedItemData  = null;
  let originalPrices  = {}; // idx → cost string, captured once at page load

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Builds a map of  index → { neoId, costInput }
   *
   * The hidden obj_id_N inputs can be displaced from their <tr> by the browser
   * (they sit between <td>s, which is invalid HTML), so we query them directly
   * by name and pair them with the matching cost_N input by index.
   */
  function buildIdMap() {
    const idMap = {};

    $('input[name^="obj_id_"]').each(function () {
      const idx   = $(this).attr('name').match(/\d+/)?.[0];
      const neoId = $(this).val();
      if (!idx || !neoId) return;

      const costInput = $(`input[name="cost_${idx}"]`);
      if (costInput.length) {
        idMap[idx] = { neoId, costInput };
      }
    });

    return idMap;
  }

  function snapshotPrices() {
    originalPrices = {};
    $('input[name^="cost_"]').each(function () {
      const idx = $(this).attr('name').match(/\d+/)?.[0];
      if (idx) originalPrices[idx] = $(this).val();
    });
  }

  function setCheckboxesByMode(mode) {
    $('.idb-check').each(function () {
      const idx = $(this).data('idx');
      $(this).prop('checked', mode === 'all' || (mode === 'unpriced' && parseInt(originalPrices[idx] ?? '0', 10) === 0));
    });
  }

  function toggleItemPrice(idx, neoId, costInput, checked, pct) {
    const item = cachedItemData && cachedItemData[neoId];
    if (!item || !item.price || !item.price.value) return;

    const price         = item.price.value;
    const adjustedPrice = Math.round(price * pct / 100);
    if (price > 999999 || adjustedPrice > 999999) return; // over cap — no-op

    if (checked) {
      costInput.val(adjustedPrice);
      costInput.css('background', '#d4f5d4');
    } else {
      costInput.val(originalPrices[idx] !== undefined ? originalPrices[idx] : '');
      costInput.css('background', '');
    }

    const statusHtml = checked
      ? `→ <b>${intl.format(adjustedPrice)} NP</b> <span style="display:inline-block; min-width:68px; color:green;">applied ✓</span>`
      : `→ <b>${intl.format(adjustedPrice)} NP</b> <span style="display:inline-block; min-width:68px; color:#aaa;">not applied</span>`;
    costInput.nextAll('.idb-hint').first()
      .find('.idb-apply-status').html(statusHtml);
  }

  function addCheckboxes(mode) {
    const idMap = buildIdMap();
    Object.entries(idMap).forEach(([idx, { neoId, costInput }]) => {
      if (costInput.prev('.idb-check').length) return;
      const preChecked = mode === 'all'
        ? true
        : mode === 'unpriced'
          ? parseInt(costInput.val(), 10) === 0
          : false; // none — none checked
      const $cb = $(`<input type="checkbox" class="idb-check"
        data-idx="${idx}" data-neo-id="${neoId}"
        style="margin-right:5px; cursor:pointer; vertical-align:middle;"
        title="Include in apply"${preChecked ? ' checked' : ''}>`);
      $cb.on('change', function () {
        if (!cachedItemData) return;
        const pct = Math.max(1, parseFloat($('#idb-pct').val()) || 100);
        toggleItemPrice(idx, neoId, costInput, $(this).is(':checked'), pct);
      });
      costInput.before($cb);
    });
  }

  // ─── UI Setup ─────────────────────────────────────────────────────────────

  function init() {
    const isEnabled = GM_getValue('idb-enabled', true);
    $('<style>#idb-toggle-wrap{display:inline-flex;align-items:center;gap:6px;cursor:pointer}'
    + '#idb-toggle-wrap input{display:none}'
    + '#idb-toggle-track{width:34px;height:18px;background:#ccc;border-radius:9px;position:relative;transition:background .2s;cursor:pointer}'
    + '#idb-toggle-track::after{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;background:#fff;border-radius:50%;transition:transform .2s}'
    + '#idb-toggle:checked~#idb-toggle-track{background:#4caf50}'
    + '#idb-toggle:checked~#idb-toggle-track::after{transform:translateX(16px)}'
    + '</style>').appendTo('head');
    const $container = $('<div style="display:inline-block; border:1px solid #bbb; border-radius:6px; padding:6px 10px; margin:6px 0;"></div>');

    const $toggleRow = $(`<div style="margin-bottom:6px;">
      <label id="idb-toggle-wrap">
        <input type="checkbox" id="idb-toggle"${isEnabled ? ' checked' : ''}>
        <span id="idb-toggle-track"></span>
        <span style="font-size:13px;">itemdb pricer</span>
      </label>
    </div>`);
    $container.append($toggleRow);
    $('form table').first().before($container);

    $('#idb-toggle').on('change', function () {
      GM_setValue('idb-enabled', $(this).is(':checked'));
      location.reload();
    });

    if (!isEnabled) return;

    snapshotPrices();

    const savedMode   = GM_getValue('idb-mode', 'all');
    const $modeSelect = $(`
      <select id="idb-mode" style="font-size:13px; padding:3px 6px; border-radius:4px;">
        <option value="all"${savedMode === 'all' ? ' selected' : ''}>All items</option>
        <option value="unpriced"${savedMode === 'unpriced' ? ' selected' : ''}>Unpriced only</option>
        <option value="none"${savedMode === 'none' ? ' selected' : ''}>None</option>
      </select>
    `);
    const $modeLabel = $('<label for="idb-mode" style="font-size:13px; margin-left:3px;">apply mode</label>');
    const $row1      = $('<div style="margin-bottom:4px;"></div>').append($modeSelect, $modeLabel);

    const savedPct  = GM_getValue('idb-pct', '100');
    const $pctInput = $(`<input type="number" id="idb-pct" value="${savedPct}" min="1" max="999" step="1" style="width:52px; font-size:13px; text-align:center;">`);
    const $pctLabel = $('<label for="idb-pct" style="font-size:13px; margin-left:3px;">% of itemdb price</label>');
    const $row2     = $('<div></div>').append($pctInput, $pctLabel);

    // Status replaces mode/% rows only when an error occurs
    const $status = $('<div id="idb-status" style="font-size:0.9em; color:gray; display:none;"></div>');

    $container.append($row1, $row2, $status);

    $pctInput.on('change', function () {
      GM_setValue('idb-pct', $(this).val());
      if (cachedItemData) {
        const pct = Math.max(1, parseFloat($(this).val()) || 100);
        applyPrices(buildIdMap(), cachedItemData, pct);
      }
    });
    $pctInput.on('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      $(this).trigger('change');
    });
    $modeSelect.on('change', function () {
      const newMode = $(this).val();
      GM_setValue('idb-mode', newMode);
      setCheckboxesByMode(newMode);
      if (cachedItemData) {
        const pct = Math.max(1, parseFloat($('#idb-pct').val()) || 100);
        applyPrices(buildIdMap(), cachedItemData, pct);
      }
    });
    // Duplicate the Update/Remove All row at the top of the table for convenience
    const $shopTable = $('input[value="Update"]').closest('table');
    const $lastRow   = $shopTable.find('tr:last');
    $lastRow.clone().insertBefore($shopTable.find('tr:first'));

    addCheckboxes(savedMode === 'custom' ? 'none' : savedMode);
    fetchPrices($status, $row1, $row2);
  }

  // ─── Core Logic ───────────────────────────────────────────────────────────

  function fetchPrices($status, $row1, $row2) {
    const showError = (html) => {
      $row1.hide(); $row2.hide();
      $status.show().html(html);
    };

    const pct   = Math.max(1, parseFloat($('#idb-pct').val()) || 100);
    const idMap = buildIdMap();

    if (!Object.keys(idMap).length) {
      showError('No items found.');
      return;
    }

    const neoIds = Object.values(idMap).map(v => v.neoId);

    GM_xmlhttpRequest({
      method:  'POST',
      url:     'https://itemdb.com.br/api/v1/items/many',
      headers: { 'Content-Type': 'application/json' },
      data:    JSON.stringify({ item_id: neoIds }),

      onload(res) {
        if (res.status === 401) {
          showError('⚠️ Session expired — please <a href="https://itemdb.com.br" target="_blank">visit itemdb.com.br</a> then try again.');
          return;
        }
        if (res.status !== 200) {
          showError(`⚠️ API error (${res.status}) – try again.`);
          return;
        }

        // Warn during transition period if itemdb flags this request as non-compliant
        if (res.responseHeaders && res.responseHeaders.includes('x-itemdb-block')) {
          showError('⚠️ itemdb requires a session cookie — please <a href="https://itemdb.com.br" target="_blank">visit itemdb.com.br</a> once to authenticate.');
          return;
        }

        cachedItemData = JSON.parse(res.responseText);
        applyPrices(idMap, cachedItemData, pct);
      },

      onerror() {
        showError('⚠️ Network error – try again.');
      },
    });
  }

  function applyPrices(idMap, itemData, pct = 100) {
    // Remove any annotations from a previous run
    $('.idb-hint').remove();
    $('input[name^="cost_"]').css('background', '');

    for (const [idx, { neoId, costInput }] of Object.entries(idMap)) {
      if (!costInput.length) continue;

      const item = itemData[neoId];
      let hint    = '';
      let bgColor = '';

      try {
        if (!item) throw new Error('not found');

        if (item.status === 'no trade') {
          hint = '<small style="color:#888;">No Trade</small>';

        } else if (item.isNC) {
          const ncLabel = item.ncValue ? `${item.ncValue.range} caps` : 'NC Item';
          hint = `<small style="color:#ec69ff;">${ncLabel}</small>`;

        } else if (item.price && item.price.value) {
          const price         = item.price.value;
          const adjustedPrice = Math.round(price * pct / 100);
          const inflated      = item.price.inflated ? '⚠ ' : '';
          const link          = `https://itemdb.com.br/item/${item.slug}`;

          // Hint always shows the raw itemdb price as the reference
          hint = `<small><a href="${link}" target="_blank" style="text-decoration:none;">`
               + `${inflated}${intl.format(price)} NP</a></small>`;

          if (price > 999999) {
            // Base itemdb price is already over the shop cap — uncheck & disable
            $(`.idb-check[data-idx="${idx}"]`).prop('checked', false).prop('disabled', true);
            costInput.val(originalPrices[idx] !== undefined ? originalPrices[idx] : costInput.val());
            bgColor = '#fff3cd'; // yellow = base price too high
            hint   += ' <small style="color:orange;"><b>⚠ itemdb price exceeds 999,999 limit — not applied</b></small>';
          } else if (adjustedPrice > 999999) {
            // Markup pushed it over the cap — uncheck & disable
            $(`.idb-check[data-idx="${idx}"]`).prop('checked', false).prop('disabled', true);
            costInput.val(originalPrices[idx] !== undefined ? originalPrices[idx] : costInput.val());
            bgColor = '#ffd5d5'; // red = markup caused overage
            hint   += ` <small style="color:red;"><b>⚠ ${pct}% markup (${intl.format(adjustedPrice)} NP) exceeds 999,999 limit — not applied</b></small>`;
          } else {
            // Valid price — re-enable checkbox; if it was cap-disabled, re-check it
            const $cb       = $(`.idb-check[data-idx="${idx}"]`);
            const wasCapped = $cb.prop('disabled');
            $cb.prop('disabled', false);
            if (wasCapped) $cb.prop('checked', true);
            const isChecked = $cb.is(':checked');
            if (isChecked) {
              costInput.val(adjustedPrice);
              bgColor = '#d4f5d4';
            } else {
              costInput.val(originalPrices[idx] !== undefined ? originalPrices[idx] : costInput.val());
            }
            const statusHtml = isChecked
              ? `→ <b>${intl.format(adjustedPrice)} NP</b> <span style="display:inline-block; min-width:68px; color:green;">applied ✓</span>`
              : `→ <b>${intl.format(adjustedPrice)} NP</b> <span style="display:inline-block; min-width:68px; color:#aaa;">not applied</span>`;
            hint += `<small class="idb-apply-status" style="display:block;">${statusHtml}</small>`;
          }

        } else {
          // Known item but no price data
          hint = item.slug
            ? `<small><a href="https://itemdb.com.br/item/${item.slug}" target="_blank">???</a></small>`
            : '<small style="color:gray;">No price</small>';
        }

      } catch (_) {
        hint = '<small style="color:gray;">Not found</small>';
      }

      if (bgColor) costInput.css('background', bgColor);
      if (hint)    costInput.after(`<span class="idb-hint"><br>${hint}</span>`);
    }
  }

  // ─── Bootstrap ────────────────────────────────────────────────────────────

  init();

})();
