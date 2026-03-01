import { defineConfig } from 'vite';
import path from 'path';
import fs from 'fs';

function copyDirSync(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export default defineConfig({
  root: '.',
  base: '/',
  publicDir: false,
  server: {
    port: 3000,
    host: true,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/assets/banners': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/assets/midi': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    {
      name: 'copy-assets',
      closeBundle() {
        const src = path.resolve(__dirname, 'assets');
        const dest = path.resolve(__dirname, 'dist', 'assets');
        copyDirSync(src, dest);
        fs.copyFileSync(
          path.resolve(__dirname, 'manifest.json'),
          path.resolve(__dirname, 'dist', 'manifest.json'),
        );
      },
    },
  ],
  build: {
    outDir: 'dist',
    assetsDir: 'vite-assets',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        editor: path.resolve(__dirname, 'editor/index.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
  assetsInclude: ['**/*.png', '**/*.jpg', '**/*.jpeg', '**/*.gif', '**/*.mp4'],
});
