/*
 * customSchedule — shared Excel/JSON parsing helpers.
 * UMD module: usable from the browser (window.ScheduleParser) and Node (require).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ScheduleParser = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DEFAULT_PHASE = '未分类';

  var HEADER_ALIASES = {
    seq: ['序号', '编号', 'no', 'no.', '#'],
    name: ['工作任务', '任务名称', '工作内容', '任务'],
    dept: ['责任部门', '责任单位', '部门', '牵头部门', '责任处室'],
    owner: ['责任人', '负责人', '任务负责人', '责任人姓名', '负责人姓名'],
    start: ['启动时间', '开始时间', '计划开始', '起始时间', '开始日期', '计划开始时间'],
    end: ['完成时间', '结束时间', '计划完成', '完成日期', '截止时间', '计划完成时间'],
    progress: ['进度(%)', '进度(％)', '进度', '进度情况', '完成度', '完成比例', '完成进度'],
    phase: ['阶段', '分类', '工作阶段', '板块'],
    note: ['备注', '说明', '备注说明']
  };

  function normText(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/\u00a0/g, ' ').trim();
  }

  function normHeader(value) {
    return normText(value)
      .replace(/\s+/g, '')
      .replace(/（/g, '(')
      .replace(/）/g, ')')
      .replace(/[：:]/g, '')
      .toLowerCase();
  }

  var NORMALIZED_ALIASES = {};
  Object.keys(HEADER_ALIASES).forEach(function (field) {
    NORMALIZED_ALIASES[field] = HEADER_ALIASES[field].map(normHeader);
  });

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function isRealDate(y, m, d) {
    if (!isFinite(y) || !isFinite(m) || !isFinite(d)) return false;
    if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31) return false;
    var dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }

  function mkISO(y, m, d) {
    if (!isRealDate(y, m, d)) return null;
    return String(y) + '-' + pad2(m) + '-' + pad2(d);
  }

  /**
   * Accepts Date, Excel serial number, and common Chinese/ISO date strings.
   * Returns YYYY-MM-DD or null.
   */
  function toISODate(value) {
    if (value === null || value === undefined || value === '') return null;

    if (value instanceof Date) {
      if (isNaN(value.getTime())) return null;
      return mkISO(value.getFullYear(), value.getMonth() + 1, value.getDate());
    }

    if (typeof value === 'number') {
      if (value > 20000 && value < 80000) {
        // Excel serial date (1899-12-30 epoch).
        var utc = Math.round((value - 25569) * 86400000);
        var d = new Date(utc);
        return mkISO(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      }
      return null;
    }

    var s = normText(value);
    if (!s) return null;

    var m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/);
    if (m) return mkISO(Number(m[1]), Number(m[2]), Number(m[3]));

    m = s.match(/^(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?$/);
    if (m) return mkISO(Number(m[1]), Number(m[2]), Number(m[3]));

    m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (m) return mkISO(Number(m[1]), Number(m[2]), Number(m[3]));

    if (/^\d{5}(\.\d+)?$/.test(s)) {
      return toISODate(Number(s));
    }

    return null;
  }

  /**
   * Parses progress into 0..100.
   * Excel percent-formatted numbers (0 < n < 1) are treated as fractions.
   */
  function parseProgress(value) {
    if (value === null || value === undefined || value === '') {
      return { value: 0, warning: '进度为空，按 0 处理' };
    }

    var n;
    if (typeof value === 'number') {
      n = value;
      if (n > 0 && n < 1) n = n * 100;
    } else {
      var s = normText(value);
      if (!s) return { value: 0, warning: '进度为空，按 0 处理' };
      var hasPercent = /[%％]/.test(s);
      var num = Number(s.replace(/[%％,\s]/g, ''));
      if (!isFinite(num)) {
        return { value: 0, warning: '进度不是数字（' + s + '），按 0 处理' };
      }
      n = num;
      if (hasPercent) n = num;
    }

    if (!isFinite(n)) {
      return { value: 0, warning: '进度不是数字，按 0 处理' };
    }
    if (n < 0) return { value: 0, warning: '进度小于 0，已按 0 处理' };
    if (n > 100) return { value: 100, warning: '进度大于 100，已按 100 处理' };
    return { value: Math.round(n) };
  }

  function splitDepartments(value) {
    var s = normText(value);
    if (!s) return [];
    var seen = Object.create(null);
    return s
      .split(/[、，,；;\n\r]+/)
      .map(function (x) { return x.trim(); })
      .filter(function (x) {
        if (!x || seen[x]) return false;
        seen[x] = true;
        return true;
      });
  }

  function detectHeader(aoa) {
    var maxScan = Math.min(aoa.length, 20);
    for (var r = 0; r < maxScan; r++) {
      var row = aoa[r] || [];
      var map = {};
      for (var c = 0; c < row.length; c++) {
        var key = normHeader(row[c]);
        if (!key) continue;
        for (var field in NORMALIZED_ALIASES) {
          if (NORMALIZED_ALIASES[field].indexOf(key) !== -1 && map[field] === undefined) {
            map[field] = c;
            break;
          }
        }
      }
      if (map.name !== undefined && map.start !== undefined && map.end !== undefined) {
        return { headerIndex: r, map: map, fallback: false };
      }
    }

    // Positional fallback: A..H.
    return {
      headerIndex: -1,
      map: { seq: 0, name: 1, dept: 2, start: 3, end: 4, progress: 5, phase: 6, note: 7 },
      fallback: true
    };
  }

  function rowIsEmpty(row) {
    if (!row) return true;
    for (var i = 0; i < row.length; i++) {
      if (normText(row[i]) !== '') return false;
    }
    return true;
  }

  function parseInteger(value) {
    if (value === null || value === undefined || value === '') return null;
    var n = Number(normText(value));
    return isFinite(n) ? Math.round(n) : null;
  }

  /**
   * Parses an array-of-arrays (from SheetJS or a test fixture) into tasks.
   *
   * options:
   *   defaultPhaseOrder?: string[]
   *   sourceName?: string
   */
  function parseAoa(aoa, options) {
    options = options || {};
    if (!Array.isArray(aoa)) {
      throw new Error('parseAoa 需要二维数组');
    }

    var header = detectHeader(aoa);
    var map = header.map;
    var warnings = [];
    var tasks = [];
    var phases = [];
    var phaseSeen = Object.create(null);
    var legacyPhaseFromNote = map.phase === undefined && map.note !== undefined;

    if (header.fallback) {
      warnings.push({
        row: 1,
        level: 'warn',
        message: '未识别到标准表头，已按旧版 A–H 列位置解析。新模板请保留表头；标准列顺序为：序号、工作任务、责任部门、责任人、启动时间、完成时间、进度（%）、阶段、备注。'
      });
    }

    var firstDataRow = header.headerIndex + 1;
    var usedSeqs = Object.create(null);

    for (var r = firstDataRow; r < aoa.length; r++) {
      var row = aoa[r] || [];
      if (rowIsEmpty(row)) continue;
      var excelRow = r + 1;

      var name = normText(row[map.name]);
      if (!name) {
        warnings.push({ row: excelRow, level: 'warn', message: '任务名为空，已跳过该行。' });
        continue;
      }

      var start = toISODate(row[map.start]);
      var end = toISODate(row[map.end]);
      if (!start) {
        warnings.push({ row: excelRow, level: 'warn', message: '启动时间无法识别，已跳过该行（任务：' + name + '）。' });
        continue;
      }
      if (!end) {
        warnings.push({ row: excelRow, level: 'warn', message: '完成时间无法识别，已跳过该行（任务：' + name + '）。' });
        continue;
      }
      if (end < start) {
        warnings.push({ row: excelRow, level: 'warn', message: '完成时间早于启动时间（' + start + ' → ' + end + '），已保留原值，请核对。' });
      }

      var progressResult = parseProgress(map.progress !== undefined ? row[map.progress] : null);
      if (progressResult.warning) {
        warnings.push({ row: excelRow, level: 'warn', message: progressResult.warning + '（任务：' + name + '）' });
      }

      var phase = '';
      if (map.phase !== undefined) {
        phase = normText(row[map.phase]);
      } else if (legacyPhaseFromNote) {
        phase = normText(row[map.note]);
      }
      if (!phase) phase = DEFAULT_PHASE;

      var note = '';
      if (map.note !== undefined && !legacyPhaseFromNote) {
        note = normText(row[map.note]);
      }

      var seq = parseInteger(map.seq !== undefined ? row[map.seq] : null);
      if (seq !== null) usedSeqs[seq] = true;

      var dept = splitDepartments(map.dept !== undefined ? row[map.dept] : '');
      var owners = splitDepartments(map.owner !== undefined ? row[map.owner] : '');
      var id = 't_' + excelRow;

      tasks.push({
        id: id,
        seq: seq,
        name: name,
        departments: dept,
        owners: owners,
        start: start,
        end: end,
        progress: progressResult.value,
        phase: phase,
        note: note,
        _row: excelRow
      });

      if (!phaseSeen[phase]) {
        phaseSeen[phase] = true;
        phases.push(phase);
      }
    }

    // Fill missing serial numbers, preferring gaps between known neighbours.
    for (var i = 0; i < tasks.length; i++) {
      if (tasks[i].seq !== null) continue;

      var prev = null;
      for (var p = i - 1; p >= 0; p--) {
        if (tasks[p].seq !== null) { prev = tasks[p]; break; }
      }
      var next = null;
      for (var n = i + 1; n < tasks.length; n++) {
        if (tasks[n].seq !== null) { next = tasks[n]; break; }
      }

      var candidate = prev ? prev.seq + 1 : (next ? next.seq - 1 : 1);
      if (candidate < 1) candidate = 1;

      if (usedSeqs[candidate] || (next && candidate >= next.seq)) {
        var found = null;
        if (prev && next) {
          for (var x = prev.seq + 1; x < next.seq; x++) {
            if (!usedSeqs[x]) { found = x; break; }
          }
        }
        if (found === null) {
          found = 1;
          while (usedSeqs[found]) found++;
        }
        candidate = found;
      }

      tasks[i].seq = candidate;
      usedSeqs[candidate] = true;
      warnings.push({
        row: tasks[i]._row,
        level: 'warn',
        message: '序号为空，已自动编号为 ' + candidate + '（任务：' + tasks[i].name + '）。'
      });
    }

    tasks.forEach(function (task) { delete task._row; });

    var defaultOrder = Array.isArray(options.defaultPhaseOrder) ? options.defaultPhaseOrder : [];
    var finalPhaseOrder = [];
    defaultOrder.forEach(function (p) {
      var name = normText(p);
      if (name && finalPhaseOrder.indexOf(name) === -1 && phaseSeen[name]) {
        finalPhaseOrder.push(name);
      }
    });
    phases.forEach(function (p) {
      if (finalPhaseOrder.indexOf(p) === -1) finalPhaseOrder.push(p);
    });
    if (phaseSeen[DEFAULT_PHASE] && finalPhaseOrder.indexOf(DEFAULT_PHASE) === -1) {
      finalPhaseOrder.push(DEFAULT_PHASE);
    }

    return {
      tasks: tasks,
      phases: finalPhaseOrder,
      warnings: warnings,
      stats: {
        sourceRows: Math.max(0, aoa.length - firstDataRow),
        imported: tasks.length,
        skipped: Math.max(0, aoa.length - firstDataRow - tasks.length),
        warningCount: warnings.length
      },
      header: header
    };
  }

  function normalizeProject(raw, options) {
    options = options || {};
    var warnings = [];
    if (!raw || typeof raw !== 'object') {
      throw new Error('项目数据为空或格式错误');
    }

    var meta = raw.meta && typeof raw.meta === 'object' ? raw.meta : {};
    var tasks = Array.isArray(raw.tasks) ? raw.tasks : [];
    var normalizedTasks = [];
    var usedIds = Object.create(null);

    tasks.forEach(function (task, index) {
      if (!task || typeof task !== 'object') return;

      var name = normText(task.name);
      if (!name) {
        warnings.push('第 ' + (index + 1) + ' 条任务缺少名称，已跳过');
        return;
      }

      var start = toISODate(task.start);
      var end = toISODate(task.end);
      if (!start || !end) {
        var today = options.today || new Date();
        var fallback = mkISO(today.getFullYear(), today.getMonth() + 1, today.getDate());
        warnings.push('任务“' + name + '”日期无效，已用今天占位');
        start = start || fallback;
        end = end || start;
      }
      if (end < start) {
        warnings.push('任务“' + name + '”完成时间早于启动时间');
      }

      var rawProgress = Number(task.progress);
      if (!isFinite(rawProgress)) rawProgress = 0;
      var progress = Math.max(0, Math.min(100, Math.round(rawProgress)));
      if (rawProgress > 100 || rawProgress < 0) {
        warnings.push('任务“' + name + '”进度超出 0–100，已截断为 ' + progress);
      }

      var id = normText(task.id) || ('t_' + (index + 1));
      while (usedIds[id]) id = id + '_' + (index + 1);
      usedIds[id] = true;

      var seq = Number(task.seq);
      if (!isFinite(seq)) seq = index + 1;

      var departments = Array.isArray(task.departments)
        ? task.departments.map(normText).filter(Boolean)
        : splitDepartments(task.departments);

      var owners = Array.isArray(task.owners)
        ? task.owners.map(normText).filter(Boolean)
        : splitDepartments(task.owners);

      normalizedTasks.push({
        id: id,
        seq: Math.round(seq),
        name: name,
        departments: departments,
        owners: owners,
        start: start,
        end: end,
        progress: progress,
        phase: normText(task.phase) || DEFAULT_PHASE,
        note: normText(task.note)
      });
    });

    var phaseOrder = Array.isArray(meta.phaseOrder) ? meta.phaseOrder.map(normText).filter(Boolean) : [];
    var seen = Object.create(null);
    phaseOrder = phaseOrder.filter(function (p) {
      if (seen[p]) return false;
      seen[p] = true;
      return true;
    });
    normalizedTasks.forEach(function (task) {
      if (!seen[task.phase]) {
        seen[task.phase] = true;
        phaseOrder.push(task.phase);
      }
    });
    if (seen[DEFAULT_PHASE] && phaseOrder.indexOf(DEFAULT_PHASE) === -1) {
      phaseOrder.push(DEFAULT_PHASE);
    }

    var project = {
      meta: {
        projectId: normText(meta.projectId) || options.projectId || 'default',
        title: normText(meta.title) || options.title || '项目进度',
        logo: normText(meta.logo) || options.logo || '',
        updatedAt: normText(meta.updatedAt) || new Date().toISOString(),
        version: isFinite(Number(meta.version)) ? Number(meta.version) : 1,
        publishNote: normText(meta.publishNote),
        phaseOrder: phaseOrder
      },
      tasks: normalizedTasks
    };

    return { project: project, warnings: warnings };
  }

  function serializeProject(project) {
    var json = JSON.stringify(project, null, 2)
      .replace(/[\u2028]/g, '\\u2028')
      .replace(/[\u2029]/g, '\\u2029');
    return '/* customSchedule data — generated ' + new Date().toISOString() + ' */\n' +
      'window.PROJECT_DATA = ' + json + ';\n';
  }

  function projectToAoa(project) {
    var rows = [[
      '序号', '工作任务', '责任部门', '责任人', '启动时间', '完成时间', '进度（%）', '阶段', '备注'
    ]];
    (project.tasks || []).forEach(function (task) {
      rows.push([
        task.seq,
        task.name,
        (task.departments || []).join('、'),
        (task.owners || []).join('、'),
        task.start,
        task.end,
        task.progress,
        task.phase,
        task.note || ''
      ]);
    });
    return rows;
  }

  function buildProject(parsed, options) {
    options = options || {};
    var now = options.now || new Date().toISOString();
    return {
      meta: {
        projectId: options.projectId || 'default',
        title: options.title || '项目进度',
        logo: options.logo || '',
        updatedAt: now,
        version: options.version || 1,
        publishNote: options.publishNote || '',
        phaseOrder: parsed.phases || []
      },
      tasks: parsed.tasks.map(function (task, index) {
        return {
          id: task.id || ('t_' + (index + 1)),
          seq: task.seq,
          name: task.name,
          departments: task.departments || [],
          owners: task.owners || [],
          start: task.start,
          end: task.end,
          progress: task.progress,
          phase: task.phase || DEFAULT_PHASE,
          note: task.note || ''
        };
      })
    };
  }

  return {
    DEFAULT_PHASE: DEFAULT_PHASE,
    HEADER_ALIASES: HEADER_ALIASES,
    toISODate: toISODate,
    parseProgress: parseProgress,
    splitDepartments: splitDepartments,
    detectHeader: detectHeader,
    parseAoa: parseAoa,
    normalizeProject: normalizeProject,
    serializeProject: serializeProject,
    projectToAoa: projectToAoa,
    buildProject: buildProject
  };
});