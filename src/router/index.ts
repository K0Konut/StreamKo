import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/HomeView.vue'),
  },
  {
    path: '/films',
    name: 'films',
    component: () => import('../views/CatalogView.vue'),
  },
  {
    path: '/series',
    name: 'series',
    component: () => import('../views/CatalogView.vue'),
  },
  {
    path: '/ma-liste',
    name: 'watchlist',
    component: () => import('../views/WatchlistView.vue'),
  },
  {
    path: '/title/:type/:id',
    name: 'details',
    component: () => import('../views/DetailsView.vue'),
  },
  {
    path: '/watch/:id',
    name: 'player',
    component: () => import('../views/PlayerView.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})

export default router
