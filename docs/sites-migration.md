# ChatGPT Sites 迁移记录

## 结论

项目已经完成 Sites 迁移。根目录使用 Vinext 输出 Cloudflare Worker 兼容 ESM；页面保持原有单页信号看板，公开活动写入 Sites 管理的 D1，DeepSeek 密钥通过托管环境变量提供。

官方说明：<https://learn.chatgpt.com/docs/sites>

## 已保留的产品行为

- 双语文案、响应式视觉与活动筛选
- `/api/activities/recent` 的返回数据契约
- FxTwitter / Nitter 字段标准化与活动分类规则
- DeepSeek 提示词、响应 JSON 结构与前端重置雷达
- SQLite 表字段和查询思路（D1 同样基于 SQLite）

## 已完成的运行时调整

1. Express 路由已迁移到 `/app/api/**`，由 Vinext Worker 执行。
2. `node:sqlite` 已替换为异步 D1 prepared statements；schema 位于 `db/schema.ts`，迁移文件保存在 `drizzle/`。
3. `.openai/hosting.json` 声明 `DB` 绑定并由 Sites 管理真实数据库。
4. DeepSeek 与数据源配置保存在 Sites 环境变量中，不进入仓库或 manifest。
5. 访问时抓取增加 10 分钟 D1 新鲜度缓存；抓取失败时继续展示已保存历史。

## 推荐的 D1 schema

当前使用三张表：

- `activities`：活动主表，status ID 主键；类型为 `original | reply | quote | repost`。
- `fetch_runs`：刷新日志，记录来源、时间、条数、成功状态和错误。
- `reset_events`：长期保存已核实的全局或可储存重置事件、状态、覆盖对象与来源证据。

普通活动查询仍是“最近 7 天按发布时间倒序”与“按日期 + 类型聚合”，因此保留 `published_at` 和 `(day, type)` 两个索引；重置历史使用 `announced_at` 索引。概率分析窗口从最近一次全局重置之后开始，普通活动的 30 天清理不会删除独立保存的重置事件。

## 风险与取舍

- **最大风险是数据源，不是 Sites**：FxTwitter 与 Nitter 都依赖 X 的非官方上游，没有可用性 SLA。部署前应保留回退，并考虑正式数据源。
- **低流量采样空档**：当前由访问触发刷新并缓存 10 分钟；如果需要连续历史，后续可增加定时刷新机制。
- **外部 API 成本与密钥**：页面每次加载都自动运行 DeepSeek 会放大调用量。公开站点建议缓存最近一次分析，或只在活动集合变化时重新分析。
- **公开测试版限制**：Sites 的可用性与存储额度受套餐、地区和工作区设置影响，发布前要在当前账号中确认。

## 后续可选优化

1. 在私有生产环境观察 FxTwitter 出站请求、D1 幂等写入与 7 天聚合。
2. 如需连续历史，增加定时刷新机制。
3. 如需公开分享，再单独调整 Sites 访问范围；默认保持仅所有者可访问。
4. 进一步把最近一次 DeepSeek 分析结果写入 D1，只在活动集合变化时重算。
