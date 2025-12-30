import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, existsSync } from 'fs';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  base: './',
  publicDir: resolve(__dirname, 'public'),
  build: {
    outDir: resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/renderer/index.html'),
        settings: resolve(__dirname, 'src/renderer/settings-app.html'),
        chat: resolve(__dirname, 'src/renderer/chat-window.html'),
      },
    },
  },

  plugins: [
    vue(),
    {
      name: 'copy-html-files',
      closeBundle() {
        // 复制 motion.html
        const motionSrc = resolve(__dirname, 'src/renderer/motion.html');
        const motionDest = resolve(__dirname, 'dist/renderer/motion.html');
        copyFileSync(motionSrc, motionDest);
        console.log('✅ motion.html copied to dist');
        
        // 复制老的 settings.html (保留备用)
        const settingsSrc = resolve(__dirname, 'src/renderer/settings.html');
        const settingsDest = resolve(__dirname, 'dist/renderer/settings-old.html');
        copyFileSync(settingsSrc, settingsDest);
        console.log('✅ settings-old.html copied');
        
        // 将 settings-app.html 重命名为 settings.html
        const settingsVueSrc = resolve(__dirname, 'dist/renderer/settings-app.html');
        const settingsVueDest = resolve(__dirname, 'dist/renderer/settings.html');
        if (existsSync(settingsVueSrc)) {
          copyFileSync(settingsVueSrc, settingsVueDest);
          console.log('✅ settings-app.html → settings.html');
        }
      }
    }
  ]
});
