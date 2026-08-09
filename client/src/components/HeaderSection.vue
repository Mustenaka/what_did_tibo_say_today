<template>
  <header class="site-header">
    <a class="brand" href="#main-content" :aria-label="$t('appTitle')">
      <span class="brand-dot" aria-hidden="true"></span>
      <span>TIBO / SIGNAL DESK</span>
    </a>

    <div class="header-actions">
      <span class="live-pill"><span aria-hidden="true"></span>{{ $t('rollingWindow') }}</span>
      <button class="language-button" :aria-label="$t('languageLabel')" @click="toggleLang">
        {{ $t('switchLang') }}
      </button>
    </div>
  </header>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { locale } = useI18n();

function toggleLang() {
  locale.value = locale.value === 'zh-CN' ? 'en' : 'zh-CN';
  document.documentElement.lang = locale.value;
}
</script>

<style scoped>
.site-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 80px;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--ink);
  font-size: 0.76rem;
  font-weight: 900;
  letter-spacing: 0.13em;
  text-decoration: none;
}

.brand-dot {
  width: 11px;
  height: 11px;
  border: 3px solid var(--ink);
  border-radius: 50%;
  background: var(--signal);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.live-pill,
.language-button {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 800;
}

.live-pill {
  gap: 7px;
  padding: 9px 14px;
  border: 1px solid var(--line);
  background: rgba(255, 253, 247, 0.6);
  color: var(--ink-soft);
}

.live-pill span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #36a35f;
  box-shadow: 0 0 0 4px rgba(54, 163, 95, 0.13);
}

.language-button {
  padding: 9px 16px;
  border: 1px solid var(--ink);
  background: var(--ink);
  color: white;
  cursor: pointer;
}

.language-button:hover {
  background: var(--signal);
  border-color: var(--signal);
}

@media (max-width: 560px) {
  .site-header {
    min-height: 68px;
  }

  .live-pill {
    display: none;
  }

  .brand {
    font-size: 0.66rem;
  }
}
</style>
