import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import qiankun from 'vite-plugin-qiankun'

const useDevMode = process.env.NODE_ENV === 'development'

export default defineConfig({
  plugins: [
    react(),
    qiankun('example-component', {
      useDevMode
    })
  ],
  server: {
    port: 3001,
    cors: true,
    origin: 'http://localhost:3001'
  },
  base: useDevMode ? '/' : '/example/',
  build: {
    outDir: 'dist',
    lib: {
      entry: './src/main.tsx',
      name: 'ExampleComponent',
      formats: ['umd']
    }
  }
})
