<template>
  <div class="app">
    <div class="container">
      <HeaderSection />
      <TiboIntro />
      <DailyStats
        :count="tweetCount"
        :date="tweetDate"
        :loading="dataLoading"
        :error="dataError"
      />

      <div v-if="!dataLoading && tweets.length > 0" class="section">
        <h3 class="section-title">{{ $t('todayTweets') }}</h3>
        <div class="tweet-list">
          <TweetCard
            v-for="(tweet, i) in tweets"
            :key="tweet.id"
            :tweet="tweet"
            :index="i + 1"
          />
        </div>
      </div>

      <div v-else-if="!dataLoading && !dataError && tweets.length === 0" class="empty-state">
        <p>{{ $t('noTweets') }}</p>
      </div>

      <ResetAnalysis
        :analysis="analysisResult"
        :loading="analysisLoading"
        :error="analysisError"
        @retry="runAnalysis"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import HeaderSection from './components/HeaderSection.vue';
import TiboIntro from './components/TiboIntro.vue';
import DailyStats from './components/DailyStats.vue';
import TweetCard from './components/TweetCard.vue';
import ResetAnalysis from './components/ResetAnalysis.vue';
import { useApi } from './composables/useApi.js';

const { fetchTodayTweets, analyzeTweets } = useApi();

const tweetCount = ref(0);
const tweetDate = ref('');
const tweets = ref([]);
const dataLoading = ref(true);
const dataError = ref(false);

const analysisResult = ref(null);
const analysisLoading = ref(false);
const analysisError = ref(false);

async function loadTweets() {
  dataLoading.value = true;
  dataError.value = false;
  try {
    const data = await fetchTodayTweets();
    tweetCount.value = data.count;
    tweetDate.value = data.date;
    tweets.value = data.tweets;

    if (data.tweets.length > 0) {
      runAnalysis();
    }
  } catch {
    dataError.value = true;
  } finally {
    dataLoading.value = false;
  }
}

async function runAnalysis() {
  if (tweets.value.length === 0) return;
  analysisLoading.value = true;
  analysisError.value = false;
  try {
    const result = await analyzeTweets(tweets.value);
    analysisResult.value = result;
  } catch {
    analysisError.value = true;
  } finally {
    analysisLoading.value = false;
  }
}

onMounted(loadTweets);
</script>

<style>
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
    'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background: #f3f4f6;
  color: #111827;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.app {
  min-height: 100vh;
  padding: 32px 16px 64px;
}

.container {
  max-width: 680px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card {
  background: #fff;
  border-radius: 16px;
  padding: 20px 24px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.section {
  margin-top: 8px;
}

.section-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 12px;
}

.tweet-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  background: #fff;
  border-radius: 16px;
  color: #6b7280;
  font-size: 0.9375rem;
}
</style>
