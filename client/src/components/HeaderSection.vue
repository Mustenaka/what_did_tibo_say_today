<template>
  <header class="header">
    <div class="header-left">
      <img class="header-avatar" src="/tibo.png" alt="Tibo" />
      <div class="header-text">
        <h1 class="header-title">{{ $t('appTitle') }}</h1>
        <p class="header-subtitle">{{ $t('tiboTitle') }}</p>
      </div>
    </div>
    <button class="lang-btn" @click="toggleLang">
      {{ $t('switchLang') }}
    </button>
  </header>
</template>

<script setup>
import { useI18n } from 'vue-i18n';

const { locale } = useI18n();

function toggleLang() {
  locale.value = locale.value === 'zh-CN' ? 'en' : 'zh-CN';
}
</script>

<style scoped>
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #e5e7eb;
}

.header-text {
  display: flex;
  flex-direction: column;
}

.header-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
  margin: 0;
  line-height: 1.3;
}

.header-subtitle {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 2px 0 0;
}

.lang-btn {
  padding: 8px 20px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #fff;
  color: #374151;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.lang-btn:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
}
</style>
