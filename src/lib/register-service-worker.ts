/** Register only on HTTPS/localhost; scope respects Vite's GitHub Pages base path. */
export function registerServiceWorker():void {
  if(!('serviceWorker' in navigator))return;
  if(window.location.protocol!=='https:' && window.location.hostname!=='localhost')return;
  window.addEventListener('load',()=>{
    const scope=import.meta.env.BASE_URL;
    void navigator.serviceWorker.register(scope+'sw.js',{scope}).catch(error=>{
      console.warn('Не удалось подключить режим приложения:',error);
    });
  },{once:true});
}
