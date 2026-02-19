<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from './components/AppLayout.vue'

const route = useRoute()
const useLayout = computed(() => route.meta?.layout !== 'auth')
</script>

<template>
  <div class="app">
    <div class="ambient" aria-hidden="true"></div>
    <AppLayout v-if="useLayout">
      <RouterView />
    </AppLayout>
    <RouterView v-else />
  </div>
</template>
