import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        studio: resolve(import.meta.dirname, 'studio/index.html'),
        book: resolve(import.meta.dirname, 'studio/book/index.html'),
      },
    },
  },
});
