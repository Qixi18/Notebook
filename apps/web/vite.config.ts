import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // 后端地址从根目录 .env 读取，默认 8000。
  // 端口被占用时可用 NOTEBOOK_PORT 切换，无需改代码。
  const env = loadEnv(mode, '../../', '')
  const backendPort = env.NOTEBOOK_PORT || env.VITE_BACKEND_PORT || '8000'

  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
      port: 5173,
      proxy: {
        '/api': `http://127.0.0.1:${backendPort}`,
      },
    },
  }
})

