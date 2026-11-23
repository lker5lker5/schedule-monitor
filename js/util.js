/* ============================================================
 * customSchedule — shared utilities
 * ============================================================ */
(function () {
  'use strict';

  var CS = window.CS = window.CS || {};

  CS.CFG = window.APP_CONFIG || {};
  CS.TITLE = (typeof window.PROJECT_TITLE === 'string' && window.PROJECT_TITLE.trim())
    ? window.PROJECT_TITLE.trim()
    : (CS.CFG.title || '项目进度');
  CS.P = window.ScheduleParser;
  CS.XLSX = window.XLSX;
  CS.DAY = 86400000;
  CS.DEFAULT_PHASES = ['项目管理流程', '基础环境建设', '主体功能建设', '制度建设', '未分类'];

  CS.ZOOM = {
    day: { px: 32, label: '日' },
    week: { px: 8, label: '周' },
    month: { px: 4, label: '月' }
  };

  CS.PHASE_COLORS = {
    '项目管理流程': { c: '#2F6BFF', soft: '#E8EFFF' },
    '基础环境建设': { c: '#0E9F6E', soft: '#E3F7EF' },
    '主体功能建设': { c: '#7C3AED', soft: '#F1EAFE' },
    '制度建设': { c: '#D97706', soft: '#FDF2DE' },
    '未分类': { c: '#64748B', soft: '#EEF2F7' }
  };

  CS.FALLBACK_COLORS = [
    { c: '#0E7490', soft: '#E0F2FE' },
    { c: '#BE123C', soft: '#FFE4E6' },
    { c: '#4D7C0F', soft: '#ECFCCB' },
    { c: '#9333EA', soft: '#F3E8FF' },
    { c: '#C2410C', soft: '#FFEDD5' },
    { c: '#1D4ED8', soft: '#DBEAFE' }
  ];

  CS.STATUS = {
    todo: { label: '未开始', cls: 'status-0' },
    run: { label: '进行中', cls: 'status-run' },
    done: { label: '已完成', cls: 'status-done' },
    overdue: { label: '逾期', cls: 'status-overdue' },
    late: { label: '应启动未启动', cls: 'status-late' }
  };

  CS.FILTER_STATUS = [
    { key: 'todo', label: '未开始' },
    { key: 'run', label: '进行中' },
    { key: 'done', label: '已完成' },
    { key: 'overdue', label: '逾期' },
    { key: 'late', label: '应启动未启动' }
  ];

  CS.STORAGE = {
    draft: 'customSchedule:draft:',
    github: 'customSchedule:github',
    session: 'customSchedule:adminSession',
    collapsed: 'customSchedule:collapsed:'
  };

  CS.state = {
    published: null,
    data: null,
    admin: false,
    dirty: false,
    draftInfo: null,
    view: 'gantt',
    viewExplicit: false,
    zoom: 'week',
    group: 'phase',
    filters: { depts: [], statuses: [], owners: [], q: '' },
    collapsed: new Set(),
    selectedId: null,
    openFilter: null,
    scrollToToday: true,
    revision: 0,
    publishPayload: null,
    loginAttempts: 0,
    lockUntil: 0,
    adminHint: false
  };

  CS.refs = {};

  /* ---------- DOM helpers ---------- */

  CS.$ = function (sel, root) {
    return (root || document).querySelector(sel);
  };

  CS.$$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };

  CS.clear = function (node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
  };

  CS.h = function (tag, props) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (key) {
        var val = props[key];
        if (val === null || val === undefined || val === false) return;
        if (key === 'class' || key === 'className') {
          node.className = val;
        } else if (key === 'text') {
          node.textContent = val;
        } else if (key === 'html') {
          node.innerHTML = val;
        } else if (key === 'dataset') {
          Object.keys(val).forEach(function (k) { node.dataset[k] = val[k]; });
        } else if (key === 'style' && typeof val === 'object') {
          Object.keys(val).forEach(function (k) {
            if (k.indexOf('--') === 0) node.style.setProperty(k, val[k]);
            else node.style[k] = val[k];
          });
        } else if (key === 'attrs' && typeof val === 'object') {
          Object.keys(val).forEach(function (k) { node.setAttribute(k, val[k]); });
        } else if (key === 'value') {
          node.value = val;
        } else if (key === 'readonly') {
          node.readOnly = !!val;
        } else if (key === 'checked' || key === 'selected' || key === 'disabled' || key === 'required' || key === 'hidden' || key === 'multiple') {
          node[key] = !!val;
        } else if (key.indexOf('on') === 0 && typeof val === 'function') {
          node.addEventListener(key.slice(2).toLowerCase(), val);
        } else {
          node.setAttribute(key, val === true ? '' : val);
        }
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      append(node, arguments[i]);
    }
    return node;
  };

  function append(node, child) {
    if (child === null || child === undefined || child === false) return;
    if (Array.isArray(child)) {
      child.forEach(function (c) { append(node, c); });
    } else if (child instanceof Node) {
      node.appendChild(child);
    } else {
      node.appendChild(document.createTextNode(String(child)));
    }
  }

  /* ---------- Icons ---------- */

  CS.ICONS = {
    search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm9 2-4-4',
    close: 'M6 6l12 12M18 6 6 18',
    chevron: 'm6 9 6 6 6-6',
    check: 'm5 12 4 4L19 6',
    alert: 'M12 3 2.8 19a1 1 0 0 0 .9 1.5h16.6a1 1 0 0 0 .9-1.5L12 3ZM12 9v4M12 17h.01',
    calendar: 'M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
    target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
    layers: 'm12 3 9 5-9 5-9-5 9-5Zm9 9-9 5-9-5m18 4-9 5-9-5',
    edit: 'M4 20h4L20 8l-4-4L4 16v4ZM14 6l4 4',
    plus: 'M12 5v14M5 12h14',
    download: 'M12 3v12m0 0 4-4m-4 4-4-4M4 19h16',
    upload: 'M12 21V9m0 0 4 4m-4-4-4 4M4 5h16',
    print: 'M7 8V3h10v5M7 17H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-3M7 14h10v7H7v-7Z',
    trash: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6',
    up: 'M12 19V5m0 0-5 5m5-5 5 5',
    down: 'M12 5v14m0 0 5-5m-5 5-5-5',
    list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    gantt: 'M4 6h7M4 12h12M4 18h5',
    info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-10v5M12 8h.01',
    lock: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5V11Z',
    eye: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
    copy: 'M9 9h11v11H9V9ZM5 15H4V4h11v1',
    settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7.5 7.5 0 0 0-2-1.2L14.6 3h-4l-.4 2.6a7.5 7.5 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5a7.4 7.4 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-.9a7.5 7.5 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7.5 7.5 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z',
    logout: 'M10 17l5-5-5-5M15 12H3M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5',
    refresh: 'M20 11a8 8 0 1 0-2 6M20 5v6h-6',
    filter: 'M3 5h18l-7 8v6l-4 2v-8L3 5Z',
    clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v5l3 2',
    flag: 'M5 21V4m0 0h11l-2 4 2 4H5',
    database: 'M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3Zm8 3v12c0 1.7-3.6 3-8 3s-8-1.3-8-3V6m16 6c0 1.7-3.6 3-8 3s-8-1.3-8-3',
    user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-8 9a8 8 0 0 1 16 0',
    cloud: 'M7 18a4 4 0 0 1-.6-8A6 6 0 0 1 18 8.5a3.5 3.5 0 0 1 1 6.9M12 12v9m0 0 3-3m-3 3-3-3'
  };

  CS.icon = function (name, size, strokeWidth) {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', size || 16);
    svg.setAttribute('height', size || 16);
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', strokeWidth || 1.8);
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    var path = document.createElementNS(ns, 'path');
    path.setAttribute('d', CS.ICONS[name] || CS.ICONS.info);
    svg.appendChild(path);
    return svg;
  };

  /* ---------- Small utilities ---------- */

  CS.clone = function (obj) {
    return JSON.parse(JSON.stringify(obj));
  };

  CS.pad2 = function (n) {
    return n < 10 ? '0' + n : String(n);
  };

  CS.debounce = function (fn, wait) {
    var timer = null;
    return function () {
      var args = arguments;
      var ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  };

  CS.genId = function () {
    try {
      if (window.crypto && crypto.randomUUID) return 't_' + crypto.randomUUID().slice(0, 8);
    } catch (e) { /* ignore */ }
    return 't_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  };

  /* ---------- Date helpers ---------- */

  CS.parseISO = function (iso) {
    var parts = String(iso).split('-');
    return Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  };

  CS.isoFromUTC = function (ms) {
    var d = new Date(ms);
    return d.getUTCFullYear() + '-' + CS.pad2(d.getUTCMonth() + 1) + '-' + CS.pad2(d.getUTCDate());
  };

  CS.todayISO = function () {
    var d = new Date();
    return d.getFullYear() + '-' + CS.pad2(d.getMonth() + 1) + '-' + CS.pad2(d.getDate());
  };

  CS.addDaysISO = function (iso, n) {
    return CS.isoFromUTC(CS.parseISO(iso) + n * CS.DAY);
  };

  CS.diffDays = function (a, b) {
    return Math.round((CS.parseISO(b) - CS.parseISO(a)) / CS.DAY);
  };

  CS.startOfWeekISO = function (iso) {
    var ms = CS.parseISO(iso);
    var dow = new Date(ms).getUTCDay();
    var delta = (dow + 6) % 7;
    return CS.isoFromUTC(ms - delta * CS.DAY);
  };

  CS.endOfWeekISO = function (iso) {
    return CS.addDaysISO(CS.startOfWeekISO(iso), 6);
  };

  CS.monthStartISO = function (iso) {
    return iso.slice(0, 7) + '-01';
  };

  CS.nextMonthStartISO = function (iso) {
    var y = Number(iso.slice(0, 4));
    var m = Number(iso.slice(5, 7));
    if (m === 12) return (y + 1) + '-01-01';
    return y + '-' + CS.pad2(m + 1) + '-01';
  };

  CS.prevMonthEndISO = function (iso) {
    return CS.addDaysISO(CS.monthStartISO(iso), -1);
  };

  CS.yearStartISO = function (iso) {
    return iso.slice(0, 4) + '-01-01';
  };

  CS.nextYearStartISO = function (iso) {
    return (Number(iso.slice(0, 4)) + 1) + '-01-01';
  };

  CS.weekdayCN = function (iso) {
    return '日一二三四五六'[new Date(CS.parseISO(iso)).getUTCDay()];
  };

  CS.isWeekend = function (iso) {
    var d = new Date(CS.parseISO(iso)).getUTCDay();
    return d === 0 || d === 6;
  };

  CS.fmtShort = function (iso) {
    return iso.slice(5, 7) + '/' + iso.slice(8, 10);
  };

  CS.fmtCN = function (iso) {
    return Number(iso.slice(5, 7)) + '月' + Number(iso.slice(8, 10)) + '日';
  };

  CS.fmtDateTime = function (iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.getFullYear() + '-' + CS.pad2(d.getMonth() + 1) + '-' + CS.pad2(d.getDate()) +
      ' ' + CS.pad2(d.getHours()) + ':' + CS.pad2(d.getMinutes());
  };

  CS.fmtRange = function (start, end) {
    return CS.fmtShort(start) + ' → ' + CS.fmtShort(end);
  };

  /* ---------- Status / stats ---------- */

  CS.statusOf = function (task, today) {
    today = today || CS.todayISO();
    if (task.progress >= 100) return 'done';
    if (task.end < today) return 'overdue';
    if (task.progress > 0) return 'run';
    if (task.start < today) return 'late';
    return 'todo';
  };

  CS.statusLabel = function (key) {
    return (CS.STATUS[key] || CS.STATUS.todo).label;
  };

  CS.statusBadge = function (key, extra) {
    var def = CS.STATUS[key] || CS.STATUS.todo;
    return CS.h('span', { class: 'status-badge ' + def.cls }, def.label + (extra ? ' · ' + extra : ''));
  };

  CS.overdueDays = function (task, today) {
    today = today || CS.todayISO();
    if (task.progress >= 100 || task.end >= today) return 0;
    return CS.diffDays(task.end, today);
  };

  CS.lateStartDays = function (task, today) {
    today = today || CS.todayISO();
    if (task.progress !== 0 || task.start >= today || task.end < today) return 0;
    return CS.diffDays(task.start, today);
  };

  CS.remainingDays = function (task, today) {
    today = today || CS.todayISO();
    return CS.diffDays(today, task.end);
  };

  CS.plannedDays = function (task) {
    return CS.diffDays(task.start, task.end) + 1;
  };

  CS.computeStats = function (tasks, today) {
    today = today || CS.todayISO();
    var n = tasks.length;
    var sum = 0;
    var counts = { todo: 0, run: 0, done: 0 };
    var overdue = 0;
    var late = 0;
    var minStart = null;
    var maxEnd = null;

    tasks.forEach(function (t) {
      sum += t.progress;
      if (t.progress >= 100) counts.done++;
      else if (t.progress > 0) counts.run++;
      else counts.todo++;
      if (t.progress < 100 && t.end < today) overdue++;
      if (t.progress === 0 && t.start < today && t.end >= today) late++;
      if (!minStart || t.start < minStart) minStart = t.start;
      if (!maxEnd || t.end > maxEnd) maxEnd = t.end;
    });

    var totalDays = 0;
    var elapsedDays = 0;
    var timePct = 0;
    if (minStart && maxEnd) {
      totalDays = CS.diffDays(minStart, maxEnd) + 1;
      var rawElapsed = CS.diffDays(minStart, today) + 1;
      elapsedDays = Math.max(0, Math.min(totalDays, rawElapsed));
      timePct = totalDays ? Math.round(elapsedDays / totalDays * 100) : 0;
    }

    return {
      n: n,
      avg: n ? Math.round(sum / n) : 0,
      counts: counts,
      overdue: overdue,
      late: late,
      minStart: minStart,
      maxEnd: maxEnd,
      totalDays: totalDays,
      elapsedDays: elapsedDays,
      timePct: timePct
    };
  };

  /* ---------- Filtering / grouping ---------- */

  CS.matchesStatus = function (task, key, today) {
    today = today || CS.todayISO();
    switch (key) {
      case 'todo': return task.progress === 0;
      case 'run': return task.progress > 0 && task.progress < 100;
      case 'done': return task.progress >= 100;
      case 'overdue': return task.progress < 100 && task.end < today;
      case 'late': return task.progress === 0 && task.start < today && task.end >= today;
      default: return true;
    }
  };

  CS.matchesFilters = function (task) {
    var f = CS.state.filters;
    if (f.depts.length && !task.departments.some(function (d) { return f.depts.indexOf(d) !== -1; })) {
      return false;
    }
    if (f.owners.length && !(task.owners || []).some(function (o) { return f.owners.indexOf(o) !== -1; })) {
      return false;
    }
    if (f.statuses.length) {
      var today = CS.todayISO();
      var ok = f.statuses.some(function (key) { return CS.matchesStatus(task, key, today); });
      if (!ok) return false;
    }
    var q = f.q.trim().toLowerCase();
    if (q) {
      var hay = [task.name, task.phase, task.note].concat(task.departments || [], task.owners || []).join(' ').toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  };

  CS.visibleTasks = function () {
    return CS.state.data.tasks.filter(CS.matchesFilters);
  };

  CS.allDepartments = function () {
    var seen = Object.create(null);
    var out = [];
    CS.state.data.tasks.forEach(function (t) {
      (t.departments || []).forEach(function (d) {
        if (!seen[d]) { seen[d] = true; out.push(d); }
      });
    });
    return out;
  };

  CS.allPersons = function () {
    var seen = Object.create(null);
    var out = [];
    CS.state.data.tasks.forEach(function (t) {
      (t.owners || []).forEach(function (o) {
        if (!seen[o]) { seen[o] = true; out.push(o); }
      });
    });
    return out;
  };

  CS.departmentUsage = function () {
    var map = Object.create(null);
    CS.state.data.tasks.forEach(function (t) {
      (t.departments || []).forEach(function (d) { map[d] = (map[d] || 0) + 1; });
    });
    return map;
  };

  CS.personUsage = function () {
    var map = Object.create(null);
    CS.state.data.tasks.forEach(function (t) {
      (t.owners || []).forEach(function (o) { map[o] = (map[o] || 0) + 1; });
    });
    return map;
  };

  function normalizeNameList(raw) {
    if (!Array.isArray(raw)) return [];
    var seen = Object.create(null);
    var out = [];
    raw.forEach(function (v) {
      var name = String(v == null ? '' : v).trim();
      if (!name || seen[name]) return;
      seen[name] = true;
      out.push(name);
    });
    return out;
  }

  CS.departmentsTable = function () {
    return normalizeNameList(window.DEPARTMENTS);
  };

  CS.personsTable = function () {
    return normalizeNameList(window.PERSONS);
  };

  function buildOptions(table, usage, used, extra) {
    var out = [];
    var seen = Object.create(null);
    table.forEach(function (name) {
      if (seen[name]) return;
      seen[name] = true;
      out.push({ value: name, count: usage[name] || 0, inTable: true });
    });
    used.forEach(function (name) {
      if (seen[name]) return;
      seen[name] = true;
      out.push({ value: name, count: usage[name] || 0, inTable: false });
    });
    (extra || []).forEach(function (name) {
      if (seen[name]) return;
      seen[name] = true;
      out.push({ value: name, count: usage[name] || 0, inTable: false });
    });
    return out;
  }

  CS.departmentOptions = function (extra) {
    return buildOptions(CS.departmentsTable(), CS.departmentUsage(), CS.allDepartments(), extra);
  };

  CS.personOptions = function (extra) {
    return buildOptions(CS.personsTable(), CS.personUsage(), CS.allPersons(), extra);
  };

  CS.nextSeq = function (tasks) {
    var used = Object.create(null);
    (tasks || []).forEach(function (t) {
      var n = Math.round(Number(t.seq));
      if (isFinite(n) && n > 0) used[n] = true;
    });
    var n = 1;
    while (used[n]) n++;
    return n;
  };

  CS.phaseOrder = function () {
    var meta = CS.state.data.meta.phaseOrder || [];
    var used = Object.create(null);
    CS.state.data.tasks.forEach(function (t) { used[t.phase] = true; });
    var out = [];
    var seen = Object.create(null);
    meta.forEach(function (p) {
      if (seen[p]) return;
      seen[p] = true;
      if (used[p] || p === '未分类') out.push(p);
    });
    CS.state.data.tasks.forEach(function (t) {
      if (!seen[t.phase]) { seen[t.phase] = true; out.push(t.phase); }
    });
    out.sort(function (a, b) {
      if (a === '未分类') return 1;
      if (b === '未分类') return -1;
      return 0;
    });
    return out;
  };

  CS.phaseOptions = function () {
    var out = [];
    var seen = Object.create(null);
    (CS.state.data.meta.phaseOrder || []).forEach(function (p) {
      if (p && !seen[p]) { seen[p] = true; out.push(p); }
    });
    CS.state.data.tasks.forEach(function (t) {
      if (!seen[t.phase]) { seen[t.phase] = true; out.push(t.phase); }
    });
    if (!seen['未分类']) out.push('未分类');
    return out;
  };

  CS.groupTasks = function (tasks) {
    if (CS.state.group === 'flat') {
      return [{
        phase: null,
        tasks: tasks.slice().sort(function (a, b) {
          return (a.seq - b.seq) || a.start.localeCompare(b.start);
        })
      }];
    }

    var order = CS.phaseOrder();
    var map = Object.create(null);
    var groups = [];
    order.forEach(function (p) { map[p] = { phase: p, tasks: [] }; groups.push(map[p]); });
    tasks.forEach(function (t) {
      if (!map[t.phase]) {
        map[t.phase] = { phase: t.phase, tasks: [] };
        groups.push(map[t.phase]);
      }
      map[t.phase].tasks.push(t);
    });
    groups.forEach(function (g) {
      g.tasks.sort(function (a, b) {
        return a.start.localeCompare(b.start) || (a.seq - b.seq);
      });
      var sum = 0;
      var overdue = 0;
      var min = null;
      var max = null;
      g.tasks.forEach(function (t) {
        sum += t.progress;
        if (t.progress < 100 && t.end < CS.todayISO()) overdue++;
        if (!min || t.start < min) min = t.start;
        if (!max || t.end > max) max = t.end;
      });
      g.avg = g.tasks.length ? Math.round(sum / g.tasks.length) : 0;
      g.overdue = overdue;
      g.minStart = min;
      g.maxEnd = max;
    });
    return groups.filter(function (g) { return g.tasks.length; });
  };

  CS.phaseColors = function (phase) {
    if (CS.PHASE_COLORS[phase]) return CS.PHASE_COLORS[phase];
    var hash = 0;
    for (var i = 0; i < phase.length; i++) hash = (hash * 31 + phase.charCodeAt(i)) >>> 0;
    return CS.FALLBACK_COLORS[hash % CS.FALLBACK_COLORS.length];
  };

  CS.filtersActive = function () {
    var f = CS.state.filters;
    return !!(f.depts.length || f.statuses.length || f.owners.length || f.q.trim());
  };

  /* ---------- Storage ---------- */

  CS.storage = {
    get: function (key) {
      try { return window.localStorage.getItem(key); } catch (e) { return null; }
    },
    set: function (key, value) {
      try { window.localStorage.setItem(key, value); return true; } catch (e) { return false; }
    },
    remove: function (key) {
      try { window.localStorage.removeItem(key); } catch (e) { /* ignore */ }
    }
  };

  CS.draftKey = function () {
    return CS.STORAGE.draft + (CS.state.data && CS.state.data.meta.projectId || 'default');
  };

  CS.readDraft = function () {
    var raw = CS.storage.get(CS.draftKey());
    if (!raw) return null;
    try {
      var draft = JSON.parse(raw);
      if (!draft || !draft.data) return null;
      return draft;
    } catch (e) {
      return null;
    }
  };

  CS.saveDraftNow = function () {
    if (!CS.state.admin || !CS.state.dirty || !CS.state.data) return;
    var draft = {
      projectId: CS.state.data.meta.projectId,
      baseVersion: CS.state.published ? CS.state.published.meta.version : 0,
      baseUpdatedAt: CS.state.published ? CS.state.published.meta.updatedAt : '',
      savedAt: new Date().toISOString(),
      data: CS.state.data
    };
    CS.storage.set(CS.draftKey(), JSON.stringify(draft));
  };

  CS.scheduleDraftSave = CS.debounce(function () {
    CS.saveDraftNow();
  }, 300);

  CS.clearDraft = function () {
    CS.storage.remove(CS.draftKey());
    CS.state.draftInfo = null;
  };

  CS.setAdminSession = function (on) {
    try {
      if (on) sessionStorage.setItem(CS.STORAGE.session, '1');
      else sessionStorage.removeItem(CS.STORAGE.session);
    } catch (e) { /* ignore */ }
  };

  CS.hasAdminSession = function () {
    try { return sessionStorage.getItem(CS.STORAGE.session) === '1'; } catch (e) { return false; }
  };

  CS.getGhSettings = function () {
    var defaults = CS.CFG.github || {};
    var stored = {};
    var raw = CS.storage.get(CS.STORAGE.github);
    if (raw) {
      try { stored = JSON.parse(raw) || {}; } catch (e) { stored = {}; }
    }
    return {
      owner: stored.owner || defaults.owner || '',
      repo: stored.repo || defaults.repo || 'customSchedule',
      branch: stored.branch || defaults.branch || 'main',
      path: stored.path || defaults.path || 'data.js',
      token: stored.token || ''
    };
  };

  CS.saveGhSettings = function (settings) {
    CS.storage.set(CS.STORAGE.github, JSON.stringify(settings));
  };

  CS.clearGhToken = function () {
    var s = CS.getGhSettings();
    s.token = '';
    CS.saveGhSettings(s);
  };

  CS.loadXlsx = function () {
    if (CS.XLSX) return Promise.resolve(CS.XLSX);
    if (CS._xlsxPromise) return CS._xlsxPromise;
    CS._xlsxPromise = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = 'vendor/xlsx.full.min.js';
      script.onload = function () {
        CS.XLSX = window.XLSX;
        if (!CS.XLSX) reject(new Error('vendor/xlsx.full.min.js 已加载，但没有导出 XLSX'));
        else resolve(CS.XLSX);
      };
      script.onerror = function () {
        reject(new Error('无法加载 vendor/xlsx.full.min.js'));
      };
      document.head.appendChild(script);
    });
    return CS._xlsxPromise;
  };

  CS.normalizeCurrent = function () {
    var res = CS.P.normalizeProject(CS.state.data, {
      projectId: CS.CFG.projectId,
      title: CS.TITLE,
      logo: CS.CFG.logo,
      today: new Date()
    });
    res.project.meta.title = CS.TITLE;
    CS.state.data = res.project;
    if (res.warnings.length) console.warn('[customSchedule] data warnings:', res.warnings);
    return res.warnings;
  };

  CS.markDirty = function () {
    CS.state.dirty = true;
    CS.state.revision++;
    CS.state.publishPayload = null;
    CS.scheduleDraftSave();
    if (CS.renderAdminBar) CS.renderAdminBar();
  };

  /* ---------- Modal / drawer shells ---------- */

  CS.lockBody = function () {
    var modalOpen = CS.refs.modal && !CS.refs.modal.hidden;
    var drawerOpen = CS.refs.taskDrawer && !CS.refs.taskDrawer.hidden;
    var overlay = !!(modalOpen || drawerOpen);
    document.body.classList.toggle('overlay-open', overlay);
    document.body.style.overflow = overlay ? 'hidden' : '';
  };

  CS.openModal = function (opts) {
    var refs = CS.refs;
    var head = CS.h('div', { class: 'modal-head' },
      CS.h('div', {},
        CS.h('h2', { class: 'modal-title', id: 'modalTitle', text: opts.title || '' }),
        opts.sub ? CS.h('div', { class: 'modal-sub', text: opts.sub }) : null
      ),
      CS.h('button', {
        class: 'drawer-close', type: 'button', 'aria-label': '关闭',
        onclick: CS.closeModal
      }, CS.icon('close', 16))
    );
    var body = CS.h('div', { class: 'modal-body' }, opts.body || null);
    var foot = opts.foot ? CS.h('div', { class: 'modal-foot' }, opts.foot) : null;

    CS.clear(refs.modal);
    refs.modal.className = 'modal' + (opts.wide ? ' wide' : '');
    refs.modal.setAttribute('aria-labelledby', 'modalTitle');
    refs.modal.appendChild(head);
    refs.modal.appendChild(body);
    if (foot) refs.modal.appendChild(foot);
    refs.modal.hidden = false;
    refs.modalBackdrop.hidden = false;
    CS.lockBody();
    requestAnimationFrame(function () {
      refs.modal.classList.add('open');
      refs.modalBackdrop.classList.add('open');
    });
    var focusable = refs.modal.querySelector('.modal-body input, .modal-body select, .modal-body textarea, .modal-body button, .modal-head button');
    if (focusable) setTimeout(function () { try { focusable.focus(); } catch (e) {} }, 60);
  };

  CS.closeModal = function () {
    var refs = CS.refs;
    if (CS.closeAllPickers) CS.closeAllPickers();
    if (!refs.modal || refs.modal.hidden) return;
    refs.modal.classList.remove('open');
    if (refs.modalBackdrop) refs.modalBackdrop.classList.remove('open');
    setTimeout(function () {
      if (!refs.modal.classList.contains('open')) {
        refs.modal.hidden = true;
        if (refs.modalBackdrop) refs.modalBackdrop.hidden = true;
        CS.clear(refs.modal);
        CS.lockBody();
      }
    }, 190);
  };

  CS.openDrawer = function (node) {
    var refs = CS.refs;
    CS.clear(refs.taskDrawer);
    refs.taskDrawer.appendChild(node);
    refs.taskDrawer.hidden = false;
    refs.drawerBackdrop.hidden = false;
    CS.lockBody();
    requestAnimationFrame(function () {
      refs.taskDrawer.classList.add('open');
      refs.drawerBackdrop.classList.add('open');
    });
  };

  CS.closeDrawer = function () {
    var refs = CS.refs;
    if (!refs.taskDrawer || refs.taskDrawer.hidden) return;
    refs.taskDrawer.classList.remove('open');
    if (refs.drawerBackdrop) refs.drawerBackdrop.classList.remove('open');
    CS.state.selectedId = null;
    setTimeout(function () {
      if (!refs.taskDrawer.classList.contains('open')) {
        refs.taskDrawer.hidden = true;
        if (refs.drawerBackdrop) refs.drawerBackdrop.hidden = true;
        CS.clear(refs.taskDrawer);
        CS.lockBody();
      }
    }, 250);
  };

  /* ---------- Toast / tooltip ---------- */

  var toastTimer = null;
  CS.toast = function (message, type) {
    var node = CS.refs.toast;
    if (!node) return;
    node.textContent = message;
    node.className = 'toast' + (type ? ' ' + type : '');
    node.hidden = false;
    requestAnimationFrame(function () { node.classList.add('show'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      node.classList.remove('show');
      setTimeout(function () { node.hidden = true; }, 180);
    }, 3200);
  };

  /* ---------- Download / base64 ---------- */

  CS.downloadText = function (text, filename, mime) {
    var blob = new Blob([text], { type: mime || 'text/javascript;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 800);
  };

  CS.b64Utf8 = function (text) {
    var bytes = new TextEncoder().encode(text);
    var bin = '';
    var chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(bin);
  };

  /* ---------- SHA-256 (pure JS, works on file://) ---------- */

  CS.sha256Hex = function (text) {
    var K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var bytes = new TextEncoder().encode(text);
    var len = bytes.length;
    var padded = new Uint8Array((((len + 9) + 63) >> 6) << 6);
    padded.set(bytes);
    padded[len] = 0x80;
    var dv = new DataView(padded.buffer);
    var bitLen = len * 8;
    dv.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000));
    dv.setUint32(padded.length - 4, bitLen >>> 0);

    function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

    var w = new Uint32Array(64);
    for (var i = 0; i < padded.length; i += 64) {
      var t;
      for (t = 0; t < 16; t++) w[t] = dv.getUint32(i + t * 4);
      for (t = 16; t < 64; t++) {
        var s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
        var s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], hh = H[7];
      for (t = 0; t < 64; t++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var temp1 = (hh + S1 + ch + K[t] + w[t]) >>> 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var temp2 = (S0 + maj) >>> 0;
        hh = g; g = f; f = e; e = (d + temp1) >>> 0;
        d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0;
      H[1] = (H[1] + b) >>> 0;
      H[2] = (H[2] + c) >>> 0;
      H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0;
      H[5] = (H[5] + f) >>> 0;
      H[6] = (H[6] + g) >>> 0;
      H[7] = (H[7] + hh) >>> 0;
    }
    return H.map(function (x) { return ('00000000' + x.toString(16)).slice(-8); }).join('');
  };
})();