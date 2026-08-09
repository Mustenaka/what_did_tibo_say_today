# 免费、无需 X 登录的数据源评估

评估日期：2026-08-09。目标是获取公开账号本人的发言，以及该账号回复别人时产生的沟通消息，并能够结构化统计。

| 方案 | 无需 X 登录 | 本人发言 | 本人回复 | 结构化 | 实测结论 |
| --- | --- | --- | --- | --- | --- |
| FxTwitter API v2 | 是 | 是 | 是 | JSON | **当前主方案**。`/2/profile/{handle}/statuses?with_replies=1` 可翻页，`replying_to` 提供对象；Tibo 7 天真实请求成功。 |
| X 官方嵌入时间线 | 是 | 是 | 不保证 | HTML/组件 | 适合直接展示，不适合统计；服务器端接口有较低限流，回复覆盖没有当前公开保证。 |
| Nitter `with_replies` RSS | 是 | 是 | 是 | RSS | 设计上满足，但公共实例实测常见 403、挑战页、404 或 RSS 白名单，只保留为降级。 |
| RSSHub Twitter route | 用户无需登录，但实例端可能要凭据 | 理论支持 | 当前不稳定 | RSS | 官方文档仍列出路由，但公共 demo 对 Tibo 实测跳转到 404，不作为运行来源。 |
| Twiiit | 是 | 取决于 Nitter | 取决于 Nitter | 重定向 | 只是随机选择 Nitter 实例，并非独立数据源，继承相同故障。 |
| X API v2 | 否（需开发者凭据） | 是 | 是 | JSON | 官方且字段稳定，但不满足“免费且无需登录/Key”。 |

## 当前选择：FxTwitter 主源 + Nitter 降级

选择 FxTwitter 的原因：

1. 公共 API 不需要 X Cookie、OAuth 或项目 API Key。
2. `with_replies=1` 能返回 Tibo 的回复及其对话上下文；程序只保留作者或转推者为 `thsottiaux` 的 status。
3. 回复通过 `replying_to.screen_name` 和 `replying_to.status` 提供沟通对象与上游消息。
4. 引用通过 `quote` 提供，被转推内容通过 `reposted_by` 识别。
5. API 提供游标，可继续翻页直到 7 天窗口起点。

项目把来源封装在 `activity-source.js` 后面；未来如果 FxTwitter 政策或接口变化，可以添加新适配器而不修改 SQLite 和前端数据契约。

## 真实数据验证

2026-08-09 本地调用 FxTwitter 三页后覆盖 2026-08-03 至 2026-08-09。通过 `/api/activities/recent` 写入内存 SQLite 后得到：

- 49 条 Tibo 活动
- 7 条原创
- 34 条回复
- 8 条引用
- 0 条转推

抽样回复正确去掉了开头的 @mention，同时保存目标账号，例如 `ryanbrewer`、`scaling01` 和 `alexgetmancom`。

## 风险

FxTwitter 是第三方公共服务，没有可用性 SLA，也可能受 X 接口变化影响。上线前应保留 SQLite 历史、请求超时、失败回退和来源状态提示；公开流量下还应缓存抓取结果，避免每位访问者都触发三页上游请求。

参考：

- FxTwitter API：<https://api.fxtwitter.com/2/openapi.json>
- FxEmbed API 文档：<https://github.com/FxEmbed/FxEmbed/blob/main/docs/src/content/docs/api/introduction.mdx>
- X 官方嵌入时间线：<https://help.x.com/en/using-x/embed-x-feed>
- Nitter：<https://github.com/zedeus/nitter>
- RSSHub Twitter route：<https://rsshub-doc.pages.dev/en/usage>
