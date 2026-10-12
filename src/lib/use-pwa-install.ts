import {useEffect,useState} from 'react';
export type DeferredInstallEvent = Event & {
  prompt:()=>Promise<void>;
  userChoice:Promise<{outcome:'accepted'|'dismissed'}>;
};
/** Chrome/Android fires beforeinstallprompt only for eligible installable PWAs. */
export function usePwaInstall() {
  const [prompt,setPrompt]=useState<DeferredInstallEvent|null>(null);
  useEffect(()=>{
    const onPrompt=(event:Event)=>{
      event.preventDefault();
      setPrompt(event as DeferredInstallEvent);
    };
    const onInstalled=()=>setPrompt(null);
    window.addEventListener('beforeinstallprompt',onPrompt);
    window.addEventListener('appinstalled',onInstalled);
    return ()=>{
      window.removeEventListener('beforeinstallprompt',onPrompt);
      window.removeEventListener('appinstalled',onInstalled);
    };
  },[]);
  const install=async()=>{
    if(!prompt)return;
    try {
      await prompt.prompt();
      await prompt.userChoice;
    }finally {setPrompt(null);}
  };
  return {canInstall:!!prompt,install};
}
