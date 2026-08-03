<template>
  <div class="tibo-intro card">
    <img class="tibo-img" src="/tibo.png" alt="Tibo" />
    <div class="tibo-info">
      <h2 class="tibo-name">Tibo</h2>
      <p class="tibo-role">{{ $t('tiboTitle') }}</p>
      <a class="tibo-link" href="https://x.com/thsottiaux" target="_blank" rel="noopener">
        @thsottiaux
      </a>
    </div>
  </div>
</template>

<style scoped>
.tibo-intro {
  display: flex;
  align-items: center;
  gap: 20px;
}

.tibo-img {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid #6366f1;
}

.tibo-info {
  display: flex;
  flex-direction: column;
}

.tibo-name {
  font-size: 1.25rem;
  font-weight: 700;
  color: #111827;
  margin: 0;
}

.tibo-role {
  font-size: 0.875rem;
  color: #6366f1;
  font-weight: 600;
  margin: 4px 0;
}

.tibo-link {
  font-size: 0.8125rem;
  color: #6b7280;
  text-decoration: none;
}

.tibo-link:hover {
  color: #6366f1;
  text-decoration: underline;
}
</style>
