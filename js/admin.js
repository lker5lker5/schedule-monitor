/* ============================================================
 * customSchedule — admin mode, task editor, settings
 * ============================================================ */
(function () {
  'use strict';

  var CS = window.CS;
  var h = CS.h;
  var state = CS.state;

  /* ---------- Admin bar ---------- */

  CS.renderAdminBar = function () {
    var bar = CS.refs.adminBar;
    if (!bar) return;
    bar.hidden = !state.admin;
    if (!state.admin) { CS.clear(bar); return; }

    CS.clear(bar);
    bar.appendChild(h('span', { class: 'admin-pill' },
      h('span', { class: 'dot' }),
      '管理模式'
    ));
    if (state.dirty) {
      bar.appendChild(h('span', { class: 'dirty-dot', title: '有未发布的修改' }));
      bar.appendChild(h('span', { style: { fontSize: '11.5px', color: 'var(--warn)' } }, '有未发布修改'));
    }
    bar.appendChild(h('span', { class: 'admin-spacer' }));

    function adminBtn(label, iconName, onClick, cls) {
      return h('button', {
        class: 'btn small ' + (cls || ''),
        type: 'button',
        onclick: onClick
      }, CS.icon(iconName, 14), label);
    }

    bar.appendChild(adminBtn('新增任务', 'plus', function () { CS.openTaskEditor(null); }));
    bar.appendChild(adminBtn('导入 Excel', 'upload', CS.openImport));
    bar.appendChild(adminBtn('导出 Excel', 'download', CS.exportExcel));
    bar.appendChild(adminBtn('发布', 'cloud', CS.openPublish, 'primary'));
    bar.appendChild(adminBtn('设置', 'settings', CS.openSettings));
    bar.appendChild(adminBtn('退出', 'logout', CS.logout));

    if (state.draftInfo) {
      var stale = state.draftInfo.stale;
      var banner = h('div', { class: 'draft-banner', style: { flexBasis: '100%', marginTop: '2px' } },
        h('span', {}, '正在编辑未发布草稿（保存于 ' + CS.fmtDateTime(state.draftInfo.savedAt) + '）' +
          (stale ? '。线上数据已更新，草稿基于旧版本，发布前请核对。' : '。')),
        h('span', { style: { flex: '1' } }),
        h('button', {
          class: 'btn small', type: 'button',
          onclick: CS.openPublish
        }, '发布'),
        h('button', {
          class: 'btn small ghost', type: 'button',
          onclick: CS.discardDraft
        }, '丢弃草稿')
      );
      bar.appendChild(banner);
    }
  };

  CS.moveTaskSeq = function (task, other, label) {
    if (!task || !other) return;
    var a = task.seq;
    task.seq = other.seq;
    other.seq = a;
    CS.normalizeCurrent();
    CS.markDirty();
    CS.renderAll();
    if (state.selectedId) CS.openDetail(state.selectedId);
    CS.toast('已' + label + '：' + task.name);
  };

  CS.logout = function () {
    CS.setAdminSession(false);
    state.admin = false;
    state.dirty = false;
    state.draftInfo = null;
    state.publishPayload = null;
    state.data = CS.clone(state.published);
    CS.renderAll();
    CS.toast('已退出管理模式，草稿已保留在本机');
  };

  /* ---------- Draft ---------- */

  CS.loadDraftForAdmin = function () {
    var draft = CS.readDraft();
    state.publishPayload = null;
    state.revision++;

    if (!draft) {
      state.data = CS.clone(state.published);
      state.dirty = false;
      state.draftInfo = null;
      return;
    }

    try {
      var normalized = CS.P.normalizeProject(draft.data, {
        projectId: state.published.meta.projectId,
        title: state.published.meta.title,
        logo: state.published.meta.logo,
        today: new Date()
      });
      normalized.project.meta.title = CS.TITLE;
      state.data = normalized.project;
      state.dirty = true;
      state.draftInfo = {
        savedAt: draft.savedAt,
        stale: draft.baseVersion !== state.published.meta.version ||
          draft.baseUpdatedAt !== state.published.meta.updatedAt
      };
      CS.toast('已恢复本机未发布草稿');
    } catch (e) {
      CS.clearDraft();
      state.data = CS.clone(state.published);
      state.dirty = false;
      state.draftInfo = null;
      CS.toast('草稿数据损坏，已加载线上版本', 'err');
    }
  };

  CS.discardDraft = function () {
    if (!window.confirm('确定丢弃本机草稿并恢复为线上数据吗？此操作不可撤销。')) return;
    CS.clearDraft();
    state.data = CS.clone(state.published);
    state.dirty = false;
    state.draftInfo = null;
    state.publishPayload = null;
    CS.renderAll();
    CS.toast('已丢弃草稿');
  };

  /* ---------- Login ---------- */

  CS.openLogin = function () {
    if (state.admin) {
      CS.toast('已处于管理模式');
      return;
    }

    var error = h('div', { class: 'field error', style: { minHeight: '16px' } });
    var input = h('input', {
      type: 'password',
      autocomplete: 'current-password',
      placeholder: '输入管理员口令'
    });
    var toggle = h('button', {
      class: 'btn small ghost', type: 'button',
      onclick: function () {
        input.type = input.type === 'password' ? 'text' : 'password';
        toggle.textContent = input.type === 'password' ? '显示' : '隐藏';
      }
    }, '显示');

    var form = h('form', {
      onsubmit: function (e) { e.preventDefault(); attempt(); }
    },
      h('div', { class: 'field' },
        h('label', {}, '管理员口令'),
        h('div', { class: 'field-row' }, input, toggle)
      ),
      error,
      h('div', { class: 'field hint' }, '当前为纯前端口令校验，仅用于防止误操作，不是安全认证。')
    );

    var loginBtn = h('button', {
      class: 'btn primary', type: 'button',
      onclick: attempt
    }, CS.icon('lock', 15), '登录');

    function attempt() {
      var now = Date.now();
      if (now < state.lockUntil) {
        error.textContent = '尝试次数过多，请 ' + Math.ceil((state.lockUntil - now) / 1000) + ' 秒后再试。';
        return;
      }
      if (state.loginAttempts >= (CS.CFG.admin.maxAttempts || 5)) {
        state.loginAttempts = 0;
      }

      var hash = CS.sha256Hex(input.value);
      var expected = String((CS.CFG.admin && CS.CFG.admin.passwordHash) || '').toLowerCase();
      if (!expected) {
        error.textContent = 'config.js 中未配置管理员口令哈希。';
        return;
      }
      if (hash === expected) {
        state.loginAttempts = 0;
        CS.setAdminSession(true);
        state.admin = true;
        CS.loadDraftForAdmin();
        CS.closeModal();
        CS.renderAll();
        CS.toast('已进入管理模式');
        return;
      }

      state.loginAttempts++;
      var max = CS.CFG.admin.maxAttempts || 5;
      if (state.loginAttempts >= max) {
        state.lockUntil = Date.now() + (CS.CFG.admin.lockSeconds || 30) * 1000;
        state.loginAttempts = 0;
        error.textContent = '口令错误次数过多，已锁定 ' + (CS.CFG.admin.lockSeconds || 30) + ' 秒。';
      } else {
        error.textContent = '口令不正确，还可以尝试 ' + (max - state.loginAttempts) + ' 次。';
      }
      input.select();
    }

    CS.openModal({
      title: '管理员登录',
      sub: '仅用于防止误操作；真正的发布权限由数据文件/GitHub 令牌控制。',
      body: form,
      foot: [
        h('button', { class: 'btn', type: 'button', onclick: CS.closeModal }, '取消'),
        loginBtn
      ]
    });

    setTimeout(function () { try { input.focus(); } catch (e) {} }, 80);
  };

  /* ---------- Task editor ---------- */

  CS.openTaskEditor = function (task) {
    if (!state.admin) return;
    var isNew = !task;
    CS.closeAllPickers();

    var draft = isNew ? {
      id: CS.genId(),
      seq: CS.nextSeq(state.data.tasks),
      name: '',
      departments: [],
      owners: [],
      start: CS.todayISO(),
      end: CS.addDaysISO(CS.todayISO(), 7),
      progress: 0,
      phase: (CS.phaseOrder()[0] || '未分类'),
      note: ''
    } : CS.clone(task);

    var error = h('div', { class: 'field error', style: { minHeight: '16px' } });

    var seqInput = h('input', {
      type: 'number', min: '1', step: '1', value: draft.seq,
      readonly: true, title: '序号由系统自动分配'
    });
    var nameInput = h('input', { type: 'text', value: draft.name, placeholder: '例如：可行性研究报告编制与评审' });
    var deptPicker = CS.createMultiPicker({
      name: 'departments',
      label: '责任部门',
      placeholder: '点击选择责任部门',
      selected: draft.departments || [],
      options: CS.departmentOptions(draft.departments || []),
      emptyHint: '暂无部门数据；可直接输入新部门'
    });
    var ownerPicker = CS.createMultiPicker({
      name: 'owners',
      label: '责任人',
      placeholder: '点击选择责任人（可多选）',
      selected: draft.owners || [],
      options: CS.personOptions(draft.owners || []),
      emptyHint: '暂无责任人数据；可直接输入姓名'
    });
    var startInput = h('input', { type: 'date', value: draft.start });
    var endInput = h('input', { type: 'date', value: draft.end });
    var progressNum = h('input', { type: 'number', min: '0', max: '100', step: '1', value: draft.progress });
    var progressRange = h('input', { type: 'range', min: '0', max: '100', step: '1', value: draft.progress });
    var noteInput = h('textarea', { value: draft.note, placeholder: '可选，记录补充说明' });

    var phaseSelect = h('select', {});
    function fillPhases(selected) {
      CS.clear(phaseSelect);
      var phases = CS.phaseOptions();
      if (phases.indexOf(selected) === -1) phases.push(selected);
      phases.forEach(function (p) {
        phaseSelect.appendChild(h('option', { value: p }, p));
      });
      phaseSelect.value = selected;
    }
    fillPhases(draft.phase);

    var newPhaseBtn = h('button', {
      class: 'btn small', type: 'button',
      onclick: function () {
        var name = window.prompt('新阶段名称');
        if (!name || !name.trim()) return;
        name = name.trim();
        if (state.data.meta.phaseOrder.indexOf(name) === -1) {
          state.data.meta.phaseOrder.push(name);
        }
        fillPhases(name);
      }
    }, CS.icon('plus', 13), '新阶段');

    progressRange.addEventListener('input', function () { progressNum.value = progressRange.value; });
    progressNum.addEventListener('input', function () {
      var v = Math.max(0, Math.min(100, Number(progressNum.value) || 0));
      progressRange.value = v;
    });

    var quick = h('div', { class: 'quick-progress' });
    [0, 25, 50, 75, 100].forEach(function (v) {
      quick.appendChild(h('button', {
        type: 'button',
        onclick: function () { progressNum.value = v; progressRange.value = v; }
      }, v + '%'));
    });

    var form = h('form', {
      onsubmit: function (e) { e.preventDefault(); save(); }
    },
      h('div', { class: 'form-grid' },
        h('div', { class: 'field' },
          h('label', {}, '序号（自动）'),
          seqInput,
          h('div', { class: 'hint' }, '系统自动分配；排序用行内上移/下移。')
        ),
        h('div', { class: 'field' }, h('label', {}, '进度（%）'),
          h('div', { class: 'progress-editor' },
            h('div', { class: 'row' }, progressRange, progressNum),
            quick
          )
        ),
        h('div', { class: 'field full' },
          h('label', {}, '工作任务 ', h('span', { class: 'req' }, '*')),
          nameInput
        ),
        h('div', { class: 'field full' },
          h('label', {}, '责任部门'),
          deptPicker.node,
          h('div', { class: 'hint' }, '可多选；不在 departments.js 中的值会标黄，但仍会保存在任务里。')
        ),
        h('div', { class: 'field full' },
          h('label', {}, '责任人'),
          ownerPicker.node,
          h('div', { class: 'hint' }, '可多选；不在 persons.js 中的姓名会标黄，但仍会保存在任务里。')
        ),
        h('div', { class: 'field' }, h('label', {}, '启动时间'), startInput),
        h('div', { class: 'field' }, h('label', {}, '完成时间'), endInput),
        h('div', { class: 'field full' },
          h('label', {}, '阶段'),
          h('div', { class: 'field-row' }, phaseSelect, newPhaseBtn)
        ),
        h('div', { class: 'field full' }, h('label', {}, '备注'), noteInput)
      ),
      error
    );

    function save() {
      var name = nameInput.value.trim();
      var start = startInput.value;
      var end = endInput.value;
      var progress = Math.round(Number(progressNum.value) || 0);
      if (!name) { error.textContent = '请填写工作任务名称。'; nameInput.focus(); return; }
      if (!start || !end) { error.textContent = '请填写启动时间和完成时间。'; return; }
      if (end < start) { error.textContent = '完成时间不能早于启动时间。'; endInput.focus(); return; }
      if (progress < 0 || progress > 100) { error.textContent = '进度必须在 0–100 之间。'; return; }

      var seq = Math.max(1, Math.round(Number(seqInput.value) || draft.seq || 1));
      if (isNew && state.data.tasks.some(function (t) { return t.seq === seq; })) {
        seq = CS.nextSeq(state.data.tasks);
      }

      var next = {
        id: draft.id,
        seq: seq,
        name: name,
        departments: deptPicker.getValues(),
        owners: ownerPicker.getValues(),
        start: start,
        end: end,
        progress: progress,
        phase: phaseSelect.value || '未分类',
        note: noteInput.value.trim()
      };

      if (isNew) state.data.tasks.push(next);
      else {
        var target = state.data.tasks.filter(function (t) { return t.id === draft.id; })[0];
        if (target) Object.assign(target, next);
      }

      CS.closeAllPickers();
      CS.normalizeCurrent();
      CS.markDirty();
      CS.closeModal();
      CS.renderAll();
      if (state.selectedId) CS.openDetail(state.selectedId);
      CS.toast(isNew ? '已新增任务' : '已保存任务');
    }

    var foot = [];
    if (!isNew) {
      foot.push(h('button', {
        class: 'btn danger',
        type: 'button',
        style: { marginRight: 'auto' },
        onclick: function () {
          if (!window.confirm('确定删除任务“' + draft.name + '”吗？')) return;
          CS.closeAllPickers();
          state.data.tasks = state.data.tasks.filter(function (t) { return t.id !== draft.id; });
          CS.normalizeCurrent();
          CS.markDirty();
          CS.closeDetail();
          CS.closeModal();
          CS.renderAll();
          CS.toast('已删除任务');
        }
      }, CS.icon('trash', 14), '删除'));
    }
    foot.push(h('button', {
      class: 'btn', type: 'button',
      onclick: function () { CS.closeAllPickers(); CS.closeModal(); }
    }, '取消'));
    foot.push(h('button', { class: 'btn primary', type: 'button', onclick: save }, '保存'));

    CS.openModal({
      title: isNew ? '新增任务' : '编辑任务',
      sub: isNew ? '填写任务信息，保存后进入草稿。' : '修改后自动进入草稿，发布后团队才能看到。',
      body: form,
      foot: foot
    });

    setTimeout(function () { try { nameInput.focus(); } catch (e) {} }, 80);
  };

  /* ---------- Settings ---------- */

  CS.openSettings = function () {
    if (!state.admin) return;

    var tempPhases = state.data.meta.phaseOrder.map(function (p) {
      return { orig: p, name: p };
    });
    var phaseList = h('div', { class: 'phase-list' });
    var phaseError = h('div', { class: 'field error', style: { minHeight: '16px' } });

    function readPhaseInputs() {
      CS.$$('.phase-row input', phaseList).forEach(function (inp, i) {
        if (tempPhases[i]) tempPhases[i].name = inp.value;
      });
    }

    function renderPhases() {
      CS.clear(phaseList);
      tempPhases.forEach(function (item, i) {
        var colors = CS.phaseColors(item.name || '未分类');
        var input = h('input', { type: 'text', value: item.name, placeholder: '阶段名称' });
        input.addEventListener('change', function () { item.name = input.value; });

        phaseList.appendChild(h('div', { class: 'phase-row', style: { '--phase': colors.c } },
          h('span', { class: 'grip' }),
          input,
          h('button', {
            class: 'icon-btn', type: 'button', 'aria-label': '上移',
            disabled: i === 0,
            onclick: function () {
              readPhaseInputs();
              var tmp = tempPhases[i - 1];
              tempPhases[i - 1] = tempPhases[i];
              tempPhases[i] = tmp;
              renderPhases();
            }
          }, CS.icon('up', 14)),
          h('button', {
            class: 'icon-btn', type: 'button', 'aria-label': '下移',
            disabled: i === tempPhases.length - 1,
            onclick: function () {
              readPhaseInputs();
              var tmp = tempPhases[i + 1];
              tempPhases[i + 1] = tempPhases[i];
              tempPhases[i] = tmp;
              renderPhases();
            }
          }, CS.icon('down', 14)),
          h('button', {
            class: 'icon-btn danger', type: 'button', 'aria-label': '删除阶段',
            onclick: function () {
              readPhaseInputs();
              tempPhases.splice(i, 1);
              renderPhases();
            }
          }, CS.icon('trash', 14))
        ));
      });
    }
    renderPhases();

    var addPhaseBtn = h('button', {
      class: 'btn small', type: 'button',
      onclick: function () {
        readPhaseInputs();
        tempPhases.push({ orig: null, name: '' });
        renderPhases();
        var inputs = CS.$$('.phase-row input', phaseList);
        if (inputs.length) inputs[inputs.length - 1].focus();
      }
    }, CS.icon('plus', 13), '新增阶段');

    var gh = CS.getGhSettings();
    var ghOwner = h('input', { type: 'text', value: gh.owner, placeholder: 'GitHub 用户名' });
    var ghRepo = h('input', { type: 'text', value: gh.repo, placeholder: 'schedule-monitor' });
    var ghBranch = h('input', { type: 'text', value: gh.branch, placeholder: 'main' });
    var ghPath = h('input', { type: 'text', value: gh.path, placeholder: 'data.js' });
    var ghToken = h('input', { type: 'password', value: gh.token, placeholder: 'github_pat_...', autocomplete: 'off' });

    var pass1 = h('input', { type: 'password', autocomplete: 'new-password', placeholder: '至少 8 位' });
    var pass2 = h('input', { type: 'password', autocomplete: 'new-password', placeholder: '再次输入' });
    var hashOut = h('input', { type: 'text', readonly: true, placeholder: '生成的 SHA-256 哈希' });

    function configTable(varName, fileName, tableValues, usedValues, usage) {
      var externalValues = usedValues.filter(function (v) { return tableValues.indexOf(v) === -1; });
      var rows = [];
      tableValues.forEach(function (v) {
        rows.push({ value: v, count: usage[v] || 0, inTable: true });
      });
      externalValues.forEach(function (v) {
        rows.push({ value: v, count: usage[v] || 0, inTable: false });
      });

      function snippet(values) {
        return 'window.' + varName + ' = [\n' +
          values.map(function (v) { return '  ' + JSON.stringify(v); }).join(',\n') +
          '\n];\n';
      }

      var list = h('div', { class: 'config-table' });
      if (!rows.length) {
        list.appendChild(h('div', { class: 'config-empty' }, '暂无数据'));
      }
      rows.forEach(function (row) {
        list.appendChild(h('div', { class: 'config-row' },
          h('span', { class: 'config-name', title: row.value }, row.value),
          h('span', { class: 'config-count' }, String(row.count)),
          h('span', { class: 'config-badge' + (row.inTable ? '' : ' external') }, row.inTable ? '表内' : '表外')
        ));
      });

      return h('div', {},
        list,
        h('div', { class: 'config-actions' },
          h('button', {
            class: 'btn small', type: 'button',
            onclick: function () {
              CS.copyText(snippet(rows.map(function (r) { return r.value; })));
            }
          }, '复制完整列表'),
          h('button', {
            class: 'btn small ghost', type: 'button',
            onclick: function () {
              if (!externalValues.length) { CS.toast('没有表外值'); return; }
              CS.copyText(snippet(externalValues));
            }
          }, '复制表外值')
        ),
        h('div', { class: 'gh-help' },
          '页面只读；编辑 ',
          h('code', {}, fileName),
          ' 后刷新/推送即可。表外值会随任务保存在 data.js 中，但不会自动写回文件。'
        )
      );
    }

    var settingsBody = h('div', {},
      h('div', { class: 'settings-section' },
        h('h3', {}, '项目信息'),
        h('div', { class: 'desc' }, '项目标题统一由根目录 title.js 管理，修改该文件并推送后生效。'),
        h('div', { class: 'field' },
          h('label', {}, '项目标题（title.js）'),
          h('input', { type: 'text', value: CS.TITLE, readonly: true })
        )
      ),
      h('div', { class: 'settings-section' },
        h('h3', {}, '阶段管理'),
        h('div', { class: 'desc' }, '阶段用于甘特分组。重命名会同步更新任务；删除有任务的阶段时，任务会归入“未分类”。'),
        phaseList,
        h('div', { style: { marginTop: '9px' } }, addPhaseBtn),
        phaseError
      ),
      h('div', { class: 'settings-section' },
        h('h3', {}, '部门表（departments.js）'),
        h('div', { class: 'desc' }, '部门表是只读文件，页面不会自动修改。新增/改名/删除部门请直接编辑 departments.js 并推送。'),
        configTable('DEPARTMENTS', 'departments.js', CS.departmentsTable(), CS.allDepartments(), CS.departmentUsage())
      ),
      h('div', { class: 'settings-section' },
        h('h3', {}, '责任人表（persons.js）'),
        h('div', { class: 'desc' }, '责任人表是只读文件，页面不会自动修改。姓名请直接编辑 persons.js 并推送。'),
        configTable('PERSONS', 'persons.js', CS.personsTable(), CS.allPersons(), CS.personUsage())
      ),
      h('div', { class: 'settings-section' },
        h('h3', {}, 'GitHub 一键发布'),
        h('div', { class: 'desc' }, '创建一个 fine-grained token，仅授予该仓库 Contents: Read and write。令牌只保存在本机浏览器，不会写入 data.js。'),
        h('div', { class: 'form-grid' },
          h('div', { class: 'field' }, h('label', {}, 'Owner'), ghOwner),
          h('div', { class: 'field' }, h('label', {}, 'Repository'), ghRepo),
          h('div', { class: 'field' }, h('label', {}, 'Branch'), ghBranch),
          h('div', { class: 'field' }, h('label', {}, 'File path'), ghPath),
          h('div', { class: 'field full' }, h('label', {}, 'Token'), ghToken)
        ),
        h('div', { class: 'field-row', style: { marginTop: '10px' } },
          h('button', {
            class: 'btn small primary', type: 'button',
            onclick: function () {
              CS.saveGhSettings({
                owner: ghOwner.value.trim(),
                repo: ghRepo.value.trim() || 'customSchedule',
                branch: ghBranch.value.trim() || 'main',
                path: ghPath.value.trim() || 'data.js',
                token: ghToken.value.trim()
              });
              CS.toast('发布设置已保存到本机');
            }
          }, '保存发布设置'),
          h('button', {
            class: 'btn small ghost', type: 'button',
            onclick: function () {
              ghToken.value = '';
              CS.clearGhToken();
              CS.toast('已清除本机令牌');
            }
          }, '清除令牌')
        ),
        h('div', { class: 'gh-help' },
          '创建入口：',
          h('a', {
            href: 'https://github.com/settings/tokens?type=beta',
            target: '_blank',
            rel: 'noopener noreferrer'
          }, 'GitHub fine-grained tokens'),
          '。权限选择 ',
          h('code', {}, 'Contents: Read and write'),
          '，建议设置 90 天有效期。'
        )
      ),
      h('div', { class: 'settings-section' },
        h('h3', {}, '修改管理员口令'),
        h('div', { class: 'desc' }, '页面只保存哈希。生成后，把新哈希替换到 config.js 的 passwordHash，并重新发布 config.js。'),
        h('div', { class: 'form-grid' },
          h('div', { class: 'field' }, h('label', {}, '新口令'), pass1),
          h('div', { class: 'field' }, h('label', {}, '确认口令'), pass2)
        ),
        h('div', { class: 'field-row', style: { marginTop: '10px' } },
          h('button', {
            class: 'btn small', type: 'button',
            onclick: function () {
              var a = pass1.value;
              var b = pass2.value;
              if (a.length < 8) { CS.toast('口令至少 8 位', 'err'); return; }
              if (a !== b) { CS.toast('两次输入不一致', 'err'); return; }
              hashOut.value = CS.sha256Hex(a);
              CS.toast('已生成哈希，请复制并替换 config.js');
            }
          }, '生成哈希'),
          h('button', {
            class: 'btn small ghost', type: 'button',
            onclick: function () {
              if (!hashOut.value) return;
              copyText(hashOut.value);
            }
          }, '复制哈希')
        ),
        h('div', { class: 'hash-box' }, hashOut)
      ),
      h('div', { class: 'settings-section' },
        h('h3', {}, '数据'),
        h('div', { class: 'desc' }, '重新编号不会自动执行；确认预览后才会写入草稿。'),
        h('div', { class: 'field-row', style: { marginBottom: '10px' } },
          h('button', {
            class: 'btn small', type: 'button',
            onclick: CS.openRenumber
          }, '重新编号（预览）'),
          h('span', { class: 'hint' }, '按当前序号顺序重编为 1..N；筛选中的隐藏任务也会被重编。')
        ),
        h('div', { class: 'desc' }, '丢弃本机未发布草稿，或强制恢复为线上版本。'),
        h('div', { class: 'field-row' },
          h('button', {
            class: 'btn small danger', type: 'button',
            onclick: function () { CS.discardDraft(); CS.closeModal(); }
          }, '丢弃草稿并恢复线上数据'),
          h('button', {
            class: 'btn small ghost', type: 'button',
            onclick: function () { CS.closeModal(); CS.openImport(); }
          }, '导入 Excel')
        )
      )
    );

    function saveSettings() {
      readPhaseInputs();
      phaseError.textContent = '';

      var names = tempPhases.map(function (p) { return p.name.trim(); });
      if (names.some(function (n) { return !n; })) {
        phaseError.textContent = '阶段名称不能为空。';
        return;
      }
      var seen = Object.create(null);
      for (var i = 0; i < names.length; i++) {
        if (seen[names[i]]) { phaseError.textContent = '阶段名称不能重复：' + names[i]; return; }
        seen[names[i]] = true;
      }

      var rename = Object.create(null);
      tempPhases.forEach(function (p) {
        if (p.orig && p.name.trim() !== p.orig) rename[p.orig] = p.name.trim();
      });

      var moved = 0;
      state.data.tasks.forEach(function (t) {
        var next = rename[t.phase] || t.phase;
        if (names.indexOf(next) === -1) moved++;
      });
      if (moved) {
        if (!window.confirm('有 ' + moved + ' 条任务所属阶段已被删除，将被归入“未分类”。继续吗？')) return;
      }

      state.data.tasks.forEach(function (t) {
        var next = rename[t.phase] || t.phase;
        if (names.indexOf(next) === -1) next = '未分类';
        t.phase = next;
      });

      var finalNames = names.slice();
      if (state.data.tasks.some(function (t) { return t.phase === '未分类'; }) && finalNames.indexOf('未分类') === -1) {
        finalNames.push('未分类');
      }
      state.data.meta.phaseOrder = finalNames;

      CS.normalizeCurrent();
      CS.markDirty();
      CS.closeModal();
      CS.renderAll();
      CS.toast('设置已保存到草稿');
    }

    CS.openModal({
      title: '管理设置',
      sub: '项目信息、阶段、发布配置与口令。',
      wide: true,
      body: settingsBody,
      foot: [
        h('button', { class: 'btn', type: 'button', onclick: CS.closeModal }, '关闭'),
        h('button', { class: 'btn primary', type: 'button', onclick: saveSettings }, '保存项目设置')
      ]
    });
  };

  CS.openRenumber = function () {
    if (!state.admin) return;
    var tasks = state.data.tasks.slice().sort(function (a, b) {
      return (a.seq - b.seq) || a.start.localeCompare(b.start) || a.name.localeCompare(b.name);
    });
    if (!tasks.length) {
      CS.toast('没有任务需要重编号');
      return;
    }

    var changes = 0;
    var tbody = h('tbody');
    tasks.forEach(function (task, i) {
      var newSeq = i + 1;
      var changed = task.seq !== newSeq;
      if (changed) changes++;
      tbody.appendChild(h('tr', { class: changed ? 'changed' : '' },
        h('td', {}, String(task.seq)),
        h('td', {}, String(newSeq)),
        h('td', { title: task.name }, task.name)
      ));
    });

    var table = h('table', { class: 'renumber-table' },
      h('thead', {},
        h('tr', {},
          h('th', {}, '旧序号'),
          h('th', {}, '新序号'),
          h('th', {}, '工作任务')
        )
      ),
      tbody
    );

    var body = h('div', {},
      h('div', { class: 'publish-note' },
        '将重编全部 ' + tasks.length + ' 条任务，按当前序号升序分配 1..' + tasks.length + '。' +
        '筛选中的隐藏任务也会被重编；本次有 ' + changes + ' 条会变化。执行后进入草稿，发布后团队可见。'
      ),
      h('div', { class: 'renumber-wrap' }, table)
    );

    CS.openModal({
      title: '重新编号预览',
      sub: '只改显示序号，不改任务 ID；取消不会修改任何数据。',
      wide: true,
      body: body,
      foot: [
        h('button', { class: 'btn', type: 'button', onclick: CS.closeModal }, '取消'),
        h('button', {
          class: 'btn primary', type: 'button',
          onclick: function () {
            tasks.forEach(function (task, i) { task.seq = i + 1; });
            CS.normalizeCurrent();
            CS.markDirty();
            CS.closeModal();
            CS.renderAll();
            CS.toast('已重新编号，保存为草稿');
          }
        }, '确认重新编号')
      ]
    });
  };

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        CS.toast('已复制到剪贴板');
      }, function () {
        CS.toast('复制失败，请手动选择', 'err');
      });
    } else {
      CS.toast('当前浏览器不支持自动复制，请手动选择', 'err');
    }
  }
  CS.copyText = copyText;
})();