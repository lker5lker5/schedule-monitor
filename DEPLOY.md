# 部署与发布说明

本页面没有后端、没有构建步骤，部署就是**把整个目录放到一个静态文件目录**。以下三种方式任选其一。

---

## 方式一：GitHub Pages（推荐先试）

### 1. 创建仓库

- 在 GitHub 创建 **public** 仓库，例如 `customSchedule`。
- 免费版 GitHub Pages 要求仓库公开。
- 不建议使用容易猜到的仓库名；页面同时有 `noindex` 与 `robots.txt`，但这不是访问控制。

### 2. 推送代码

```bash
git init
git add .
git commit -m "init project schedule board"
git branch -M main
git remote add origin https://github.com/<用户名>/customSchedule.git
git push -u origin main
```

### 3. 开启 Pages

仓库 → Settings → Pages：

- Source：`Deploy from a branch`
- Branch：`main`
- Folder：`/ (root)`
- Save

等待 1–2 分钟，访问：

```
https://<用户名>.github.io/customSchedule/
```

### 4. 更新数据

**方式 A：手动（无需令牌）**

1. 管理端 → 发布 → 下载 `data.js`；
2. 在 GitHub 仓库页面打开根目录 `data.js` → 编辑（铅笔图标）→ 粘贴/上传新内容 → Commit changes；
3. 回到管理端点击"标记为已发布"，清除本地草稿；
4. 等 Pages 构建完成（通常 1 分钟内），团队刷新即可。

> GitHub 网页上传文件：仓库页面 → Add file → Upload files → 选择 `data.js` → Commit changes。

**方式 B：一键发布**

1. 创建 fine-grained token：
   - 打开 <https://github.com/settings/tokens?type=beta>
   - Token name 任意；Expiration 建议 90 天；
   - Repository access：Only select repositories → 选择 `customSchedule`；
   - Permissions → Repository permissions → Contents：`Read and write`；
   - 生成并复制 token。
2. 管理端 → 设置 → GitHub 一键发布：
   - Owner：你的 GitHub 用户名
   - Repository：`customSchedule`
   - Branch：`main`
   - File path：`data.js`
   - Token：粘贴
   - 保存发布设置
3. 管理端 → 发布 → 一键发布。

令牌只保存在**当前浏览器 localStorage**，不会写入 `data.js`，不会进入仓库。更换电脑或清缓存后需要重新填写。

### 4.1 标题 / 部门表 / 责任人表

`title.js`、`departments.js` 和 `persons.js` 是**静态文件**，不在"一键发布 data.js"的范围内：

- 修改项目标题：编辑 `title.js` 的 `window.PROJECT_TITLE` → Commit；页面按时间戳加载该文件，刷新即可，通常不受缓存影响；
- 新增/改名/删除部门：编辑 `departments.js` → Commit；
- 新增/改名/删除责任人：编辑 `persons.js` → Commit；
- 任务里可以填写表外部门/姓名，表外值会保存在 `data.js` 里，一键发布会带上；
- 要让表外值成为正式候选，需再手动补进 `departments.js` / `persons.js`；
- 设置 → 部门表/责任人表可以复制列表或表外值为 JS 数组，方便粘贴。

### 5. 常见问题

- **页面没更新**：GitHub Pages 有短暂 CDN 缓存，等 1–2 分钟；强制刷新（Cmd/Ctrl+Shift+R）。
- **403/404**：token 没有该仓库 Contents 写权限，或 Owner/Repository 填错。
- **国内访问慢/打不开**：改用方式二（云服务器）或方式三（内网共享盘）。代码不需要改。

---

## 方式二：云服务器 + nginx

适合国内团队、已有服务器/域名的场景。仍然是纯静态，不需要 Node/PHP。

### 1. 上传

把整个目录上传到服务器，例如：

```
/var/www/customSchedule/
├─ index.html
├─ title.js
├─ data.js
├─ departments.js
├─ persons.js
├─ config.js
├─ ...
```

确保 nginx 运行用户可以读取：

```bash
sudo chown -R www-data:www-data /var/www/customSchedule
sudo find /var/www/customSchedule -type d -exec chmod 755 {} \;
sudo find /var/www/customSchedule -type f -exec chmod 644 {} \;
```

### 2. nginx 配置

```nginx
server {
    listen 80;
    server_name schedule.example.com;

    root /var/www/customSchedule;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    # 如需 HTTPS，用 certbot 或云厂商证书
    # listen 443 ssl;
    # ssl_certificate ...;
    # ssl_certificate_key ...;
}
```

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 3. 更新数据

管理端 → 发布 → 下载 `data.js` → 通过 SFTP/云控制台上传覆盖服务器上的 `data.js`。

> 服务器部署下，"一键发布到 GitHub"不适用（它提交到 GitHub）。可以把 GitHub Actions 作为中转，或直接手动上传；静态方案下这是最简单的做法。

---

## 方式三：内网共享盘 / 百度同步盘

适合不联网、团队在同一共享目录的场景。

1. 把整个目录放到共享盘，例如 `\\server\share\customSchedule\`。
2. 团队成员双击 `index.html` 打开。
3. 管理员发布 `data.js` 后，替换共享盘里的同名文件；同步盘会自动分发。

注意：

- `file://` 下不能使用 `fetch`，本项目已经用 `<script src="data.js">` 规避。
- 不同浏览器对 `file://` 的 `localStorage` 支持略有差异；建议使用 Chrome/Edge。
- `file://` 下 GitHub 一键发布可能受浏览器跨域限制；请使用"下载 + 替换"。
- 双击打开时，页面地址栏会显示本地路径；把带 `?admin=1` 的地址收藏即可。

---

## 发布流程速查

```
管理端登录
  → 编辑任务/阶段
  → 自动存草稿（本机）
  → 发布
      ├─ 下载 data.js → 替换线上文件 → 标记为已发布
      └─ 一键发布到 GitHub → 自动清除草稿
  → 团队刷新页面
```

## 发布文件说明

`data.js` 形如：

```js
/* customSchedule data — generated 2026-11-20T15:50:50.954Z */
window.PROJECT_DATA = {
  "meta": {
    "projectId": "deep-earth-ai-pilot",
    "title": "深地科学与人工智能中试基地建设任务分解表",
    "logo": "assets/logo.jpg",
    "updatedAt": "2026-11-20T15:50:50.953Z",
    "version": 1,
    "publishNote": "从 Excel 初始导入",
    "phaseOrder": ["项目管理流程", "基础环境建设", "主体功能建设", "制度建设"]
  },
  "tasks": [ ... ]
};
```

- 不要手动编辑 `data.js` 里的任务，除非你清楚格式；优先用管理端或 Excel 导入。
- `data.js` 里的 `meta.title` 只是元数据；页面显示标题以 `title.js` 为准。
- 备份：每次下载的文件可以按日期归档，形成简单历史。

## 安全检查清单

- [ ] 已修改 `config.js` 里的初始口令哈希
- [ ] `data.js` 中没有 GitHub token、密码等敏感信息
- [ ] `departments.js` / `persons.js` 已按当前项目维护并推送
- [ ] 仓库为 public 时，确认内容允许公网可见
- [ ] 已确认 `robots.txt` 与页面 `noindex` 存在
- [ ] GitHub token 仅授予单仓库 `Contents: Read and write`，设置了有效期
- [ ] 团队访问地址已通过真实网络测试（尤其是国内访问 GitHub Pages）