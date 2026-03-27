// ==UserScript==
// @name         Neopets Shop Pricer (itemdb)
// @namespace    https://github.com/
// @version      1.0
// @description  Auto-prices your Neopets shop using itemdb.com.br prices
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
  let cachedItemData = null;

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

  // ─── UI Setup ─────────────────────────────────────────────────────────────

  function init() {
    const $btn = $(`
      <button type="button" id="idb-autoprice-btn"
        style="margin:8px 4px; padding:5px 12px; cursor:pointer;
               background:#4d9cf0; color:#fff; border:none; border-radius:4px;
               font-weight:bold; font-size:13px;">
        🏷️ Auto-Price with itemdb
      </button>
    `);

    const savedPct = GM_getValue('idb-pct', '100');
    const $pctInput = $(`<input type="number" id="idb-pct" value="${savedPct}" min="1" max="999" step="1" style="width:52px; font-size:13px; text-align:center; margin-left:10px;">`);
    const $pctLabel = $('<label for="idb-pct" style="font-size:13px; margin-left:3px;">% of itemdb price</label>');

    const $status = $('<span id="idb-status" style="margin-left:8px; font-size:0.9em; color:gray;"></span>');

    $('form table').first().before($btn, $pctInput, $pctLabel, $status);

    $pctInput.on('change', function () {
      GM_setValue('idb-pct', $(this).val());
    });
    // Duplicate the Update/Remove All row at the top of the table for convenience
    const $shopTable = $('input[value="Update"]').closest('table');
    const $lastRow   = $shopTable.find('tr:last');
    $lastRow.clone().insertBefore($shopTable.find('tr:first'));

    $btn.on('click', function () {
      $btn.prop('disabled', true).text('⏳ Fetching prices…');
      $status.text('');
      fetchPrices($btn, $status);
    });
  }

  // ─── Core Logic ───────────────────────────────────────────────────────────

  function fetchPrices($btn, $status) {
    const pct   = Math.max(1, parseFloat($('#idb-pct').val()) || 100);
    const idMap = buildIdMap();

    if (!Object.keys(idMap).length) {
      $status.text('No items found.');
      $btn.prop('disabled', false).text('🏷️ Auto-Price with itemdb');
      return;
    }

    // If we already have data, skip the network round-trip
    if (cachedItemData) {
      applyPrices(idMap, cachedItemData, pct);
      $btn.prop('disabled', false).text('🔄 Re-Apply Prices');
      $status.text('✅ Done! (cached)');
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
          $status.html('⚠️ Session expired — please <a href="https://itemdb.com.br" target="_blank">visit itemdb.com.br</a> then try again.');
          $btn.prop('disabled', false).text('🏷️ Auto-Price with itemdb');
          return;
        }
        if (res.status !== 200) {
          $status.text(`⚠️ API error (${res.status}) – try again.`);
          $btn.prop('disabled', false).text('🏷️ Auto-Price with itemdb');
          return;
        }

        // Warn during transition period if itemdb flags this request as non-compliant
        if (res.responseHeaders && res.responseHeaders.includes('x-itemdb-block')) {
          $status.html('⚠️ itemdb requires a session cookie — please <a href="https://itemdb.com.br" target="_blank">visit itemdb.com.br</a> once to authenticate.');
        }

        cachedItemData = JSON.parse(res.responseText);
        applyPrices(idMap, cachedItemData, pct);
        $btn.prop('disabled', false).text('🔄 Re-Apply Prices');
        if (!res.responseHeaders || !res.responseHeaders.includes('x-itemdb-block')) {
          $status.text('✅ Done!');
        }
      },

      onerror() {
        $status.text('⚠️ Network error – try again.');
        $btn.prop('disabled', false).text('🏷️ Auto-Price with itemdb');
      },
    });
  }

  function applyPrices(idMap, itemData, pct = 100) {
    // Remove any annotations from a previous run
    $('.idb-hint').remove();
    $('input[name^="cost_"]').css('background', '');

    for (const [, { neoId, costInput }] of Object.entries(idMap)) {
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
            // Base itemdb price is already over the shop cap
            bgColor = '#fff3cd'; // yellow = base price too high
            hint   += ' <small style="color:orange;"><b>⚠ itemdb price exceeds 999,999 limit — not applied</b></small>';
          } else if (adjustedPrice > 999999) {
            // Markup pushed it over the cap
            bgColor = '#ffd5d5'; // red = markup caused overage
            hint   += ` <small style="color:red;"><b>⚠ ${pct}% markup (${intl.format(adjustedPrice)} NP) exceeds 999,999 limit — not applied</b></small>`;
          } else {
            costInput.val(adjustedPrice);
            bgColor = '#d4f5d4'; // green = auto-priced
            if (pct !== 100) hint += ` <small>→ <b>${intl.format(adjustedPrice)} NP</b> applied</small>`;
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
