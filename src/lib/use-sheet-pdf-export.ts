import {useEffect,useRef,useState} from 'react';
import {exportRenderedSheetPdf} from './sheet-pdf';
import type {PdfSystem} from './sheet-pdf';

/** Shared PDF lifecycle; sheet-specific layout and names stay with each caller. */
export function useSheetPdfExport(system:PdfSystem,name:()=>string,autoExport=false,onAutoExportComplete?:()=>void){
  const pdfRoot=useRef<HTMLElement>(null);
  const pdfInFlight=useRef(false);
  const pdfAutoStarted=useRef(false);
  const [exportingPdf,setExportingPdf]=useState(false);
  const [pdfError,setPdfError]=useState('');
  const nameRef=useRef(name);
  nameRef.current=name;
  const completeRef=useRef(onAutoExportComplete);
  completeRef.current=onAutoExportComplete;
  const autoRef=useRef(autoExport);
  autoRef.current=autoExport;
  async function exportPdf(){
    if(pdfInFlight.current||!pdfRoot.current)return;
    pdfInFlight.current=true;setExportingPdf(true);setPdfError('');
    try{await exportRenderedSheetPdf(pdfRoot.current,nameRef.current(),system);}
    catch(cause){setPdfError(cause instanceof Error?cause.message:'Ошибка экспорта PDF.');}
    finally{
      pdfInFlight.current=false;setExportingPdf(false);
      if(autoRef.current)completeRef.current?.();
    }
  }
  useEffect(()=>{
    if(!autoExport){pdfAutoStarted.current=false;return;}
    if(pdfAutoStarted.current)return;
    pdfAutoStarted.current=true;
    const timer=window.setTimeout(()=>{void exportPdf();},600);
    return ()=>window.clearTimeout(timer);
  },[autoExport]);
  return {pdfRoot,exportPdf,exportingPdf,pdfError};
}
