import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
    meta: { layout: 'auth' },
  },
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

router.beforeEach((to) => {
  const token = localStorage.getItem('sk_token')
  if (!token && to.name !== 'login') {
    return { name: 'login' }
  }
  if (token && to.name === 'login') {
    return { name: 'home' }
  }
  return true
})

export default router
