<template>
  <div class="tweet-card card">
    <div class="tweet-header">
      <span class="tweet-index">#{{ index }}</span>
      <a v-if="tweet.link" class="tweet-link" :href="tweet.link" target="_blank" rel="noopener">
        &nearr;
      </a>
    </div>
    <p class="tweet-text">{{ tweet.text }}</p>
    <time v-if="tweet.time" class="tweet-time">{{ formatTime(tweet.time) }}</time>
  </div>
</template>

<script setup>
defineProps({
  tweet: { type: Object, required: true },
  index: { type: Number, required: true },
});

function formatTime(timeStr) {
  try {
    const d = new Date(timeStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}
</script>

<style scoped>
.tweet-card {
  position: relative;
}

.tweet-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.tweet-index {
  font-size: 0.75rem;
  color: #9ca3af;
  font-weight: 600;
}

.tweet-link {
  font-size: 0.875rem;
  color: #6366f1;
  text-decoration: none;
  font-weight: 600;
}

.tweet-link:hover {
  text-decoration: underline;
}

.tweet-text {
  font-size: 0.9375rem;
  color: #1f2937;
  line-height: 1.6;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.tweet-time {
  display: block;
  margin-top: 10px;
  font-size: 0.75rem;
  color: #9ca3af;
}
</style>
