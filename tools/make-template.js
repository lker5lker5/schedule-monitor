#!/usr/bin/env node
'use strict';

/*
 * Generate templates/任务分解表模板.xlsx
 * Usage: node tools/make-template.js
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('../vendor/xlsx.full.min.js');

const out = path.resolve(__dirname, '..', 'templates', '任务分解表模板.xlsx');
fs.mkdirSync(path.dirname(out), { recursive: true });

const rows = [
  ['序号', '工作任务', '责任部门', '责任人', '启动时间', '完成时间', '进度（%）', '阶段', '备注'],
  [1, '示例任务（请替换）', '科教处、地调所', '张三、李四', '2026-11-06', '2026-11-20', 50, '项目管理流程', '示例备注，可留空'],
  [2, '示例任务二（请替换）', '院数字化工作专班', '王五', '2026-12-01', '2026-12-31', 0, '主体功能建设', '']
];

const ws = XLSX.utils.aoa_to_sheet(rows);
ws['!cols'] = [
  { wch: 6 }, { wch: 52 }, { wch: 32 }, { wch: 20 }, { wch: 12 },
  { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 30 }
];
ws['!freeze'] = { xSplit: 0, ySplit: 1 };

const info = XLSX.utils.aoa_to_sheet([
  ['字段', '填写说明'],
  ['序号', '显示序号，建议从 1 开始连续编号；缺失时会自动编号。'],
  ['工作任务', '必填，任务名称。'],
  ['责任部门', '多个部门用顿号（、）、逗号或分号分隔。'],
  ['责任人', '多个责任人用顿号（、）、逗号或分号分隔；可留空。'],
  ['启动时间', '推荐格式 YYYY-MM-DD；也支持 2026/11/6、2026年11月6日。'],
  ['完成时间', '格式同上；不能早于启动时间。日期按自然日计算，包含首尾两天。'],
  ['进度（%）', '0 = 未开始；1–99 = 进行中（填写估算完成度）；100 = 已完成。'],
  ['阶段', '用于甘特图分组。建议使用固定阶段，例如：项目管理流程、基础环境建设、主体功能建设、制度建设。'],
  ['备注', '可选，显示在任务详情中。'],
  ['', ''],
  ['提示', '网页端导入时会按表头名称识别列，列顺序可以调整；责任人、备注列可以删除。'],
  ['提示', '不要在两列表头之间插入合并单元格；表头上方可以有标题行，但不要有空表头。']
]);
info['!cols'] = [{ wch: 14 }, { wch: 86 }];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, '任务分解表');
XLSX.utils.book_append_sheet(wb, info, '填写说明');

const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
fs.writeFileSync(out, buf);
console.log('已生成: ' + out);