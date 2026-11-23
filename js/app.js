/* ============================================================
 * customSchedule — boot and global events
 * ============================================================ */
(function () {
  'use strict';

  var CS = window.CS;
  var h = CS.h;
  var state = CS.state;

  function cacheRefs() {
    var ids = [
      'appHeader', 'brand', 'brandLogoWrap', 'brandLogo', 'brandTitle',
      'updatedAt', 'adminHint', 'kpiGrid', 'toolbar', 'searchInput',
      'searchClear', 'filterButtons', 'toolbarRight', 'adminBar', 'board',
      'footerNote', 'drawerBackdrop', 'taskDrawer', 'modalBackdrop', 'modal',
      'tooltip', 'toast'
    ];
    ids.forEach(function (id) {
      CS.refs[id] = document.getElementById(id);
    });
  }

  function fatal(message) {
    document.body.innerHTML = '';
    var box = h('div', { class: 'fatal' },
      h('strong', { style: { display: 'block', fontSize: '16px', marginBottom: '8px' } }, '无法加载项目数据'),
      h('div', {}, message),
      h('div', { style: { marginTop: '12px', fontSize: '12px', color: '#991B1B' } },
        '请确认 data.js、config.js、shared/parse.js、js/ 目录与 index.html 位于同一站点目录下。'
      )
    );
    document.body.appendChild(box);
  }

  CS.init = function () {
    cacheRefs();

    if (!CS.P) {
      fatal('缺少 shared/parse.js，数据解析模块未加载。');
      return;
    }
    if (!window.PROJECT_DATA) {
      fatal('缺少 data.js，或 data.js 中没有 window.PROJECT_DATA。');
      return;
    }

    var normalized;
    try {
      normalized = CS.P.normalizeProject(window.PROJECT_DATA, {
        projectId: CS.CFG.projectId,
        title: CS.TITLE,
        logo: CS.CFG.logo,
        today: new Date()
      });
      // title.js 是标题的唯一来源，忽略 data.js 里可能残留的旧标题。
      normalized.project.meta.title = CS.TITLE;
    } catch (e) {
      fatal('data.js 格式错误：' + (e && e.message ? e.message : e));
      return;
    }

    state.published = normalized.project;
    state.data = CS.clone(state.published);

    if (normalized.warnings.length) {
      console.warn('[customSchedule] data warnings:', normalized.warnings);
    }

    state.admin = CS.hasAdminSession();
    if (state.admin) CS.loadDraftForAdmin();
    else state.data = CS.clone(state.published);

    CS.readURL();
    CS.loadCollapsed();
    bindEvents();
    CS.renderAll();

    if (state.draftInfo && state.draftInfo.stale) {
      CS.toast('检测到基于旧版本的草稿，请核对后再发布', 'err');
    }

    console.info('[customSchedule] ready — ' + state.data.tasks.length + ' tasks, v' + state.data.meta.version);
  };

  function bindEvents() {
    var refs = CS.refs;

    refs.brandLogo.addEventListener('error', function () {
      refs.brandLogoWrap.hidden = true;
    });

    var brandClicks = 0;
    var brandTimer = null;
    refs.brand.addEventListener('click', function () {
      brandClicks++;
      clearTimeout(brandTimer);
      brandTimer = setTimeout(function () { brandClicks = 0; }, 1600);
      if (brandClicks >= (CS.CFG.admin.clickCount || 5)) {
        brandClicks = 0;
        if (state.admin) CS.openSettings();
        else CS.openLogin();
      }
    });

    refs.adminHint.addEventListener('click', function () {
      if (state.admin) CS.logout();
      else CS.openLogin();
    });

    var doSearch = CS.debounce(function () {
      state.filters.q = refs.searchInput.value;
      refs.searchClear.hidden = !state.filters.q;
      CS.renderBoard();
      CS.updateFilterSummary();
      CS.writeURL();
    }, 180);

    refs.searchInput.addEventListener('input', function () {
      refs.searchClear.hidden = !refs.searchInput.value;
      doSearch();
    });

    refs.searchClear.addEventListener('click', function () {
      state.filters.q = '';
      refs.searchInput.value = '';
      refs.searchClear.hidden = true;
      CS.renderBoard();
      CS.updateFilterSummary();
      CS.writeURL();
      refs.searchInput.focus();
    });

    document.addEventListener('click', function (e) {
      if (!state.openFilter) return;
      if (e.target.closest('.filter-wrap')) return;
      state.openFilter = null;
      CS.renderFilterButtons();
    });

    refs.modalBackdrop.addEventListener('click', CS.closeModal);
    refs.drawerBackdrop.addEventListener('click', CS.closeDrawer);

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (refs.modal && !refs.modal.hidden) {
        CS.closeModal();
      } else if (refs.taskDrawer && !refs.taskDrawer.hidden) {
        CS.closeDrawer();
      } else if (state.openFilter) {
        state.openFilter = null;
        CS.renderFilterButtons();
      }
    });

    var lastMobile = window.matchMedia('(max-width: 767px)').matches;
    var onResize = CS.debounce(function () {
      var mobile = window.matchMedia('(max-width: 767px)').matches;
      if (mobile !== lastMobile) {
        lastMobile = mobile;
        if (!state.viewExplicit) {
          state.view = mobile ? 'cards' : 'gantt';
          if (state.view === 'gantt') state.scrollToToday = true;
          CS.renderBoard();
          CS.writeURL();
        }
      }
    }, 180);
    window.addEventListener('resize', onResize);

    window.addEventListener('beforeunload', function (e) {
      if (state.admin && state.dirty) {
        CS.saveDraftNow();
        e.preventDefault();
        e.returnValue = '';
      }
    });

    bindTooltip();
  }

  function bindTooltip() {
    var board = CS.refs.board;
    var tip = CS.refs.tooltip;

    function show(target, x, y) {
      CS.clear(tip);
      tip.appendChild(h('div', { class: 't-title', text: target.dataset.tipTitle || '' }));
      if (target.dataset.tipMeta) {
        tip.appendChild(h('div', { class: 't-meta', text: target.dataset.tipMeta }));
      }
      tip.hidden = false;
      requestAnimationFrame(function () { tip.classList.add('show'); });
      position(x, y);
    }

    function position(x, y) {
      var pad = 14;
      var rect = tip.getBoundingClientRect();
      var left = x + pad;
      var top = y + pad;
      if (left + rect.width > window.innerWidth - 8) left = x - rect.width - pad;
      if (top + rect.height > window.innerHeight - 8) top = y - rect.height - pad;
      tip.style.left = Math.max(8, left) + 'px';
      tip.style.top = Math.max(8, top) + 'px';
    }

    function hide() {
      tip.classList.remove('show');
      setTimeout(function () {
        if (!tip.classList.contains('show')) tip.hidden = true;
      }, 120);
    }

    board.addEventListener('mouseover', function (e) {
      var target = e.target.closest('[data-tip-title]');
      if (target) show(target, e.clientX, e.clientY);
    });

    board.addEventListener('mousemove', function (e) {
      if (!tip.hidden) position(e.clientX, e.clientY);
    });

    board.addEventListener('mouseout', function (e) {
      var target = e.target.closest('[data-tip-title]');
      if (target && !target.contains(e.relatedTarget)) hide();
    });

    window.addEventListener('scroll', hide, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', CS.init);
  } else {
    CS.init();
  }
})();