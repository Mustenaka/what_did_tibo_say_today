<template>
  <section class="stats-panel card-surface" aria-labelledby="stats-heading" aria-live="polite">
    <div class="stats-heading">
      <div>
        <p class="panel-kicker">{{ $t('statsKicker') }}</p>
        <h2 id="stats-heading">{{ $t('weeklyStats') }}</h2>
      </div>
      <span v-if="range.start && range.end" class="date-range">{{ range.start }} → {{ range.end }}</span>
    </div>

    <div v-if="error" class="stats-error" role="alert">
      <p>{{ $t('fetchError') }}</p>
      <button @click="$emit('retry')">{{ $t('retry') }}</button>
    </div>

    <template v-else>
      <div class="metric-grid">
        <article class="metric metric-primary">
          <span>{{ $t('totalActivities') }}</span>
          <strong>{{ loading ? '—' : stats.total }}</strong>
          <small>{{ $t('pastSevenDays') }}</small>
        </article>
        <article class="metric">
          <span>{{ $t('directPosts') }}</span>
          <strong>{{ loading ? '—' : stats.originals }}</strong>
          <small>{{ $t('directPostsHint') }}</small>
        </article>
        <article class="metric metric-acid">
          <span>{{ $t('interactions') }}</span>
          <strong>{{ loading ? '—' : stats.interactions }}</strong>
          <small>{{ interactionRate }}% {{ $t('ofActivity') }}</small>
        </article>
      </div>

      <div class="stats-detail-grid">
        <div class="trend-block">
          <div class="subheading">
            <h3>{{ $t('dailyRhythm') }}</h3>
            <div class="legend" aria-hidden="true">
              <span><i class="original-dot"></i>{{ $t('directShort') }}</span>
              <span><i class="interaction-dot"></i>{{ $t('interactionShort') }}</span>
            </div>
          </div>

          <div class="bar-chart" :aria-label="$t('trendDescription')">
            <div v-for="day in normalizedDays" :key="day.date" class="bar-day">
              <span class="bar-value">{{ day.total }}</span>
              <div class="bar-track">
                <span
                  class="bar-segment interaction-segment"
                  :style="segmentStyle(day.reply + day.quote + day.repost)"
                ></span>
                <span class="bar-segment original-segment" :style="segmentStyle(day.original)"></span>
              </div>
              <time :datetime="day.date">{{ formatDay(day.date) }}</time>
            </div>
          </div>
        </div>

        <div class="breakdown-block">
          <h3>{{ $t('interactionMix') }}</h3>
          <div class="breakdown-list">
            <div v-for="item in breakdown" :key="item.key" class="breakdown-item">
              <div>
                <span>{{ $t(`activityType.${item.key}`) }}</span>
                <strong>{{ item.value }}</strong>
              </div>
              <span class="progress-track" aria-hidden="true">
                <i :class="`progress-${item.key}`" :style="{ width: `${item.percent}%` }"></i>
              </span>
            </div>
          </div>
          <p v-if="!loading && coverage.storedCount && !coverage.complete" class="coverage-note">
            {{ $t('coverageNote', { date: coverage.oldestDay }) }}
          </p>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  stats: { type: Object, required: true },
  daily: { type: Array, default: () => [] },
  range: { type: Object, required: true },
  coverage: { type: Object, required: true },
  loading: { type: Boolean, default: false },
  error: { type: Boolean, default: false },
});

defineEmits(['retry']);

const { locale } = useI18n();

const interactionRate = computed(() => {
  if (!props.stats.total) return 0;
  return Math.round((props.stats.interactions / props.stats.total) * 100);
});

const normalizedDays = computed(() => {
  if (props.daily.length) return props.daily;
  return Array.from({ length: 7 }, (_, index) => ({
    date: `loading-${index}`,
    total: 0,
    original: 0,
    reply: 0,
    quote: 0,
    repost: 0,
  }));
});

const maxDaily = computed(() => Math.max(1, ...normalizedDays.value.map((day) => day.total)));

const breakdown = computed(() => ['reply', 'quote', 'repost'].map((key) => {
  const statKey = key === 'reply' ? 'replies' : key === 'quote' ? 'quotes' : 'reposts';
  const value = props.stats[statKey] || 0;
  return {
    key,
    value,
    percent: props.stats.interactions ? Math.round((value / props.stats.interactions) * 100) : 0,
  };
}));

function segmentStyle(value) {
  return {
    height: `${Math.round((value / maxDaily.value) * 100)}%`,
    minHeight: value ? '4px' : 0,
  };
}

function formatDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '—';
  return new Intl.DateTimeFormat(locale.value, { weekday: 'short' })
    .format(new Date(`${value}T12:00:00Z`))
    .replace('.', '');
}
</script>

<style scoped>
.stats-panel {
  padding: clamp(22px, 4vw, 34px);
}

.stats-heading,
.subheading,
.breakdown-item > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.panel-kicker {
  margin: 0 0 5px;
  color: var(--signal-dark);
  font-size: 0.68rem;
  font-weight: 850;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

h2,
h3,
p {
  margin: 0;
}

h2 {
  font-family: Georgia, "Noto Serif SC", serif;
  font-size: clamp(1.55rem, 3vw, 2.1rem);
  font-weight: 500;
}

.date-range {
  color: var(--muted);
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 0.68rem;
}

.metric-grid {
  display: grid;
  grid-template-columns: 1.25fr 1fr 1fr;
  gap: 12px;
  margin-top: 26px;
}

.metric {
  display: flex;
  flex-direction: column;
  min-height: 150px;
  padding: 18px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: #f8f6f0;
}

.metric-primary {
  border-color: var(--ink);
  background: var(--signal);
  color: white;
}

.metric-acid {
  background: var(--acid);
}

.metric span {
  font-size: 0.72rem;
  font-weight: 800;
}

.metric strong {
  margin: auto 0 4px;
  font-family: Georgia, serif;
  font-size: clamp(2.8rem, 6vw, 4rem);
  font-weight: 500;
  letter-spacing: -0.06em;
  line-height: 0.85;
}

.metric small {
  color: var(--muted);
  font-size: 0.65rem;
}

.metric-primary small {
  color: rgba(255, 255, 255, 0.7);
}

.stats-detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(190px, 0.8fr);
  gap: 30px;
  margin-top: 34px;
  padding-top: 28px;
  border-top: 1px solid var(--line);
}

h3 {
  font-size: 0.8rem;
}

.legend {
  display: flex;
  gap: 12px;
  color: var(--muted);
  font-size: 0.62rem;
}

.legend span {
  display: flex;
  align-items: center;
  gap: 5px;
}

.legend i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.original-dot { background: var(--ink); }
.interaction-dot { background: var(--signal); }

.bar-chart {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 8px;
  align-items: end;
  height: 188px;
  margin-top: 22px;
}

.bar-day {
  display: grid;
  grid-template-rows: 18px 130px 20px;
  gap: 5px;
  min-width: 0;
  text-align: center;
}

.bar-value,
.bar-day time {
  color: var(--muted);
  font-size: 0.62rem;
  font-weight: 750;
}

.bar-track {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-self: stretch;
  overflow: hidden;
  border-radius: 7px 7px 3px 3px;
  background: #ede9df;
}

.bar-segment {
  display: block;
  width: 100%;
  transition: height 300ms ease;
}

.interaction-segment { background: var(--signal); }
.original-segment { background: var(--ink); }

.breakdown-list {
  display: grid;
  gap: 18px;
  margin-top: 25px;
}

.breakdown-item span,
.breakdown-item strong {
  font-size: 0.68rem;
}

.progress-track {
  display: block;
  height: 7px;
  margin-top: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: #e7e3d9;
}

.progress-track i {
  display: block;
  height: 100%;
  border-radius: inherit;
}

.progress-reply { background: var(--signal); }
.progress-quote { background: #5c7fa3; }
.progress-repost { background: #57a178; }

.coverage-note {
  margin-top: 22px;
  padding: 12px;
  border-radius: 10px;
  background: #f2efe7;
  color: var(--muted);
  font-size: 0.65rem;
}

.stats-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 130px;
  margin-top: 24px;
  padding: 20px;
  border-radius: 14px;
  background: #fff0eb;
  color: var(--signal-dark);
}

.stats-error button {
  min-height: 44px;
  padding: 8px 16px;
  border: 1px solid var(--signal-dark);
  border-radius: 999px;
  background: transparent;
  color: inherit;
  font-weight: 800;
  cursor: pointer;
}

@media (max-width: 680px) {
  .metric-grid,
  .stats-detail-grid {
    grid-template-columns: 1fr;
  }

  .metric-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .metric-primary {
    grid-column: 1 / -1;
  }

  .stats-heading {
    align-items: flex-start;
    flex-direction: column;
  }
}

@media (max-width: 400px) {
  .metric-grid {
    grid-template-columns: 1fr;
  }

  .metric-primary {
    grid-column: auto;
  }
}
</style>
