import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// For a project GitHub Pages site: https://f-gav.github.io/At-your-service/
// Set VITE_BASE_PATH=/ to use a custom domain at the site root later.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || '/At-your-service/',
});
