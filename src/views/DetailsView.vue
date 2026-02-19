<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const isSeries = computed(() => route.params.type === 'serie')

const title = computed(() => (isSeries.value ? 'Night Meridian' : 'Silent Atlas'))
const meta = computed(() => (isSeries.value ? 'S3 · 10 episodes' : 'Film · 2h 08'))

const episodes = [
  { title: 'Episode 1 - Lueur', duration: '48 min' },
  { title: 'Episode 2 - Ligne noire', duration: '46 min' },
  { title: 'Episode 3 - Puits froid', duration: '50 min' },
  { title: 'Episode 4 - Echo', duration: '43 min' },
]
</script>

<template>
  <section class="detail-hero">
    <div class="detail-backdrop"></div>
    <div class="detail-content">
      <div class="eyebrow">Fiche</div>
      <h1>{{ title }}</h1>
      <p class="detail-meta">{{ meta }} · Thriller · 4K · VOSTFR</p>
      <p class="detail-desc">
        Atmospheres denses, intrigues a tiroirs et une mise en scene precise. Tout est concu pour une
        experience premium.
      </p>
      <div class="hero-actions">
        <button class="cta">Lire</button>
        <button class="ghost">Ajouter a ma liste</button>
      </div>
    </div>
    <aside class="detail-card">
      <div class="media-cover"></div>
      <div class="detail-stats">
        <div>
          <span class="meta-label">Qualite</span>
          <span class="meta-value">4K / HDR</span>
        </div>
        <div>
          <span class="meta-label">Audio</span>
          <span class="meta-value">VF / VOSTFR</span>
        </div>
      </div>
    </aside>
  </section>

  <section class="section">
    <div class="section-head">
      <h2>Reprendre</h2>
      <button class="ghost small">Reprendre l'episode</button>
    </div>
    <div class="continue-card detail-progress">
      <div class="card-media"></div>
      <div class="card-info">
        <h3>Episode 4 - Echo</h3>
        <span>Position 32:18</span>
        <div class="progress">
          <div class="progress-bar" style="width: 62%"></div>
        </div>
        <p>18 min restantes</p>
      </div>
    </div>
  </section>

  <section v-if="isSeries" class="section">
    <div class="section-head">
      <h2>Episodes</h2>
      <button class="ghost small">Saison 3</button>
    </div>
    <div class="episode-list">
      <article v-for="episode in episodes" :key="episode.title" class="episode-row">
        <div>
          <h3>{{ episode.title }}</h3>
          <span>{{ episode.duration }}</span>
        </div>
        <button class="ghost small">Lire</button>
      </article>
    </div>
  </section>

  <section class="section">
    <div class="section-head">
      <h2>Recommandations</h2>
      <button class="ghost small">Voir tout</button>
    </div>
    <div class="rail">
      <article v-for="index in 5" :key="index" class="media-card">
        <div class="media-cover"></div>
        <div class="media-info">
          <h3>Selection {{ index }}</h3>
          <span>Thriller - 2024</span>
        </div>
      </article>
    </div>
  </section>
</template>
