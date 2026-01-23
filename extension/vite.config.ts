import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { mkdirSync, existsSync, readFileSync, writeFileSync, rmSync } from 'fs';

// Plugin to fix output paths for Chrome extension
function chromeExtensionPlugin() {
  return {
    name: 'chrome-extension-fix',
    closeBundle() {
      const srcHtml = resolve(__dirname, 'dist/src/sidepanel/index.html');
      const destDir = resolve(__dirname, 'dist/sidepanel');
      const destHtml = resolve(destDir, 'index.html');

      if (existsSync(srcHtml)) {
        // Read and fix the paths in the HTML
        let html = readFileSync(srcHtml, 'utf-8');
        // Fix relative paths to be correct from sidepanel/ directory
        html = html.replace(/\.\.\/\.\.\/sidepanel\//g, './');
        html = html.replace(/\.\.\/\.\.\/assets\//g, '../assets/');

        if (!existsSync(destDir)) {
          mkdirSync(destDir, { recursive: true });
        }
        writeFileSync(destHtml, html);

        // Clean up the src directory in dist
        rmSync(resolve(__dirname, 'dist/src'), { recursive: true, force: true });
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), chromeExtensionPlugin()],
  base: './', // Use relative paths for Chrome extension
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'src/sidepanel/index.html'),
        background: resolve(__dirname, 'src/background/service-worker.ts'),
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === 'background') {
            return 'background/service-worker.js';
          }
          return 'sidepanel/[name].js';
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
