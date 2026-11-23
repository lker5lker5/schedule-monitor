# customSchedule — 项目进度甘特看板

一个**纯静态**的项目进度看板：团队打开网页即可查看整体进度、阶段、责任部门、责任人、逾期风险；单人管理员可登录后调整进度、增删任务、导入/导出 Excel 并发布更新。

- 无后端、无构建步骤、无 CDN
- 数据来自 `data.js`，由 Excel 导入生成
- 项目标题来自 `title.js`，换项目只需改这一行
- 可原样部署到 GitHub Pages、云服务器 nginx 或内网共享目录
- 当前项目：深地科学与人工智能中试基地建设任务分解表
- 培训资料：`docs/用户操作手册.md`（同目录提供可打印的 `.html` 与 `.pdf`，含 13 张操作截图）

## 快速开始

直接用浏览器打开 `index.html` 即可（`file://` 协议可用）。

也可以启动一个本地静态服务预览：

```bash
python3 -m http.server 8765
# 浏览器打开 http://127.0.0.1:8765/
```

## 管理员

- 入口：网址后加 `?admin=1`，点击右上角"管理"；或连续点击页头 logo/标题 5 次。
- 初始口令由管理员设置，仓库中只保存 SHA-256 哈希，不保存明文；首次登录前请向项目管理员获取。
- 修改口令：登录 → 设置 → 修改管理员口令 → 生成哈希 → 替换 `config.js` 里的 `passwordHash` → 重新发布 `config.js`。
- 会话保存在 `sessionStorage`，关闭标签页失效；未发布草稿保存在本机 `localStorage`。

> **安全边界**：纯前端口令只能防止误操作，不能防止懂技术的人绕过。真正的控制点是"谁有权替换线上 `data.js` / 谁持有 GitHub 发布令牌"。

## 数据流

```
Excel（任务分解表）
   │ 首次导入 / 管理端"导入 Excel"
   ▼
data.js  ◀── 管理端编辑（草稿）──▶ 发布（下载或 GitHub 提交）
   │
   ▼
index.html 读取 window.PROJECT_DATA 渲染
```

- 首次数据由 `tools/xlsx-to-data.js` 从 Excel 生成。
- 之后**网页是唯一数据源**：管理员在网页里改进度、任务、阶段、责任人；Excel 只用于初始导入或导出汇报，避免双轨。
- `departments.js` / `persons.js` 是**手工维护的候选表**，页面只读；任务里可以出现表外值，表外值会随任务保存在 `data.js`，但不会自动写回这两个文件。
- 发布后团队看到的新数据取决于是否替换了线上 `data.js`；`departments.js` / `persons.js` 修改后需要单独提交/推送。

## 项目标题

- 根目录 `title.js` 里的 `window.PROJECT_TITLE` 是**唯一来源**。
- 页头标题、浏览器标签、管理设置中的标题、发布后的 `data.js` 都读取这个值。
- 管理设置里的标题为**只读**；要改标题，直接编辑 `title.js`，刷新页面即可，推送到线上后团队生效。
- `title.js` 与 `data.js` 一样按时间戳加载，避免 CDN/浏览器缓存旧标题。
- `config.js` 的 `title` 仅作旧版兼容回退，不再保存实际标题。

## Excel 格式

标准 9 列：

```
序号 | 工作任务 | 责任部门 | 责任人 | 启动时间 | 完成时间 | 进度（%） | 阶段 | 备注
```

- 责任人、备注列可以缺失；阶段列也缺失时，会把"备注"当作阶段（兼容旧模板）。
- 列顺序可以调整，按表头名称识别。
- 进度：`0 = 未开始`，`1–99 = 进行中`，`100 = 已完成`。
- 责任部门、责任人都支持多个值，用顿号、逗号或分号分隔。
- 日期支持 `2026-11-06`、`2026/11/6`、`2026.11.6`、`2026年11月6日`。

模板：`templates/任务分解表模板.xlsx`（含示例与填写说明）。

## 部门表与责任人表

- `departments.js`：部门候选表，初始包含当前 8 个部门，按使用次数排序；手工编辑、提交/推送。
- `persons.js`：责任人候选表，初始为空数组；姓名由管理员手工填写、提交/推送。
- 页面只读取这两个文件，不会自动修改。
- 任务里可以填写不在表中的部门/姓名：会显示为**表外**（黄色标记），并随任务保存在 `data.js`；不会自动写回文件。
- 设置 → 部门表/责任人表：只读展示表内/表外值和使用次数，并提供"复制完整列表"/"复制表外值"，方便粘贴回文件。

## 管理端功能

- 新增 / 编辑 / 删除任务
- 序号自动分配（取最小空号，只读）；设置 → 数据 → "重新编号"（预览后手动执行）
- 进度滑杆与快捷按钮（0/25/50/75/100）
- 责任部门、责任人：可搜索多选标签；支持从候选表选择、输入表外值、批量粘贴
- 阶段新增、重命名、排序、删除（任务迁移到"未分类"前会确认）
- 导入 Excel：预览 + 校验报告 + 确认覆盖（表外部门/责任人会提示）
- 导出 Excel：当前数据导出为 9 列模板 + 填写说明
- 筛选栏：责任部门、责任人搜索/多选，显示任务数
- 草稿自动保存（本机），刷新/重新登录可恢复
- 发布：
  - **手动**：下载 `data.js`，替换仓库/服务器文件
  - **GitHub 一键**：配置 fine-grained token 后直接提交到仓库

## 发布到 GitHub Pages

1. 在 GitHub 创建 **public** 仓库，例如 `customSchedule`。
2. 把本目录所有文件推到 `main` 分支。
3. 仓库 Settings → Pages → Build and deployment → Deploy from a branch → `main` / `/ (root)`。
4. 访问 `https://<你的用户名>.github.io/customSchedule/`。

更新数据：

- 管理端 → 发布 → 下载 `data.js` → 在 GitHub 网页替换根目录 `data.js` → 提交。
- 或在 设置 中填 Owner / Repository / Branch / Token，使用"一键发布"。

令牌要求：fine-grained token，仅授权该仓库 `Contents: Read and write`，建议 90 天有效期。令牌只保存在本机浏览器，不会写入 `data.js`。

详见 [DEPLOY.md](DEPLOY.md)。

## 复用其他项目

1. 复制整个目录，改名（例如 `project-b-gantt`）。
2. 用新项目的 Excel 覆盖导入：
   - 打开页面 → `?admin=1` 登录 → 导入 Excel；或
   - `node tools/xlsx-to-data.js 新项目.xlsx data.js --title "新项目名称" --project-id "project-b"`
3. 修改 `title.js` 的项目标题；修改 `config.js` 的 `projectId`、`logo`（可选），并替换管理员口令哈希。
4. 按新项目维护 `departments.js` / `persons.js`；替换 `assets/logo.jpg`（可选）。
5. 部署到新的静态目录/仓库。

模板和解析逻辑不变；阶段、部门、责任人、任务数量都从数据中读取。

## 命令行工具

```bash
# 从 Excel 生成 data.js
node tools/xlsx-to-data.js 路径/任务分解表.xlsx data.js \
  --title "项目名称" --project-id "project-id" --logo "assets/logo.jpg"

# 生成 Excel 模板
node tools/make-template.js

# 解析模块单元测试
node tools/test-parse.js
```

> `xlsx-to-data.js` 的 `--title` 只写入 `data.js` 的元数据；页面显示标题始终以 `title.js` 为准。

## 文件结构

```
customSchedule/
├─ index.html
├─ styles.css
├─ title.js         项目标题（唯一来源，换项目只改这里）
├─ config.js
├─ data.js
├─ departments.js   部门候选表（手工维护）
├─ persons.js       责任人候选表（手工维护）
├─ js/
│  ├─ util.js       工具、日期、状态、存储、SHA-256
│  ├─ gantt.js      甘特与卡片渲染
│  ├─ render.js     页面、KPI、筛选、详情
│  ├─ picker.js     部门/责任人可搜索多选组件
│  ├─ admin.js      登录、任务编辑、设置
│  ├─ publish.js    Excel 导入导出、发布
│  └─ app.js        启动与全局事件
├─ shared/
│  └─ parse.js      浏览器/Node 共用的 Excel 解析
├─ vendor/
│  └─ xlsx.full.min.js
├─ assets/
│  └─ logo.jpg
├─ tools/
│  ├─ xlsx-to-data.js
│  ├─ make-template.js
│  └─ test-parse.js
├─ templates/
│  └─ 任务分解表模板.xlsx
├─ docs/
│  ├─ PRD.md
│  ├─ 用户操作手册.md
│  ├─ 用户操作手册.html
│  ├─ 用户操作手册.pdf
│  └─ images/            培训截图
├─ README.md
├─ DEPLOY.md
└─ robots.txt
```

## 已知限制

- 纯静态页面没有真正的服务端鉴权与审计日志。
- 公网部署时，任何拿到链接的人都能看到内容；页面使用 `noindex` + `robots.txt`，但不是访问控制。
- 没有记录实际完成日期，因此无法区分"按期完成"和"逾期完成"。
- GitHub Pages 在国内可能访问不稳定；代码与托管解耦，可原样迁移到云服务器或内网。
- 管理员草稿保存在浏览器本机，清缓存/换设备会丢失；请及时发布。

## 浏览器支持

最新 Chrome / Edge / Safari / Firefox。不支持 IE。

## 许可

- 本项目代码可自由用于内部项目管理。
- `vendor/xlsx.full.min.js` 为 SheetJS Community Edition，Apache-2.0 许可。