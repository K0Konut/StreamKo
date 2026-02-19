<script setup lang="ts">
const playlist = [
  { title: 'Episode 1 - Lueur', duration: '48 min', active: false },
  { title: 'Episode 2 - Ligne noire', duration: '46 min', active: true },
  { title: 'Episode 3 - Puits froid', duration: '50 min', active: false },
  { title: 'Episode 4 - Echo', duration: '43 min', active: false },
]
</script>

<template>
  <section class="player-shell">
    <div class="player-frame">
      <div class="player-overlay">
        <span class="pill">Lecture privee</span>
        <h1>Night Meridian</h1>
        <p>S3 - E2 · Ligne noire</p>
        <div class="player-actions">
          <button class="cta">Reprendre</button>
          <button class="ghost">Options</button>
        </div>
      </div>
    </div>
    <aside class="player-aside">
      <div class="section-head">
        <h2>Episodes</h2>
        <button class="ghost small">Saison 3</button>
      </div>
      <div class="episode-list compact">
        <article v-for="episode in playlist" :key="episode.title" class="episode-row">
          <div>
            <h3 :class="{ active: episode.active }">{{ episode.title }}</h3>
            <span>{{ episode.duration }}</span>
          </div>
          <button class="ghost small">Lire</button>
        </article>
      </div>
    </aside>
  </section>
</template>
