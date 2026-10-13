// Build-Variante für die Vorschau als claude.ai-Artifact: React & Recharts kommen vom CDN
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  base: './',
  plugins: [react({ jsxRuntime: 'classic' })],
  build: {
    outDir: 'dist-artifact',
    cssCodeSplit: false,
    rollupOptions: {
      external: ['react', 'react-dom', 'react-dom/client', 'recharts'],
      output: { format: 'iife', globals: { react: 'React', 'react-dom': 'ReactDOM', 'react-dom/client': 'ReactDOM', recharts: 'Recharts' }, entryFileNames: 'app.js', assetFileNames: 'app.[ext]' },
    },
  },
});
