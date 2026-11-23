import { createApp } from 'vue'
import App from './App.vue'
import router from './permission'
import '@/assets/global.scss'
import 'element-plus/theme-chalk/dark/css-vars.css'
import pinia from '@/store'
import { loadTemplateLibrary } from '@/templates/config'

loadTemplateLibrary().finally(() => createApp(App).use(router).use(pinia).mount('#app'))
