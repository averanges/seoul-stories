import { useEffect, useState } from 'react';
import type { Scene } from './types';
type Frame = { src: string; scene: Scene };
export function SceneImage({src,scene,instant=false}:{src:string;scene:Scene;instant?:boolean}) {
  const [shown,setShown]=useState<Frame>({src,scene});
  const [previous,setPrevious]=useState<Frame>();
  useEffect(()=>{
    if(src===shown.src)return;
    let cancelled=false;const image=new Image();image.src=src;
    image.decode().catch(()=>undefined).then(()=>{if(!cancelled){setPrevious(instant || scene.transition === 'cut' ? undefined : shown);setShown({src,scene});}});
    return()=>{cancelled=true;};
  },[src,scene,shown,instant]);
  useEffect(()=>{if(!previous)return;const timer=setTimeout(()=>setPrevious(undefined),650);return()=>clearTimeout(timer);},[previous]);
  const layer=(frame:Frame,old:boolean)=>{
    const crop=frame.scene.frame;
    return <div key={frame.src} className={`image-layer ${old?'outgoing':'incoming'} ${instant || frame.scene.transition === 'cut' ? 'instant' : ''}`} style={instant || frame.scene.transition === 'cut' ? {animation:'none'} : undefined}>
      {crop ? <div className="frame-window" style={{'--ratio':crop.aspect,'--image-top':`${-crop.top/(1-crop.top-crop.bottom)*100}%`} as React.CSSProperties}><img src={frame.src} alt={old?'':frame.scene.label} aria-hidden={old || undefined}/></div>
      : <img src={frame.src} alt={old?'':frame.scene.label} aria-hidden={old || undefined} style={{objectFit:frame.scene.fit,objectPosition:`${frame.scene.focus.x*100}% ${frame.scene.focus.y*100}%`}}/>}
    </div>;
  };
  return <div className="illustration">{!(instant && shown.src !== src) && <>{previous&&layer(previous,true)}{layer(shown,false)}</>}<div className="stage-vignette"/></div>;
}

