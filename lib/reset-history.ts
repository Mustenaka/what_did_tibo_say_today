import type { Activity, ResetEvent, ResetEventScope } from "./types";

type StoredResetEvent = ResetEvent & { discoveredAt: string; activityId: string | null };

const event = (
  id: string,
  announcedAt: string,
  kind: ResetEvent["kind"],
  status: ResetEvent["status"],
  scope: ResetEventScope,
  evidenceText: string,
): StoredResetEvent => ({
  id,
  announcedAt,
  day: announcedAt.slice(0, 10),
  kind,
  status,
  scope,
  evidenceText,
  evidenceUrl: `https://x.com/thsottiaux/status/${id}`,
  source: "tibo_x",
  discoveredAt: "2026-08-09T00:00:00.000Z",
  activityId: id,
});

// Confirmed public announcements found in Tibo's timeline. The dashboard only
// renders the newest rows, while D1 keeps the complete verified event series.
export const CURATED_RESET_EVENTS: StoredResetEvent[] = [
  event("2086188036493344823", "2026-08-08T20:29:22.000Z", "global", "completed", "paid_codex_chatgpt_work", "To celebrate this, together with the fact that I'm not going anywhere... I have reset usage limits for all paid users of ChatGPT Work and Codex."),
  event("2083395449814229287", "2026-08-01T03:32:37.000Z", "global", "completed", "paid_codex_chatgpt_work", "To celebrate a week of efficiency and let you run 100’000 Luna threads this weekend... I have reset usage limits for Codex and ChatGPT Work."),
  event("2082317452755751098", "2026-07-29T04:09:02.000Z", "global", "completed", "paid_codex_chatgpt_work", "Hello people of Sol! I've reset usage limits for all ChatGPT Work and Codex users."),
  event("2081940052154933696", "2026-07-28T03:09:23.000Z", "global", "completed", "paid_codex_chatgpt_work", "Back at the laptop. The usage limits have been reset for all paid users of Codex and ChatGPT Work."),
  event("2081096447718723984", "2026-07-25T19:17:12.000Z", "global", "completed", "paid_codex_chatgpt_work", "We have reset usage limits for all Codex and ChatGPT Work users."),
  event("2078320950488297917", "2026-07-18T03:28:22.000Z", "global", "completed", "paid_codex_chatgpt_work", "Oops... I did it again. Enjoy reset usage limits for all paid users for Codex and ChatGPT Work."),
  event("2077607697487188198", "2026-07-16T04:14:09.000Z", "global", "rolling_out", "paid_codex_chatgpt_work", "Another reset for our Codex and ChatGPT Work users. Should have that sweet 100% weekly usage limit back in a few minutes."),
  event("2077114635308986427", "2026-07-14T19:34:54.000Z", "global", "rolling_out", "paid_codex_chatgpt_work", "We are once again resetting the usage limits for all."),
  event("2076735790567338203", "2026-07-13T18:29:31.000Z", "banked", "completed", "paid_codex_chatgpt_work", "We have added a banked reset to everyone's account to celebrate the milestone."),
  event("2076418567143408112", "2026-07-12T21:28:59.000Z", "banked", "completed", "targeted", "Added a banked reset to 500k users of ChatGPT Work and Codex."),
  event("2076365965915467978", "2026-07-12T17:59:57.000Z", "global", "rolling_out", "paid_codex_chatgpt_work", "We hit 6M active users, and are landing a usage reset in the next hour."),
  event("2075820987833274448", "2026-07-11T05:54:25.000Z", "global", "rolling_out", "paid_codex_chatgpt_work", "Introducing... another usage limit reset for all our ChatGPT Work and Codex users. Should land over next 30 minutes."),
  event("2075641131002700120", "2026-07-10T17:59:43.000Z", "global", "completed", "paid_codex_chatgpt_work", "Hello beautiful people! We have reset usage limits across Codex and ChatGPT Work."),
  event("2075330198887940337", "2026-07-09T21:24:11.000Z", "global", "rolling_out", "paid_codex_chatgpt_work", "Enjoy a full reset of your usage limits for ChatGPT Work and Codex. Propagating in the next hour."),
  event("2071740419030053227", "2026-06-29T23:39:41.000Z", "global", "rolling_out", "all_codex", "Codex usage limits will be fully reset again in the next hour and we will credit one additional reset into your bank."),
  event("2071381664853319742", "2026-06-28T23:54:07.000Z", "global", "completed", "all_codex", "As we are still investigating, I have reset everyone's Codex usage limits."),
  event("2070653282440405046", "2026-06-26T23:39:48.000Z", "global", "rolling_out", "all_codex", "We are giving all Codex users a usage reset on the house. Should be showing in your accounts in the next few hours."),
  event("2067399435009622521", "2026-06-18T00:10:10.000Z", "banked", "completed", "all_codex", "We did a sneaky double reset. Not only do you get a full reset on us. But you are also getting one into the reset bank."),
  event("2062329981548802523", "2026-06-04T00:25:58.000Z", "global", "completed", "all_codex", "I have reset usage limits for Codex across all paid plans."),
  event("2061106703446450392", "2026-05-31T15:25:06.000Z", "global", "completed", "all_codex", "The Codex usage limits have been reset for all paid ChatGPT subscriptions."),
  event("2058280452851638313", "2026-05-23T20:14:35.000Z", "global", "completed", "all_codex", "We fixed this and have now reset usage limits for all accounts."),
];

export function resetEventFromActivity(activity: Activity, discoveredAt: string): StoredResetEvent | null {
  if (activity.authorHandle.toLowerCase() !== "thsottiaux" || activity.type === "repost") return null;

  const text = activity.text.trim();
  const hasQuotaContext = /\b(codex|chatgpt work|usage limits?|rate limits?)\b/i.test(text);
  if (!hasQuotaContext) return null;

  const completed = /\b(i(?:'ve| have)? reset|we(?:'ve| have) reset|have (?:now )?reset|limits? have been reset|we did (?:a )?.*reset|added (?:a )?banked reset|have added (?:a )?banked reset)\b/i.test(text);
  const rollingOut = /\b(are (?:once again )?resetting|landing a usage reset|introducing.*reset|propagating in|will be fully reset.*next hour|giving all codex users a usage reset)\b/i.test(text);
  if (!completed && !rollingOut) return null;

  const kind: ResetEvent["kind"] = /\bbanked reset|reset bank\b/i.test(text) ? "banked" : "global";
  const scope: ResetEventScope = /\b500k|selected|specific users?\b/i.test(text)
    ? "targeted"
    : /\bchatgpt work\b/i.test(text)
      ? "paid_codex_chatgpt_work"
      : "all_codex";

  return {
    id: activity.id,
    announcedAt: activity.publishedAt,
    day: activity.day,
    kind,
    status: completed ? "completed" : "rolling_out",
    scope,
    evidenceText: text,
    evidenceUrl: activity.link || `https://x.com/thsottiaux/status/${activity.id}`,
    source: "tibo_x",
    discoveredAt,
    activityId: activity.id,
  };
}
