import Layout from '@/layout/main.vue'

export default {
  path: '/template',
  component: Layout,
  children: [
    {
      path: '',
      name: 'template',
      meta: { workspace: true },
      component: () => import('@/views/template/template.vue')
    }
  ]
}
