#!/usr/bin/env node
'use strict';

const assert = require('assert');
const P = require('../shared/parse.js');

let passed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ok  ' + name);
  } catch (err) {
    console.error('FAIL  ' + name);
    console.error(err && err.stack ? err.stack : err);
    process.exitCode = 1;
  }
}

console.log('shared/parse.js');

test('date parsing', () => {
  assert.strictEqual(P.toISODate('2026-11-06'), '2026-11-06');
  assert.strictEqual(P.toISODate('2026/11/6'), '2026-11-06');
  assert.strictEqual(P.toISODate('2026.11.6'), '2026-11-06');
  assert.strictEqual(P.toISODate('2026年11月6日'), '2026-11-06');
  assert.strictEqual(P.toISODate('20261106'), '2026-11-06');
  assert.strictEqual(P.toISODate(new Date(2026, 10, 6)), '2026-11-06');
  assert.strictEqual(P.toISODate(46332), '2026-11-06');
  assert.strictEqual(P.toISODate('2026-02-30'), null);
  assert.strictEqual(P.toISODate(''), null);
});

test('progress parsing', () => {
  assert.strictEqual(P.parseProgress(0).value, 0);
  assert.strictEqual(P.parseProgress(100).value, 100);
  assert.strictEqual(P.parseProgress('30%').value, 30);
  assert.strictEqual(P.parseProgress('30％').value, 30);
  assert.strictEqual(P.parseProgress(0.3).value, 30);
  assert.strictEqual(P.parseProgress('120').value, 100);
  assert.strictEqual(P.parseProgress('-5').value, 0);
  assert.strictEqual(P.parseProgress('abc').value, 0);
});

test('department splitting', () => {
  assert.deepStrictEqual(
    P.splitDepartments('科教处、院数字化工作专班，地调所,地灾防治所;城市所'),
    ['科教处', '院数字化工作专班', '地调所', '地灾防治所', '城市所']
  );
  assert.deepStrictEqual(P.splitDepartments('科教处、科教处'), ['科教处']);
});

test('8-column parse with warnings and gap filling', () => {
  const aoa = [
    ['深地科学与人工智能中试基地建设任务分解表'],
    [],
    ['序号', '工作任务', '责任部门', '启动时间', '完成时间', '进度（%）', '阶段', '备注'],
    [1, '任务A', '科教处、地调所', '2026-11-06', '2026-11-06', 100, '项目管理流程', '说明A'],
    [null, '任务B', '地灾所', '2026/11/7', '2026年11月20日', '30%', '基础环境建设', ''],
    [3, '任务C', '城市所', new Date(2026, 10, 8), '2026.11.9', 0.5, '主体功能建设', ''],
    [4, '', 'x', '2026-11-06', '2026-11-07', 10, '制度建设', ''],
    [5, '任务D', 'x', '2026-11-10', '2026-11-09', 120, '制度建设', '']
  ];

  const result = P.parseAoa(aoa, {
    defaultPhaseOrder: ['项目管理流程', '基础环境建设', '主体功能建设', '制度建设', '未分类']
  });

  assert.strictEqual(result.tasks.length, 4);
  assert.deepStrictEqual(result.tasks.map(t => t.name), ['任务A', '任务B', '任务C', '任务D']);
  assert.deepStrictEqual(result.tasks.map(t => t.seq), [1, 2, 3, 5]);
  assert.strictEqual(result.tasks[0].note, '说明A');
  assert.strictEqual(result.tasks[1].progress, 30);
  assert.strictEqual(result.tasks[2].progress, 50);
  assert.strictEqual(result.tasks[3].progress, 100);
  assert.deepStrictEqual(result.tasks[0].departments, ['科教处', '地调所']);
  assert.deepStrictEqual(result.phases, ['项目管理流程', '基础环境建设', '主体功能建设', '制度建设']);
  assert.ok(result.warnings.some(w => /任务名为空/.test(w.message)));
  assert.ok(result.warnings.some(w => /早于启动时间/.test(w.message)));
  assert.ok(result.warnings.some(w => /大于 100/.test(w.message)));
  assert.ok(result.warnings.some(w => /自动编号为 2/.test(w.message)));
});

test('7-column legacy parse uses note as phase', () => {
  const aoa = [
    ['序号', '工作任务', '责任部门', '启动时间', '完成时间', '进度（%）', '备注'],
    [1, '任务X', '科教处', '2026-11-06', '2026-11-07', 10, '项目管理流程'],
    [2, '任务Y', '地调所', '2026-11-06', '2026-11-07', 20, '']
  ];
  const result = P.parseAoa(aoa);
  assert.strictEqual(result.tasks.length, 2);
  assert.strictEqual(result.tasks[0].phase, '项目管理流程');
  assert.strictEqual(result.tasks[0].note, '');
  assert.strictEqual(result.tasks[1].phase, '未分类');
});

test('positional fallback when header is missing', () => {
  const aoa = [
    [1, '任务X', '科教处', '2026-11-06', '2026-11-07', 10, '项目管理流程', '']
  ];
  const result = P.parseAoa(aoa);
  assert.strictEqual(result.tasks.length, 1);
  assert.strictEqual(result.tasks[0].name, '任务X');
  assert.ok(result.warnings.some(w => /未识别到标准表头/.test(w.message)));
});

test('normalizeProject cleans and completes metadata', () => {
  const raw = {
    meta: { title: '测试项目', phaseOrder: ['阶段B'] },
    tasks: [
      {
        id: 't1', seq: 1, name: '任务A', departments: ['部门A'],
        start: '2026-11-06', end: '2026-11-07', progress: 120, phase: '阶段A'
      },
      {
        id: 't1', seq: 2, name: '任务B', departments: '部门B、部门C',
        owners: '张三、李四',
        start: '2026-11-06', end: '2026-11-07', progress: '50', phase: ''
      }
    ]
  };
  const { project, warnings } = P.normalizeProject(raw);
  assert.strictEqual(project.meta.title, '测试项目');
  assert.deepStrictEqual(project.meta.phaseOrder, ['阶段B', '阶段A', '未分类']);
  assert.strictEqual(project.tasks[0].progress, 100);
  assert.notStrictEqual(project.tasks[0].id, project.tasks[1].id);
  assert.deepStrictEqual(project.tasks[1].departments, ['部门B', '部门C']);
  assert.deepStrictEqual(project.tasks[1].owners, ['张三', '李四']);
  assert.strictEqual(project.tasks[1].phase, '未分类');
  assert.ok(warnings.length >= 1);
});

test('serializeProject produces a loadable data.js payload', () => {
  const project = {
    meta: { projectId: 'x', title: 'T', logo: '', updatedAt: '2026-11-20T00:00:00Z', version: 1, publishNote: '', phaseOrder: ['未分类'] },
    tasks: []
  };
  const text = P.serializeProject(project);
  assert.ok(text.indexOf('window.PROJECT_DATA =') !== -1);
  assert.ok(text.indexOf('\\u2028') === -1);
});

test('projectToAoa round-trips core fields', () => {
  const project = {
    meta: { projectId: 'x', title: 'T', logo: '', updatedAt: '2026-11-20T00:00:00Z', version: 1, publishNote: '', phaseOrder: ['阶段A'] },
    tasks: [{
      id: 't1', seq: 1, name: '任务A', departments: ['部门A', '部门B'],
      owners: ['张三', '李四'],
      start: '2026-11-06', end: '2026-11-07', progress: 30, phase: '阶段A', note: '备注'
    }]
  };
  const aoa = P.projectToAoa(project);
  assert.deepStrictEqual(aoa[0], ['序号', '工作任务', '责任部门', '责任人', '启动时间', '完成时间', '进度（%）', '阶段', '备注']);
  assert.deepStrictEqual(aoa[1], [1, '任务A', '部门A、部门B', '张三、李四', '2026-11-06', '2026-11-07', 30, '阶段A', '备注']);
});

test('9-column parse reads multiple owners', () => {
  const aoa = [
    ['序号', '工作任务', '责任部门', '责任人', '启动时间', '完成时间', '进度（%）', '阶段', '备注'],
    [1, '任务O', '科教处', '张三、李四', '2026-11-06', '2026-11-07', 30, '项目管理流程', '备注O']
  ];
  const result = P.parseAoa(aoa);
  assert.strictEqual(result.tasks.length, 1);
  assert.deepStrictEqual(result.tasks[0].owners, ['张三', '李四']);
  assert.strictEqual(result.tasks[0].note, '备注O');
  assert.strictEqual(result.tasks[0].departments[0], '科教处');
});

console.log('\n' + passed + ' tests passed' + (process.exitCode ? ' (with failures)' : ''));