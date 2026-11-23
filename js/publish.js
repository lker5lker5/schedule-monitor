/* ============================================================
 * customSchedule — Excel import/export and publishing
 * ============================================================ */
(function () {
  'use strict';

  var CS = window.CS;
  var h = CS.h;
  var state = CS.state;

  /* ---------- Excel import ---------- */

  CS.openImport = function () {
    if (!state.admin) return;
    if (!CS.XLSX) {
      CS.toast('正在加载 Excel 组件…');
      CS.loadXlsx().then(function () { CS.openImport(); }).catch(function (err) {
        CS.toast('Excel 组件加载失败：' + (err && err.message ? err.message : err), 'err');
      });
      return;
    }

    var result = h('div', {});
    var confirmBtn = h('button', {
      class: 'btn primary', type: 'button', disabled: true,
      onclick: function () { applyImport(); }
    }, '覆盖并导入');
    var imported = null;

    var fileInput = h('input', {
      type: 'file',
      accept: '.xlsx,.xls,.csv',
      onchange: function (e) {
        var file = e.target.files && e.target.files[0];
        if (file) handleFile(file);
      }
    });

    var drop = h('div', {
      class: 'import-drop',
      onclick: function () { fileInput.click(); },
      ondragover: function (e) { e.preventDefault(); drop.classList.add('drag'); },
      ondragleave: function () { drop.classList.remove('drag'); },
      ondrop: function (e) {
        e.preventDefault();
        drop.classList.remove('drag');
        var file = e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) handleFile(file);
      }
    },
      CS.icon('upload', 28),
      h('strong', {}, '拖入 Excel，或点击选择文件'),
      h('span', { style: { fontSize: '11.5px' } }, '支持 .xlsx / .xls / .csv，首张工作表；导入前会显示预览与警告。'),
      fileInput
    );

    function handleFile(file) {
      CS.clear(result);
      result.appendChild(h('div', { class: 'muted', style: { fontSize: '12px' } }, '正在解析 ' + file.name + ' …'));

      file.arrayBuffer().then(function (buf) {
        var wb = CS.XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: true });
        var sheet = wb.Sheets[wb.SheetNames[0]];
        var rows = CS.XLSX.utils.sheet_to_json(sheet, {
          header: 1, raw: true, defval: null, blankrows: false
        });
        var parsed = CS.P.parseAoa(rows, {
          defaultPhaseOrder: state.data.meta.phaseOrder
        });
        imported = parsed;
        confirmBtn.disabled = !parsed.tasks.length;
        renderResult(file.name, parsed);
      }).catch(function (err) {
        imported = null;
        confirmBtn.disabled = true;
        CS.clear(result);
        result.appendChild(h('div', { class: 'field error' }, '解析失败：' + (err && err.message ? err.message : err)));
      });
    }

    function renderResult(filename, parsed) {
      CS.clear(result);
      result.appendChild(h('div', { class: 'import-summary' },
        stat(parsed.tasks.length, '条有效任务'),
        stat(parsed.phases.length, '个阶段'),
        stat(parsed.warnings.length, '条警告')
      ));
      result.appendChild(h('div', { style: { fontSize: '11.5px', color: 'var(--muted)' } },
        '来源：' + filename + ' · 导入后覆盖当前 ' + state.data.tasks.length + ' 条任务（项目标题与发布信息不变）。'));

      var deptTable = CS.departmentsTable();
      var personTable = CS.personsTable();
      var extDept = Object.create(null);
      var extPerson = Object.create(null);
      parsed.tasks.forEach(function (t) {
        (t.departments || []).forEach(function (d) { if (deptTable.indexOf(d) === -1) extDept[d] = true; });
        (t.owners || []).forEach(function (o) { if (personTable.indexOf(o) === -1) extPerson[o] = true; });
      });
      var extDeptList = Object.keys(extDept);
      var extPersonList = Object.keys(extPerson);
      if (extDeptList.length || extPersonList.length) {
        var externalNotes = [];
        if (extDeptList.length) externalNotes.push('表外部门：' + extDeptList.join('、'));
        if (extPersonList.length) externalNotes.push('表外责任人：' + extPersonList.join('、'));
        result.appendChild(h('div', {
          class: 'warning-item',
          style: { border: '1px solid #FDE68A', borderRadius: '8px', marginTop: '8px' }
        }, externalNotes.join('；') + '。将保留在任务中并标黄，不会自动写入 departments.js / persons.js。'));
      }

      if (parsed.warnings.length) {
        var warnings = h('div', { class: 'warnings' });
        parsed.warnings.slice(0, 50).forEach(function (w) {
          warnings.appendChild(h('div', { class: 'warning-item' },
            h('span', { class: 'row-no' }, '第 ' + w.row + ' 行'),
            w.message
          ));
        });
        if (parsed.warnings.length > 50) {
          warnings.appendChild(h('div', { class: 'warning-item' }, '还有 ' + (parsed.warnings.length - 50) + ' 条警告未显示…'));
        }
        result.appendChild(warnings);
      }

      var wrap = h('div', { class: 'preview-table-wrap' });
      var table = h('table', { class: 'preview-table' });
      var thead = h('thead');
      var tr = h('tr');
      ['序号', '工作任务', '责任部门', '责任人', '启动时间', '完成时间', '进度', '阶段', '备注'].forEach(function (t) {
        tr.appendChild(h('th', {}, t));
      });
      thead.appendChild(tr);
      table.appendChild(thead);
      var tbody = h('tbody');
      parsed.tasks.slice(0, 8).forEach(function (t) {
        var row = h('tr');
        [t.seq, t.name, (t.departments || []).join('、'), (t.owners || []).join('、'), t.start, t.end, t.progress + '%', t.phase, t.note || ''].forEach(function (v) {
          row.appendChild(h('td', { title: String(v) }, String(v)));
        });
        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
      result.appendChild(wrap);
      if (parsed.tasks.length > 8) {
        result.appendChild(h('div', { class: 'hint', style: { marginTop: '6px' } }, '仅预览前 8 条，共 ' + parsed.tasks.length + ' 条。'));
      }
      if (!parsed.tasks.length) {
        result.appendChild(h('div', { class: 'field error', style: { marginTop: '10px' } }, '没有解析到有效任务，无法导入。'));
      }
    }

    function applyImport() {
      if (!imported || !imported.tasks.length) return;
      if (!window.confirm('将用导入的 ' + imported.tasks.length + ' 条任务覆盖当前数据，确定继续吗？')) return;

      state.data.tasks = imported.tasks.map(function (t, i) {
        return {
          id: t.id || ('t_import_' + i),
          seq: t.seq,
          name: t.name,
          departments: t.departments || [],
          owners: t.owners || [],
          start: t.start,
          end: t.end,
          progress: t.progress,
          phase: t.phase || '未分类',
          note: t.note || ''
        };
      });

      var phases = imported.phases.slice();
      if (state.data.tasks.some(function (t) { return t.phase === '未分类'; }) && phases.indexOf('未分类') === -1) {
        phases.push('未分类');
      }
      state.data.meta.phaseOrder = phases;

      CS.normalizeCurrent();
      CS.markDirty();
      CS.closeModal();
      CS.renderAll();
      CS.toast('已导入 ' + state.data.tasks.length + ' 条任务');
    }

    function stat(n, label) {
      return h('div', { class: 'import-stat' },
        h('div', { class: 'n' }, String(n)),
        h('div', { class: 'l' }, label)
      );
    }

    CS.openModal({
      title: '导入 Excel',
      sub: '标准列：序号、工作任务、责任部门、责任人、启动时间、完成时间、进度（%）、阶段、备注。责任人、备注列可缺失。',
      wide: true,
      body: h('div', {}, drop, result),
      foot: [
        h('button', { class: 'btn', type: 'button', onclick: CS.closeModal }, '取消'),
        confirmBtn
      ]
    });
  };

  /* ---------- Excel export ---------- */

  CS.exportExcel = function () {
    if (!state.admin) return;
    if (!CS.XLSX) {
      CS.toast('正在加载 Excel 组件…');
      CS.loadXlsx().then(function () { CS.exportExcel(); }).catch(function (err) {
        CS.toast('Excel 组件加载失败：' + (err && err.message ? err.message : err), 'err');
      });
      return;
    }

    var aoa = CS.P.projectToAoa(state.data);
    var ws = CS.XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [
      { wch: 6 }, { wch: 52 }, { wch: 32 }, { wch: 12 },
      { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 30 }
    ];

    var wb = CS.XLSX.utils.book_new();
    CS.XLSX.utils.book_append_sheet(wb, ws, '任务分解表');

    var info = CS.XLSX.utils.aoa_to_sheet([
      ['字段', '填写说明'],
      ['序号', '显示序号；可重复，建议保持唯一。'],
      ['工作任务', '必填。'],
      ['责任部门', '多个部门请用顿号（、）、逗号或分号分隔。'],
      ['责任人', '多个责任人请用顿号（、）、逗号或分号分隔；可留空。'],
      ['启动时间', '格式：YYYY-MM-DD，也支持 2026/11/6、2026年11月6日。'],
      ['完成时间', '格式同上；不能早于启动时间。'],
      ['进度（%）', '0 = 未开始；1–99 = 进行中（估算完成度）；100 = 已完成。'],
      ['阶段', '用于甘特分组，例如：项目管理流程、基础环境建设、主体功能建设、制度建设。'],
      ['备注', '可选。']
    ]);
    info['!cols'] = [{ wch: 14 }, { wch: 72 }];
    CS.XLSX.utils.book_append_sheet(wb, info, '填写说明');

    CS.XLSX.writeFile(wb, '任务分解表-' + CS.todayISO() + '.xlsx');
    CS.toast('已导出 Excel');
  };

  /* ---------- Publishing ---------- */

  CS.preparePublish = function (note) {
    note = (note || '').trim();
    var key = state.revision + '|' + note;
    if (state.publishPayload && state.publishPayload.key === key) {
      return state.publishPayload;
    }

    var data = CS.clone(state.data);
    data.meta.title = CS.TITLE;
    data.meta.updatedAt = new Date().toISOString();
    data.meta.version = (Number(data.meta.version) || 0) + 1;
    data.meta.publishNote = note;

    var payload = {
      key: key,
      note: note,
      data: data,
      content: CS.P.serializeProject(data)
    };
    state.publishPayload = payload;
    return payload;
  };

  CS.openPublish = function () {
    if (!state.admin) return;

    var meta = state.data.meta;
    var noteInput = h('input', {
      type: 'text',
      value: meta.publishNote || '',
      placeholder: '例如：完成可研评审，更新 3 条任务'
    });
    var statusEl = h('div', { class: 'publish-status' });
    var gh = CS.getGhSettings();
    var configured = !!(gh.owner && gh.token);

    var actions = h('div', { class: 'publish-actions' },
      actionRow('download', '下载 data.js', '生成发布文件，手动替换仓库/服务器上的 data.js。', h('button', {
        class: 'btn primary', type: 'button',
        onclick: function () { CS.publishDownload(noteInput.value, statusEl); }
      }, '下载')),
      actionRow('copy', '复制内容', '复制 data.js 内容，便于在 GitHub 网页编辑器中粘贴。', h('button', {
        class: 'btn', type: 'button',
        onclick: function () { CS.publishCopy(noteInput.value, statusEl); }
      }, '复制')),
      actionRow('cloud', configured ? '一键发布到 GitHub' : '配置 GitHub 一键发布',
        configured
          ? gh.owner + '/' + gh.repo + ' · ' + gh.branch + ' · ' + gh.path
          : '需要 Owner 与 fine-grained token，配置后可直接提交 data.js。',
        configured
          ? h('button', {
            class: 'btn primary', type: 'button',
            onclick: function (e) {
              CS.publishGithub(noteInput.value, statusEl, e.currentTarget);
            }
          }, '一键发布')
          : h('button', {
            class: 'btn', type: 'button',
            onclick: function () { CS.closeModal(); CS.openSettings(); }
          }, '去设置'))
    );

    var body = h('div', {},
      h('div', { class: 'publish-note' },
        '当前线上版本 v' + meta.version + '，更新于 ' + CS.fmtDateTime(meta.updatedAt) + '。' +
        '发布会在本地更新版本号与时间；团队看到新数据取决于你是否替换线上 data.js。'
      ),
      h('div', { class: 'field', style: { marginBottom: '14px' } },
        h('label', {}, '发布说明（可选）'),
        noteInput,
        h('div', { class: 'hint' }, '会显示在页脚，帮助团队了解本次更新内容。')
      ),
      actions,
      statusEl
    );

    var foot = [
      h('button', { class: 'btn', type: 'button', onclick: CS.closeModal }, '关闭'),
      h('button', {
        class: 'btn', type: 'button',
        onclick: function () { CS.markPublished(); }
      }, CS.icon('check', 15), '标记为已发布')
    ];

    CS.openModal({
      title: '发布更新',
      sub: '静态页面无法自动写入线上文件；下载后替换，或使用 GitHub 一键发布。',
      wide: true,
      body: body,
      foot: foot
    });
  };

  function actionRow(iconName, title, desc, button) {
    return h('div', { class: 'publish-action' },
      h('span', { class: 'icon' }, CS.icon(iconName, 17)),
      h('span', { class: 'body' },
        h('span', { class: 'title' }, title),
        h('span', { class: 'desc' }, desc)
      ),
      button
    );
  }

  CS.publishDownload = function (note, statusEl) {
    var payload = CS.preparePublish(note);
    state.data = CS.clone(payload.data);
    state.dirty = true;
    state.publishPayload = payload;
    CS.saveDraftNow();
    CS.downloadText(payload.content, 'data.js', 'text/javascript;charset=utf-8');
    CS.renderAll();
    if (statusEl) {
      statusEl.className = 'publish-status ok';
      statusEl.textContent = '已生成并下载 data.js（v' + state.data.meta.version + '）。替换线上文件后，点击“标记为已发布”清除草稿。';
    }
    CS.toast('已下载 data.js');
  };

  CS.publishCopy = function (note, statusEl) {
    var payload = CS.preparePublish(note);
    CS.copyText(payload.content);
    if (statusEl) {
      statusEl.className = 'publish-status';
      statusEl.textContent = '已复制 data.js 内容。把它粘贴到 GitHub 的 data.js 编辑器中并提交。';
    }
  };

  CS.markPublished = function () {
    if (state.dirty && !state.publishPayload) {
      CS.toast('请先下载/复制发布文件，或使用一键发布', 'err');
      return;
    }
    var source = state.publishPayload && state.publishPayload.data ? state.publishPayload.data : state.data;
    state.data = CS.clone(source);
    state.published = CS.clone(source);
    state.dirty = false;
    state.draftInfo = null;
    state.publishPayload = null;
    CS.clearDraft();
    CS.closeModal();
    CS.renderAll();
    CS.toast('已标记为已发布，本地草稿已清除', 'ok');
  };

  CS.publishGithub = function (note, statusEl, btn) {
    var settings = CS.getGhSettings();
    if (!settings.owner) {
      if (statusEl) {
        statusEl.className = 'publish-status err';
        statusEl.textContent = '尚未配置 GitHub Owner。请先在“设置”中填写 Owner、仓库与 token。';
      }
      return;
    }
    if (!settings.token) {
      if (statusEl) {
        statusEl.className = 'publish-status err';
        statusEl.textContent = '尚未配置 GitHub token。请先在“设置”中填写 fine-grained token。';
      }
      return;
    }

    var payload = CS.preparePublish(note);
    if (btn) {
      btn.disabled = true;
      btn.textContent = '发布中…';
    }
    if (statusEl) {
      statusEl.className = 'publish-status';
      statusEl.textContent = '正在提交到 GitHub…';
    }

    githubPut(settings, payload.content, 'chore: update project data ' + new Date().toISOString())
      .then(function () {
        state.data = CS.clone(payload.data);
        state.published = CS.clone(payload.data);
        state.dirty = false;
        state.draftInfo = null;
        state.publishPayload = null;
        CS.clearDraft();
        CS.closeModal();
        CS.renderAll();
        CS.toast('已发布到 GitHub，Pages 通常会在 1 分钟内更新', 'ok');
      })
      .catch(function (err) {
        if (statusEl) {
          statusEl.className = 'publish-status err';
          statusEl.textContent = '发布失败：' + (err && err.message ? err.message : err);
        }
        CS.toast('GitHub 发布失败', 'err');
      })
      .finally(function () {
        if (btn) {
          btn.disabled = false;
          btn.textContent = '一键发布';
        }
      });
  };

  function githubPut(settings, content, message) {
    var owner = encodeURIComponent(settings.owner);
    var repo = encodeURIComponent(settings.repo || 'customSchedule');
    var branch = settings.branch || 'main';
    var path = (settings.path || 'data.js').split('/').map(encodeURIComponent).join('/');
    var api = 'https://api.github.com/repos/' + owner + '/' + repo + '/contents/' + path;

    var headers = {
      'Accept': 'application/vnd.github+json',
      'Authorization': 'Bearer ' + settings.token,
      'X-GitHub-Api-Version': '2022-11-28'
    };

    function getSha() {
      return fetch(api + '?ref=' + encodeURIComponent(branch), { headers: headers })
        .then(function (res) {
          if (res.status === 404) return undefined;
          if (!res.ok) return parseError(res).then(function (msg) { throw new Error(msg); });
          return res.json().then(function (json) { return json.sha; });
        });
    }

    function put(sha) {
      var body = {
        message: message,
        content: CS.b64Utf8(content),
        branch: branch
      };
      if (sha) body.sha = sha;
      return fetch(api, {
        method: 'PUT',
        headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
        body: JSON.stringify(body)
      });
    }

    return getSha().then(function (sha) {
      return put(sha).then(function (res) {
        if (res.ok) return res.json();
        if (res.status === 409 || res.status === 422) {
          return getSha().then(function (freshSha) {
            return put(freshSha).then(function (retry) {
              if (!retry.ok) return parseError(retry).then(function (msg) { throw new Error(msg); });
              return retry.json();
            });
          });
        }
        return parseError(res).then(function (msg) { throw new Error(msg); });
      });
    });
  }

  function parseError(res) {
    return res.text().then(function (text) {
      var message = text;
      try {
        var json = JSON.parse(text);
        if (json && json.message) message = json.message;
      } catch (e) { /* ignore */ }
      return 'HTTP ' + res.status + '：' + message;
    });
  }
})();