import { assetPath, assetSrcSet } from "../lib/assetPath.js";
import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

export default function LoadingScreen({reduced,onComplete,onSkip}){
  const root=useRef(),[failed,setFailed]=useState(false);
  // The cover is a short introduction; navigation never waits for WebGL or the image.
  useEffect(()=>{
    let tween;
    const timer=setTimeout(()=>{
      if(reduced)onComplete();
      else tween=gsap.to(root.current,{opacity:0,y:-6,duration:.15,ease:'power2.out',onComplete});
    },reduced?0:280);
    return()=>{clearTimeout(timer);tween?.kill();};
  },[reduced,onComplete]);
  return <div ref={root} className="botanical-loader" role="status" aria-label="作品集正在加载">
    <div className="frame-florals" aria-hidden="true"><i/><i/></div><div className="loader-top"><span>ELOWEN</span><span>DESIGN / MOTION / DIGITAL</span></div>
    <div className="loader-title"><span className="loader-kicker">ELOWEN / DESIGN PORTFOLIO</span>{!failed?<img src={assetPath("/assets/portfolio-botanical-elowen-display.webp")} srcSet={assetSrcSet("/assets/portfolio-botanical-elowen-mobile.webp 768w, /assets/portfolio-botanical-elowen-display.webp 1400w")} sizes="(max-width:760px) calc(100vw - 50px), (max-width:1217px) 92vw, 1120px" decoding="async" alt="PORTFOLIO，花枝与藤蔓组成的英文作品集标题" onError={()=>setFailed(true)}/>:<h1>PORTFOLIO</h1>}<div className="loader-title-caption"><span>欢迎浏览我的作品集。</span><span>作品集 / ELOWEN</span></div></div>
    <div className="loader-bottom"><p>欢迎进入创作小镇。</p><div className="loader-line"><i/></div><button onClick={onSkip}>直接浏览作品 ↗</button></div>
  </div>;
}
