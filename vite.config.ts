import { defineConfig } from 'vite';
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [{ name: 'static-hosting-fallback', transformIndexHtml(html) {
    return process.env.VITE_STATIC_HOSTING === 'true'
      ? html.replace(/<a\b[^>]*id="local-request-link"[^>]*>[^<]*<\/a>/, 'Комплектацию можно сохранить после загрузки приложения.')
      : html;
  } }],
  server: { host:'127.0.0.1', proxy:{'/api':{target:`http://127.0.0.1:${process.env.SMART_HOUSE_API_PORT||4174}`},'/request':{target:`http://127.0.0.1:${process.env.SMART_HOUSE_API_PORT||4174}`}} },
  build: { chunkSizeWarningLimit:900, rollupOptions:{output:{manualChunks:(id:string)=>id.includes('/node_modules/three/')?'three':undefined}} }
});
