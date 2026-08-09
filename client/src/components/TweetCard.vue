<template>
  <article class="activity-card card-surface" :class="`activity-${tweet.type}`">
    <div class="activity-marker" aria-hidden="true">{{ marker }}</div>

    <div class="activity-body">
      <div class="activity-meta">
        <span class="type-label">{{ $t(`activityType.${tweet.type}`) }}</span>
        <span v-if="tweet.targetHandle" class="target-handle">@{{ tweet.targetHandle }}</span>
        <time :datetime="tweet.publishedAt">{{ formatDate(tweet.publishedAt) }}</time>
      </div>

      <p class="activity-text">{{ tweet.text || $t('mediaOnly') }}</p>

      <a
        v-if="tweet.link"
        class="activity-link"
        :href="tweet.link"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span>{{ $t('viewOnX') }}</span>
        <b aria-hidden="true">↗</b>
      </a>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  tweet: { type: Object, required: true },
});

const { locale } = useI18n();

const marker = computed(() => ({
  original: 'T',
  reply: '↩',
  quote: '“',
  repost: '↻',
}[props.tweet.type] || '·'));

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat(locale.value, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return '';
  }
}
</script>

<style scoped>
.activity-card {
  position: relative;
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  gap: 18px;
  padding: 22px;
  box-shadow: none;
  transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
}

.activity-card:hover {
  transform: translateY(-2px);
  border-color: rgba(19, 34, 25, 0.28);
  box-shadow: 0 14px 36px rgba(19, 34, 25, 0.08);
}

.activity-marker {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: var(--ink);
  color: white;
  font-family: Georgia, serif;
  font-size: 1.15rem;
  font-weight: 700;
}

.activity-reply .activity-marker { background: var(--signal); }
.activity-quote .activity-marker { background: #5c7fa3; }
.activity-repost .activity-marker { background: #57a178; }

.activity-body {
  min-width: 0;
}

.activity-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 24px;
  color: var(--muted);
  font-size: 0.68rem;
}

.type-label {
  color: var(--ink);
  font-weight: 850;
}

.target-handle {
  max-width: 150px;
  overflow: hidden;
  color: var(--signal-dark);
  font-weight: 750;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.activity-meta time {
  margin-left: auto;
  white-space: nowrap;
}

.activity-text {
  margin: 12px 0 16px;
  color: var(--ink-soft);
  font-family: Georgia, "Noto Serif SC", serif;
  font-size: clamp(1rem, 2vw, 1.16rem);
  line-height: 1.58;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.activity-link {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 44px;
  color: var(--ink);
  font-size: 0.7rem;
  font-weight: 800;
  text-decoration: none;
}

.activity-link:hover span {
  text-decoration: underline;
  text-underline-offset: 4px;
}

.activity-link b {
  color: var(--signal);
}

@media (max-width: 520px) {
  .activity-card {
    grid-template-columns: 38px minmax(0, 1fr);
    gap: 12px;
    padding: 18px 16px;
  }

  .activity-marker {
    width: 38px;
    height: 38px;
    border-radius: 11px;
  }

  .activity-meta {
    flex-wrap: wrap;
  }

  .activity-meta time {
    width: 100%;
    margin-left: 0;
  }
}
</style>
