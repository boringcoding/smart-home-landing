import { defineConfig } from 'vite';
import { execFileSync } from 'node:child_process';
const revision = process.env.GITHUB_SHA?.slice(0, 8) || (() => {
  try { return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return 'local'; }
})();
const buildId = `${revision} · ${new Date().toISOString()}`;
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  define: { 'import.meta.env.VITE_BUILD_ID': JSON.stringify(buildId) },
  plugins: [{ name: 'static-hosting-fallback', transformIndexHtml(html) {
    html = html.replaceAll('__SMART_HOUSE_BUILD__', buildId);
    return process.env.VITE_STATIC_HOSTING === 'true'
      ? html.replace(/<a\b[^>]*id="local-request-link"[^>]*>[^<]*<\/a>/, 'Комплектацию можно сохранить после загрузки приложения.')
      : html;
  } }],
  server: { host:'127.0.0.1', proxy:{'/api':{target:`http://127.0.0.1:${process.env.SMART_HOUSE_API_PORT||4174}`},'/request':{target:`http://127.0.0.1:${process.env.SMART_HOUSE_API_PORT||4174}`}} },
  build: { chunkSizeWarningLimit:900, rollupOptions:{output:{manualChunks:(id:string)=>id.includes('/node_modules/three/')?'three':undefined}} }
});
