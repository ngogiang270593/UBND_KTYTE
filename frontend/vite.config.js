import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: mode === "web" ? "dist-web" : "dist",
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": {
        target: mode === "web" ? "http://127.0.0.1:5023" : "http://127.0.0.1:5022",
        changeOrigin: true,
      },
      "/swagger": {
        target: mode === "web" ? "http://127.0.0.1:5023" : "http://127.0.0.1:5022",
        changeOrigin: true,
      },
    },
  },
}));