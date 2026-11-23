import router from './router'
import nprogress from 'nprogress'
import 'nprogress/nprogress.css'

nprogress.configure({ easing: 'ease', speed: 300 })
router.beforeEach(to => {
  if (to.path !== '/download') nprogress.start()
})
router.afterEach(() => nprogress.done())
export default router
