import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from "@tailwindcss/vite";


// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  esbuild: {
    loader: 'jsx',
    include: /\.(js|jsx)$/,
  },
  server: {
    // proxy: {
    //   '/admin': 'http://localhost:4000',
    // },
    proxy: {
      '/admin': 'https://url-shortner-uk9k.onrender.com',
    },
  },
})