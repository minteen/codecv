import Layout from '@/layout/main.vue'

export default {
  path: '/',
  component: Layout,
  children: [
    {
      path: '',
      name: 'home',
      meta: { workspace: true },
      component: () => import('@/views/home/home.vue')
    }
  ]
}
