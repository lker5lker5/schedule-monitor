/* ============================================================
 * customSchedule — Gantt and card rendering
 * ============================================================ */
(function () {
  'use strict';

  var CS = window.CS;
  var h = CS.h;
  var state = CS.state;

  function leftWidthPx() {
    if (window.matchMedia('(max-width: 767px)').matches) return 42 + 210;
    if (window.matchMedia('(max-width: 1199px)').matches) return 52 + 280 + 94;
    return 52 + 300 + 162 + 94;
  }

  CS.computeRange = function () {
    var tasks = state.data.tasks;
    var today = CS.todayISO();
    var min = null;
    var max = null;
    tasks.forEach(function (t) {
      if (!min || t.start < min) min = t.start;
      if (!max || t.end > max) max = t.end;
    });
    if (!min) {
      min = CS.addDaysISO(today, -30);
      max = CS.addDaysISO(today, 30);
    }
    var start = CS.startOfWeekISO(CS.addDaysISO(min, -7));
    var end = CS.endOfWeekISO(CS.addDaysISO(max, 7));
    return { start: start, end: end, days: CS.diffDays(start, end) + 1 };
  };

  CS.buildGridBackground = function (range, px) {
    var layers = [];
    var cur = range.start;
    while (cur <= range.end) {
      if (CS.isWeekend(cur)) {
        var x = CS.diffDays(range.start, cur) * px;
        layers.push('linear-gradient(to right, transparent ' + x + 'px, rgba(15,23,42,.035) ' + x + 'px, rgba(15,23,42,.035) ' + (x + px) + 'px, transparent ' + (x + px) + 'px)');
      }
      cur = CS.addDaysISO(cur, 1);
    }

    cur = CS.monthStartISO(range.start);
    if (cur < range.start) cur = CS.nextMonthStartISO(cur);
    while (cur <= range.end) {
      var mx = CS.diffDays(range.start, cur) * px;
      layers.push('linear-gradient(to right, transparent ' + mx + 'px, rgba(15,23,42,.10) ' + mx + 'px, rgba(15,23,42,.10) ' + (mx + 1) + 'px, transparent ' + (mx + 1) + 'px)');
      cur = CS.nextMonthStartISO(cur);
    }

    if (state.zoom === 'day') {
      cur = range.start;
      while (cur <= range.end) {
        var wx = CS.diffDays(range.start, cur) * px;
        layers.push('linear-gradient(to right, transparent ' + wx + 'px, rgba(15,23,42,.055) ' + wx + 'px, rgba(15,23,42,.055) ' + (wx + 1) + 'px, transparent ' + (wx + 1) + 'px)');
        cur = CS.addDaysISO(cur, 7);
      }
    }

    return layers.length ? layers.join(',') : 'none';
  };

  CS.buildTimelineHeader = function (range, px) {
    var tl = h('div', { class: 'gh-timeline' });
    var months = h('div', { class: 'tl-months' });
    var ticks = h('div', { class: 'tl-ticks' });
    var today = CS.todayISO();

    function segWidth(start, end) {
      return (CS.diffDays(start, end) + 1) * px;
    }

    function addMonthRow(container, start, end, label, shortLabel) {
      var width = segWidth(start, end);
      var text = width < 84 && shortLabel ? shortLabel : label;
      container.appendChild(h('div', {
        class: 'tl-month',
        style: { width: width + 'px' },
        title: label
      }, width < 30 ? '' : text));
    }

    if (state.zoom === 'month') {
      var y = CS.yearStartISO(range.start);
      while (y <= range.end) {
        var yEnd = CS.addDaysISO(CS.nextYearStartISO(y), -1);
        var yStart = y < range.start ? range.start : y;
        if (yEnd > range.end) yEnd = range.end;
        addMonthRow(months, yStart, yEnd, y.slice(0, 4) + '年', y.slice(0, 4));
        y = CS.nextYearStartISO(y);
      }
    } else {
      var m = CS.monthStartISO(range.start);
      while (m <= range.end) {
        var mEnd = CS.addDaysISO(CS.nextMonthStartISO(m), -1);
        var mStart = m < range.start ? range.start : m;
        if (mEnd > range.end) mEnd = range.end;
        addMonthRow(months, mStart, mEnd, Number(m.slice(0, 4)) + '年' + Number(m.slice(5, 7)) + '月', Number(m.slice(5, 7)) + '月');
        m = CS.nextMonthStartISO(m);
      }
    }

    if (state.zoom === 'day') {
      var d = range.start;
      while (d <= range.end) {
        var cls = 'tl-tick';
        if (CS.isWeekend(d)) cls += ' weekend';
        if (d === today) cls += ' today';
        ticks.appendChild(h('div', {
          class: cls,
          style: { width: px + 'px' },
          title: d + ' 周' + CS.weekdayCN(d)
        }, Number(d.slice(8, 10)) + ' ' + CS.weekdayCN(d)));
        d = CS.addDaysISO(d, 1);
      }
    } else if (state.zoom === 'week') {
      var w = range.start;
      while (w <= range.end) {
        var wEnd = CS.addDaysISO(w, 6);
        if (wEnd > range.end) wEnd = range.end;
        var wCls = 'tl-tick';
        if (today >= w && today <= wEnd) wCls += ' today';
        ticks.appendChild(h('div', {
          class: wCls,
          style: { width: segWidth(w, wEnd) + 'px' },
          title: w + ' → ' + wEnd
        }, CS.fmtShort(w)));
        w = CS.addDaysISO(wEnd, 1);
      }
    } else {
      var mm = CS.monthStartISO(range.start);
      while (mm <= range.end) {
        var mmEnd = CS.addDaysISO(CS.nextMonthStartISO(mm), -1);
        var mmStart = mm < range.start ? range.start : mm;
        if (mmEnd > range.end) mmEnd = range.end;
        var mCls = 'tl-tick';
        if (today >= mmStart && today <= mmEnd) mCls += ' today';
        ticks.appendChild(h('div', {
          class: mCls,
          style: { width: segWidth(mmStart, mmEnd) + 'px' }
        }, Number(mm.slice(5, 7)) + '月'));
        mm = CS.nextMonthStartISO(mm);
      }
    }

    tl.appendChild(months);
    tl.appendChild(ticks);

    if (today >= range.start && today <= range.end) {
      var tx = (CS.diffDays(range.start, today) + 0.5) * px;
      tl.appendChild(h('div', {
        class: 'today-pill',
        style: { left: tx + 'px' }
      }, '今天 ' + CS.fmtShort(today)));
    }

    return tl;
  };

  CS.buildGanttHeader = function (range, px) {
    var head = h('div', { class: 'ghead' });
    head.appendChild(h('div', { class: 'gh-cell gh-seq', title: '序号' }, '序号'));
    head.appendChild(h('div', { class: 'gh-cell gh-name' }, '工作任务'));
    head.appendChild(h('div', { class: 'gh-cell gh-dept' }, '责任部门'));
    head.appendChild(h('div', { class: 'gh-cell gh-prog' }, '进度'));
    head.appendChild(CS.buildTimelineHeader(range, px));
    return head;
  };

  CS.buildGroupRow = function (group, range, px) {
    var colors = CS.phaseColors(group.phase);
    var collapsed = state.collapsed.has(group.phase);
    var meta = h('span', { class: 'gg-meta' },
      group.tasks.length + ' 项 · 平均 ' + group.avg + '% · ' +
      CS.fmtShort(group.minStart) + '–' + CS.fmtShort(group.maxEnd)
    );
    if (group.overdue > 0) {
      meta.appendChild(document.createTextNode(' · '));
      meta.appendChild(h('span', { class: 'risk' }, group.overdue + ' 项逾期'));
    }

    var toggle = h('button', {
      class: 'gg-toggle',
      type: 'button',
      'aria-label': collapsed ? '展开阶段' : '折叠阶段',
      'aria-expanded': String(!collapsed)
    }, CS.icon('chevron', 14));

    var label = h('div', { class: 'gg-label', style: { '--phase': colors.c } },
      toggle,
      h('span', { class: 'gg-dot' }),
      h('span', { class: 'gg-name' }, group.phase),
      meta
    );

    function toggleGroup(e) {
      e.preventDefault();
      e.stopPropagation();
      if (state.collapsed.has(group.phase)) state.collapsed.delete(group.phase);
      else state.collapsed.add(group.phase);
      CS.saveCollapsed();
      CS.renderBoard();
    }
    toggle.addEventListener('click', toggleGroup);
    label.addEventListener('click', function (e) {
      if (e.target.closest('.gg-toggle')) return;
      toggleGroup(e);
    });

    var left = CS.diffDays(range.start, group.minStart) * px;
    var width = (CS.diffDays(group.minStart, group.maxEnd) + 1) * px;
    var timeline = h('div', { class: 'gg-timeline', style: { '--phase': colors.c } },
      h('div', {
        class: 'gg-bar',
        style: { left: left + 'px', width: Math.max(4, width) + 'px', background: colors.c }
      })
    );

    return h('div', {
      class: 'ggroup' + (collapsed ? ' is-collapsed' : ''),
      dataset: { phase: group.phase }
    }, label, timeline);
  };

  function statusText(task, today) {
    var st = CS.statusOf(task, today);
    if (st === 'done') return '已完成';
    if (st === 'overdue') return '逾期 ' + CS.overdueDays(task, today) + ' 天';
    if (st === 'late') return '应启动未启动';
    if (st === 'run') {
      var rem = CS.remainingDays(task, today);
      return rem > 0 ? '剩余 ' + rem + ' 天' : (rem === 0 ? '今天截止' : '已超期');
    }
    var toStart = CS.diffDays(today, task.start);
    return toStart > 0 ? '距启动 ' + toStart + ' 天' : '今天启动';
  }

  CS.buildTaskRow = function (task, range, px, index) {
    var today = CS.todayISO();
    var st = CS.statusOf(task, today);
    var colors = CS.phaseColors(task.phase);
    var row = h('div', {
      class: 'grow' + (index % 2 ? ' alt' : '') + (st === 'overdue' ? ' is-overdue' : ''),
      dataset: { taskId: task.id },
      attrs: { tabindex: '0', role: 'button', 'aria-label': task.name }
    });

    row.appendChild(h('div', { class: 'gc g-seq' }, task.seq));

    var nameText = h('div', { class: 'g-name-text', title: task.name });
    if (state.group === 'flat') {
      nameText.appendChild(h('span', { class: 'phase-flag', style: { '--phase': colors.c } }));
    }
    nameText.appendChild(document.createTextNode(task.name));

    var dates = h('span', { class: 'g-dates' }, CS.fmtRange(task.start, task.end));
    if (st === 'overdue') {
      dates.appendChild(document.createTextNode('  '));
      dates.appendChild(CS.statusBadge('overdue', CS.overdueDays(task, today) + ' 天'));
    } else if (st === 'late') {
      dates.appendChild(document.createTextNode('  '));
      dates.appendChild(CS.statusBadge('late'));
    }

    var name = h('div', { class: 'gc g-name' + (state.admin ? ' has-actions' : '') }, nameText, dates);
    if (state.admin) {
      var ordered = state.data.tasks.slice().sort(function (a, b) { return a.seq - b.seq; });
      var idx = -1;
      for (var oi = 0; oi < ordered.length; oi++) {
        if (ordered[oi].id === task.id) { idx = oi; break; }
      }
      var prevTask = idx > 0 ? ordered[idx - 1] : null;
      var nextTask = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null;

      var actions = h('div', { class: 'row-actions' },
        h('button', {
          class: 'icon-btn', type: 'button', disabled: !prevTask,
          'aria-label': '上移序号',
          onclick: function (e) {
            e.stopPropagation();
            if (prevTask) CS.moveTaskSeq(task, prevTask, '上移');
          }
        }, CS.icon('up', 13)),
        h('button', {
          class: 'icon-btn', type: 'button', disabled: !nextTask,
          'aria-label': '下移序号',
          onclick: function (e) {
            e.stopPropagation();
            if (nextTask) CS.moveTaskSeq(task, nextTask, '下移');
          }
        }, CS.icon('down', 13)),
        h('button', {
          class: 'icon-btn', type: 'button',
          'aria-label': '编辑任务',
          onclick: function (e) {
            e.stopPropagation();
            CS.openTaskEditor(task);
          }
        }, CS.icon('edit', 14))
      );
      name.appendChild(actions);
    }
    row.appendChild(name);

    row.appendChild(h('div', {
      class: 'gc g-dept',
      title: (task.departments || []).join('、')
    }, (task.departments || []).join('、') || '—'));

    var prog = h('div', { class: 'gc g-prog' },
      h('div', { class: 'g-prog-top' },
        h('span', { class: 'g-prog-pct' }, task.progress + '%')
      ),
      h('div', { class: 'mini-bar' },
        h('span', { style: { width: task.progress + '%', background: colors.c } })
      )
    );
    row.appendChild(prog);

    var timeline = h('div', { class: 'g-timeline' }, CS.buildBar(task, range, px));
    row.appendChild(timeline);

    row.addEventListener('click', function (e) {
      if (e.target.closest('button, a, input, select, textarea')) return;
      CS.openDetail(task.id);
    });
    row.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        CS.openDetail(task.id);
      }
    });

    return row;
  };

  CS.buildBar = function (task, range, px) {
    var today = CS.todayISO();
    var st = CS.statusOf(task, today);
    var colors = CS.phaseColors(task.phase);
    var left = CS.diffDays(range.start, task.start) * px;
    var span = CS.diffDays(task.start, task.end) + 1;
    var width = Math.max(span * px, 4);
    var frag = document.createDocumentFragment();
    var tipTitle = task.name;
    var tipMeta = task.start + ' → ' + task.end + ' · ' + task.progress + '% · ' + CS.statusLabel(st);

    function open(e) {
      e.stopPropagation();
      CS.openDetail(task.id);
    }

    if (task.start === task.end) {
      var center = left + px / 2;
      var milestone = h('div', {
        class: 'milestone' + (st === 'overdue' ? ' is-overdue' : '') + (st === 'late' ? ' is-late-start' : ''),
        style: { left: center + 'px', '--phase': colors.c },
        attrs: { tabindex: '0', role: 'button', 'aria-label': task.name },
        dataset: { tipTitle: tipTitle, tipMeta: tipMeta }
      });
      milestone.addEventListener('click', open);
      milestone.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(e); }
      });
      frag.appendChild(milestone);
      frag.appendChild(h('span', {
        class: 'milestone-label',
        style: { left: (center + 12) + 'px', color: st === 'overdue' ? 'var(--danger)' : (st === 'late' ? 'var(--warn)' : '') }
      }, task.progress + '%'));
      return frag;
    }

    var bar = h('div', {
      class: 'bar' + (st === 'overdue' ? ' is-overdue' : '') + (st === 'late' ? ' is-late-start' : '') + (task.progress >= 100 ? ' is-complete' : ''),
      style: {
        left: left + 'px',
        width: width + 'px',
        '--phase': colors.c,
        '--phase-soft': colors.soft
      },
      attrs: { tabindex: '0', role: 'button', 'aria-label': task.name },
      dataset: { tipTitle: tipTitle, tipMeta: tipMeta }
    });
    bar.appendChild(h('div', { class: 'bar-fill', style: { width: task.progress + '%' } }));
    if (task.progress >= 100) {
      bar.appendChild(h('span', { class: 'bar-check' }, CS.icon('check', 12, 2.4)));
    }
    bar.addEventListener('click', open);
    bar.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(e); }
    });
    frag.appendChild(bar);

    var labelInside = task.progress >= 58 && width >= 46;
    var label = h('span', {
      class: 'bar-label ' + (labelInside ? 'inside' : 'outside'),
      style: labelInside ? { left: '7px' } : { left: (left + width + 6) + 'px', color: st === 'overdue' ? 'var(--danger)' : (st === 'late' ? 'var(--warn)' : '') }
    }, task.progress + '%');

    if (labelInside) bar.appendChild(label);
    else frag.appendChild(label);

    return frag;
  };

  CS.scrollTodayIntoView = function (range, px) {
    var viewport = CS.refs.board.querySelector('.gantt-viewport');
    if (!viewport) return;
    var today = CS.todayISO();
    if (today < range.start || today > range.end) {
      viewport.scrollLeft = 0;
      return;
    }
    var todayX = (CS.diffDays(range.start, today) + 0.5) * px;
    var visibleTimeline = Math.max(120, viewport.clientWidth - leftWidthPx());
    var desired = todayX - visibleTimeline / 2;
    viewport.scrollLeft = Math.max(0, desired);
  };

  CS.renderGantt = function (groups) {
    var range = CS.computeRange();
    var px = CS.ZOOM[state.zoom].px;
    var timelineWidth = range.days * px;

    var content = h('div', { class: 'gantt-content' });
    content.style.setProperty('--timeline-w', timelineWidth + 'px');
    content.style.setProperty('--tl-grid', CS.buildGridBackground(range, px));

    content.appendChild(CS.buildGanttHeader(range, px));

    var body = h('div', { class: 'gbody' });
    var idx = 0;
    groups.forEach(function (group) {
      if (group.phase) {
        body.appendChild(CS.buildGroupRow(group, range, px));
        if (state.collapsed.has(group.phase)) return;
      }
      group.tasks.forEach(function (task) {
        body.appendChild(CS.buildTaskRow(task, range, px, idx++));
      });
    });
    content.appendChild(body);

    var today = CS.todayISO();
    if (today >= range.start && today <= range.end) {
      var todayX = (CS.diffDays(range.start, today) + 0.5) * px;
      content.appendChild(h('div', {
        class: 'today-line',
        style: { left: 'calc(var(--left-w) + ' + todayX + 'px)', top: '60px' }
      }));
    }

    var wrap = h('div', { class: 'gantt-wrap' },
      h('div', { class: 'gantt-viewport' }, content)
    );

    CS.refs.board.appendChild(wrap);

    if (state.scrollToToday) {
      state.scrollToToday = false;
      requestAnimationFrame(function () { CS.scrollTodayIntoView(range, px); });
    }
  };

  function cardStatusText(task, today) {
    return statusText(task, today);
  }

  CS.renderCards = function (groups) {
    var today = CS.todayISO();
    var wrap = h('div', { class: 'gantt-wrap cards-wrap' });

    groups.forEach(function (group) {
      var colors = group.phase ? CS.phaseColors(group.phase) : { c: '#64748B', soft: '#EEF2F7' };
      var collapsed = group.phase && state.collapsed.has(group.phase);
      var meta = group.phase
        ? h('span', { class: 'meta' }, group.tasks.length + ' 项 · 平均 ' + group.avg + '%' + (group.overdue ? ' · ' + group.overdue + ' 项逾期' : ''))
        : h('span', { class: 'meta' }, group.tasks.length + ' 项');

      var toggle = group.phase ? h('button', {
        class: 'gg-toggle',
        type: 'button',
        'aria-label': collapsed ? '展开阶段' : '折叠阶段',
        'aria-expanded': String(!collapsed),
        onclick: function (e) {
          e.stopPropagation();
          if (state.collapsed.has(group.phase)) state.collapsed.delete(group.phase);
          else state.collapsed.add(group.phase);
          CS.saveCollapsed();
          CS.renderBoard();
        }
      }, CS.icon('chevron', 14)) : null;

      var head = h('div', { class: 'cards-group-head' },
        toggle,
        h('span', { class: 'gg-dot', style: { background: colors.c } }),
        h('span', { class: 'name' }, group.phase || '全部任务'),
        meta
      );

      var section = h('div', { class: 'cards-group' }, head);
      if (!collapsed) {
        var grid = h('div', { class: 'cards-grid' });
        group.tasks.forEach(function (task) {
          grid.appendChild(CS.buildCard(task, today));
        });
        section.appendChild(grid);
      }
      wrap.appendChild(section);
    });

    CS.refs.board.appendChild(wrap);
  };

  CS.buildCard = function (task, today) {
    var st = CS.statusOf(task, today);
    var colors = CS.phaseColors(task.phase);
    var card = h('article', {
      class: 'task-card' + (st === 'overdue' ? ' is-overdue' : '') + (state.admin ? ' is-admin' : ''),
      dataset: { taskId: task.id },
      attrs: { tabindex: '0', role: 'button', 'aria-label': task.name }
    });

    var top = h('div', { class: 'card-top' },
      h('span', { class: 'card-phase', style: { '--phase': colors.c } },
        h('span', { class: 'dot' }),
        task.phase
      ),
      CS.statusBadge(st, st === 'overdue' ? CS.overdueDays(task, today) + ' 天' : '')
    );
    card.appendChild(top);

    card.appendChild(h('h3', { class: 'card-title', text: task.name }));

    var depts = h('div', { class: 'card-depts' });
    var list = task.departments || [];
    list.slice(0, 3).forEach(function (d) {
      depts.appendChild(h('span', { class: 'chip', title: d }, d));
    });
    if (list.length > 3) depts.appendChild(h('span', { class: 'chip' }, '+' + (list.length - 3)));
    if (!list.length) depts.appendChild(h('span', { class: 'chip muted' }, '未填写部门'));
    card.appendChild(depts);

    card.appendChild(h('div', { class: 'card-dates' },
      h('span', {}, task.start),
      h('span', { class: 'arrow' }, '→'),
      h('span', {}, task.end)
    ));

    card.appendChild(h('div', { class: 'card-progress' },
      h('div', { class: 'mini-bar' }, h('span', { style: { width: task.progress + '%', background: colors.c } })),
      h('span', { class: 'pct' }, task.progress + '%')
    ));

    var footText = cardStatusText(task, today);
    card.appendChild(h('div', { class: 'card-foot' },
      h('span', {}, '计划 ' + CS.plannedDays(task) + ' 天'),
      h('span', { class: st === 'overdue' ? 'danger' : (st === 'late' ? 'warn' : '') }, footText)
    ));

    if (state.admin) {
      card.appendChild(h('button', {
        class: 'card-edit',
        type: 'button',
        'aria-label': '编辑任务',
        onclick: function (e) {
          e.stopPropagation();
          CS.openTaskEditor(task);
        }
      }, CS.icon('edit', 14)));
    }

    card.addEventListener('click', function (e) {
      if (e.target.closest('button')) return;
      CS.openDetail(task.id);
    });
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        CS.openDetail(task.id);
      }
    });

    return card;
  };
})();