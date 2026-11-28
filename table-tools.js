/**
 * Tide ERP — Universal Data Table Engine (TideTableTools)
 * Automatically upgrades EVERY <table class="data-table"> across the entire ERP with:
 *   1. Smart sorting on every column (alphabetical, numeric/currency, dates, status)
 *   2. Similarity grouping (clusters identical/similar items with group headers & counts)
 *   3. Interactive Column Editor (show/hide, reorder, and rename columns — persisted per list)
 *   4. Branded Print / Save-as-PDF reflecting the exact active filters, sorting, grouping & columns
 */
(function (root) {
  'use strict';

  const PREFS_STORAGE_KEY = 'tide-erp-table-prefs-v1';
  let prefsCache = null;

  function loadAllPrefs() {
    if (prefsCache) return prefsCache;
    try {
      prefsCache = JSON.parse(localStorage.getItem(PREFS_STORAGE_KEY) || '{}') || {};
    } catch {
      prefsCache = {};
    }
    return prefsCache;
  }

  function saveAllPrefs() {
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefsCache || {}));
    } catch {}
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getHeaderCleanText(th) {
    const clone = th.cloneNode(true);
    clone.querySelectorAll('.th-sort-ind').forEach(el => el.remove());
    return (clone.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function extractCellPrimaryText(td) {
    if (!td) return '';
    // Prefer status pill or strong heading if present for cleaner grouping/sorting
    const pill = td.querySelector('.status-pill');
    if (pill && td.children.length <= 2 && !td.querySelector('strong')) {
      return (pill.textContent || '').replace(/\s+/g, ' ').trim();
    }
    const strong = td.querySelector('strong');
    if (strong) {
      const strongText = (strong.textContent || '').replace(/\s+/g, ' ').trim();
      if (strongText) return strongText;
    }
    return (td.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function extractCellFullText(td) {
    if (!td) return '';
    const clone = td.cloneNode(true);
    clone.querySelectorAll('details, button, input, select, textarea, .row-actions, .order-actions-menu').forEach(el => el.remove());
    return (clone.textContent || '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Smart value parser: handles currency (TSh 45,000), numbers (12 units, 45%),
   * dates (27 Nov 2026 / 2026-11-27), and natural alphabetical strings.
   */
  function parseSortableValue(rawText) {
    const s = String(rawText || '').replace(/\s+/g, ' ').trim();
    if (!s || s === '—' || s === '-') return { kind: 'empty', val: '' };

    // ISO Date YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const ts = Date.parse(s.slice(0, 10) + 'T12:00:00Z');
      if (!Number.isNaN(ts)) return { kind: 'num', val: ts };
    }

    // Readable Date e.g. "27 Nov 2026" or "Nov 27, 2026"
    if (/^\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}$/.test(s) || /^[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}$/.test(s)) {
      const ts = Date.parse(s);
      if (!Number.isNaN(ts)) return { kind: 'num', val: ts };
    }

    // Currency / numeric / percentage / unit quantity (e.g. "TSh 12,500", "-2,000", "45 Piece", "18.5%")
    const normalizedNum = s
      .replace(/−/g, '-')
      .replace(/^(?:TSh|TZS|USD|KES|UGX|EUR|GBP|\$|€|£)\s*/i, '')
      .replace(/,/g, '')
      .replace(/\s*(?:%|units?|pcs?|pieces?|packs?|boxes?|kg|litres?|l|g|ml|cartons?|days?|d)\.?$/i, '')
      .trim();
    if (/^[+-]?\d+(?:\.\d+)?$/.test(normalizedNum)) {
      return { kind: 'num', val: Number(normalizedNum) };
    }

    return { kind: 'str', val: s.toLowerCase() };
  }

  function compareCellValues(aText, bText, dir = 'asc') {
    const a = parseSortableValue(aText);
    const b = parseSortableValue(bText);
    if (a.kind === 'empty' && b.kind === 'empty') return 0;
    if (a.kind === 'empty') return 1;
    if (b.kind === 'empty') return -1;

    let cmp = 0;
    if (a.kind === 'num' && b.kind === 'num') {
      cmp = a.val - b.val;
    } else {
      cmp = String(aText || '').localeCompare(String(bText || ''), 'en', { sensitivity: 'base', numeric: true });
    }
    return dir === 'desc' ? -cmp : cmp;
  }

  function getTableTitle(table) {
    const panel = table.closest('.table-panel, .modal-card, section');
    const heading =
      panel?.querySelector('.table-heading h2, .toolbar h2, .modal-head h2, .panel-header h2, h2')?.textContent?.trim() ||
      document.querySelector('#page-content .page-head h1, #page-content h1')?.textContent?.trim() ||
      document.getElementById('crumb-current')?.textContent?.trim() ||
      'Report List';
    return heading.replace(/\s+/g, ' ').trim();
  }

  function getAppContext() {
    if (typeof window.getTidePrintContext === 'function') {
      try { return window.getTidePrintContext() || {}; } catch {}
    }
    return {
      state: (typeof window.state === 'object' && window.state) ? window.state : {},
      page: typeof window.page === 'string' ? window.page : '',
      activeBranch: null,
      currentUser: typeof window.currentWorkspaceUser === 'function' ? window.currentWorkspaceUser() : null
    };
  }

  function buildTableKey(table, indexOnPage) {
    const ctx = getAppContext();
    const pageId = (typeof ctx.page === 'string' && ctx.page) || (location.hash || '#home').replace(/^#/, '') || 'home';
    const inModal = Boolean(table.closest('#app-modal'));
    const ths = Array.from(table.querySelectorAll('thead tr th'));
    const sig = ths.map(th => getHeaderCleanText(th).toLowerCase().replace(/[^a-z0-9]/g, '')).join('_').slice(0, 64);
    return `${inModal ? 'modal' : pageId}__t${indexOnPage}__${sig}`;
  }

  function inspectColumns(table) {
    const ths = Array.from(table.querySelectorAll('thead tr th'));
    return ths.map((th, idx) => {
      const origIdx = th.dataset.origCol !== undefined ? Number(th.dataset.origCol) : idx;
      const defaultLabel = th.dataset.defaultLabel !== undefined ? th.dataset.defaultLabel : getHeaderCleanText(th);
      const isCheckbox = Boolean(th.querySelector('input[type="checkbox"]')) || defaultLabel === '';
      const isAction = /^(actions?|action)$/i.test(defaultLabel);
      th.dataset.origCol = String(origIdx);
      th.dataset.defaultLabel = defaultLabel;
      return { origIdx, defaultLabel, isCheckbox, isAction };
    });
  }

  function getNormalizedPrefs(tableKey, cols) {
    const all = loadAllPrefs();
    const raw = all[tableKey] || {};
    const validIds = cols.map(c => c.origIdx);
    const validSet = new Set(validIds);

    // Ensure order contains every column exactly once (checkbox always pinned first)
    const checkboxCol = cols.find(c => c.isCheckbox);
    let order = Array.isArray(raw.order) ? raw.order.filter(id => validSet.has(id)) : [];
    for (const id of validIds) {
      if (!order.includes(id)) order.push(id);
    }
    if (checkboxCol) {
      order = [checkboxCol.origIdx, ...order.filter(id => id !== checkboxCol.origIdx)];
    }

    const hidden = Array.isArray(raw.hidden)
      ? raw.hidden.filter(id => validSet.has(id) && (!checkboxCol || id !== checkboxCol.origIdx))
      : [];

    const sortCol = Number.isInteger(raw.sortCol) && validSet.has(raw.sortCol) ? raw.sortCol : -1;
    const sortDir = raw.sortDir === 'desc' ? 'desc' : 'asc';
    const groupCol = Number.isInteger(raw.groupCol) && validSet.has(raw.groupCol) ? raw.groupCol : -1;
    const labels = raw.labels && typeof raw.labels === 'object' ? { ...raw.labels } : {};

    return { sortCol, sortDir, groupCol, order, hidden, labels };
  }

  function saveTablePrefs(tableKey, prefs) {
    const all = loadAllPrefs();
    all[tableKey] = prefs;
    saveAllPrefs();
  }

  function resetTablePrefs(tableKey) {
    const all = loadAllPrefs();
    delete all[tableKey];
    saveAllPrefs();
  }

  function hasCustomPrefs(prefs, cols) {
    if (prefs.sortCol >= 0 || prefs.groupCol >= 0) return true;
    if (prefs.hidden.length > 0) return true;
    if (Object.keys(prefs.labels || {}).length > 0) return true;
    for (let i = 0; i < cols.length; i++) {
      if (prefs.order[i] !== cols[i].origIdx) return true;
    }
    return false;
  }

  function tagOriginalCells(table) {
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll('tr')).filter(tr => !tr.classList.contains('table-group-row'));
    rows.forEach((tr, rowIdx) => {
      if (tr.dataset.origRow === undefined) tr.dataset.origRow = String(rowIdx);
      const cells = Array.from(tr.children);
      if (cells.length === 1 && cells[0].hasAttribute('colspan')) {
        tr.dataset.emptyRow = '1';
        return;
      }
      cells.forEach((td, colIdx) => {
        if (td.dataset.origCol === undefined) td.dataset.origCol = String(colIdx);
      });
    });
  }

  function applyTableState(table, tableKey, cols, prefs) {
    const theadRow = table.querySelector('thead tr');
    const tbody = table.querySelector('tbody');
    if (!theadRow || !tbody) return;

    const hiddenSet = new Set(prefs.hidden);
    const colByOrig = new Map(cols.map(c => [c.origIdx, c]));

    // 1. Reorder, rename, toggle visibility, and update sort indicators on <thead>
    const thByOrig = new Map();
    Array.from(theadRow.children).forEach(th => {
      if (th.dataset.origCol !== undefined) thByOrig.set(Number(th.dataset.origCol), th);
    });

    for (const origIdx of prefs.order) {
      const th = thByOrig.get(origIdx);
      const meta = colByOrig.get(origIdx);
      if (!th || !meta) continue;
      theadRow.appendChild(th);
      const isHidden = hiddenSet.has(origIdx);
      th.classList.toggle('col-hidden-by-user', isHidden);

      if (!meta.isCheckbox && !meta.isAction) {
        const displayLabel = (prefs.labels && prefs.labels[origIdx]) ? prefs.labels[origIdx] : meta.defaultLabel;
        const isSorted = prefs.sortCol === origIdx;
        const isGrouped = prefs.groupCol === origIdx;
        const arrow = isSorted ? (prefs.sortDir === 'desc' ? '↓' : '↑') : '⇅';
        th.classList.add('th-sortable');
        th.classList.toggle('th-sorted', isSorted);
        th.classList.toggle('th-grouped', isGrouped);
        th.title = `Click to sort by ${displayLabel}`;
        th.innerHTML = `<span class="th-label-text">${escapeHtml(displayLabel)}</span><span class="th-sort-ind" aria-hidden="true">${arrow}</span>`;
      } else if (meta.isAction) {
        const displayLabel = (prefs.labels && prefs.labels[origIdx]) ? prefs.labels[origIdx] : meta.defaultLabel;
        th.textContent = displayLabel;
      }
    }

    const visibleColCount = Math.max(1, prefs.order.filter(id => !hiddenSet.has(id)).length);

    // 2. Remove previous injected group divider rows
    tbody.querySelectorAll('tr.table-group-row').forEach(el => el.remove());

    const allRows = Array.from(tbody.querySelectorAll('tr'));
    const dataRows = allRows.filter(tr => tr.dataset.emptyRow !== '1');
    const emptyRows = allRows.filter(tr => tr.dataset.emptyRow === '1');

    // Update empty row colspan
    emptyRows.forEach(tr => {
      const td = tr.querySelector('td[colspan]');
      if (td) td.setAttribute('colspan', String(visibleColCount));
    });

    // 3. Reorder & toggle column visibility on every data row
    dataRows.forEach(tr => {
      const tdByOrig = new Map();
      Array.from(tr.children).forEach(td => {
        if (td.dataset.origCol !== undefined) tdByOrig.set(Number(td.dataset.origCol), td);
      });
      for (const origIdx of prefs.order) {
        const td = tdByOrig.get(origIdx);
        if (!td) continue;
        tr.appendChild(td);
        td.classList.toggle('col-hidden-by-user', hiddenSet.has(origIdx));
      }
    });

    // 4. Sort rows (and group by similarity when groupCol >= 0)
    const getRowCellText = (tr, origIdx) => {
      const td = tr.querySelector(`:scope > td[data-orig-col="${origIdx}"]`);
      return extractCellPrimaryText(td);
    };

    const sortedRows = [...dataRows];
    if (prefs.groupCol >= 0) {
      const groupDir = (prefs.sortCol === prefs.groupCol) ? prefs.sortDir : 'asc';
      sortedRows.sort((a, b) => {
        const gA = getRowCellText(a, prefs.groupCol) || 'Uncategorized';
        const gB = getRowCellText(b, prefs.groupCol) || 'Uncategorized';
        const gCmp = compareCellValues(gA, gB, groupDir);
        if (gCmp !== 0) return gCmp;
        if (prefs.sortCol >= 0 && prefs.sortCol !== prefs.groupCol) {
          const sCmp = compareCellValues(getRowCellText(a, prefs.sortCol), getRowCellText(b, prefs.sortCol), prefs.sortDir);
          if (sCmp !== 0) return sCmp;
        }
        return Number(a.dataset.origRow || 0) - Number(b.dataset.origRow || 0);
      });
    } else if (prefs.sortCol >= 0) {
      sortedRows.sort((a, b) => {
        const cmp = compareCellValues(getRowCellText(a, prefs.sortCol), getRowCellText(b, prefs.sortCol), prefs.sortDir);
        if (cmp !== 0) return cmp;
        return Number(a.dataset.origRow || 0) - Number(b.dataset.origRow || 0);
      });
    } else {
      sortedRows.sort((a, b) => Number(a.dataset.origRow || 0) - Number(b.dataset.origRow || 0));
    }

    // 5. Re-attach sorted rows (inserting similarity group headers if grouping is active)
    const frag = document.createDocumentFragment();
    if (prefs.groupCol >= 0 && sortedRows.length > 0) {
      const groupMeta = colByOrig.get(prefs.groupCol);
      const groupColLabel = (prefs.labels && prefs.labels[prefs.groupCol]) || groupMeta?.defaultLabel || 'Group';
      const buckets = new Map();
      for (const tr of sortedRows) {
        const rawLabel = getRowCellText(tr, prefs.groupCol) || 'Other / Unspecified';
        const normKey = rawLabel.toLowerCase();
        if (!buckets.has(normKey)) buckets.set(normKey, { label: rawLabel, rows: [] });
        buckets.get(normKey).rows.push(tr);
      }
      for (const bucket of buckets.values()) {
        const groupTr = document.createElement('tr');
        groupTr.className = 'table-group-row';
        groupTr.innerHTML = `<td colspan="${visibleColCount}"><div class="table-group-banner"><span class="table-group-name">${escapeHtml(groupColLabel)}: <strong>${escapeHtml(bucket.label)}</strong></span><span class="table-group-count">${bucket.rows.length} item${bucket.rows.length === 1 ? '' : 's'}</span></div></td>`;
        frag.appendChild(groupTr);
        for (const tr of bucket.rows) frag.appendChild(tr);
      }
    } else {
      for (const tr of sortedRows) frag.appendChild(tr);
    }
    for (const tr of emptyRows) frag.appendChild(tr);
    tbody.appendChild(frag);
  }

  function renderPowerBar(table, tableKey, cols, prefs) {
    const scrollWrap = table.closest('.table-scroll');
    if (!scrollWrap || !scrollWrap.parentElement) return;

    const existing = scrollWrap.previousElementSibling;
    const bar = (existing && existing.classList.contains('table-power-bar'))
      ? existing
      : document.createElement('div');
    bar.className = 'table-power-bar';

    const sortableCols = cols.filter(c => !c.isCheckbox && !c.isAction);
    const editableCols = cols.filter(c => !c.isCheckbox);
    const visibleEditableCount = editableCols.filter(c => !prefs.hidden.includes(c.origIdx)).length;
    const isCustomized = hasCustomPrefs(prefs, cols);

    const colLabel = (c) => (prefs.labels && prefs.labels[c.origIdx]) ? prefs.labels[c.origIdx] : c.defaultLabel;
    const sortVal = prefs.sortCol >= 0 ? `${prefs.sortCol}:${prefs.sortDir}` : '';
    const groupVal = prefs.groupCol >= 0 ? String(prefs.groupCol) : '';

    bar.innerHTML = `
      <div class="table-power-left">
        <label class="table-power-control" title="Sort list rows">
          <span class="table-power-icon">⇅</span>
          <select class="table-power-select" data-tp-role="sort" aria-label="Sort list">
            <option value="" ${!sortVal ? 'selected' : ''}>Sort: Default</option>
            ${sortableCols.map(c => `
              <option value="${c.origIdx}:asc" ${sortVal === `${c.origIdx}:asc` ? 'selected' : ''}>${escapeHtml(colLabel(c))} (A→Z / Low→High)</option>
              <option value="${c.origIdx}:desc" ${sortVal === `${c.origIdx}:desc` ? 'selected' : ''}>${escapeHtml(colLabel(c))} (Z→A / High→Low)</option>
            `).join('')}
          </select>
        </label>
        <label class="table-power-control" title="Cluster similar items together">
          <span class="table-power-icon">⊞</span>
          <select class="table-power-select" data-tp-role="group" aria-label="Group by similarity">
            <option value="" ${!groupVal ? 'selected' : ''}>Group: None</option>
            ${sortableCols.map(c => `
              <option value="${c.origIdx}" ${groupVal === String(c.origIdx) ? 'selected' : ''}>Group by ${escapeHtml(colLabel(c))}</option>
            `).join('')}
          </select>
        </label>
      </div>
      <div class="table-power-right">
        <button type="button" class="button small table-power-btn" data-tp-role="columns" title="Show, hide, reorder, or rename columns">
          ⚙ Columns${visibleEditableCount < editableCols.length ? ` (${visibleEditableCount}/${editableCols.length})` : ''}
        </button>
        <button type="button" class="button small table-power-btn" data-tp-role="print" title="Print or save PDF with current sorting & selected columns">
          🖨 Print
        </button>
        ${isCustomized ? `<button type="button" class="button small table-power-btn" data-tp-role="reset" title="Reset sort, grouping, and columns">↺ Reset</button>` : ''}
      </div>
    `;

    if (!existing || !existing.classList.contains('table-power-bar')) {
      scrollWrap.parentElement.insertBefore(bar, scrollWrap);
    }

    bar.querySelector('[data-tp-role="sort"]')?.addEventListener('change', (e) => {
      const val = e.target.value;
      const latest = getNormalizedPrefs(tableKey, cols);
      if (!val) {
        latest.sortCol = -1;
        latest.sortDir = 'asc';
      } else {
        const [idxStr, dir] = val.split(':');
        latest.sortCol = Number(idxStr);
        latest.sortDir = dir === 'desc' ? 'desc' : 'asc';
      }
      saveTablePrefs(tableKey, latest);
      applyTableState(table, tableKey, cols, latest);
      renderPowerBar(table, tableKey, cols, latest);
    });

    bar.querySelector('[data-tp-role="group"]')?.addEventListener('change', (e) => {
      const val = e.target.value;
      const latest = getNormalizedPrefs(tableKey, cols);
      latest.groupCol = val === '' ? -1 : Number(val);
      saveTablePrefs(tableKey, latest);
      applyTableState(table, tableKey, cols, latest);
      renderPowerBar(table, tableKey, cols, latest);
    });

    bar.querySelector('[data-tp-role="columns"]')?.addEventListener('click', () => {
      openColumnEditor(table, tableKey, cols);
    });

    bar.querySelector('[data-tp-role="print"]')?.addEventListener('click', () => {
      printEnhancedTable(table, tableKey, cols);
    });

    bar.querySelector('[data-tp-role="reset"]')?.addEventListener('click', () => {
      resetTablePrefs(tableKey);
      const fresh = getNormalizedPrefs(tableKey, cols);
      applyTableState(table, tableKey, cols, fresh);
      renderPowerBar(table, tableKey, cols, fresh);
      if (typeof window.toast === 'function') window.toast('↺ List sorting and columns reset to default');
    });

    if (typeof window.TideI18n?.applyDomTranslations === 'function') {
      window.TideI18n.applyDomTranslations(bar);
    }
  }

  function ensureColumnEditorDialog() {
    let dlg = document.getElementById('table-columns-modal');
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.id = 'table-columns-modal';
      dlg.className = 'modal';
      dlg.innerHTML = `<form method="dialog" class="modal-card" id="table-columns-form"></form>`;
      document.body.appendChild(dlg);
    }
    return dlg;
  }

  function openColumnEditor(table, tableKey, cols) {
    const dlg = ensureColumnEditorDialog();
    const form = dlg.querySelector('#table-columns-form');
    const prefs = getNormalizedPrefs(tableKey, cols);
    const colByOrig = new Map(cols.map(c => [c.origIdx, c]));
    const checkboxCol = cols.find(c => c.isCheckbox);

    // Working copy of editable columns in current display order
    let workingOrder = prefs.order.filter(id => !checkboxCol || id !== checkboxCol.origIdx);
    const workingHidden = new Set(prefs.hidden);
    const workingLabels = { ...(prefs.labels || {}) };

    const renderList = () => {
      const title = getTableTitle(table);
      form.innerHTML = `
        <div class="modal-head">
          <div>
            <h2>Edit Columns · ${escapeHtml(title)}</h2>
            <p>Choose which columns to display &amp; print, reorder them, or rename column headers.</p>
          </div>
          <button type="button" class="modal-close" data-col-act="close" aria-label="Close">×</button>
        </div>
        <div class="col-editor-toolbar">
          <button type="button" class="button small" data-col-act="select-all">✓ Show All</button>
          <button type="button" class="button small" data-col-act="reset-cols">↺ Reset Default Order &amp; Names</button>
        </div>
        <div class="col-editor-list">
          ${workingOrder.map((origIdx, pos) => {
            const meta = colByOrig.get(origIdx);
            if (!meta) return '';
            const checked = !workingHidden.has(origIdx);
            const curLabel = workingLabels[origIdx] || meta.defaultLabel;
            return `
              <div class="col-editor-row ${checked ? '' : 'is-hidden-col'}" data-orig-idx="${origIdx}">
                <label class="col-editor-check">
                  <input type="checkbox" data-col-toggle="${origIdx}" ${checked ? 'checked' : ''}>
                </label>
                <div class="col-editor-input-wrap">
                  <input type="text" class="col-editor-name-input" data-col-name="${origIdx}" value="${escapeHtml(curLabel)}" placeholder="${escapeHtml(meta.defaultLabel)}">
                  ${meta.isAction ? '<small class="muted">Screen-only action menu (excluded from print)</small>' : ''}
                </div>
                <div class="col-editor-move">
                  <button type="button" class="button small" data-col-move="up" data-pos="${pos}" ${pos === 0 ? 'disabled' : ''} title="Move up">↑</button>
                  <button type="button" class="button small" data-col-move="down" data-pos="${pos}" ${pos === workingOrder.length - 1 ? 'disabled' : ''} title="Move down">↓</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <div class="modal-actions">
          <button type="button" class="button" data-col-act="close">Cancel</button>
          <button type="button" class="button primary" data-col-act="apply">✓ Apply Columns</button>
        </div>
      `;

      form.querySelectorAll('[data-col-toggle]').forEach(cb => {
        cb.addEventListener('change', () => {
          const idx = Number(cb.dataset.colToggle);
          if (cb.checked) workingHidden.delete(idx);
          else workingHidden.add(idx);
          cb.closest('.col-editor-row')?.classList.toggle('is-hidden-col', !cb.checked);
        });
      });

      form.querySelectorAll('[data-col-name]').forEach(inp => {
        inp.addEventListener('input', () => {
          const idx = Number(inp.dataset.colName);
          const meta = colByOrig.get(idx);
          const val = inp.value.trim();
          if (!val || val === meta?.defaultLabel) delete workingLabels[idx];
          else workingLabels[idx] = val;
        });
      });

      form.querySelectorAll('[data-col-move]').forEach(btn => {
        btn.addEventListener('click', () => {
          const pos = Number(btn.dataset.pos);
          const dir = btn.dataset.colMove === 'up' ? -1 : 1;
          const target = pos + dir;
          if (target < 0 || target >= workingOrder.length) return;
          const tmp = workingOrder[pos];
          workingOrder[pos] = workingOrder[target];
          workingOrder[target] = tmp;
          renderList();
        });
      });

      form.querySelector('[data-col-act="select-all"]')?.addEventListener('click', () => {
        workingHidden.clear();
        renderList();
      });

      form.querySelector('[data-col-act="reset-cols"]')?.addEventListener('click', () => {
        workingOrder = cols.filter(c => !c.isCheckbox).map(c => c.origIdx);
        workingHidden.clear();
        Object.keys(workingLabels).forEach(k => delete workingLabels[k]);
        renderList();
      });

      form.querySelectorAll('[data-col-act="close"]').forEach(btn => {
        btn.addEventListener('click', () => dlg.close());
      });

      form.querySelector('[data-col-act="apply"]')?.addEventListener('click', () => {
        const visibleDataCols = workingOrder.filter(id => !workingHidden.has(id) && !colByOrig.get(id)?.isAction);
        if (visibleDataCols.length === 0) {
          if (typeof window.toast === 'function') window.toast('Keep at least one data column visible');
          return;
        }
        const latest = getNormalizedPrefs(tableKey, cols);
        latest.order = checkboxCol ? [checkboxCol.origIdx, ...workingOrder] : [...workingOrder];
        latest.hidden = Array.from(workingHidden);
        latest.labels = { ...workingLabels };
        saveTablePrefs(tableKey, latest);
        applyTableState(table, tableKey, cols, latest);
        renderPowerBar(table, tableKey, cols, latest);
        dlg.close();
        if (typeof window.toast === 'function') window.toast('✓ Columns updated (applied to view & print)');
      });
    };

    renderList();
    if (!dlg.open) dlg.showModal();
  }

  function printEnhancedTable(table, tableKey, cols) {
    const prefs = getNormalizedPrefs(tableKey, cols);
    const hiddenSet = new Set(prefs.hidden);
    const colByOrig = new Map(cols.map(c => [c.origIdx, c]));

    // Printable columns: visible columns in chosen order, automatically excluding checkboxes & Actions
    const printCols = prefs.order
      .filter(id => !hiddenSet.has(id))
      .map(id => colByOrig.get(id))
      .filter(c => c && !c.isCheckbox && !c.isAction);

    if (!printCols.length) {
      if (typeof window.toast === 'function') window.toast('No printable columns selected');
      return;
    }

    const title = getTableTitle(table);
    const ctx = getAppContext();
    const st = (ctx.state && typeof ctx.state === 'object') ? ctx.state : {};
    const companyName = st.companyName || 'My Company';
    const branchName = ctx.activeBranch?.name || st.branch || 'Main branch';
    const companyMeta = [st.companyAddress, st.companyPhone, st.companyEmail].filter(Boolean).join(' · ');
    const companyLogo = (typeof st.companyLogo === 'string' && /^data:image\/(png|jpeg|jpg|webp);base64,/i.test(st.companyLogo)) ? st.companyLogo : '';
    const primaryColor = /^#[0-9a-fA-F]{6}$/.test(st.themeColors?.primary || '') ? st.themeColors.primary : '#0a1e36';
    const secondaryColor = /^#[0-9a-fA-F]{6}$/.test(st.themeColors?.secondary || '') ? st.themeColors.secondary : '#ff6a00';
    const currentUser = ctx.currentUser?.name || (typeof window.currentWorkspaceUser === 'function' ? window.currentWorkspaceUser()?.name : '') || 'Administrator';
    const printedAt = new Intl.DateTimeFormat('en-TZ', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      timeZone: 'Africa/Dar_es_Salaam'
    }).format(new Date());

    const sortMeta = prefs.sortCol >= 0 ? colByOrig.get(prefs.sortCol) : null;
    const sortLabel = sortMeta
      ? `${(prefs.labels && prefs.labels[sortMeta.origIdx]) || sortMeta.defaultLabel} (${prefs.sortDir === 'desc' ? 'Z→A / High→Low' : 'A→Z / Low→High'})`
      : 'Default order';
    const groupMeta = prefs.groupCol >= 0 ? colByOrig.get(prefs.groupCol) : null;
    const groupLabel = groupMeta
      ? ((prefs.labels && prefs.labels[groupMeta.origIdx]) || groupMeta.defaultLabel)
      : 'None';

    // Collect rows in EXACT current DOM order (preserves active search, filters, sorting, and similarity groups)
    const tbody = table.querySelector('tbody');
    const domRows = tbody ? Array.from(tbody.querySelectorAll('tr')) : [];
    let recordCount = 0;

    const bodyHtml = domRows.map(tr => {
      if (tr.dataset.emptyRow === '1') {
        return `<tr><td colspan="${printCols.length}" style="text-align:center;padding:18px;color:#64748b">${escapeHtml(tr.textContent.trim())}</td></tr>`;
      }
      if (tr.classList.contains('table-group-row')) {
        const gText = tr.textContent.replace(/\s+/g, ' ').trim();
        return `<tr class="print-group-row"><td colspan="${printCols.length}">${escapeHtml(gText)}</td></tr>`;
      }
      recordCount++;
      const tds = printCols.map(c => {
        const td = tr.querySelector(`:scope > td[data-orig-col="${c.origIdx}"]`);
        const cellText = extractCellFullText(td);
        const parsed = parseSortableValue(cellText);
        const isNum = parsed.kind === 'num' && !/^\d{4}-\d{2}-\d{2}/.test(cellText) && !/^\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}$/.test(cellText);
        return `<td class="${isNum ? 'num' : ''}">${escapeHtml(cellText || '—')}</td>`;
      }).join('');
      return `<tr>${tds}</tr>`;
    }).join('');

    const headHtml = printCols.map(c => {
      const label = (prefs.labels && prefs.labels[c.origIdx]) ? prefs.labels[c.origIdx] : c.defaultLabel;
      return `<th>${escapeHtml(label)}</th>`;
    }).join('');

    const docHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)} — ${escapeHtml(companyName)}</title>
  <style>
    @page { size: auto; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'IBM Plex Sans', 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 0; font-size: 11px; line-height: 1.4; }
    .print-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 3px solid ${primaryColor}; padding-bottom: 12px; margin-bottom: 14px; }
    .brand-block { display: flex; align-items: center; gap: 12px; }
    .brand-block img { max-height: 48px; max-width: 110px; object-fit: contain; }
    .company-name { font-size: 18px; font-weight: 800; color: ${primaryColor}; margin: 0; }
    .company-sub { font-size: 11px; color: #475569; margin: 2px 0 0; }
    .report-title-box { text-align: right; }
    .report-title { font-size: 15px; font-weight: 800; color: ${secondaryColor}; text-transform: uppercase; letter-spacing: 0.04em; margin: 0; }
    .report-date { font-size: 10.5px; color: #64748b; margin-top: 3px; }
    .meta-strip { display: flex; flex-wrap: wrap; gap: 14px; padding: 8px 12px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; margin-bottom: 12px; font-size: 10.5px; color: #334155; }
    .meta-strip strong { color: #0f172a; }
    table { width: 100%; border-collapse: collapse; }
    thead th { background: ${primaryColor}; color: #ffffff; text-align: left; padding: 7px 8px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 2px solid ${secondaryColor}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    tbody td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; word-break: break-word; }
    tbody tr:nth-child(even):not(.print-group-row) { background: #f8fafc; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    tr.print-group-row td { background: #eef2f6; color: ${primaryColor}; font-weight: 800; font-size: 10.5px; padding: 7px 8px; border-top: 1.5px solid ${primaryColor}; border-bottom: 1px solid #cbd5e1; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .print-footer { margin-top: 14px; padding-top: 8px; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; font-size: 10px; color: #64748b; }
  </style>
</head>
<body>
  <header class="print-header">
    <div class="brand-block">
      ${companyLogo ? `<img src="${escapeHtml(companyLogo)}" alt="Logo">` : ''}
      <div>
        <h1 class="company-name">${escapeHtml(companyName)}</h1>
        <p class="company-sub">${escapeHtml(branchName)}${companyMeta ? ` · ${escapeHtml(companyMeta)}` : ''}</p>
      </div>
    </div>
    <div class="report-title-box">
      <div class="report-title">${escapeHtml(title)}</div>
      <div class="report-date">Printed ${escapeHtml(printedAt)}</div>
    </div>
  </header>
  <div class="meta-strip">
    <span><strong>Records:</strong> ${recordCount}</span>
    <span><strong>Columns:</strong> ${printCols.length}</span>
    <span><strong>Sorted by:</strong> ${escapeHtml(sortLabel)}</span>
    ${prefs.groupCol >= 0 ? `<span><strong>Grouped by:</strong> ${escapeHtml(groupLabel)}</span>` : ''}
  </div>
  <table>
    <thead><tr>${headHtml}</tr></thead>
    <tbody>${bodyHtml}</tbody>
  </table>
  <footer class="print-footer">
    <span>Generated by Tide ERP · ${escapeHtml(companyName)} (${escapeHtml(branchName)})</span>
    <span>Printed by ${escapeHtml(currentUser)} · ${recordCount} total record${recordCount === 1 ? '' : 's'}</span>
  </footer>
</body>
</html>`;

    // Print via hidden iframe (never blocked by pop-up blockers on desktop or mobile!)
    try {
      const oldFrame = document.getElementById('tide-print-iframe');
      if (oldFrame) oldFrame.remove();
      const iframe = document.createElement('iframe');
      iframe.id = 'tide-print-iframe';
      iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
      document.body.appendChild(iframe);
      const win = iframe.contentWindow;
      const doc = win.document;
      doc.open();
      doc.write(docHtml);
      doc.close();
      setTimeout(() => {
        try {
          win.focus();
          win.print();
        } catch {
          const popup = window.open('', '_blank', 'width=960,height=720');
          if (popup) {
            popup.document.write(docHtml);
            popup.document.close();
            popup.focus();
            setTimeout(() => popup.print(), 250);
          }
        }
      }, 220);
    } catch (err) {
      console.error('Print failed:', err);
      if (typeof window.toast === 'function') window.toast('Unable to open print preview');
    }
  }

  function enhanceTable(table, indexOnPage) {
    if (!table || table.dataset.noPowerBar === 'true' || !table.querySelector('thead tr th') || !table.querySelector('tbody')) return;
    const cols = inspectColumns(table);
    const dataCols = cols.filter(c => !c.isCheckbox && !c.isAction);
    if (dataCols.length < 2) return;

    const tableKey = buildTableKey(table, indexOnPage);
    table.dataset.tableKey = tableKey;
    tagOriginalCells(table);

    const prefs = getNormalizedPrefs(tableKey, cols);
    applyTableState(table, tableKey, cols, prefs);
    renderPowerBar(table, tableKey, cols, prefs);

    // Clickable column header sorting (attach once per rendered table)
    if (!table.dataset.thSortBound) {
      table.dataset.thSortBound = '1';
      table.querySelector('thead')?.addEventListener('click', (e) => {
        const th = e.target.closest('th.th-sortable');
        if (!th || th.dataset.origCol === undefined) return;
        const origIdx = Number(th.dataset.origCol);
        const latest = getNormalizedPrefs(tableKey, cols);
        if (latest.sortCol === origIdx) {
          latest.sortDir = latest.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          latest.sortCol = origIdx;
          latest.sortDir = 'asc';
        }
        saveTablePrefs(tableKey, latest);
        applyTableState(table, tableKey, cols, latest);
        renderPowerBar(table, tableKey, cols, latest);
      });
    }
  }

  function enhanceAll(container = document.getElementById('page-content')) {
    if (!container) return;
    const tables = Array.from(container.querySelectorAll('table.data-table'));
    tables.forEach((table, idx) => enhanceTable(table, idx));
  }

  root.TideTableTools = {
    enhanceAll,
    enhanceTable,
    printEnhancedTable,
    openColumnEditor
  };
}(typeof window !== 'undefined' ? window : this));
