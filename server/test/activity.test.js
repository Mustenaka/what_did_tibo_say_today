import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchFxTwitterActivities, parseFxTwitterStatus } from '../services/fxtwitter.js';
import { parseActivityItem } from '../services/nitter.js';
import { createActivityStore } from '../services/storage.js';

const source = 'https://nitter.example';

test('classifies replies, reposts, quotes, and originals from Nitter RSS fields', () => {
  const base = {
    pubDate: 'Sat, 08 Aug 2026 12:00:00 GMT',
    link: `${source}/thsottiaux/status/100`,
    guid: '100',
    creator: '@thsottiaux',
  };

  const reply = parseActivityItem({ ...base, title: 'R to @alice: shipping again' }, source);
  const repost = parseActivityItem({ ...base, guid: '101', title: 'RT by @thsottiaux: hello', creator: '@bob' }, source);
  const quote = parseActivityItem({ ...base, guid: '102', title: 'there will be signs', content: '<blockquote><b>Alice (@alice)</b></blockquote>' }, source);
  const original = parseActivityItem({ ...base, guid: '103', title: 'celebrate' }, source);

  assert.deepEqual([reply.type, reply.targetHandle, reply.text], ['reply', 'alice', 'shipping again']);
  assert.deepEqual([repost.type, repost.targetHandle, repost.text], ['repost', 'bob', 'hello']);
  assert.deepEqual([quote.type, quote.targetHandle], ['quote', 'alice']);
  assert.equal(original.type, 'original');
});

test('stores activities idempotently and returns a zero-filled 7-day rollup', () => {
  const store = createActivityStore(':memory:');
  const fetchedAt = '2026-08-09T10:00:00.000Z';
  const activities = [
    {
      id: '1', text: 'one', publishedAt: '2026-08-03T08:00:00.000Z', day: '2026-08-03',
      link: '', type: 'original', targetHandle: null, authorHandle: 'thsottiaux', source, rawTitle: 'one',
    },
    {
      id: '2', text: 'two', publishedAt: '2026-08-09T08:00:00.000Z', day: '2026-08-09',
      link: '', type: 'reply', targetHandle: 'alice', authorHandle: 'thsottiaux', source, rawTitle: 'two',
    },
  ];

  store.saveFetch({ activities, source, fetchedAt });
  store.saveFetch({ activities, source, fetchedAt });
  const result = store.getRecent(7, new Date('2026-08-09T12:00:00.000Z'));

  assert.equal(result.activities.length, 2);
  assert.deepEqual(result.stats, {
    total: 2, originals: 1, interactions: 1, replies: 1, quotes: 0, reposts: 0,
  });
  assert.equal(result.daily.length, 7);
  assert.equal(result.daily[1].total, 0);
  assert.equal(result.daily[6].reply, 1);
  assert.equal(result.coverage.complete, true);
  store.close();
});

test('normalizes FxTwitter replies, quotes, reposts, and ignores conversation context', () => {
  const base = {
    type: 'status',
    id: '200',
    url: 'https://x.com/thsottiaux/status/200',
    text: 'hello',
    created_timestamp: 1786233600,
    author: { screen_name: 'thsottiaux' },
  };

  const reply = parseFxTwitterStatus({
    ...base,
    text: '@alice @bob shipping again',
    replying_to: { screen_name: 'alice' },
  });
  const quote = parseFxTwitterStatus({
    ...base,
    id: '201',
    quote: { type: 'status', author: { screen_name: 'carol' } },
  });
  const repost = parseFxTwitterStatus({
    ...base,
    id: '202',
    author: { screen_name: 'dave' },
    reposted_by: { screen_name: 'thsottiaux' },
  });
  const context = parseFxTwitterStatus({
    ...base,
    id: '203',
    author: { screen_name: 'someone_else' },
  });

  assert.deepEqual([reply.type, reply.targetHandle, reply.text], ['reply', 'alice', 'shipping again']);
  assert.deepEqual([quote.type, quote.targetHandle], ['quote', 'carol']);
  assert.deepEqual([repost.type, repost.targetHandle], ['repost', 'dave']);
  assert.equal(context, null);
});

test('paginates FxTwitter until the 7-day boundary and de-duplicates statuses', async () => {
  const pages = [
    {
      code: 200,
      results: [
        {
          type: 'status', id: '1', text: 'new', url: '', created_timestamp: 1786233600,
          author: { screen_name: 'thsottiaux' },
        },
        {
          type: 'status', id: 'context', text: 'context', url: '', created_timestamp: 1786233500,
          author: { screen_name: 'alice' },
        },
      ],
      cursor: { bottom: 'next-page' },
    },
    {
      code: 200,
      results: [
        {
          type: 'status', id: '1', text: 'new', url: '', created_timestamp: 1786233600,
          author: { screen_name: 'thsottiaux' },
        },
        {
          type: 'status', id: '2', text: '@bob old reply', url: '', created_timestamp: 1785718800,
          author: { screen_name: 'thsottiaux' }, replying_to: { screen_name: 'bob' },
        },
        {
          type: 'status', id: 'older-context', text: 'older context', url: '', created_timestamp: 1785628800,
          author: { screen_name: 'alice' },
        },
      ],
      cursor: { bottom: 'unused' },
    },
  ];
  const requestedUrls = [];
  const fetchImpl = async (url) => {
    requestedUrls.push(String(url));
    const payload = pages.shift();
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  const result = await fetchFxTwitterActivities({
    now: new Date('2026-08-09T12:00:00.000Z'),
    fetchImpl,
  });

  assert.equal(result.pages, 2);
  assert.deepEqual(result.activities.map((activity) => activity.id), ['1', '2']);
  assert.match(requestedUrls[0], /with_replies=1/);
  assert.match(requestedUrls[1], /cursor=next-page/);
});
