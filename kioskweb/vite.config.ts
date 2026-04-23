import { cpSync, mkdirSync } from 'node:fs';
import path from 'node:path';

import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

/**
 * 构建结束后将 src/assets 全量复制到 dist/__kiosk_assets，
 * 避免仅被打包引用资源覆盖：Docker/部署只挂载 dist 时也能带上全部静态文件。
 */
function copySrcAssetsPlugin(): import('vite').Plugin {
  return {
    name: 'copy-src-assets-to-dist',
    closeBundle() {
      const srcDir = path.resolve(process.cwd(), 'src/assets');
      const destDir = path.resolve(process.cwd(), 'dist/__kiosk_assets');
      try {
        mkdirSync(destDir, { recursive: true });
        cpSync(srcDir, destDir, { recursive: true });
      } catch (e) {
        console.warn('[vite] 复制 src/assets 到 dist 失败：', e);
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), copySrcAssetsPlugin()],
});
