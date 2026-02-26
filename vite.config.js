import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-content-scripts',
      closeBundle: () => {
        // Ensure build directory exists
        const buildDir = path.resolve(__dirname, 'build');
        if (!fs.existsSync(buildDir)) {
          fs.mkdirSync(buildDir, { recursive: true });
        }
        
        // Copy content.js from public to build
        const contentJsSrc = path.resolve(__dirname, 'public/content.js');
        const contentJsDest = path.resolve(__dirname, 'build/content.js');
        if (fs.existsSync(contentJsSrc)) {
          fs.copyFileSync(contentJsSrc, contentJsDest);
        }
        
        // Copy content.css from public to build
        const contentCssSrc = path.resolve(__dirname, 'public/content.css');
        const contentCssDest = path.resolve(__dirname, 'build/content.css');
        if (fs.existsSync(contentCssSrc)) {
          fs.copyFileSync(contentCssSrc, contentCssDest);
        }
        
        // Copy manifest.json from public to build
        const manifestSrc = path.resolve(__dirname, 'public/manifest.json');
        const manifestDest = path.resolve(__dirname, 'build/manifest.json');
        if (fs.existsSync(manifestSrc)) {
          fs.copyFileSync(manifestSrc, manifestDest);
        }
        
        // Copy background.js from public to build
        const backgroundSrc = path.resolve(__dirname, 'public/background.js');
        const backgroundDest = path.resolve(__dirname, 'build/background.js');
        if (fs.existsSync(backgroundSrc)) {
          fs.copyFileSync(backgroundSrc, backgroundDest);
        }
        
        // Copy icons folder
        const iconsSrc = path.resolve(__dirname, 'public/icons');
        const iconsDest = path.resolve(__dirname, 'build/icons');
        if (fs.existsSync(iconsSrc)) {
          if (!fs.existsSync(iconsDest)) {
            fs.mkdirSync(iconsDest, { recursive: true });
          }
          const iconFiles = fs.readdirSync(iconsSrc);
          iconFiles.forEach(file => {
            fs.copyFileSync(
              path.join(iconsSrc, file),
              path.join(iconsDest, file)
            );
          });
        }
      }
    }
  ],
  base: './',
  build: {
    outDir: 'build',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html'),
      output: {
        entryFileNames: 'popup.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});