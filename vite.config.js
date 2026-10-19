import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // No source maps in production: keeps internals out of the public bundle.
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      // Three pages: the landing site, the customer dashboard at /app and the local services page at /services.
      input: { main: 'index.html', app: 'app.html', services: 'services.html' },
      output: {
        // three.js only ships with the sections that need it.
        manualChunks: (id) => (id.includes('node_modules/three') ? 'three' : undefined),
      },
    },
  },
});
