# Tibo Signal Desk

一个单页 Web 仪表盘，追踪 [Tibo（@thsottiaux）](https://x.com/thsottiaux) 过去 7 天在 X 上的公开活动，并通过 DeepSeek 判断这些发言是否包含 Codex / GPT Work 额度重置信号。

## 当前功能

- 统计滚动 7 天内的直接发言、回复、引用和转推
- 显示每日活动趋势与互动类型构成
- 将抓取结果幂等写入本地 SQLite，逐次补全历史
- 使用 DeepSeek 分析 Tibo 自己的发言、回复和引用；纯转推不会被错误归因为 Tibo 的原话
- 中文 / 英文切换、响应式布局、键盘焦点与减少动画支持
- 主数据源暂时不可用时自动回退，并优先展示已存储的历史数据

## 技术结构

| 层级 | 技术 |
| --- | --- |
| 前端 | Vue 3 + Vite + vue-i18n |
| 后端 | Express.js（Node.js 22.13+） |
| 数据源 | FxTwitter API v2（主）+ Nitter `with_replies` RSS（降级） |
| 结构化存储 | Node 原生 SQLite |
| AI | DeepSeek Chat Completions API |

```text
client/                    Vue 单页应用
server/
  routes/api.js            7 天活动与分析 API
  services/fxtwitter.js    FxTwitter 翻页、互动分类与字段标准化
  services/nitter.js       Nitter RSS 降级数据源
  services/activity-source.js  数据源回退编排
  services/storage.js      SQLite schema、幂等写入与 7 天聚合
  services/deepseek.js     Codex 重置信号判断
  test/activity.test.js    分类与聚合关键路径测试
docs/
  sites-migration.md       ChatGPT Sites 迁移可行性与边界
```

## 本地运行

### 1. 环境变量

复制 `server/.env.example` 为 `server/.env`，至少填写 DeepSeek Key：

```dotenv
DEEPSEEK_API_KEY=your_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com
PORT=3001
DATA_DB_PATH=data/tibo-activity.sqlite
ACTIVITY_SOURCES=fxtwitter,nitter
FXTWITTER_BASE_URL=https://api.fxtwitter.com
X_HANDLE=thsottiaux
NITTER_INSTANCES=https://nitter.net,https://nitter.poast.org,https://nitter.privacyredirect.com,https://nitter.tiekoetter.com
```

默认先使用无需 X 登录或 API Key 的 FxTwitter 公共 API，失败后再依次尝试 `NITTER_INSTANCES`。可通过 `ACTIVITY_SOURCES` 调整或关闭来源。不要提交真实密钥。

### 2. 安装并启动

```bash
cd server
npm install
npm run dev
```

另开终端：

```bash
cd client
npm install
npm run dev
```

访问 `http://localhost:5173`。

### 3. 验证

```bash
cd server && npm test
cd client && npm run build
```

## API

| 端点 | 方法 | 说明 |
| --- | --- | --- |
| `/api/activities/recent` | GET | 刷新公开数据源，写入 SQLite，并返回过去 7 天统计与活动 |
| `/api/tweets/today` | GET | 旧客户端兼容别名；返回同一份 7 天数据模型 |
| `/api/tweets/analyze` | POST | 对传入的 Tibo 发言运行重置可能性判断 |

`/api/activities/recent` 的主要返回字段：

```json
{
  "range": { "days": 7, "start": "2026-08-03", "end": "2026-08-09" },
  "stats": {
    "total": 12,
    "originals": 4,
    "interactions": 8,
    "replies": 5,
    "quotes": 1,
    "reposts": 2
  },
  "daily": [],
  "activities": [],
  "coverage": { "oldestDay": "2026-08-03", "storedCount": 12, "complete": true }
}
```

## SQLite 数据模型

`activities` 使用 X status ID 作为主键，保存标准化文本、发布时间、日期、活动类型、互动对象、作者、链接、数据来源与抓取时间；同一条活动重复抓取时更新而不是重复插入。`fetch_runs` 保存每次刷新成功或失败的状态，便于判断数据新鲜度。

索引围绕实际查询建立：`published_at` 支持 7 天窗口查询，`(day, type)` 支持每日分类聚合。

## 数据边界

- “互动”当前指回复、引用和转推。点赞是轻量行为，不作为沟通消息统计。
- FxTwitter 会带 `with_replies=1` 按游标翻页到 7 天边界，并过滤对话上下文中不是 Tibo 发布的消息。
- FxTwitter 与 Nitter 都是第三方非官方来源，可能因 X 上游变化而失效；SQLite 和多来源回退只能提高可用性，不能提供 SLA。
- 实测 2026-08-09，FxTwitter 能一次覆盖完整 7 天；Nitter 公共实例仍普遍受到 403、反爬或 RSS 白名单限制。
- 统计按 UTC 自然日计算，范围为今天及之前 6 天。

当前方案对比见 [docs/x-data-sources.md](docs/x-data-sources.md)。

## ChatGPT Sites

这个产品形态可以部署到 ChatGPT Sites，并可用 D1 保存结构化历史；但当前 Express + `node:sqlite` 不能原样发布。需要将服务入口改为 Cloudflare Worker 兼容 ESM，并把存储实现替换为 Sites 的 D1 绑定。完整迁移拆解见 [docs/sites-migration.md](docs/sites-migration.md)。

## License

MIT
