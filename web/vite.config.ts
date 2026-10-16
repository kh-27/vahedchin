import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The site is served from https://kh-27.github.io/vahedchin/
export default defineConfig({
  base: process.env.BASE_PATH ?? "/vahedchin/",
  plugins: [react()],
  worker: { format: "es" },
  build: { target: "es2022" },
});
