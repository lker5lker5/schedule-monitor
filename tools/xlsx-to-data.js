#!/usr/bin/env node
'use strict';

/*
 * Convert an Excel task table into data.js.
 *
 * Usage:
 *   node tools/xlsx-to-data.js <input.xlsx> [output.js] [--title "..."] [--project-id "..."] [--logo "assets/logo.jpg"]
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('../vendor/xlsx.full.min.js');
const P = require('../shared/parse.js');

const DEFAULT_PHASES = ['项目管理流程', '基础环境建设', '主体功能建设', '制度建设'];

function usage() {
  console.error('用法: node tools/xlsx-to-data.js <input.xlsx> [output.js] [--title "..."] [--project-id "..."] [--logo "assets/logo.jpg"]');
}

function parseArgs(argv) {
  const opts = { positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--title') opts.title = argv[++i];
    else if (arg === '--project-id') opts.projectId = argv[++i];
    else if (arg === '--logo') opts.logo = argv[++i];
    else if (arg === '--help' || arg === '-h') opts.help = true;
    else opts.positional.push(arg);
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
if (opts.help || opts.positional.length === 0) {
  usage();
  process.exit(opts.help ? 0 : 1);
}

const input = path.resolve(opts.positional[0]);
const output = path.resolve(opts.positional[1] || path.join(__dirname, '..', 'data.js'));
const title = opts.title || path.basename(input, path.extname(input));
const projectId = opts.projectId || 'default';
const logo = opts.logo || 'assets/logo.jpg';

if (!fs.existsSync(input)) {
  console.error('找不到文件: ' + input);
  process.exit(1);
}

const workbook = XLSX.read(fs.readFileSync(input), { type: 'buffer', cellDates: true });
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(sheet, {
  header: 1,
  raw: true,
  defval: null,
  blankrows: false
});

const parsed = P.parseAoa(rows, { defaultPhaseOrder: DEFAULT_PHASES });
const project = P.buildProject(parsed, {
  projectId,
  title,
  logo,
  version: 1,
  publishNote: '从 Excel 初始导入'
});

const normalized = P.normalizeProject(project);
const text = P.serializeProject(normalized.project);
fs.writeFileSync(output, text, 'utf8');

console.log('已生成: ' + output);
console.log('工作表: ' + sheetName);
console.log('任务: ' + normalized.project.tasks.length + ' 条');
console.log('阶段: ' + normalized.project.meta.phaseOrder.join(' / '));

if (parsed.warnings.length) {
  console.log('\n警告 (' + parsed.warnings.length + '):');
  parsed.warnings.forEach(w => {
    console.log('  第 ' + w.row + ' 行: ' + w.message);
  });
}

if (normalized.warnings.length) {
  console.log('\n规范化警告 (' + normalized.warnings.length + '):');
  normalized.warnings.forEach(w => console.log('  ' + w));
}