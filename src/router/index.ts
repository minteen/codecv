import { RouteRecordRaw, createRouter, createWebHashHistory } from 'vue-router'

/* 统一导入路由 */
const routeFiles = import.meta.glob('./modules/*.ts', { eager: true })
export const routeConfiguras: RouteRecordRaw[] = []

Object.keys(routeFiles).forEach(routeModule => {
  ;(routeFiles[routeModule] as any).default &&
    routeConfiguras.push((routeFiles[routeModule] as any).default)
})

const routes: RouteRecordRaw[] = [
  {
    path: '/home',
    redirect: to => ({ path: '/', query: to.query, hash: to.hash })
  },
  {
    path: '/download',
    name: 'download',
    component: () => import('@/views/download/index.vue')
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/404/index.vue')
  }
]

const topInitList = [
  '/community/detail',
  '/syntax/helper',
  '/template',
  '/update/line',
  '/',
  '/editor'
]

const router = createRouter({
  routes: routeConfiguras.concat(routes),
  history: createWebHashHistory(),
  scrollBehavior: (to, from, savePos) => {
    if (topInitList.includes(to.path)) return { top: 0 /*  behavior: 'smooth' */ }
    if (savePos) return savePos
  }
})

// Compatibility with links produced by the previous modal-based creation flow.
router.beforeEach(to => {
  if (to.path === '/' && to.query.create === '1') return { path: '/template', replace: true }
})

export default router
