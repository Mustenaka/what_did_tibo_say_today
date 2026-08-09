# ChatGPT Sites 迁移可行性

## 结论

可以迁移，而且这个项目很适合 Sites：它是一个单页数据看板，只需要服务器端抓取、一个关系型数据表和一个外部 AI API。Sites 官方支持从兼容的现有项目创建托管 Web 应用，并用 D1 保存需要跨访问持久化的结构化记录。

当前代码还不是可直接发布的 Sites 工程。主要差异不是 UI，而是运行时：本项目后端是常驻 Express 进程，并通过 Node `node:sqlite` 写本地文件；Sites 要求 Cloudflare Worker 兼容 ESM 输出，持久数据应写入平台提供的 D1。

官方说明：<https://learn.chatgpt.com/docs/sites>

## 可以原样保留的部分

- Vue 页面、双语文案和响应式样式
- `/api/activities/recent` 的返回数据契约
- FxTwitter / Nitter 字段标准化与活动分类规则
- DeepSeek 提示词、响应 JSON 结构与前端重置雷达
- SQLite 表字段和查询思路（D1 同样基于 SQLite）

## 必须调整的部分

1. **运行时入口**：将 Express 路由迁移到 Sites 推荐工程的服务器端路由或 Worker `fetch` handler，输出 Worker 兼容 ESM。
2. **数据库适配**：把 `DatabaseSync` 调用替换为 `env.DB.prepare(...).bind(...).run()/all()`，schema 放到 `db/schema.ts` 并生成 D1 migration。
3. **绑定配置**：在 Sites 初始化/发布流程中让 `.openai/hosting.json` 声明逻辑 D1 绑定（通常为 `DB`）。真实 `project_id` 由 Sites 创建项目后写入，不能预先伪造。
4. **密钥**：在 Sites 设置中配置 `DEEPSEEK_API_KEY`、`DEEPSEEK_BASE_URL` 和可选 `NITTER_INSTANCES`；密钥不能写入仓库或 manifest。
5. **抓取新鲜度**：当前为“访问时刷新”。低流量站点会出现采样空档；如果需要连续、完整的历史，应增加一个受保护的刷新端点，并由外部定时任务或平台支持的调度能力定期调用。

## 推荐的 D1 schema

可以沿用当前两张表：

- `activities`：活动主表，status ID 主键；类型为 `original | reply | quote | repost`。
- `fetch_runs`：刷新日志，记录来源、时间、条数、成功状态和错误。

常用查询仍是“最近 7 天按发布时间倒序”与“按日期 + 类型聚合”，因此保留 `published_at` 和 `(day, type)` 两个索引即可。

## 风险与取舍

- **最大风险是数据源，不是 Sites**：FxTwitter 与 Nitter 都依赖 X 的非官方上游，没有可用性 SLA。部署前应保留回退，并考虑正式数据源。
- **访问量会放大抓取**：当前每次页面加载都会刷新；公开部署前应增加短期服务端缓存或按最后成功刷新时间跳过重复抓取。
- **外部 API 成本与密钥**：页面每次加载都自动运行 DeepSeek 会放大调用量。公开站点建议缓存最近一次分析，或只在活动集合变化时重新分析。
- **公开测试版限制**：Sites 的可用性与存储额度受套餐、地区和工作区设置影响，发布前要在当前账号中确认。

## 推荐迁移顺序

1. 先保持本次本地版本运行，观察 FxTwitter 数据质量并积累一周。
2. 把存储接口改成异步 repository API，让本地 SQLite 与 D1 可以分别实现同一契约。
3. 创建 Sites 兼容工程和 D1 migration，迁移 API 后运行部署构建。
4. 在私有部署中验证 FxTwitter 出站请求、Nitter 回退、DeepSeek 密钥、幂等写入与 7 天聚合。
5. 再决定是否公开，并为重置分析增加缓存。
