import Layout from '@/layout/main.vue'

export default {
  name: 'syntax',
  path: '/syntax',
  redirect: '/syntax/helper',
  component: Layout,
  children: [
    {
      path: '/syntax/helper',
      name: 'syntaxHelper',
      meta: { workspace: true },
      component: () => import('@/views/syntax/syntax.vue')
    }
  ]
}
