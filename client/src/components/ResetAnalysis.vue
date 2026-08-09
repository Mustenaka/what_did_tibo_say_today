<template>
  <section class="analysis-card" aria-labelledby="analysis-heading" aria-live="polite">
    <div class="analysis-header">
      <div>
        <p>{{ $t('analysisKicker') }}</p>
        <h2 id="analysis-heading">{{ $t('resetAnalysis') }}</h2>
      </div>
      <span class="radar-mark" :class="likelihoodClass" aria-hidden="true">
        <i></i><i></i><i></i>
      </span>
    </div>

    <div v-if="loading" class="analysis-state">
      <span class="analysis-spinner" aria-hidden="true"></span>
      <strong>{{ $t('analyzing') }}</strong>
      <small>{{ $t('analyzingHint') }}</small>
    </div>

    <div v-else-if="error" class="analysis-state analysis-error" role="alert">
      <span class="state-symbol" aria-hidden="true">!</span>
      <strong>{{ $t('analyzeError') }}</strong>
      <button @click="$emit('retry')">{{ $t('retry') }}</button>
    </div>

    <div v-else-if="analysis" class="analysis-result">
      <p class="result-label">{{ $t('signalLevel') }}</p>
      <strong class="likelihood-label" :class="likelihoodClass">{{ likelihoodLabel }}</strong>

      <div class="signal-meter" aria-hidden="true">
        <span v-for="index in 4" :key="index" :class="{ active: index <= likelihoodScore }"></span>
      </div>

      <div v-if="analysis.keywords?.length" class="keyword-list">
        <span v-for="keyword in analysis.keywords" :key="keyword">{{ keyword }}</span>
      </div>

      <div class="analysis-copy">
        <div>
          <h3>{{ $t('reason') }}</h3>
          <p>{{ analysis.reason }}</p>
        </div>
        <div>
          <h3>{{ $t('summary') }}</h3>
          <p>{{ analysis.summary }}</p>
        </div>
      </div>
    </div>

    <div v-else class="analysis-state">
      <span class="state-symbol quiet" aria-hidden="true">○</span>
      <strong>{{ $t('analysisIdle') }}</strong>
      <small>{{ $t('analysisIdleHint') }}</small>
    </div>

    <p class="analysis-disclaimer">{{ $t('analysisDisclaimer') }}</p>
  </section>
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

const likelihoodClass = computed(() => `likelihood-${props.analysis?.likelihood || 'unknown'}`);

const likelihoodScore = computed(() => ({
  none: 1,
  unlikely: 2,
  likely: 3,
  very_likely: 4,
}[props.analysis?.likelihood] || 0));

const likelihoodLabel = computed(() => t(`likelihood.${props.analysis?.likelihood || 'unknown'}`));
</script>

<style scoped>
.analysis-card {
  overflow: hidden;
  border-radius: var(--radius-lg);
  background: var(--ink);
  color: white;
  box-shadow: 0 22px 56px rgba(19, 34, 25, 0.2);
}

.analysis-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 24px 24px 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.13);
}

.analysis-header p,
.result-label,
h2,
h3,
.analysis-copy p,
.analysis-disclaimer {
  margin: 0;
}

.analysis-header p {
  margin-bottom: 4px;
  color: var(--acid);
  font-size: 0.62rem;
  font-weight: 850;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

h2 {
  font-family: Georgia, "Noto Serif SC", serif;
  font-size: 1.35rem;
  font-weight: 500;
}

.radar-mark {
  position: relative;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
}

.radar-mark i {
  position: absolute;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
}

.radar-mark i:nth-child(1) { width: 42px; height: 42px; }
.radar-mark i:nth-child(2) { width: 27px; height: 27px; }
.radar-mark i:nth-child(3) { width: 8px; height: 8px; background: var(--acid); border: 0; }

.analysis-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 290px;
  padding: 32px 24px;
  text-align: center;
}

.analysis-state strong {
  margin-top: 18px;
  font-size: 0.92rem;
}

.analysis-state small {
  max-width: 240px;
  margin-top: 6px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.7rem;
}

.analysis-spinner,
.state-symbol {
  display: grid;
  place-items: center;
  width: 54px;
  height: 54px;
  border: 2px solid rgba(255, 255, 255, 0.18);
  border-top-color: var(--acid);
  border-radius: 50%;
}

.analysis-spinner {
  animation: spin 0.8s linear infinite;
}

.state-symbol {
  border-color: var(--signal);
  color: var(--signal);
  font-family: Georgia, serif;
  font-size: 1.35rem;
}

.state-symbol.quiet {
  border-color: rgba(255, 255, 255, 0.25);
  color: var(--acid);
}

.analysis-error button {
  min-height: 44px;
  margin-top: 18px;
  padding: 8px 18px;
  border: 1px solid white;
  border-radius: 999px;
  background: transparent;
  color: white;
  font-weight: 800;
  cursor: pointer;
}

.analysis-result {
  padding: 28px 24px 26px;
}

.result-label {
  color: rgba(255, 255, 255, 0.48);
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.likelihood-label {
  display: block;
  margin-top: 6px;
  font-family: Georgia, "Noto Serif SC", serif;
  font-size: 2.1rem;
  font-weight: 500;
}

.likelihood-very_likely { color: #ff8061; }
.likelihood-likely { color: #ffd166; }
.likelihood-unlikely { color: #9bd1ff; }
.likelihood-none { color: var(--acid); }
.likelihood-unknown { color: rgba(255, 255, 255, 0.65); }

.signal-meter {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 5px;
  margin: 20px 0;
}

.signal-meter span {
  height: 7px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
}

.signal-meter span.active {
  background: var(--signal);
}

.keyword-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding-bottom: 20px;
}

.keyword-list span {
  padding: 5px 9px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  color: var(--acid);
  font-size: 0.66rem;
}

.analysis-copy {
  display: grid;
  gap: 18px;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.13);
}

.analysis-copy h3 {
  margin: 0 0 5px;
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.analysis-copy p {
  color: rgba(255, 255, 255, 0.76);
  font-size: 0.78rem;
  line-height: 1.62;
}

.analysis-disclaimer {
  padding: 13px 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.35);
  font-size: 0.6rem;
  text-align: center;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
