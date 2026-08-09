<template>
  <section class="hero" aria-labelledby="hero-title">
    <div class="hero-copy">
      <p class="hero-kicker">{{ $t('heroKicker') }}</p>
      <h1 id="hero-title">{{ $t('heroTitle') }}</h1>
      <p class="hero-summary">{{ $t('heroSummary') }}</p>

      <a class="profile-chip" href="https://x.com/thsottiaux" target="_blank" rel="noopener noreferrer">
        <img src="/tibo.png" alt="" />
        <span>
          <strong>Tibo</strong>
          <small>@thsottiaux · {{ $t('tiboRole') }}</small>
        </span>
        <b aria-hidden="true">↗</b>
        <span class="sr-only">{{ $t('openProfile') }}</span>
      </a>
    </div>

    <div class="hero-window" aria-hidden="true">
      <span class="window-label">WINDOW / 07</span>
      <strong v-if="!loading">{{ compactDate(range.start) }}</strong>
      <span class="window-line"></span>
      <strong v-if="!loading">{{ compactDate(range.end) }}</strong>
      <span v-if="loading" class="window-loading">— / —</span>
      <small>UTC</small>
    </div>
  </section>
</template>

<script setup>
defineProps({
  range: { type: Object, default: () => ({ start: '', end: '' }) },
  loading: { type: Boolean, default: false },
});

function compactDate(value) {
  if (!value) return '—';
  const [, month, day] = value.split('-');
  return `${month}.${day}`;
}
</script>

<style scoped>
.hero {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 220px;
  gap: 32px;
  min-height: 410px;
  padding: clamp(30px, 6vw, 68px);
  overflow: hidden;
  border-radius: var(--radius-lg);
  background: var(--ink);
  color: white;
  box-shadow: 0 26px 70px rgba(19, 34, 25, 0.2);
}

.hero::before,
.hero::after {
  content: "";
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}

.hero::before {
  width: 380px;
  height: 380px;
  right: -170px;
  top: -160px;
  border: 80px solid rgba(217, 245, 111, 0.12);
}

.hero::after {
  width: 190px;
  height: 190px;
  right: 24%;
  bottom: -145px;
  border: 42px solid rgba(255, 92, 53, 0.15);
}

.hero-copy {
  position: relative;
  z-index: 1;
  align-self: center;
}

.hero-kicker {
  margin: 0 0 16px;
  color: var(--acid);
  font-size: 0.75rem;
  font-weight: 850;
  letter-spacing: 0.17em;
  text-transform: uppercase;
}

h1 {
  max-width: 760px;
  margin: 0;
  font-family: Georgia, "Noto Serif SC", serif;
  font-size: clamp(2.55rem, 6.2vw, 5.2rem);
  font-weight: 500;
  letter-spacing: -0.05em;
  line-height: 0.98;
}

.hero-summary {
  max-width: 650px;
  margin: 22px 0 26px;
  color: rgba(255, 255, 255, 0.72);
  font-size: clamp(0.92rem, 2vw, 1.05rem);
}

.profile-chip {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  min-height: 62px;
  padding: 8px 14px 8px 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 999px;
  color: white;
  text-decoration: none;
  background: rgba(255, 255, 255, 0.07);
}

.profile-chip:hover {
  background: rgba(255, 255, 255, 0.13);
}

.profile-chip img {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  object-fit: cover;
}

.profile-chip span:not(.sr-only) {
  display: grid;
}

.profile-chip strong {
  font-size: 0.86rem;
}

.profile-chip small {
  color: rgba(255, 255, 255, 0.58);
  font-size: 0.68rem;
}

.profile-chip b {
  margin-left: 10px;
  color: var(--acid);
}

.hero-window {
  position: relative;
  z-index: 1;
  align-self: end;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 8px;
  align-items: center;
  padding: 18px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 18px;
  background: rgba(0, 0, 0, 0.12);
}

.window-label,
.hero-window small {
  grid-column: 1 / -1;
  color: rgba(255, 255, 255, 0.48);
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.hero-window strong {
  font-family: Georgia, serif;
  font-size: 1.4rem;
  font-weight: 500;
}

.window-line {
  width: 22px;
  height: 1px;
  background: var(--signal);
}

.window-loading {
  grid-column: 1 / -1;
  font-family: Georgia, serif;
  font-size: 1.4rem;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 760px) {
  .hero {
    grid-template-columns: 1fr;
    min-height: auto;
  }

  .hero-window {
    width: min(220px, 100%);
  }
}

@media (max-width: 480px) {
  .hero {
    padding: 28px 22px;
    border-radius: 22px;
  }

  .profile-chip small {
    max-width: 170px;
  }
}
</style>
