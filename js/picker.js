/* ============================================================
 * customSchedule — searchable multi-select picker
 * Used by the task editor for departments and responsible people.
 * ============================================================ */
(function () {
  'use strict';

  var CS = window.CS;
  var h = CS.h;

  var activePicker = null;

  function splitValues(text) {
    return String(text || '')
      .split(/[、，,；;]+/)
      .map(function (v) { return v.trim(); })
      .filter(Boolean);
  }

  CS.closeAllPickers = function () {
    if (activePicker) activePicker.close();
    activePicker = null;
  };

  /**
   * opts:
   *   label: string
   *   placeholder: string
   *   selected: string[]
   *   options: [{ value, count, inTable }]
   *   emptyHint: string
   * Returns { node, getValues }
   */
  CS.createMultiPicker = function (opts) {
    opts = opts || {};
    var selected = (opts.selected || []).map(String).filter(Boolean);
    var options = (opts.options || []).map(function (o) {
      return { value: String(o.value), count: o.count || 0, inTable: o.inTable !== false };
    });

    // Make sure already-selected values exist in the option list.
    selected.forEach(function (v) {
      if (!options.some(function (o) { return o.value === v; })) {
        options.push({ value: v, count: 0, inTable: false });
      }
    });

    var field = h('div', { class: 'picker-field' });
    var chips = h('div', { class: 'picker-chips' });
    var placeholder = h('span', { class: 'picker-placeholder' }, opts.placeholder || '点击选择');
    var chevron = h('span', { class: 'picker-chevron' }, CS.icon('chevron', 12));
    var box = h('div', {
      class: 'picker-box',
      attrs: { role: 'button', tabindex: '0', 'aria-haspopup': 'dialog' }
    }, chips, placeholder, chevron);

    field.appendChild(box);

    var backdrop = null;
    var panel = null;
    var search = null;
    var list = null;

    function isExternal(value) {
      var found = options.filter(function (o) { return o.value === value; })[0];
      return !found || found.inTable === false;
    }

    function renderChips() {
      CS.clear(chips);
      selected.forEach(function (value) {
        var external = isExternal(value);
        var chip = h('span', { class: 'picker-chip' + (external ? ' external' : ''), title: external ? '不在表中' : value },
          h('span', { class: 'picker-chip-text' }, value),
          h('button', {
            class: 'picker-chip-remove',
            type: 'button',
            'aria-label': '移除 ' + value,
            onclick: function (e) {
              e.stopPropagation();
              removeValue(value);
            }
          }, '×')
        );
        chips.appendChild(chip);
      });
      placeholder.hidden = selected.length > 0;
      box.classList.toggle('has-value', selected.length > 0);
    }

    function addValue(value) {
      var v = String(value || '').trim();
      if (!v) return;
      if (selected.indexOf(v) === -1) selected.push(v);
      if (!options.some(function (o) { return o.value === v; })) {
        options.push({ value: v, count: 0, inTable: false });
      }
      renderChips();
      if (list) renderList(search ? search.value : '');
      if (opts.onChange) opts.onChange(getValues());
    }

    function removeValue(value) {
      var i = selected.indexOf(value);
      if (i !== -1) selected.splice(i, 1);
      renderChips();
      if (list) renderList(search ? search.value : '');
      if (opts.onChange) opts.onChange(getValues());
    }

    function toggleValue(value) {
      if (selected.indexOf(value) === -1) addValue(value);
      else removeValue(value);
    }

    function getValues() {
      return selected.slice();
    }

    function close() {
      if (backdrop) backdrop.remove();
      if (panel) panel.remove();
      backdrop = null;
      panel = null;
      search = null;
      list = null;
      if (activePicker && activePicker.name === opts.name) activePicker = null;
      document.removeEventListener('keydown', onDocKey, true);
    }

    function onDocKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    }

    function open() {
      if (activePicker && activePicker.name !== opts.name) activePicker.close();
      if (panel) return;

      var rect = box.getBoundingClientRect();
      var mobile = window.matchMedia('(max-width: 767px)').matches;

      backdrop = h('div', { class: 'picker-backdrop', onclick: close });
      document.body.appendChild(backdrop);

      search = h('input', {
        class: 'picker-search',
        type: 'search',
        placeholder: '搜索' + (opts.label || '') + '，或输入新值',
        'aria-label': '搜索' + (opts.label || '')
      });

      list = h('div', { class: 'picker-list', attrs: { role: 'listbox', 'aria-multiselectable': 'true' } });

      panel = h('div', { class: 'picker-panel', attrs: { role: 'dialog', 'aria-label': '选择' + (opts.label || '') } },
        h('div', { class: 'picker-panel-head' },
          h('span', { class: 'picker-panel-title' }, '选择' + (opts.label || '')),
          h('button', {
            class: 'drawer-close', type: 'button', 'aria-label': '关闭',
            onclick: close
          }, CS.icon('close', 15))
        ),
        search,
        list,
        h('div', { class: 'picker-panel-foot' },
          h('span', { class: 'picker-hint' }, '支持输入多个值（用顿号分隔）；不在表中的值会标黄'),
          h('button', { class: 'btn primary small', type: 'button', onclick: close }, '完成')
        )
      );

      document.body.appendChild(panel);
      if (!mobile) {
        panel.style.left = Math.max(8, rect.left) + 'px';
        panel.style.top = Math.min(window.innerHeight - 20, rect.bottom + 6) + 'px';
        panel.style.width = Math.max(260, rect.width) + 'px';
        if (rect.bottom + 320 > window.innerHeight) {
          panel.style.top = Math.max(8, rect.top - 326) + 'px';
        }
      }

      search.addEventListener('input', function () { renderList(search.value); });
      search.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          var raw = search.value.trim();
          if (!raw) return;
          var parts = splitValues(raw);
          if (parts.length > 1) {
            parts.forEach(addValue);
            search.value = '';
            renderList('');
            return;
          }
          var exact = options.filter(function (o) {
            return o.value.toLowerCase() === raw.toLowerCase();
          })[0];
          addValue(exact ? exact.value : raw);
          search.value = '';
          renderList('');
        }
      });

      renderList('');
      activePicker = { name: opts.name, close: close };
      document.addEventListener('keydown', onDocKey, true);
      setTimeout(function () { try { search.focus(); } catch (e) {} }, 40);
    }

    function renderList(query) {
      if (!list) return;
      CS.clear(list);
      var q = String(query || '').trim().toLowerCase();
      var visible = 0;

      options.forEach(function (opt) {
        if (q && opt.value.toLowerCase().indexOf(q) === -1) return;
        visible++;
        var isSelected = selected.indexOf(opt.value) !== -1;
        list.appendChild(h('div', {
          class: 'picker-option' + (isSelected ? ' selected' : '') + (opt.inTable === false ? ' external' : ''),
          attrs: { role: 'option', 'aria-selected': String(isSelected) },
          onclick: function () { toggleValue(opt.value); }
        },
          h('span', { class: 'picker-check' }, isSelected ? '✓' : ''),
          h('span', { class: 'picker-option-name', title: opt.value }, opt.value),
          opt.count ? h('span', { class: 'picker-option-count' }, String(opt.count)) : null,
          opt.inTable === false ? h('span', { class: 'picker-external' }, '表外') : null
        ));
      });

      var trimmed = String(query || '').trim();
      if (trimmed && !options.some(function (o) { return o.value.toLowerCase() === trimmed.toLowerCase(); })) {
        list.appendChild(h('div', {
          class: 'picker-option picker-add-external',
          onclick: function () { addValue(trimmed); if (search) search.value = ''; renderList(''); }
        },
          h('span', { class: 'picker-check' }, '+'),
          h('span', { class: 'picker-option-name' }, '使用“' + trimmed + '”（不在表）'),
          h('span', { class: 'picker-external' }, '表外')
        ));
      }

      if (!visible && !trimmed) {
        list.appendChild(h('div', { class: 'picker-empty' }, opts.emptyHint || '暂无选项'));
      }
    }

    box.addEventListener('click', function (e) {
      if (e.target.closest('.picker-chip-remove')) return;
      if (panel) close();
      else open();
    });
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (panel) close();
        else open();
      }
    });

    renderChips();

    return {
      node: field,
      getValues: getValues,
      close: close
    };
  };
})();