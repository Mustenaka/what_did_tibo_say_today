"use client";

import { useEffect, useMemo, useState } from "react";
import type { Activity, DashboardData, ResetAnalysisResult } from "../lib/types";

type Language = "zh" | "en";
type Filter = "all" | "original" | "interactions";
const copy = {
  zh: {
    appTitle: "Tibo 过去 7 天说了啥？",
    switchLabel: "切换为英文",
    switchText: "EN",
    rolling: "滚动 7 天",
    heroKicker: "TIBO 活动与互动观察",
    heroTitle: "过去七天，Tibo 释放了什么信号？",
    heroSummary: "追踪他的直接发言、回复、引用和转推，并判断 Tibo 是否正在靠近下一次全局额度重置。",
    role: "OpenAI 首席重置官",
    openProfile: "在 X 打开 Tibo 的主页",
    statsKicker: "7 天信号概览",
    statsTitle: "活动强度与互动构成",
    total: "全部活动",
    totalHint: "过去 7 个 UTC 自然日",
    originals: "直接发言",
    originalsHint: "Tibo 自己发布的内容",
    interactions: "与他人互动",
    activityShare: "占全部活动",
    rhythm: "每日节奏",
    directShort: "直接发言",
    interactionShort: "互动",
    mix: "互动方式",
    reply: "回复",
    quote: "引用",
    repost: "转推",
    timelineKicker: "公开时间线",
    timelineTitle: "逐条活动记录",
    itemCount: (count: number) => `${count} 条`,
    filterLabel: "筛选活动类型",
    all: "全部",
    originalOnly: "直接发言",
    interactionsOnly: "只看互动",
    viewOnX: "在 X 查看",
    mediaOnly: "这条活动只包含媒体内容。",
    empty: "当前筛选下没有活动记录。",
    radarKicker: "CODEX 重置雷达",
    radarTitle: "Tibo 再次重置可能性",
    analyzing: "正在比对重置信号",
    analyzingHint: "服务端只分析最近一次全局重置之后的新发言，并复用可追溯的 D1 快照。",
    analysisError: "分析暂时不可用",
    waiting: "等待足够的公开发言",
    currentSignal: "当前信号等级",
    reason: "分析依据",
    summary: "信号摘要",
    disclaimer: "娱乐性信号判断，不代表 OpenAI 官方信息",
    contextTitle: "重置感知基线",
    postResetSignals: "重置后信号",
    sinceLastReset: (date: string) => `窗口始于 ${date}`,
    weeklyProxy: "全球行动周期代理",
    weeklyProxyHint: "Tibo 行为参考，非个人 resetsAt",
    rapidRepeat: "24h 内先例",
    shortestRepeat: (hours: number | null) => hours === null ? "暂无可用间隔" : `最短 ${hours} 小时`,
    explicitOverride: "已识别明确重置承诺 / 信号",
    changesTitle: "自上次分析",
    firstAnalysis: "已建立首个可回溯分析基线",
    newSignals: (count: number) => `新增 ${count} 条重置后信号`,
    signalChanged: (from: string, to: string) => `等级由“${from}”变为“${to}”`,
    signalSteady: "信号等级保持不变",
    snapshotStale: "新数据分析失败，暂用上一份快照",
    snapshotAt: (date: string) => `快照生成于 ${date}`,
    personalKicker: "本机参考",
    personalTitle: "个人额度周期",
    personalNote: "这个时间只保存在当前浏览器，不参与 Tibo 行为判断，也不会上传到服务器。",
    personalLabel: "你的下次已知额度重置时间",
    personalEmpty: "填写账户显示的重置时间后，这里会显示个人倒计时。",
    personalRemaining: (hours: number) => hours < 1 ? "预计不足 1 小时" : `预计还有约 ${hours} 小时`,
    personalDue: "你填写的重置时间已经到达",
    personalClear: "清除",
    cadence: { low: "周期早段", rising: "逐步接近", high: "临近周窗口", due: "已到代理窗口", unknown: "周期未知" },
    resetHistoryKicker: "已核实事件",
    resetHistoryTitle: "重置历史",
    resetHistoryNote: "只收录 Tibo 明确宣布已执行或正在传播的额度重置；预告、玩笑和个人猜测不计入。",
    resetHistoryCount: (count: number) => `最近 ${count} 条`,
    resetHistoryEmpty: "尚未找到可核实的重置公告。",
    resetSource: "查看原始公告",
    effectiveTime: "有效时间",
    resetKinds: { global: "全局额度重置", banked: "可储存重置" },
    resetStatuses: { completed: "已执行", rolling_out: "传播中" },
    resetScopes: { paid_codex_chatgpt_work: "Codex + ChatGPT Work 付费用户", all_codex: "Codex 用户", targeted: "指定用户" },
    retry: "重试",
    dataError: "暂时无法获取公开活动，D1 中也没有可展示的历史记录。",
    structured: "结构化历史",
    storageLoading: "正在读取 Sites D1 活动库。",
    storageEmpty: "D1 已就绪，将从下一次成功抓取开始积累。",
    storageComplete: (count: number) => `D1 已保存 ${count} 条活动，观测历史已覆盖当前 7 天窗口。`,
    storageGrowing: (count: number, date: string) => `D1 已保存 ${count} 条活动；数据从 ${date} 开始继续积累。`,
    storageStale: (count: number) => `本次刷新失败，正在展示 D1 中已有的 ${count} 条历史活动。`,
    footer: "活动数据由 FxTwitter 提供，Nitter 降级 · D1 保存 · DeepSeek 分析",
    lastUpdated: "最后刷新",
    githubRepository: "项目源代码",
    loading: "正在接收公开信号",
    likelihood: {
      very_likely: "极有可能",
      likely: "有可能",
      unlikely: "不太可能",
      none: "暂无迹象",
      unknown: "无法判断",
    },
    types: { original: "直接发言", reply: "回复", quote: "引用", repost: "转推" },
  },
  en: {
    appTitle: "What did Tibo say in the last 7 days?",
    switchLabel: "Switch to Chinese",
    switchText: "中文",
    rolling: "Rolling 7 days",
    heroKicker: "TIBO ACTIVITY & INTERACTION WATCH",
    heroTitle: "What signals did Tibo send this week?",
    heroSummary: "Track his posts, replies, quotes, and reposts—and watch for clues that Tibo may trigger another global limit reset.",
    role: "OpenAI Chief Reset Officer",
    openProfile: "Open Tibo's profile on X",
    statsKicker: "7-DAY SIGNAL OVERVIEW",
    statsTitle: "Activity intensity and interaction mix",
    total: "All activity",
    totalHint: "Past 7 UTC calendar days",
    originals: "Original posts",
    originalsHint: "Words posted directly by Tibo",
    interactions: "Interactions",
    activityShare: "of all activity",
    rhythm: "Daily rhythm",
    directShort: "Original",
    interactionShort: "Interaction",
    mix: "Interaction mix",
    reply: "Replies",
    quote: "Quotes",
    repost: "Reposts",
    timelineKicker: "PUBLIC TIMELINE",
    timelineTitle: "Activity, item by item",
    itemCount: (count: number) => `${count} items`,
    filterLabel: "Filter activity type",
    all: "Everything",
    originalOnly: "Original posts",
    interactionsOnly: "Interactions only",
    viewOnX: "View on X",
    mediaOnly: "This activity contains media only.",
    empty: "No activity matches this filter.",
    radarKicker: "CODEX RESET RADAR",
    radarTitle: "Tibo reset likelihood",
    analyzing: "Comparing reset signals",
    analyzingHint: "The server analyzes only post-reset activity and reuses an auditable D1 snapshot.",
    analysisError: "Analysis is temporarily unavailable",
    waiting: "Waiting for enough public posts",
    currentSignal: "Current signal level",
    reason: "Reasoning",
    summary: "Signal summary",
    disclaimer: "An entertainment signal check, not official OpenAI information",
    contextTitle: "Reset-aware baseline",
    postResetSignals: "Post-reset signals",
    sinceLastReset: (date: string) => `Window starts ${date}`,
    weeklyProxy: "Global-action cadence",
    weeklyProxyHint: "Tibo behavior proxy, not personal resetsAt",
    rapidRepeat: "≤24h precedents",
    shortestRepeat: (hours: number | null) => hours === null ? "No interval available" : `Shortest ${hours}h`,
    explicitOverride: "Explicit reset commitment / signal detected",
    changesTitle: "Since the previous analysis",
    firstAnalysis: "First auditable analysis baseline created",
    newSignals: (count: number) => `${count} new post-reset signal${count === 1 ? "" : "s"}`,
    signalChanged: (from: string, to: string) => `Level changed from “${from}” to “${to}”`,
    signalSteady: "Signal level is unchanged",
    snapshotStale: "New-data analysis failed; using the previous snapshot",
    snapshotAt: (date: string) => `Snapshot generated ${date}`,
    personalKicker: "ON-DEVICE REFERENCE",
    personalTitle: "Personal quota cycle",
    personalNote: "This time stays in this browser. It is not uploaded or used to judge Tibo's behavior.",
    personalLabel: "Your next known quota reset time",
    personalEmpty: "Enter the reset time shown for your account to see a personal countdown.",
    personalRemaining: (hours: number) => hours < 1 ? "Estimated in under 1 hour" : `About ${hours} hours remaining`,
    personalDue: "The reset time you entered has arrived",
    personalClear: "Clear",
    cadence: { low: "Early in cycle", rising: "Getting closer", high: "Near weekly window", due: "Proxy window reached", unknown: "Unknown cycle" },
    resetHistoryKicker: "VERIFIED EVENTS",
    resetHistoryTitle: "Reset history",
    resetHistoryNote: "Only explicit announcements that a reset was completed or propagating are included. Teasers, jokes, and guesses are excluded.",
    resetHistoryCount: (count: number) => `${count} latest`,
    resetHistoryEmpty: "No verifiable reset announcements yet.",
    resetSource: "Open source post",
    effectiveTime: "Effective time",
    resetKinds: { global: "Usage-limit reset", banked: "Banked reset" },
    resetStatuses: { completed: "Completed", rolling_out: "Rolling out" },
    resetScopes: { paid_codex_chatgpt_work: "Paid Codex + ChatGPT Work", all_codex: "Codex users", targeted: "Selected users" },
    retry: "Retry",
    dataError: "Public activity sources are unavailable and D1 has no history to display yet.",
    structured: "Structured history",
    storageLoading: "Reading the Sites D1 activity store.",
    storageEmpty: "D1 is ready and will start accumulating after the next successful fetch.",
    storageComplete: (count: number) => `D1 holds ${count} activities and covers the current 7-day window.`,
    storageGrowing: (count: number, date: string) => `D1 holds ${count} activities and will keep growing from ${date}.`,
    storageStale: (count: number) => `This refresh failed; showing ${count} activities already stored in D1.`,
    footer: "Activity via FxTwitter, Nitter fallback · Stored in D1 · Analysis by DeepSeek",
    lastUpdated: "Last refreshed",
    githubRepository: "Project source",
    loading: "Receiving public signals",
    likelihood: {
      very_likely: "Very likely",
      likely: "Likely",
      unlikely: "Unlikely",
      none: "No signs yet",
      unknown: "Unknown",
    },
    types: { original: "Original post", reply: "Reply", quote: "Quote", repost: "Repost" },
  },
} as const;

const markers: Record<Activity["type"], string> = {
  original: "T",
  reply: "↩",
  quote: "“",
  repost: "↻",
};

function padDate(value?: string) {
  if (!value) return "--.--";
  const [, month, day] = value.split("-");
  return `${month}.${day}`;
}

export function TiboDashboard() {
  const [language, setLanguage] = useState<Language>("zh");
  const [filter, setFilter] = useState<Filter>("all");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dataError, setDataError] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [analysis, setAnalysis] = useState<ResetAnalysisResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState(false);
  const [personalResetAt, setPersonalResetAt] = useState("");
  const [loadedAt] = useState(() => Date.now());
  const t = copy[language];

  async function runAnalysis() {
    setAnalysis(null);
    setAnalysisLoading(true);
    setAnalysisError(false);
    try {
      const response = await fetch("/api/analyze", { cache: "no-store" });
      if (!response.ok) throw new Error("analysis failed");
      setAnalysis(await response.json());
    } catch {
      setAnalysisError(true);
    } finally {
      setAnalysisLoading(false);
    }
  }

  async function loadActivities() {
    setDataLoading(true);
    setDataError(false);
    try {
      const response = await fetch("/api/activities/recent", { cache: "no-store" });
      if (!response.ok) throw new Error("activity fetch failed");
      const next = await response.json() as DashboardData;
      setDashboard(next);
      void runAnalysis();
    } catch {
      setDataError(true);
    } finally {
      setDataLoading(false);
    }
  }

  useEffect(() => {
    // Initial data hydration intentionally synchronizes the client with the Worker API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadActivities();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem("tibo-personal-reset-at") || "";
    // Browser-only preference; it is intentionally not authoritative product data.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPersonalResetAt(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    document.title = language === "zh"
      ? "Tibo Signal Desk · 过去 7 天说了啥？"
      : "Tibo Signal Desk · The last 7 days";
  }, [language]);

  const filteredActivities = useMemo(() => {
    const activities = dashboard?.activities || [];
    if (filter === "original") return activities.filter((item) => item.type === "original");
    if (filter === "interactions") return activities.filter((item) => item.type !== "original");
    return activities;
  }, [dashboard, filter]);

  const dailyMax = Math.max(1, ...(dashboard?.daily || []).map((day) => day.total));
  const share = dashboard?.stats.total
    ? Math.round((dashboard.stats.interactions / dashboard.stats.total) * 100)
    : 0;
  const resetContext = analysis?.context || dashboard?.resetContext;
  const personalReset = useMemo(() => {
    const time = new Date(personalResetAt).getTime();
    if (!personalResetAt || !Number.isFinite(time)) return null;
    return { hoursRemaining: Math.max(0, Math.ceil((time - loadedAt) / 3_600_000)), due: time <= loadedAt };
  }, [loadedAt, personalResetAt]);
  const storageNote = dataLoading
    ? t.storageLoading
    : !dashboard?.coverage.storedCount
      ? t.storageEmpty
      : dashboard.lastRefreshSucceeded === false || dashboard.stale
        ? t.storageStale(dashboard.coverage.storedCount)
        : dashboard.coverage.complete
          ? t.storageComplete(dashboard.coverage.storedCount)
          : t.storageGrowing(dashboard.coverage.storedCount, dashboard.coverage.oldestDay || "—");

  function formatDate(value: string) {
    try {
      return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value));
    } catch {
      return "";
    }
  }

  function weekday(value: string) {
    return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en", { weekday: "short", timeZone: "UTC" })
      .format(new Date(`${value}T12:00:00Z`));
  }

  function savePersonalReset(value: string) {
    setPersonalResetAt(value);
    if (value) window.localStorage.setItem("tibo-personal-reset-at", value);
    else window.localStorage.removeItem("tibo-personal-reset-at");
  }

  function likelihoodLabel(value: ResetAnalysisResult["likelihood"]) {
    return t.likelihood[value] || t.likelihood.unknown;
  }

  return (
    <>
      <a className="skip-link" href="#main-content">{language === "zh" ? "跳到主要内容" : "Skip to main content"}</a>
      <div className="app-shell">
        <div className="site-container">
          <header className="site-header">
            <a className="brand" href="#main-content" aria-label={t.appTitle}>
              <span className="brand-dot" aria-hidden="true" />
              <span>TIBO / SIGNAL DESK</span>
            </a>
            <div className="header-actions">
              <span className="window-chip"><i aria-hidden="true" />{t.rolling}</span>
              <button className="language-button" aria-label={t.switchLabel} onClick={() => setLanguage(language === "zh" ? "en" : "zh")}>
                {t.switchText}
              </button>
            </div>
          </header>

          <main id="main-content">
            <section className="hero" aria-labelledby="hero-title">
              <div className="hero-rings" aria-hidden="true" />
              <div className="hero-copy">
                <p className="hero-kicker">{t.heroKicker}</p>
                <h1 id="hero-title">{t.heroTitle}</h1>
                <p className="hero-summary">{t.heroSummary}</p>
                <a className="profile-pill" href="https://x.com/thsottiaux" target="_blank" rel="noreferrer">
                  <img src="/tibo.png" alt="" />
                  <span><strong>Tibo</strong><small>@thsottiaux · {t.role}</small></span>
                  <b aria-hidden="true">↗</b>
                  <span className="sr-only">{t.openProfile}</span>
                </a>
              </div>
              <div className="window-card" aria-label="7 day UTC window">
                <span>WINDOW / 07</span>
                <div><strong>{padDate(dashboard?.range.start)}</strong><i /><strong>{padDate(dashboard?.range.end)}</strong></div>
                <small>UTC</small>
              </div>
            </section>

            <div className="content-grid">
              <div className="primary-column">
                <section className="stats-panel card-surface" aria-labelledby="stats-title">
                  <div className="section-heading-row">
                    <div><p className="section-kicker">{t.statsKicker}</p><h2 id="stats-title" className="section-title">{t.statsTitle}</h2></div>
                    <span className="range-label">{dashboard?.range.start || "—"} → {dashboard?.range.end || "—"}</span>
                  </div>
                  {dataError ? (
                    <div className="error-state"><p>{t.dataError}</p><button onClick={() => void loadActivities()}>{t.retry}</button></div>
                  ) : (
                    <>
                      <div className="metric-grid" aria-busy={dataLoading}>
                        <article className="metric-card metric-total"><span>{t.total}</span><strong>{dataLoading ? "—" : dashboard?.stats.total || 0}</strong><small>{t.totalHint}</small></article>
                        <article className="metric-card"><span>{t.originals}</span><strong>{dataLoading ? "—" : dashboard?.stats.originals || 0}</strong><small>{t.originalsHint}</small></article>
                        <article className="metric-card metric-interactions"><span>{t.interactions}</span><strong>{dataLoading ? "—" : dashboard?.stats.interactions || 0}</strong><small>{share}% {t.activityShare}</small></article>
                      </div>
                      <div className="stats-detail-grid">
                        <div className="rhythm-panel">
                          <div className="detail-title-row"><h3>{t.rhythm}</h3><div className="legend"><span className="legend-original">{t.directShort}</span><span className="legend-interaction">{t.interactionShort}</span></div></div>
                          <div className="bar-chart" role="img" aria-label={t.rhythm}>
                            {(dashboard?.daily || Array.from({ length: 7 }, (_, index) => ({ date: `2026-08-0${index + 3}`, total: 0, original: 0, reply: 0, quote: 0, repost: 0 }))).map((day) => {
                              const interaction = day.reply + day.quote + day.repost;
                              return (
                                <div className="day-column" key={day.date}>
                                  <span className="day-total">{dataLoading ? "·" : day.total}</span>
                                  <div className="bar-track">
                                    <span className="bar-empty" />
                                    <span className="bar-interaction" style={{ height: `${(interaction / dailyMax) * 100}%` }} />
                                    <span className="bar-original" style={{ height: `${(day.original / dailyMax) * 100}%`, bottom: `${(interaction / dailyMax) * 100}%` }} />
                                  </div>
                                  <time>{weekday(day.date)}</time>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <div className="mix-panel"><h3>{t.mix}</h3>{[
                          [t.reply, dashboard?.stats.replies || 0, "reply"],
                          [t.quote, dashboard?.stats.quotes || 0, "quote"],
                          [t.repost, dashboard?.stats.reposts || 0, "repost"],
                        ].map(([label, count, kind]) => (
                          <div className="mix-row" key={String(kind)}><div><span>{label}</span><strong>{dataLoading ? "—" : count}</strong></div><div className="mix-track"><i className={`mix-${kind}`} style={{ width: `${dashboard?.stats.interactions ? (Number(count) / dashboard.stats.interactions) * 100 : 0}%` }} /></div></div>
                        ))}</div>
                      </div>
                    </>
                  )}
                </section>

                <section className="activity-section" aria-labelledby="activity-title">
                  <div className="section-heading-row"><div><p className="section-kicker">{t.timelineKicker}</p><h2 id="activity-title" className="section-title">{t.timelineTitle}</h2></div>{!dataLoading && <span className="result-count">{t.itemCount(filteredActivities.length)}</span>}</div>
                  <div className="filter-row" role="group" aria-label={t.filterLabel}>
                    {(["all", "original", "interactions"] as Filter[]).map((value) => (
                      <button key={value} className={filter === value ? "active" : ""} aria-pressed={filter === value} onClick={() => setFilter(value)}>
                        {value === "all" ? t.all : value === "original" ? t.originalOnly : t.interactionsOnly}
                      </button>
                    ))}
                  </div>
                  <div className="activity-list" aria-live="polite">
                    {dataLoading ? Array.from({ length: 3 }, (_, index) => <div className="activity-skeleton card-surface" key={index}><span /><span /><span /></div>) : filteredActivities.length ? filteredActivities.map((activity) => (
                      <article className={`activity-card card-surface activity-${activity.type}`} key={activity.id}>
                        <div className="activity-marker" aria-hidden="true">{markers[activity.type]}</div>
                        <div className="activity-body"><div className="activity-meta"><span>{t.types[activity.type]}</span>{activity.targetHandle && <b>@{activity.targetHandle}</b>}<time dateTime={activity.publishedAt}>{formatDate(activity.publishedAt)}</time></div><p>{activity.text || t.mediaOnly}</p><a href={activity.link} target="_blank" rel="noreferrer">{t.viewOnX}<b aria-hidden="true">↗</b></a></div>
                      </article>
                    )) : !dataError ? <div className="empty-state card-surface">∅ <span>{t.empty}</span></div> : null}
                  </div>
                </section>
              </div>

              <aside className="analysis-column" aria-label={t.radarTitle}>
                <section className="analysis-card">
                  <div className="analysis-header"><div><p>{t.radarKicker}</p><h2>{t.radarTitle}</h2></div><span className="radar-mark"><i /></span></div>
                  <div className="analysis-body">
                    {analysisLoading ? <div className="analysis-state"><div className="signal-loader"><i /><i /><i /><i /></div><strong>{t.analyzing}</strong><p>{t.analyzingHint}</p></div>
                      : analysisError ? <div className="analysis-state"><strong>{t.analysisError}</strong><button onClick={() => void runAnalysis()}>{t.retry}</button></div>
                      : analysis ? <>
                        <span className="signal-label">{t.currentSignal}</span>
                        <strong className={`likelihood likelihood-${analysis.likelihood}`}>{likelihoodLabel(analysis.likelihood)}</strong>
                        <div className="signal-meter"><i /><i /><i /><i /></div>
                        {analysis.keywords?.length ? <div className="keyword-list">{analysis.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}</div> : null}
                        {analysis.reason && <div className="analysis-copy"><h3>{t.reason}</h3><p>{analysis.reason}</p></div>}
                        {analysis.summary && <div className="analysis-copy"><h3>{t.summary}</h3><p>{analysis.summary}</p></div>}
                        {analysis.snapshot && <div className="analysis-delta" aria-live="polite">
                          <div><span>{t.changesTitle}</span>{analysis.snapshot.stale && <b>{t.snapshotStale}</b>}</div>
                          <strong>{analysis.delta?.previousLikelihood
                            ? analysis.delta.likelihoodChanged
                              ? t.signalChanged(likelihoodLabel(analysis.delta.previousLikelihood), likelihoodLabel(analysis.likelihood))
                              : t.signalSteady
                            : t.firstAnalysis}</strong>
                          <p>{t.newSignals(analysis.delta?.newActivityCount || 0)} · {t.snapshotAt(formatDate(analysis.snapshot.generatedAt))}</p>
                        </div>}
                      </>
                      : <div className="analysis-state"><strong>{t.waiting}</strong></div>}
                    {resetContext && <div className="reset-context-panel">
                      <div className="reset-context-heading"><strong>{t.contextTitle}</strong>{resetContext.explicitPostResetSignal && <span>{t.explicitOverride}</span>}</div>
                      <div className="reset-context-grid">
                        <article><span>{t.postResetSignals}</span><strong>{resetContext.postResetActivityCount}</strong><small>{t.sinceLastReset(formatDate(resetContext.analysisWindowStart || ""))}</small></article>
                        <article><span>{t.weeklyProxy}</span><strong>{resetContext.weeklyProgressPercent ?? "—"}%</strong><small>{t.cadence[resetContext.cadencePressure]} · {t.weeklyProxyHint}</small></article>
                        <article><span>{t.rapidRepeat}</span><strong>{resetContext.rapidRepeatCount30d}</strong><small>{t.shortestRepeat(resetContext.shortestIntervalHours)}</small></article>
                      </div>
                    </div>}
                  </div>
                  <p className="analysis-disclaimer">{t.disclaimer}</p>
                </section>
                <section className="personal-cycle-card card-surface" aria-labelledby="personal-cycle-title">
                  <div className="personal-cycle-header"><p>{t.personalKicker}</p><h2 id="personal-cycle-title">{t.personalTitle}</h2></div>
                  <p id="personal-cycle-note">{t.personalNote}</p>
                  <label htmlFor="personal-reset-at">{t.personalLabel}</label>
                  <div className="personal-cycle-control">
                    <input
                      id="personal-reset-at"
                      type="datetime-local"
                      value={personalResetAt}
                      aria-describedby="personal-cycle-note personal-cycle-result"
                      onChange={(event) => savePersonalReset(event.target.value)}
                    />
                    {personalResetAt && <button type="button" onClick={() => savePersonalReset("")}>{t.personalClear}</button>}
                  </div>
                  <div id="personal-cycle-result" className="personal-cycle-result" aria-live="polite">
                    {personalReset ? <><strong>{personalReset.due ? t.personalDue : t.personalRemaining(personalReset.hoursRemaining)}</strong><span>{formatDate(personalResetAt)}</span></> : <span>{t.personalEmpty}</span>}
                  </div>
                </section>
                <section className="reset-history-card card-surface" aria-labelledby="reset-history-title">
                  <div className="reset-history-header">
                    <div><p>{t.resetHistoryKicker}</p><h2 id="reset-history-title">{t.resetHistoryTitle}</h2></div>
                    <span>{t.resetHistoryCount(dashboard?.resetHistory.length || 0)}</span>
                  </div>
                  <p className="reset-history-note">{t.resetHistoryNote}</p>
                  {dashboard?.resetHistory.length ? (
                    <ol className="reset-history-list">
                      {dashboard.resetHistory.map((reset) => (
                        <li key={reset.id}>
                          <div className="reset-event-topline">
                            <time dateTime={reset.effectiveAt} title={t.effectiveTime}>{formatDate(reset.effectiveAt)}</time>
                            <span className={`reset-status reset-status-${reset.status}`}>{t.resetStatuses[reset.status]}</span>
                          </div>
                          <strong>{t.resetKinds[reset.kind]}</strong>
                          <small>{t.resetScopes[reset.scope]}</small>
                          <p>{reset.evidenceText}</p>
                          <a href={reset.evidenceUrl} target="_blank" rel="noreferrer">{t.resetSource}<b aria-hidden="true">↗</b></a>
                        </li>
                      ))}
                    </ol>
                  ) : <div className="reset-history-empty">{dataLoading ? t.loading : t.resetHistoryEmpty}</div>}
                </section>
                <div className="data-note card-surface"><span>DB</span><div><h3>{t.structured}</h3><p>{storageNote}</p></div></div>
              </aside>
            </div>
          </main>
          <footer className="site-footer">
            <div className="footer-copy">
              <span>{t.footer}</span>
              {dashboard?.fetchedAt && <span>{t.lastUpdated} {formatDate(dashboard.fetchedAt)}</span>}
            </div>
            <a
              className="github-link"
              href="https://github.com/Mustenaka/what_did_tibo_say_today"
              target="_blank"
              rel="noreferrer"
              aria-label={`${t.githubRepository}: https://github.com/Mustenaka/what_did_tibo_say_today`}
            >
              <span>{t.githubRepository}</span>
              <strong>github.com/Mustenaka/what_did_tibo_say_today</strong>
              <b aria-hidden="true">↗</b>
            </a>
          </footer>
        </div>
      </div>
    </>
  );
}
