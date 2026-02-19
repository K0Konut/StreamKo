<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { fetchMovie, fetchSerie, resolveMediaUrl, type Movie, type Serie } from '../lib/strapi'

const route = useRoute()
const isSeries = computed(() => route.query.type === 'serie')
const title = ref('')
const subtitle = ref('')
const poster = ref<string | null>(null)
const loading = ref(false)

const loadPlayer = async () => {
  loading.value = true
  try {
    if (isSeries.value) {
      const response = await fetchSerie(String(route.params.id))
      const serie = response.data?.attributes as Serie | undefined
      title.value = serie?.title || 'Serie'
      subtitle.value = 'Episode en cours'
      poster.value = resolveMediaUrl(serie?.poster || null)
    } else {
      const response = await fetchMovie(String(route.params.id))
      const movie = response.data?.attributes as Movie | undefined
      title.value = movie?.title || 'Film'
      subtitle.value = movie?.duration ? `${movie.duration} min` : 'Lecture'
      poster.value = resolveMediaUrl(movie?.poster || null)
    }
  } finally {
    loading.value = false
  }
}

onMounted(loadPlayer)
</script>

<template>
  <section class="player-shell">
    <div class="player-frame" :style="poster ? { backgroundImage: `url(${poster})` } : {}">
      <div class="player-overlay">
        <span class="pill">Lecture privee</span>
        <h1>{{ title }}</h1>
        <p>{{ subtitle }}</p>
        <div class="player-actions">
          <button class="cta">Reprendre</button>
          <button class="ghost">Options</button>
        </div>
      </div>
    </div>
    <aside class="player-aside">
      <div class="section-head">
        <h2>Details</h2>
        <button class="ghost small">Qualite</button>
      </div>
      <div class="continue-card">
        <div class="card-info">
          <h3>{{ loading ? 'Chargement...' : 'Lecture en cours' }}</h3>
          <span>Progression sauvegardee automatiquement</span>
          <div class="progress">
            <div class="progress-bar" style="width: 45%"></div>
          </div>
        </div>
      </div>
    </aside>
  </section>
</template>
