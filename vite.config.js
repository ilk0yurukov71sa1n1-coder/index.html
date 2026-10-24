import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // No source maps in production: keeps internals out of the public bundle.
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      // Five pages: the landing site, the customer dashboard at /app, the local services page at /services, the booking demo at /book and the private background playground at /playground.
      input: { main: 'index.html', app: 'app.html', services: 'services.html', book: 'book.html', playground: 'playground.html' },
      output: {
        // three.js only ships with the sections that need it.
        manualChunks: (id) => (id.includes('node_modules/three') ? 'three' : undefined),
      },
    },
  },
});
