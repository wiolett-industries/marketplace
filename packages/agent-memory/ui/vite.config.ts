import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The UI ships prebuilt inside the npm package and is served by the `view`
// command from dist/ui. Relative base keeps asset URLs valid regardless of host.
export default defineConfig({
  root: __dirname,
  base: './',
  plugins: [react()],
  build: {
    outDir: '../dist/ui',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
  },
});
