/* ============================================================
 * customSchedule — page rendering
 * ============================================================ */
(function () {
  'use strict';

  var CS = window.CS;
  var h = CS.h;
  var state = CS.state;

  CS.renderAll = function () {
    CS.renderHeader();
    CS.renderKPI();
    CS.renderToolbar();
    if (CS.renderAdminBar) CS.renderAdminBar();
    CS.renderBoard();
    document.title = CS.TITLE;
  };

  CS.renderHeader = function () {
    var meta = state.data.meta;
    CS.refs.brandTitle.textContent = CS.TITLE;
    CS.refs.brandTitle.title = CS.refs.brandTitle.textContent;

    var logo = meta.logo || CS.CFG.logo || '';
    if (logo) {
      CS.refs.brandLogo.src = logo;
      CS.refs.brandLogoWrap.hidden = false;
    } else {
      CS.refs.brandLogoWrap.hidden = true;
    }

    CS.refs.updatedAt.textContent = meta.updatedAt
      ? '数据更新于 ' + CS.fmtDateTime(meta.updatedAt)
      : '尚未发布';

    var showAdmin = state.admin || state.adminHint;
    CS.refs.adminHint.hidden = !showAdmin;
    if (showAdmin) {
      CS.refs.adminHint.textContent = state.admin ? '退出管理' : '管理';
    }

    CS.refs.footerNote.textContent = '静态页面 · 数据由管理员发布后更新' +
      (meta.publishNote ? ' · ' + meta.publishNote : '');
  };

  function kpiCard(iconName, label, valueNode, subNode, extraNode, tone) {
    return h('article', { class: 'kpi-card' },
      h('div', { class: 'kpi-head' },
        h('span', { class: 'kpi-label' }, label),
        h('span', { class: 'kpi-icon' }, CS.icon(iconName, 15))
      ),
      h('div', { class: 'kpi-value' + (tone ? ' ' + tone : '') }, valueNode),
      subNode ? h('div', { class: 'kpi-sub' }, subNode) : null,
      extraNode || null
    );
  }

  CS.renderKPI = function () {
    var stats = CS.computeStats(state.data.tasks);
    var grid = CS.refs.kpiGrid;
    CS.clear(grid);

    var avgValue = h('span', {}, String(stats.avg));
    avgValue.appendChild(h('span', { class: 'unit' }, '%'));
    grid.appendChild(kpiCard(
      'target', '整体完成率',
      avgValue,
      '按 ' + stats.n + ' 项任务进度平均',
      h('div', { class: 'kpi-bar' }, h('span', { style: { width: stats.avg + '%' } }))
    ));

    var doneValue = h('span', {}, String(stats.counts.done));
    doneValue.appendChild(h('span', { class: 'unit' }, ' / ' + stats.n + ' 已完成'));
    var total = stats.n || 1;
    var stack = h('div', { class: 'stack-bar' },
      h('span', { class: 's-done', style: { width: (stats.counts.done / total * 100) + '%' } }),
      h('span', { class: 's-run', style: { width: (stats.counts.run / total * 100) + '%' } }),
      h('span', { class: 's-todo', style: { width: (stats.counts.todo / total * 100) + '%' } })
    );
    var legend = h('div', { class: 'legend' },
      h('span', { class: 'legend-item' }, h('span', { class: 'dot', style: { background: 'var(--ok)' } }), '已完成 ' + stats.counts.done),
      h('span', { class: 'legend-item' }, h('span', { class: 'dot', style: { background: 'var(--phase-pm)' } }), '进行中 ' + stats.counts.run),
      h('span', { class: 'legend-item' }, h('span', { class: 'dot', style: { background: '#CBD5E1' } }), '未开始 ' + stats.counts.todo)
    );
    grid.appendChild(kpiCard(
      'layers', '任务状态',
      doneValue,
      null,
      h('div', {}, stack, legend)
    ));

    var overdueValue = h('span', {}, String(stats.overdue));
    overdueValue.appendChild(h('span', { class: 'unit' }, ' 项逾期'));
    var riskSub = h('span', {}, '应启动未启动 ');
    riskSub.appendChild(h('span', { style: { color: stats.late ? 'var(--warn)' : 'inherit', fontWeight: stats.late ? '600' : '400' } }, String(stats.late)));
    riskSub.appendChild(document.createTextNode(' 项'));
    grid.appendChild(kpiCard(
      'alert', '风险提示',
      overdueValue,
      riskSub,
      null,
      stats.overdue ? 'danger' : ''
    ));

    var timeValue = h('span', {}, stats.n ? String(stats.timePct) : '—');
    if (stats.n) timeValue.appendChild(h('span', { class: 'unit' }, '% 时间进度'));
    grid.appendChild(kpiCard(
      'calendar', '计划周期',
      timeValue,
      stats.n
        ? CS.fmtShort(stats.minStart) + ' → ' + CS.fmtShort(stats.maxEnd) + ' · 已过 ' + stats.elapsedDays + ' / ' + stats.totalDays + ' 天'
        : '暂无任务',
      stats.n ? h('div', { class: 'kpi-bar' }, h('span', { style: { width: stats.timePct + '%', background: 'linear-gradient(90deg, var(--navy-3), var(--accent-2))' } })) : null
    ));
  };

  function segmented(items, current, onPick, label) {
    var wrap = h('div', { class: 'segmented', attrs: { role: 'group', 'aria-label': label || '' } });
    items.forEach(function (item) {
      wrap.appendChild(h('button', {
        type: 'button',
        class: item.key === current ? 'active' : '',
        'aria-pressed': String(item.key === current),
        onclick: function () { onPick(item.key); }
      }, item.label));
    });
    return wrap;
  }

  CS.renderToolbar = function () {
    if (document.activeElement !== CS.refs.searchInput) {
      CS.refs.searchInput.value = state.filters.q;
    }
    CS.refs.searchClear.hidden = !state.filters.q;

    CS.renderFilterButtons();

    var right = CS.refs.toolbarRight;
    CS.clear(right);

    right.appendChild(segmented([
      { key: 'phase', label: '阶段' },
      { key: 'flat', label: '序号' }
    ], state.group, function (key) {
      state.group = key;
      state.scrollToToday = true;
      CS.writeURL();
      CS.renderAll();
    }, '分组方式'));

    right.appendChild(segmented([
      { key: 'gantt', label: '甘特' },
      { key: 'cards', label: '卡片' }
    ], state.view, function (key) {
      state.view = key;
      state.viewExplicit = true;
      if (key === 'gantt') state.scrollToToday = true;
      CS.writeURL();
      CS.renderAll();
    }, '视图'));

    right.appendChild(segmented([
      { key: 'day', label: '日' },
      { key: 'week', label: '周' },
      { key: 'month', label: '月' }
    ], state.zoom, function (key) {
      state.zoom = key;
      state.scrollToToday = true;
      CS.writeURL();
      CS.renderAll();
    }, '时间缩放'));

    right.appendChild(h('button', {
      class: 'btn icon',
      type: 'button',
      title: '打印 / 导出 PDF',
      'aria-label': '打印',
      onclick: CS.printBoard
    }, CS.icon('print', 16)));
  };

  CS.renderFilterButtons = function () {
    var box = CS.refs.filterButtons;
    CS.clear(box);

    var deptUsage = CS.departmentUsage();
    var deptTable = CS.departmentsTable();
    var deptOptions = CS.allDepartments().map(function (d) {
      return { value: d, count: deptUsage[d] || 0, inTable: deptTable.indexOf(d) !== -1 };
    });

    var personUsage = CS.personUsage();
    var personTable = CS.personsTable();
    var personOptions = CS.allPersons().map(function (o) {
      return { value: o, count: personUsage[o] || 0, inTable: personTable.indexOf(o) !== -1 };
    });

    box.appendChild(CS.filterWrap('dept', '责任部门', deptOptions, state.filters.depts, '暂无部门数据'));
    box.appendChild(CS.filterWrap('owner', '责任人', personOptions, state.filters.owners, '暂无责任人数据'));
    box.appendChild(CS.filterWrap('status', '状态', CS.FILTER_STATUS.map(function (s) { return s; }), state.filters.statuses, '', true));

    box.appendChild(h('button', {
      class: 'btn ghost small',
      id: 'clearFilters',
      type: 'button',
      hidden: !CS.filtersActive(),
      onclick: CS.clearFilters
    }, '清除筛选'));

    var result = h('span', {
      class: 'filter-result',
      id: 'filterResult',
      style: { fontSize: '11.5px', color: 'var(--muted)', whiteSpace: 'nowrap' }
    });
    box.appendChild(result);
    CS.updateFilterSummary();
  };

  CS.filterWrap = function (kind, label, options, selected, emptyText, isStatus) {
    var active = selected.length > 0;
    var button = h('button', {
      class: 'filter-btn' + (active ? ' active' : ''),
      type: 'button',
      'data-filter': kind,
      'aria-expanded': String(state.openFilter === kind),
      onclick: function (e) {
        e.stopPropagation();
        state.openFilter = state.openFilter === kind ? null : kind;
        CS.renderFilterButtons();
      }
    },
      label,
      active ? h('span', { class: 'filter-count' }, String(selected.length)) : null,
      CS.icon('chevron', 12)
    );

    var wrap = h('div', { class: 'filter-wrap' }, button);

    if (state.openFilter === kind) {
      var pop = h('div', { class: 'popover', onclick: function (e) { e.stopPropagation(); } });
      pop.appendChild(h('div', { class: 'popover-title' },
        kind === 'dept' ? '选择责任部门' : (kind === 'owner' ? '选择责任人' : '选择状态')
      ));

      var search = null;
      if (!isStatus) {
        search = h('input', {
          class: 'popover-search',
          type: 'search',
          placeholder: kind === 'dept' ? '搜索部门' : '搜索责任人',
          'aria-label': kind === 'dept' ? '搜索部门' : '搜索责任人'
        });
        pop.appendChild(search);
      }

      var rows = [];
      var noMatch = h('div', { class: 'popover-row muted', hidden: true }, '没有匹配项');
      pop.appendChild(noMatch);

      if (!options.length && emptyText) {
        pop.appendChild(h('div', { class: 'popover-row muted' }, emptyText));
      }

      options.forEach(function (opt) {
        var key = isStatus ? opt.key : opt.value;
        var text = isStatus ? opt.label : opt.value;
        var cb = h('input', {
          type: 'checkbox',
          checked: selected.indexOf(key) !== -1,
          onchange: function (e) {
            var arr = state.filters[kind === 'dept' ? 'depts' : (kind === 'owner' ? 'owners' : 'statuses')];
            var idx = arr.indexOf(key);
            if (e.target.checked && idx === -1) arr.push(key);
            if (!e.target.checked && idx !== -1) arr.splice(idx, 1);
            CS.afterFilterChange();
          }
        });
        var row = h('label', { class: 'popover-row', dataset: { search: text.toLowerCase() } },
          cb,
          h('span', { class: 'popover-name', title: text }, text),
          !isStatus && opt.count ? h('span', { class: 'popover-count' }, String(opt.count)) : null,
          !isStatus && opt.inTable === false ? h('span', { class: 'popover-external' }, '表外') : null
        );
        rows.push({ node: row, text: text.toLowerCase() });
        pop.appendChild(row);
      });

      function applySearch() {
        var q = search ? search.value.trim().toLowerCase() : '';
        var visible = 0;
        rows.forEach(function (row) {
          var show = !q || row.text.indexOf(q) !== -1;
          row.node.hidden = !show;
          if (show) visible++;
        });
        noMatch.hidden = !q || visible > 0 || !rows.length;
      }
      if (search) {
        search.addEventListener('input', applySearch);
      }

      pop.appendChild(h('div', { class: 'popover-actions' },
        h('button', {
          class: 'btn ghost small', type: 'button',
          onclick: function () {
            var arr = state.filters[kind === 'dept' ? 'depts' : (kind === 'owner' ? 'owners' : 'statuses')];
            var q = search ? search.value.trim().toLowerCase() : '';
            options.forEach(function (opt) {
              var key = isStatus ? opt.key : opt.value;
              var text = isStatus ? opt.label : opt.value;
              if (q && text.toLowerCase().indexOf(q) === -1) return;
              if (arr.indexOf(key) === -1) arr.push(key);
            });
            CS.afterFilterChange(true);
          }
        }, '全选'),
        h('button', {
          class: 'btn ghost small', type: 'button',
          onclick: function () {
            var arr = state.filters[kind === 'dept' ? 'depts' : (kind === 'owner' ? 'owners' : 'statuses')];
            arr.length = 0;
            CS.afterFilterChange(true);
          }
        }, '清空')
      ));

      wrap.appendChild(pop);
    }

    return wrap;
  };

  CS.afterFilterChange = function (rebuild) {
    if (rebuild) CS.renderFilterButtons();
    else CS.updateFilterSummary();
    CS.renderBoard();
    CS.writeURL();
  };

  CS.updateFilterSummary = function () {
    var box = CS.refs.filterButtons;
    if (!box) return;

    function setCount(btn, count) {
      if (!btn) return;
      var existing = btn.querySelector('.filter-count');
      if (count) {
        if (!existing) {
          existing = h('span', { class: 'filter-count' });
          btn.appendChild(existing);
        }
        existing.textContent = String(count);
      } else if (existing) {
        existing.remove();
      }
      btn.classList.toggle('active', !!count);
    }

    setCount(box.querySelector('[data-filter="dept"]'), state.filters.depts.length);
    setCount(box.querySelector('[data-filter="owner"]'), state.filters.owners.length);
    setCount(box.querySelector('[data-filter="status"]'), state.filters.statuses.length);

    var clear = box.querySelector('#clearFilters');
    if (clear) clear.hidden = !CS.filtersActive();

    var result = box.querySelector('#filterResult');
    if (result) {
      var visible = state.data.tasks.filter(CS.matchesFilters).length;
      result.textContent = CS.filtersActive() ? '筛选出 ' + visible + ' 项' : '';
    }
  };

  CS.clearFilters = function () {
    state.filters.depts.length = 0;
    state.filters.owners.length = 0;
    state.filters.statuses.length = 0;
    state.filters.q = '';
    state.openFilter = null;
    CS.refs.searchInput.value = '';
    CS.refs.searchClear.hidden = true;
    CS.renderToolbar();
    CS.renderBoard();
    CS.writeURL();
  };

  CS.renderBoard = function () {
    var board = CS.refs.board;
    var viewport = board.querySelector('.gantt-viewport');
    var prev = viewport ? { left: viewport.scrollLeft, top: viewport.scrollTop } : null;
    var shouldScroll = state.scrollToToday;

    var all = state.data.tasks;
    var visible = all.filter(CS.matchesFilters);
    var groups = CS.groupTasks(visible);

    CS.clear(board);

    if (!all.length) {
      board.appendChild(CS.renderEmpty('empty', '还没有任务', state.admin
        ? '新增第一条任务，或从 Excel 导入任务表。'
        : '管理员尚未录入任务。', state.admin ? {
        label: '新增任务', onClick: function () { CS.openTaskEditor(null); }
      } : null));
      CS.updateFilterSummary();
      return;
    }

    if (!visible.length) {
      board.appendChild(CS.renderEmpty('filter', '没有匹配的任务', '当前筛选条件下没有任务，试试清除筛选或换一个关键词。', {
        label: '清除筛选', onClick: CS.clearFilters
      }));
      CS.updateFilterSummary();
      return;
    }

    if (state.view === 'cards') {
      CS.renderCards(groups);
    } else {
      CS.renderGantt(groups);
    }

    if (prev && !shouldScroll) {
      var next = board.querySelector('.gantt-viewport');
      if (next) {
        next.scrollLeft = prev.left;
        next.scrollTop = prev.top;
      }
    }

    CS.updateFilterSummary();
  };

  CS.renderEmpty = function (iconName, title, text, action) {
    var node = h('div', { class: 'gantt-wrap' },
      h('div', { class: 'empty-state' },
        h('div', { class: 'empty-icon' }, CS.icon(iconName === 'filter' ? 'filter' : 'database', 22)),
        h('strong', {}, title),
        h('span', {}, text),
        action ? h('button', { class: 'btn primary', type: 'button', onclick: action.onClick }, action.label) : null
      )
    );
    return node;
  };

  CS.openDetail = function (taskId) {
    var task = state.data.tasks.filter(function (t) { return t.id === taskId; })[0];
    if (!task) return;
    state.selectedId = task.id;

    var today = CS.todayISO();
    var st = CS.statusOf(task, today);
    var colors = CS.phaseColors(task.phase);

    var head = h('div', { class: 'drawer-head' },
      h('div', {},
        h('h2', { text: task.name }),
        h('div', { class: 'sub' },
          CS.statusBadge(st, st === 'overdue' ? CS.overdueDays(task, today) + ' 天' : ''),
          h('span', { class: 'chip', style: { background: colors.soft, color: colors.c } }, task.phase)
        )
      ),
      h('button', {
        class: 'drawer-close', type: 'button', 'aria-label': '关闭',
        onclick: CS.closeDetail
      }, CS.icon('close', 16))
    );

    var body = h('div', { class: 'drawer-body' });

    body.appendChild(h('div', { class: 'detail-progress' },
      h('div', { class: 'detail-progress-head' },
        h('span', { class: 'big' }, task.progress + '%'),
        h('span', { style: { fontSize: '11.5px', color: 'var(--muted)' } }, '完成进度')
      ),
      h('div', { class: 'kpi-bar' }, h('span', { style: { width: task.progress + '%', background: colors.c } }))
    ));

    var depts = h('div', { class: 'detail-value' });
    (task.departments || []).forEach(function (d) { depts.appendChild(h('span', { class: 'chip' }, d)); });
    if (!task.departments || !task.departments.length) depts.textContent = '未填写';

    var owners = h('div', { class: 'detail-value' });
    (task.owners || []).forEach(function (o) { owners.appendChild(h('span', { class: 'chip owner-chip' }, o)); });
    if (!task.owners || !task.owners.length) owners.textContent = '未填写';

    var grid = h('div', { class: 'detail-grid' },
      detailItem('责任部门', depts, true),
      detailItem('责任人', owners, true),
      detailItem('阶段', task.phase),
      detailItem('序号', String(task.seq)),
      detailItem('启动时间', task.start),
      detailItem('完成时间', task.end),
      detailItem('计划工期', CS.plannedDays(task) + ' 天'),
      detailItem('状态', CS.statusLabel(st)),
      detailItem('时间提示', detailStatusText(task, today, st))
    );
    body.appendChild(grid);

    var note = h('div', { class: 'detail-note' }, task.note || '暂无备注');
    if (!task.note) note.style.color = 'var(--muted-2)';
    body.appendChild(h('div', { class: 'detail-label', style: { marginTop: '18px' } }, '备注'));
    body.appendChild(note);

    if (state.admin) {
      body.appendChild(h('div', { class: 'detail-actions' },
        h('button', {
          class: 'btn primary',
          type: 'button',
          onclick: function () { CS.openTaskEditor(task); }
        }, CS.icon('edit', 15), '编辑任务'),
        h('button', {
          class: 'btn',
          type: 'button',
          onclick: function () { CS.closeDetail(); }
        }, '关闭')
      ));
    }

    CS.openDrawer(h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } }, head, body));
  };

  function detailItem(label, value, full) {
    var val = value instanceof Node ? value : h('div', { class: 'detail-value nums' }, value);
    return h('div', { class: 'detail-item' + (full ? ' full' : '') },
      h('div', { class: 'detail-label' }, label),
      val
    );
  }

  function detailStatusText(task, today, st) {
    if (st === 'overdue') return '已逾期 ' + CS.overdueDays(task, today) + ' 天';
    if (st === 'late') return '已过启动时间 ' + CS.lateStartDays(task, today) + ' 天，尚未开始';
    if (st === 'done') return '已完成';
    if (st === 'run') {
      var rem = CS.remainingDays(task, today);
      return rem > 0 ? '剩余 ' + rem + ' 天' : (rem === 0 ? '今天截止' : '已超过完成时间');
    }
    var toStart = CS.diffDays(today, task.start);
    return toStart > 0 ? '距启动 ' + toStart + ' 天' : '今天启动';
  }

  CS.closeDetail = function () {
    CS.closeDrawer();
  };

  CS.printBoard = function () {
    var saved = {
      zoom: state.zoom,
      view: state.view,
      collapsed: new Set(state.collapsed),
      scrollToToday: state.scrollToToday
    };
    state.zoom = 'month';
    state.view = 'gantt';
    state.collapsed = new Set();
    state.scrollToToday = false;
    CS.renderAll();

    var restored = false;
    function restore() {
      if (restored) return;
      restored = true;
      state.zoom = saved.zoom;
      state.view = saved.view;
      state.collapsed = saved.collapsed;
      state.scrollToToday = saved.scrollToToday;
      CS.renderAll();
    }

    window.addEventListener('afterprint', function once() {
      window.removeEventListener('afterprint', once);
      restore();
    });

    setTimeout(function () {
      window.print();
      setTimeout(restore, 1200);
    }, 120);
  };

  CS.saveCollapsed = function () {
    if (!state.data) return;
    var key = CS.STORAGE.collapsed + state.data.meta.projectId;
    CS.storage.set(key, JSON.stringify(Array.from(state.collapsed)));
  };

  CS.loadCollapsed = function () {
    if (!state.data) return;
    var key = CS.STORAGE.collapsed + state.data.meta.projectId;
    var raw = CS.storage.get(key);
    if (!raw) return;
    try {
      var arr = JSON.parse(raw);
      if (Array.isArray(arr)) state.collapsed = new Set(arr);
    } catch (e) { /* ignore */ }
  };

  CS.writeURL = function () {
    try {
      var params = new URLSearchParams(window.location.search);
      params.set('view', state.view);
      params.set('zoom', state.zoom);
      params.set('group', state.group);

      if (state.filters.depts.length) params.set('dept', state.filters.depts.join(','));
      else params.delete('dept');
      if (state.filters.owners.length) params.set('owner', state.filters.owners.join(','));
      else params.delete('owner');
      if (state.filters.statuses.length) params.set('status', state.filters.statuses.join(','));
      else params.delete('status');
      if (state.filters.q.trim()) params.set('q', state.filters.q.trim());
      else params.delete('q');

      var qs = params.toString();
      var next = window.location.pathname + (qs ? '?' + qs : '') + window.location.hash;
      window.history.replaceState(null, '', next);
    } catch (e) { /* file:// or restricted history */ }
  };

  CS.readURL = function () {
    var params = new URLSearchParams(window.location.search);
    if (params.has('admin')) state.adminHint = true;

    var view = params.get('view');
    var defaultView = (CS.CFG.defaults && CS.CFG.defaults.view) || 'gantt';
    if (view === 'gantt' || view === 'cards') {
      state.view = view;
      state.viewExplicit = true;
    } else {
      state.view = window.matchMedia('(max-width: 767px)').matches ? 'cards' : defaultView;
    }

    var zoom = params.get('zoom');
    if (zoom === 'day' || zoom === 'week' || zoom === 'month') state.zoom = zoom;
    else state.zoom = (CS.CFG.defaults && CS.CFG.defaults.zoom) || 'week';

    var group = params.get('group');
    if (group === 'phase' || group === 'flat') state.group = group;
    else state.group = (CS.CFG.defaults && CS.CFG.defaults.group) || 'phase';

    var dept = params.get('dept');
    if (dept) {
      var known = CS.allDepartments();
      state.filters.depts = dept.split(',').filter(function (d) { return known.indexOf(d) !== -1; });
    }

    var owner = params.get('owner');
    if (owner) {
      var knownOwners = CS.allPersons();
      state.filters.owners = owner.split(',').filter(function (o) { return knownOwners.indexOf(o) !== -1; });
    }

    var status = params.get('status');
    if (status) {
      var valid = CS.FILTER_STATUS.map(function (s) { return s.key; });
      state.filters.statuses = status.split(',').filter(function (s) { return valid.indexOf(s) !== -1; });
    }

    var q = params.get('q');
    if (q) state.filters.q = q;

    state.scrollToToday = true;
  };
})();