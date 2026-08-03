<template>
  <div class="stats-card card">
    <h3 class="stats-title">{{ $t('tweetCount') }}</h3>
    <div class="stats-number" :class="{ loading: loading }">
      <span v-if="loading" class="spinner"></span>
      <span v-else-if="error" class="stats-error">{{ $t('fetchError') }}</span>
      <span v-else class="stats-count">{{ count }}</span>
    </div>
    <p class="stats-date">{{ date }}</p>
  </div>
</template>

<script setup>
defineProps({
  count: { type: Number, default: 0 },
  date: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  error: { type: Boolean, default: false },
});
</script>

<style scoped>
.stats-card {
  text-align: center;
}

.stats-title {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0 0 8px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stats-number {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
}

.stats-count {
  font-size: 3rem;
  font-weight: 800;
  color: #111827;
  line-height: 1;
}

.stats-count.loading {
  color: #d1d5db;
}

.stats-error {
  font-size: 1rem;
  color: #ef4444;
  font-weight: 500;
}

.stats-date {
  font-size: 0.8125rem;
  color: #9ca3af;
  margin: 8px 0 0;
}

.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid #e5e7eb;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
