/*
 * customSchedule — 项目标题（唯一来源）
 *
 * 复用本项目时，只改这一行即可：
 * 页面页头、浏览器标签、管理设置、发布后的 data.js 都会使用这个标题。
 *
 * 注意：不要在这里写 HTML；支持纯文本。
 */
window.PROJECT_TITLE = '深地科学与人工智能中试基地建设任务分解表';

// 让浏览器标签尽早显示项目标题（页面渲染后还会再同步一次）。
if (typeof document !== 'undefined' && window.PROJECT_TITLE) {
  document.title = window.PROJECT_TITLE;
}