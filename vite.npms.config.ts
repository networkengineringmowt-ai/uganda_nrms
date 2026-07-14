import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { existsSync, renameSync } from 'fs';

const pagesEntryPlugin = {
  name: 'npms-pages-entry',
  closeBundle() {
    const source = path.resolve(__dirname, 'dist-npms/index.npms.html');
    const target = path.resolve(__dirname, 'dist-npms/index.html');
    if (existsSync(source)) renameSync(source, target);
  },
};

export default defineConfig({
  plugins: [react(), pagesEntryPlugin],
  base: '/uganda_npms/',
  define: {
    'import.meta.env.VITE_STANDALONE': JSON.stringify('1'),
    'import.meta.env.VITE_APP_ID': JSON.stringify('npms'),
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    outDir: 'dist-npms',
    emptyOutDir: true,
    rollupOptions: {
      input: { index: path.resolve(__dirname, 'index.npms.html') },
      output: {
        manualChunks: {
          'vendor-leaflet': ['leaflet', 'react-leaflet'],
          'vendor-recharts': ['recharts'],
        },
      },
    },
    chunkSizeWarningLimit: 1500,
  },
});
