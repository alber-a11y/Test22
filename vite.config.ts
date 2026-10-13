import { defineConfig } from 'vite';

// base: './' — относительные пути, чтобы билд работал на любом хостинге и игровых порталах.
export default defineConfig({
  base: './',
  build: {
    target: 'es2019',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1500,
  },
});
