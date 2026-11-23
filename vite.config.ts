import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import AutoImport from 'unplugin-auto-import/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import { defineConfig, loadEnv } from 'vite'
import viteCompression from 'vite-plugin-compression'
import eslint from 'vite-plugin-eslint'
import { visualizer } from 'rollup-plugin-visualizer'
import { draftFilePlugin } from './build/draftFilePlugin'
import { templateFilePlugin } from './build/templateFilePlugin'

const viteCompressionPlugin = viteCompression({
  disable: false,
  threshold: 10240 // 如果体积大于阈值，将被压缩，单位为b，体积过小时请不要压缩，以免适得其反
})

export default ({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  return defineConfig({
    plugins: [
      draftFilePlugin(process.cwd()),
      templateFilePlugin(process.cwd()),
      vue(),
      AutoImport({
        resolvers: [ElementPlusResolver()]
      }),
      Components({
        resolvers: [ElementPlusResolver()]
      }),
      eslint({ lintOnStart: true, cache: false }) // 打包以及启动项目开启eslint检查
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    },
    esbuild: {
      drop: env?.VITE_DROP_CONSOLE === 'true' ? ['console', 'debugger'] : []
    },
    base: './',
    server: {
      host: '127.0.0.1',
      cors: { origin: /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/ },
      fs: {
        deny: [
          '.env',
          '.env.*',
          '*.{crt,pem,key}',
          '**/.git/**',
          '**/drafts/**',
          '**/template-library/**',
          '**/local-private/**',
          '**/tmp/**',
          '**/output/**'
        ]
      },
      proxy: {
        '/api/export': {
          target: 'http://127.0.0.1:3001',
          changeOrigin: true,
          configure(proxy) {
            proxy.on('proxyReq', request => request.removeHeader('origin'))
          }
        }
      }
    },
    preview: { host: '127.0.0.1' },
    build: {
      rollupOptions: {
        plugins: [
          viteCompressionPlugin,
          ...(env.VITE_ANALYZE === 'true' ? [visualizer({ open: false })] : [])
        ],
        output: {
          chunkFileNames: 'js/[name]-[hash].js',
          entryFileNames: 'js/[name]-[hash].js',
          assetFileNames: '[ext]/[name]-[hash].[ext]',
          manualChunks(id) {
            if (id.includes('node_modules')) {
              return id.toString().split('node_modules/')[1].split('/')[0].toString()
            }
          }
        }
      }
    }
  })
}
