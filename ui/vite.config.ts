import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Free, local dev server only. No paid hosting required — see README §10.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/products': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/synthetic': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: "esnext",
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "framer-motion", "lucide-react"],
          charts: ["recharts"],
        },
      },
    },
  },
});
