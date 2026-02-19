<script setup lang="ts">
import AppLayout from './components/AppLayout.vue'
</script>

<template>
  <div class="app">
    <div class="ambient" aria-hidden="true"></div>
    <AppLayout>
      <RouterView />
    </AppLayout>
  </div>
</template>
