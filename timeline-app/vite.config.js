import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  build: {
    outDir: resolve(__dirname, "../assets/timeline"),
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: resolve(__dirname, "src/main.jsx"),
      name: "RashtTimeline",
      formats: ["iife"],
      fileName: () => "rasht-timeline.js",
    },
    rollupOptions: {
      output: {
        assetFileNames: "rasht-timeline.[ext]",
      },
    },
  },
});
