<template>
  <a class="skip-link" href="#main-content">{{ $t('skipToContent') }}</a>

  <div class="app-shell">
    <div class="site-container">
      <HeaderSection />

      <main id="main-content">
        <TiboIntro :range="dashboard.range" :loading="dataLoading" />

        <div class="content-grid">
          <div class="primary-column">
            <DailyStats
              :stats="dashboard.stats"
              :daily="dashboard.daily"
              :range="dashboard.range"
              :coverage="dashboard.coverage"
              :loading="dataLoading"
              :error="dataError"
              @retry="loadActivities"
            />

            <section class="activity-section" aria-labelledby="activity-heading">
              <div class="section-heading-row">
                <div>
                  <p class="section-kicker">{{ $t('activityKicker') }}</p>
                  <h2 id="activity-heading" class="section-title">{{ $t('activityTitle') }}</h2>
                </div>
                <span v-if="!dataLoading" class="result-count">
                  {{ $t('activityCount', { count: filteredActivities.length }) }}
                </span>
              </div>

              <div class="filter-row" role="group" :aria-label="$t('filterLabel')">
                <button
                  v-for="option in filters"
                  :key="option.value"
                  class="filter-button"
                  :class="{ active: activityFilter === option.value }"
                  :aria-pressed="activityFilter === option.value"
                  @click="activityFilter = option.value"
                >
                  {{ $t(option.label) }}
                </button>
              </div>

              <div v-if="dataLoading" class="activity-list" aria-live="polite">
                <div v-for="index in 3" :key="index" class="activity-skeleton card-surface">
                  <span></span><span></span><span></span>
                </div>
              </div>

              <div v-else-if="filteredActivities.length" class="activity-list">
                <TweetCard
                  v-for="activity in filteredActivities"
                  :key="activity.id"
                  :tweet="activity"
                />
              </div>

              <div v-else-if="!dataError" class="empty-state card-surface">
                <span class="empty-mark" aria-hidden="true">∅</span>
                <p>{{ $t('noActivities') }}</p>
              </div>
            </section>
          </div>

          <aside class="analysis-column" :aria-label="$t('resetAnalysis')">
            <ResetAnalysis
              :analysis="analysisResult"
              :loading="analysisLoading"
              :error="analysisError"
              @retry="runAnalysis"
            />

            <div class="data-note card-surface">
              <span class="data-note-icon" aria-hidden="true">DB</span>
              <div>
                <h3>{{ $t('structuredData') }}</h3>
                <p>{{ storageNote }}</p>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <footer class="site-footer">
        <span>{{ $t('footerLine') }}</span>
        <span v-if="dashboard.fetchedAt">{{ $t('lastUpdated') }} {{ formatTimestamp(dashboard.fetchedAt) }}</span>
      </footer>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import HeaderSection from './components/HeaderSection.vue';
import TiboIntro from './components/TiboIntro.vue';
import DailyStats from './components/DailyStats.vue';
import TweetCard from './components/TweetCard.vue';
import ResetAnalysis from './components/ResetAnalysis.vue';
import { useApi } from './composables/useApi.js';

const { locale, t } = useI18n();
const { fetchRecentActivities, analyzeTweets } = useApi();

const dashboard = reactive({
  range: { days: 7, start: '', end: '' },
  stats: { total: 0, originals: 0, interactions: 0, replies: 0, quotes: 0, reposts: 0 },
  daily: [],
  activities: [],
  coverage: { oldestDay: null, complete: false, storedCount: 0 },
  fetchedAt: null,
  lastRefreshSucceeded: null,
});

const dataLoading = ref(true);
const dataError = ref(false);
const analysisResult = ref(null);
const analysisLoading = ref(false);
const analysisError = ref(false);
const activityFilter = ref('all');

const filters = [
  { value: 'all', label: 'filters.all' },
  { value: 'original', label: 'filters.original' },
  { value: 'interactions', label: 'filters.interactions' },
];

const filteredActivities = computed(() => {
  if (activityFilter.value === 'original') {
    return dashboard.activities.filter((activity) => activity.type === 'original');
  }
  if (activityFilter.value === 'interactions') {
    return dashboard.activities.filter((activity) => activity.type !== 'original');
  }
  return dashboard.activities;
});

const storageNote = computed(() => {
  if (dataLoading.value) return t('storageLoading');
  if (!dashboard.coverage.storedCount) return t('storageEmpty');
  if (dashboard.lastRefreshSucceeded === false) {
    return t('storageStale', { count: dashboard.coverage.storedCount });
  }
  if (dashboard.coverage.complete) {
    return t('storageComplete', { count: dashboard.coverage.storedCount });
  }
  return t('storageGrowing', {
    count: dashboard.coverage.storedCount,
    date: dashboard.coverage.oldestDay || '—',
  });
});

async function loadActivities() {
  dataLoading.value = true;
  dataError.value = false;
  try {
    const data = await fetchRecentActivities();
    Object.assign(dashboard, data);
    const analyzable = data.activities.filter((activity) => activity.type !== 'repost');
    if (analyzable.length) runAnalysis(analyzable);
  } catch {
    dataError.value = true;
  } finally {
    dataLoading.value = false;
  }
}

async function runAnalysis(input) {
  const tweets = Array.isArray(input)
    ? input
    : dashboard.activities.filter((activity) => activity.type !== 'repost');
  if (!tweets.length) return;

  analysisLoading.value = true;
  analysisError.value = false;
  try {
    analysisResult.value = await analyzeTweets(tweets);
  } catch {
    analysisError.value = true;
  } finally {
    analysisLoading.value = false;
  }
}

function formatTimestamp(value) {
  return new Intl.DateTimeFormat(locale.value, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

onMounted(loadActivities);
</script>

<style>
:root {
  color-scheme: light;
  --ink: #132219;
  --ink-soft: #304239;
  --paper: #f4f0e7;
  --surface: #fffdf7;
  --line: #d9d5ca;
  --muted: #66736b;
  --signal: #ff5c35;
  --signal-dark: #c73516;
  --acid: #d9f56f;
  --mint: #d9eee1;
  --blue: #dce9f5;
  --radius-lg: 28px;
  --radius-md: 18px;
  --shadow: 0 18px 50px rgba(19, 34, 25, 0.08);
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  min-width: 320px;
  background: var(--paper);
  color: var(--ink);
  font-family: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", sans-serif;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

button,
a {
  font: inherit;
}

button:focus-visible,
a:focus-visible {
  outline: 3px solid var(--signal);
  outline-offset: 3px;
}

::selection {
  color: var(--ink);
  background: var(--acid);
}

.skip-link {
  position: fixed;
  top: 12px;
  left: 12px;
  z-index: 100;
  padding: 10px 16px;
  border-radius: 999px;
  background: var(--ink);
  color: white;
  transform: translateY(-160%);
}

.skip-link:focus {
  transform: translateY(0);
}

.app-shell {
  min-height: 100vh;
  overflow: hidden;
  background:
    radial-gradient(circle at 4% 10%, rgba(217, 245, 111, 0.28), transparent 22rem),
    radial-gradient(circle at 96% 32%, rgba(255, 92, 53, 0.12), transparent 28rem),
    var(--paper);
}

.site-container {
  width: min(1180px, calc(100% - 40px));
  margin: 0 auto;
}

.content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 24px;
  align-items: start;
  margin-top: 24px;
}

.primary-column,
.analysis-column {
  min-width: 0;
}

.analysis-column {
  position: sticky;
  top: 24px;
  display: grid;
  gap: 16px;
}

.card-surface {
  border: 1px solid rgba(19, 34, 25, 0.12);
  border-radius: var(--radius-md);
  background: var(--surface);
  box-shadow: var(--shadow);
}

.activity-section {
  margin-top: 44px;
}

.section-heading-row {
  display: flex;
  gap: 20px;
  align-items: end;
  justify-content: space-between;
}

.section-kicker {
  margin: 0 0 4px;
  color: var(--signal-dark);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.section-title {
  margin: 0;
  font-family: Georgia, "Noto Serif SC", serif;
  font-size: clamp(1.85rem, 4vw, 2.7rem);
  font-weight: 500;
  line-height: 1.1;
}

.result-count {
  padding-bottom: 5px;
  color: var(--muted);
  font-size: 0.82rem;
  font-weight: 700;
}

.filter-row {
  display: flex;
  gap: 8px;
  margin: 22px 0 16px;
}

.filter-button {
  min-height: 44px;
  padding: 9px 16px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: rgba(255, 253, 247, 0.68);
  color: var(--ink-soft);
  font-weight: 750;
  cursor: pointer;
  transition: background 160ms ease, color 160ms ease, border-color 160ms ease;
}

.filter-button:hover,
.filter-button.active {
  border-color: var(--ink);
  background: var(--ink);
  color: white;
}

.activity-list {
  display: grid;
  gap: 12px;
}

.activity-skeleton {
  min-height: 150px;
  padding: 24px;
  box-shadow: none;
}

.activity-skeleton span {
  display: block;
  height: 12px;
  margin: 12px 0;
  border-radius: 999px;
  background: linear-gradient(90deg, #e7e3d9 25%, #f5f2eb 50%, #e7e3d9 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}

.activity-skeleton span:first-child { width: 28%; }
.activity-skeleton span:last-child { width: 62%; }

.empty-state {
  display: grid;
  place-items: center;
  min-height: 220px;
  padding: 32px;
  text-align: center;
  color: var(--muted);
}

.empty-mark {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  border: 1px solid var(--line);
  border-radius: 50%;
  font-size: 1.4rem;
}

.data-note {
  display: flex;
  gap: 14px;
  padding: 18px;
  box-shadow: none;
}

.data-note-icon {
  display: grid;
  place-items: center;
  flex: 0 0 38px;
  height: 38px;
  border-radius: 11px;
  background: var(--mint);
  font-size: 0.68rem;
  font-weight: 900;
  letter-spacing: 0.05em;
}

.data-note h3 {
  margin: 0 0 4px;
  font-size: 0.82rem;
}

.data-note p {
  margin: 0;
  color: var(--muted);
  font-size: 0.76rem;
  line-height: 1.5;
}

.site-footer {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  padding: 36px 0 44px;
  color: var(--muted);
  font-size: 0.74rem;
}

@keyframes shimmer {
  to { background-position: -200% 0; }
}

@media (max-width: 920px) {
  .content-grid {
    grid-template-columns: 1fr;
  }

  .analysis-column {
    position: static;
  }
}

@media (max-width: 640px) {
  .site-container {
    width: min(100% - 24px, 1180px);
  }

  .content-grid {
    margin-top: 12px;
  }

  .section-heading-row,
  .site-footer {
    align-items: flex-start;
    flex-direction: column;
  }

  .filter-row {
    overflow-x: auto;
    padding: 2px 2px 6px;
  }

  .filter-button {
    flex: 0 0 auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
