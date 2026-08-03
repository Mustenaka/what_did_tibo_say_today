<template>
  <div class="analysis-card card">
    <h3 class="analysis-title">{{ $t('resetAnalysis') }}</h3>

    <div v-if="loading" class="analysis-loading">
      <span class="spinner"></span>
      <span>{{ $t('analyzing') }}</span>
    </div>

    <div v-else-if="error" class="analysis-error">
      <p>{{ $t('analyzeError') }}</p>
      <button class="retry-btn" @click="$emit('retry')">{{ $t('retry') }}</button>
    </div>

    <div v-else-if="analysis" class="analysis-result">
      <div class="likelihood-badge" :class="likelihoodClass">{{ likelihoodLabel }}</div>

      <div v-if="analysis.keywords && analysis.keywords.length" class="analysis-section">
        <h4>{{ $t('keywords') }}</h4>
        <div class="keyword-tags">
          <span v-for="kw in analysis.keywords" :key="kw" class="keyword-tag">{{ kw }}</span>
        </div>
      </div>

      <div class="analysis-section">
        <h4>{{ $t('reason') }}</h4>
        <p class="analysis-text">{{ analysis.reason }}</p>
      </div>

      <div class="analysis-section">
        <h4>{{ $t('summary') }}</h4>
        <p class="analysis-text">{{ analysis.summary }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  analysis: { type: Object, default: null },
  loading: { type: Boolean, default: false },
  error: { type: Boolean, default: false },
});

defineEmits(['retry']);

const { t } = useI18n();

const likelihoodClass = computed(() => {
  const map = {
    very_likely: 'lh-very',
    likely: 'lh-likely',
    unlikely: 'lh-unlikely',
    none: 'lh-none',
  };
  return map[props.analysis?.likelihood] || 'lh-unknown';
});

const likelihoodLabel = computed(() => {
  const key = props.analysis?.likelihood || 'unknown';
  return t(`likelihood.${key}`);
});
</script>

<style scoped>
.analysis-card {
  border: 2px solid #6366f1;
}

.analysis-title {
  font-size: 1rem;
  font-weight: 700;
  color: #111827;
  margin: 0 0 16px;
}

.analysis-loading {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #6b7280;
  font-size: 0.875rem;
}

.analysis-error {
  text-align: center;
  color: #ef4444;
  font-size: 0.875rem;
}

.retry-btn {
  margin-top: 8px;
  padding: 6px 16px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #fff;
  font-size: 0.8125rem;
  cursor: pointer;
}

.retry-btn:hover {
  background: #f3f4f6;
}

.likelihood-badge {
  display: inline-block;
  padding: 6px 16px;
  border-radius: 999px;
  font-size: 0.875rem;
  font-weight: 700;
  margin-bottom: 16px;
}

.lh-very { background: #fef2f2; color: #dc2626; }
.lh-likely { background: #fffbeb; color: #d97706; }
.lh-unlikely { background: #eff6ff; color: #2563eb; }
.lh-none { background: #f0fdf4; color: #16a34a; }
.lh-unknown { background: #f3f4f6; color: #6b7280; }

.analysis-section {
  margin-top: 14px;
}

.analysis-section h4 {
  font-size: 0.75rem;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 6px;
}

.analysis-text {
  font-size: 0.875rem;
  color: #374151;
  line-height: 1.6;
  margin: 0;
}

.keyword-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.keyword-tag {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  background: #eef2ff;
  color: #6366f1;
  font-size: 0.75rem;
  font-weight: 600;
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid #e5e7eb;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
