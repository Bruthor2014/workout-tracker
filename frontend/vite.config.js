import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Esta versão do Vite usa o bundler Rolldown, que precisa de uma
        // função aqui (não o objeto antigo do Rollup) — devolve o nome do
        // chunk pelo pacote do módulo.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("react-router-dom") || id.includes("/react/") || id.includes("/react-dom/")) return "vendor";
          if (id.includes("recharts")) return "charts";
          return undefined;
        },
      },
    },
  },
})
