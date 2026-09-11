import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Free, local dev server only. No paid hosting required — see README §10.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
      '/products': 'http://localhost:8000',
      '/synthetic': 'http://localhost:8000',
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
