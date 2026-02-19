<script setup lang="ts">
const continueWatching = [
  { title: 'Nocturne City', meta: 'S1 - E4', progress: 0.62, timeLeft: '18 min restantes' },
  { title: 'Silent Atlas', meta: 'Film', progress: 0.34, timeLeft: '1h 02 restantes' },
  { title: 'Aurora Divide', meta: 'S2 - E1', progress: 0.9, timeLeft: '4 min restantes' },
]

const rails = [
  {
    title: 'Tendances',
    items: [
      { title: 'Glass Harbor', tag: 'Thriller', year: '2024', badge: 'Nouveau' },
      { title: 'Marelle', tag: 'Drame', year: '2022', badge: '4K' },
      { title: 'Silverline', tag: 'Sci-Fi', year: '2023', badge: 'VF' },
      { title: 'Opaline', tag: 'Romance', year: '2021', badge: 'VOSTFR' },
      { title: 'Pulse Theory', tag: 'Action', year: '2024', badge: 'HDR' },
    ],
  },
  {
    title: 'Series a reprendre',
    items: [
      { title: 'Night Meridian', tag: 'Mystere', year: 'S3', badge: 'E08' },
      { title: 'Blue Paradox', tag: 'Crime', year: 'S1', badge: 'E02' },
      { title: 'Kite District', tag: 'Drama', year: 'S2', badge: 'E05' },
      { title: 'Atlas Code', tag: 'Tech', year: 'S1', badge: 'E09' },
      { title: 'Brass Room', tag: 'Indie', year: 'S4', badge: 'E01' },
    ],
  },
  {
    title: 'Ajoutes recemment',
    items: [
      { title: 'Lumen 12', tag: 'SF', year: '2024', badge: 'HDR' },
      { title: 'Cold Frame', tag: 'Thriller', year: '2023', badge: '4K' },
      { title: 'Velvet Run', tag: 'Action', year: '2022', badge: 'VF' },
      { title: 'Paper Sky', tag: 'Aventure', year: '2021', badge: 'VOSTFR' },
      { title: 'Echelon', tag: 'Spy', year: '2024', badge: 'Nouveau' },
    ],
  },
]

const filters = ['Tout', 'Films', 'Series', 'Anime', 'Documentaires', '4K', 'VOSTFR']
</script>

<template>
  <section class="hero">
    <div class="hero-content">
      <div class="eyebrow">Reprenez exactement ou vous etiez</div>
      <h1>
        Votre cinema prive,
        <span class="accent">sans compromis</span>
      </h1>
      <p>
        Un catalogue maitrise, des reprises instantanees et une experience fluide pour toi et ton entourage.
        Recherchez, filtrez, sauvegardez, regardez.
      </p>
      <div class="hero-actions">
        <button class="cta">Commencer</button>
        <button class="ghost">Parcourir le catalogue</button>
      </div>
      <div class="hero-meta">
        <div>
          <span class="meta-label">Qualite</span>
          <span class="meta-value">4K / HDR / VOSTFR</span>
        </div>
        <div>
          <span class="meta-label">Acces</span>
          <span class="meta-value">100% prive - comptes geres</span>
        </div>
      </div>
    </div>

    <div class="hero-card">
      <div class="card-header">
        <span class="pill">Continue watching</span>
        <span class="time">Maintenant</span>
      </div>
      <h3>Silent Atlas</h3>
      <p>Film - 2h 08 - 4K</p>
      <div class="progress">
        <div class="progress-bar" style="width: 34%"></div>
      </div>
      <div class="card-actions">
        <button class="cta small">Reprendre</button>
        <button class="ghost small">Details</button>
      </div>
      <div class="card-foot">
        <span>1h 02 restantes</span>
        <span>Derniere lecture: hier</span>
      </div>
    </div>
  </section>

  <section class="search-panel">
    <div class="search-box">
      <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M11 4a7 7 0 1 1 0 14a7 7 0 0 1 0-14Zm0-2a9 9 0 1 0 5.6 16.1l4.1 4.1a1 1 0 0 0 1.4-1.4l-4.1-4.1A9 9 0 0 0 11 2Z"
          fill="currentColor"
        />
      </svg>
      <input type="text" placeholder="Rechercher un film, une serie, un genre..." />
      <button class="ghost small">Filtres</button>
    </div>
    <div class="filter-row">
      <button v-for="filter in filters" :key="filter" class="chip">
        {{ filter }}
      </button>
    </div>
  </section>

  <section class="section" style="--delay: 0.1s">
    <div class="section-head">
      <h2>Reprendre</h2>
      <span class="section-sub">Progression sauvegardee automatiquement</span>
    </div>
    <div class="continue-grid">
      <article v-for="item in continueWatching" :key="item.title" class="continue-card">
        <div class="card-media"></div>
        <div class="card-info">
          <h3>{{ item.title }}</h3>
          <span>{{ item.meta }}</span>
          <div class="progress">
            <div class="progress-bar" :style="{ width: `${item.progress * 100}%` }"></div>
          </div>
          <p>{{ item.timeLeft }}</p>
        </div>
      </article>
    </div>
  </section>

  <section
    v-for="(rail, index) in rails"
    :key="rail.title"
    class="section"
    :style="{ '--delay': `${0.2 + index * 0.08}s` }"
  >
    <div class="section-head">
      <h2>{{ rail.title }}</h2>
      <button class="ghost small">Voir tout</button>
    </div>
    <div class="rail">
      <article v-for="item in rail.items" :key="item.title" class="media-card">
        <div class="media-cover">
          <span class="badge">{{ item.badge }}</span>
        </div>
        <div class="media-info">
          <h3>{{ item.title }}</h3>
          <span>{{ item.tag }} - {{ item.year }}</span>
        </div>
      </article>
    </div>
  </section>
</template>
