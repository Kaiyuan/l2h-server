import { createRouter, createWebHistory } from 'vue-router'
import Dashboard from '../views/Dashboard.vue'
import Paths from '../views/Paths.vue'
import Settings from '../views/Settings.vue'
import Login from '../views/Login.vue'

const router = createRouter({
  history: createWebHistory('/dashboard/'),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: Login
    },
    {
      path: '/',
      name: 'dashboard',
      component: Dashboard,
      meta: { requiresAuth: true }
    },
    {
      path: '/paths',
      name: 'paths',
      component: Paths,
      meta: { requiresAuth: true }
    },
    {
      path: '/settings',
      name: 'settings',
      component: Settings,
      meta: { requiresAuth: true }
    }
  ]
})

router.beforeEach((to, _from, next) => {
  const isAuth = !!localStorage.getItem('token');
  if (to.meta.requiresAuth && !isAuth) {
    next('/login');
  } else {
    next();
  }
});

export default router
