/*
 * customSchedule — 站点配置
 *
 * 管理员口令只保存 SHA-256 哈希，不保存明文。
 * 修改口令：页面进入管理模式 → 设置 → 修改口令 → 生成哈希，
 * 然后把下面的 passwordHash 替换为新值并重新发布 config.js。
 */
window.APP_CONFIG = {
  projectId: 'deep-earth-ai-pilot',
  title: '深地科学与人工智能中试基地建设任务分解表',
  logo: 'assets/logo.jpg',

  admin: {
    // 管理员口令的 SHA-256 哈希（不保存明文）
    passwordHash: 'e92627378027c10c0fa4689e11c7a8f3effc7851ce3e07d045a625e3ad43fc40',
    hiddenParam: 'admin',
    clickCount: 5,
    maxAttempts: 5,
    lockSeconds: 30
  },

  github: {
    owner: '',
    repo: 'customSchedule',
    branch: 'main',
    path: 'data.js'
  },

  defaults: {
    zoom: 'week',
    view: 'gantt',
    group: 'phase'
  }
};