import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// For a project GitHub Pages site: https://f-gav.github.io/At-your-service/
// Set VITE_BASE_PATH=/ to use a custom domain at the site root later.
export default defineConfig({
  plugins: [react(),{
    name:'pages-routes',
    generateBundle:{order:'post',handler(_options,bundle){
      const index=bundle['index.html'];
      if(!index||index.type!=='asset')throw new Error('Missing site entry');
      for(const path of ['library/index.html','characters/index.html']){
        this.emitFile({type:'asset',fileName:path,source:index.source});
      }
      const base=JSON.stringify(process.env.VITE_BASE_PATH||'/At-your-service/');
      this.emitFile({type:'asset',fileName:'404.html',source:`<!doctype html><html lang="ru"><meta charset="utf-8"><title>At your service!</title><script>location.replace(${base}+'?__route='+encodeURIComponent(location.pathname+location.search+location.hash))</script><body>Открываем страницу…</body></html>`});
    }}
  }],
  base: process.env.VITE_BASE_PATH || '/At-your-service/',
});
