import { assetPath } from "./lib/assetPath.js";
import { Suspense, lazy, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowUpRight, ArrowsOut, List, SpeakerHigh, SpeakerSlash, Sparkle, X } from '@phosphor-icons/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import Lenis from 'lenis';
import { ProjectArt, Blueprint, Dialog, SceneBoundary, useReducedMotion } from './PortfolioUI';
import { districts, projects, getProject } from './data/portfolio';
import { rooms, phaseAt, doorAt, doorProgress, clamp01 } from './data/journey';
import { createSoundscape, backgroundMusic } from './lib/sound';
import LoadingScreen from './components/LoadingScreen';

const JourneyScene=lazy(()=>import('./components/JourneyScene'));
const AboutProfile=lazy(()=>import('./components/AboutProfile'));
const MotionProject=lazy(()=>import('./components/MotionProject'));
const ProjectCaseStudy=lazy(()=>import('./components/ProjectCaseStudy'));
gsap.registerPlugin(ScrollTrigger,useGSAP);
const readRoom=()=>rooms.find(r=>r.id===new URLSearchParams(location.search).get('room'))?.id||null;
const directContent=()=>!!readRoom()||!!getProject(location.hash.slice(1));

function RoomPage({id,onClose,onSelect,onGo}){
  const room=rooms.find(r=>r.id===id),heading=useRef(),previous=useRef(document.activeElement);
  useEffect(()=>{heading.current?.focus({preventScroll:true});return()=>previous.current?.focus?.({preventScroll:true});},[id]);
  const items=projects.filter(p=>p.district===id);
  return <section className={`room-page${id==='about'?' profile-page':''}`} aria-label={room.label} data-lenis-prevent style={{'--room-color':room.color}}>
    <div className="frame-florals room-florals" aria-hidden="true"><i/><i/></div><header className="room-header"><button className="text-link" onClick={onClose}><ArrowLeft size={19}/>返回走廊</button><span>{id==='about'?'作品集 / 01':`ELOWEN’S / ROOM 0${room.index+1}`}</span><button className="icon-button" aria-label="关闭房间页面" onClick={onClose}><X size={21}/></button></header>
    {id!=='about'&&<div className="room-intro"><p>Elowen 的作品集</p><h1 ref={heading} tabIndex={-1}>{room.label}<span>0{room.index+1}</span></h1><div>{room.subtitle}</div></div>}
    {items.length>0&&<><div className={`room-gallery ${items.length===1?'room-gallery-single':''}`}>{items.map(p=><button className="room-work" key={p.id} onClick={()=>onSelect(p.id)}><ProjectArt project={p}/><div><span>{p.number} / {p.type}</span><ArrowUpRight size={22}/></div><h2>{p.title}{p.sample&&<small className="project-placeholder">待补充</small>}</h2><p>{p.tag}</p></button>)}</div><p className="room-note">{items.some(p=>!p.sample)?`已收录 ${items.filter(p=>!p.sample).length} 个项目${items.some(p=>p.sample)?'，其余位置待补充。':'。'}`:'作品位置已预留，项目标题与封面暂为示意内容。'}</p></>}
    {id==='about'&&<Suspense fallback={<p className="room-note" role="status">正在打开个人介绍…</p>}><AboutProfile headingRef={heading}/></Suspense>}
    {id==='vibecoding'&&<div className="vibe-room"><img src={assetPath("/assets/town-poster.svg")} alt="创作小镇的插画地图"/><div><p>EXPERIMENT 01 / 正在发生</p><h2>交互作品集小镇</h2><p>以三维小镇组织作品分类，通过滚动镜头、人物动画和门牌导航完成浏览。这座网站本身，也是一个交互设计实验。</p><button className="primary-link" onClick={()=>onGo(.19)}>再次体验骑行<ArrowUpRight size={19}/></button></div></div>}
    <footer className="room-foot"><span>返回走廊，继续浏览其他分类。</span><button className="text-link" onClick={onClose}>回到走廊<ArrowUpRight size={17}/></button></footer>
  </section>;
}

export default function JourneyApp(){
  const reduced=useReducedMotion(),root=useRef(),shell=useRef(),indexRef=useRef(),lenis=useRef(),lenisTick=useRef(),progress=useRef(0),invalidate=useRef(),sound=useRef(),shutter=useRef(),bar=useRef(),phaseRef=useRef('town'),doorRef=useRef(0),roomAnchor=useRef(null);
  const [phase,setPhase]=useState('town'),[door,setDoor]=useState(0),[room,setRoom]=useState(readRoom),[selected,setSelected]=useState(()=>getProject(location.hash.slice(1))?.id||null),[menu,setMenu]=useState(false),[filter,setFilter]=useState('projects'),[eco]=useState(()=>innerWidth<700||navigator.hardwareConcurrency<=4||navigator.connection?.saveData),[soundOn,setSoundOn]=useState(false),[audioStatus,setAudioStatus]=useState('idle');
  const [ready,setReady]=useState(false),[sceneMounted,setSceneMounted]=useState(false),[active,setActive]=useState(true),[visible,setVisible]=useState(()=>!document.hidden);
  const [entered,setEntered]=useState(directContent),[lookUp,setLookUp]=useState(false);
  const project=getProject(selected),modal=!!selected,currentDoor=rooms[door];
  // Prepare the first real 3D frame behind the loading artwork.
  const sceneActive=active&&visible&&!modal&&!room;
  const play=useCallback(kind=>sound.current?.play(kind),[]),onReady=useCallback(()=>setReady(true),[]);
  const completeLoading=useCallback(()=>setEntered(true),[]);
  const close=useCallback(()=>{setSelected(null);history.replaceState(null,'',location.pathname+location.search);},[]);
  const select=useCallback(id=>{const p=getProject(id);if(!p)return;setSelected(id);if(districts.some(d=>d.id===p.district))setFilter(p.district);play('open');history.replaceState(null,'',location.pathname+location.search+'#'+id);},[play]);
  const openRoom=useCallback(id=>{if(!rooms.some(r=>r.id===id))return;roomAnchor.current={phase:phaseRef.current,y:shell.current.getBoundingClientRect().top+window.scrollY+(shell.current.offsetHeight-innerHeight)*progress.current};setMenu(false);setRoom(id);sound.current?.setChapter(id);play('open');const url=new URL(location.href);url.searchParams.set('room',id);url.hash='';history.pushState({room:id},'',url.pathname+url.search);},[play]);
  const jumpTo=useCallback(p=>{setMenu(false);const top=shell.current.getBoundingClientRect().top+window.scrollY+(shell.current.offsetHeight-innerHeight)*p;if(lenis.current)lenis.current.scrollTo(top,{duration:reduced?0:1.5,force:true});else window.scrollTo({top,behavior:reduced?'instant':'smooth'});},[reduced]);
  const closeRoom=useCallback(()=>{const target=rooms.find(r=>r.id===room)?.index||0,saved=roomAnchor.current;setRoom(null);const url=new URL(location.href);url.searchParams.delete('room');url.hash='';history.replaceState(null,'',url.pathname+url.search);requestAnimationFrame(()=>{if(saved?.phase==='hall'){if(lenis.current)lenis.current.scrollTo(saved.y,{immediate:true,force:true});else window.scrollTo({top:saved.y,behavior:'instant'});ScrollTrigger.update();}else jumpTo(doorProgress(target));});},[room,jumpTo]);
  const enter=useCallback(()=>jumpTo(doorProgress(0)),[jumpTo]);
  const goIndex=useCallback(()=>{setMenu(false);if(lenis.current)lenis.current.scrollTo(indexRef.current,{offset:-10,force:true,immediate:true});else indexRef.current.scrollIntoView({behavior:'instant'});},[]);
  useEffect(()=>{sound.current=createSoundscape(status=>{setAudioStatus(status);if(status==='error')setSoundOn(false);});return()=>sound.current?.destroy();},[]);
  useEffect(()=>{const id=location.hash.slice(1);if(getProject(id))select(id);const pop=()=>{setRoom(readRoom());setSelected(getProject(location.hash.slice(1))?.id||null);};window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop);},[select]);
  useEffect(()=>{document.title=room?`${rooms.find(r=>r.id===room).label} · Elowen town`:'Elowen · 作品集';},[room]);
  useEffect(()=>{const obs=new IntersectionObserver(entries=>setActive(entries[0].isIntersecting),{threshold:.01});obs.observe(shell.current);return()=>obs.disconnect();},[]);
  useEffect(()=>{const update=()=>setVisible(!document.hidden);document.addEventListener('visibilitychange',update);return()=>document.removeEventListener('visibilitychange',update);},[]);
  useEffect(()=>{
    if(!sceneActive||sceneMounted)return;
    const frame=requestAnimationFrame(()=>{
      if(shell.current.getBoundingClientRect().bottom>0)startTransition(()=>setSceneMounted(true));
    });
    return()=>cancelAnimationFrame(frame);
  },[sceneActive,sceneMounted]);
  useEffect(()=>{if(reduced)return;const instance=new Lenis({duration:.85,smoothWheel:true,syncTouch:false});lenis.current=instance;instance.on('scroll',ScrollTrigger.update);const tick=t=>instance.raf(t*1000);lenisTick.current=tick;return()=>{gsap.ticker.remove(tick);instance.destroy();lenis.current=null;lenisTick.current=null;};},[reduced]);
  useEffect(()=>{const tick=lenisTick.current;if(!tick||room||modal||!entered||!visible)return;gsap.ticker.add(tick);return()=>gsap.ticker.remove(tick);},[room,modal,entered,reduced,visible]);
  useEffect(()=>{if(room||modal||!entered)lenis.current?.stop();else lenis.current?.start();const before=document.body.style.overflow;if(room||!entered)document.body.style.overflow='hidden';return()=>{document.body.style.overflow=before;};},[room,modal,entered]);
  useEffect(()=>{if(!menu)return;const key=e=>{if(e.key==='Escape')setMenu(false);};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[menu]);
  useGSAP(()=>{
    const playhead={p:0};
    const update=()=>{const p=playhead.p;progress.current=p;const next=phaseAt(p),d=doorAt(p);if(next!==phaseRef.current){phaseRef.current=next;setPhase(next);}if(d!==doorRef.current){doorRef.current=d;setDoor(d);}if(bar.current)bar.current.style.transform=`scaleX(${p})`;if(shutter.current)shutter.current.style.opacity=String(p<.5?clamp01((p-.475)/.025):clamp01((.525-p)/.025));invalidate.current?.();};
    gsap.to(playhead,{p:1,ease:'none',onUpdate:update,scrollTrigger:{trigger:shell.current,start:'top top',end:'bottom bottom',scrub:reduced?true:.65,invalidateOnRefresh:true}});
    const intro=root.current.querySelectorAll('.intro-copy > *');if(!reduced&&intro.length)gsap.from(intro,{y:18,autoAlpha:0,stagger:.09,duration:.8,ease:'power3.out'});
  },{scope:root,dependencies:[reduced],revertOnUpdate:true});
  const visibleProjects=useMemo(()=>projects.filter(p=>p.district===filter),[filter]);
  return <main ref={root}>
    <div inert={modal||room||!entered?true:undefined}>
    <a className="skip-link" href="#work-index">直接浏览作品索引</a>
    <section className="journey-scroll" ref={shell} aria-label="滚动探索创作小镇">
      <div className={`town-shell journey-stage phase-${phase}`}>
      <div className="town-frame">
        {phase==='town'&&<div className="frame-florals town-florals" aria-hidden="true"><i/><i/></div>}
        <div className="scene-canvas" aria-label="随滚动推进的三维小镇和六扇门走廊">
          {sceneMounted&&<SceneBoundary onFailure={onReady}><Suspense fallback={null}><JourneyScene progress={progress} eco={eco} reduced={reduced} active={sceneActive} inHall={phase==='hall'} play={play} onReady={onReady} onEnter={enter} onOpenRoom={openRoom} lookUp={lookUp} invalidateRef={invalidate}/></Suspense></SceneBoundary>}
        </div>
        <div className="journey-shutter" ref={shutter} aria-hidden="true"/>
        <header className="site-header"><button className="wordmark" onClick={()=>jumpTo(0)} aria-label="回到小镇全景"><span className="brand-script">Elowen</span><span className="brand-small">design & motion portfolio</span></button><nav className="desktop-nav" aria-label="作品直达"><button onClick={()=>openRoom('projects')}>课程项目<sup>06</sup></button><button onClick={()=>openRoom('web')}>实习项目<sup>06</sup></button><button onClick={()=>openRoom('motion')}>动效设计<sup>{districts.find(d=>d.id==='motion').count}</sup></button><button onClick={goIndex}>作品索引<ArrowUpRight size={14}/></button></nav><button className="journey-menu-toggle icon-button" aria-expanded={menu} aria-controls="room-menu" aria-label={menu?'收起房间导航':'打开六个房间导航'} onClick={()=>setMenu(v=>!v)}>{menu?<X size={24}/>:<List size={24}/>}</button></header>
        {menu&&<nav id="room-menu" className="room-menu" aria-label="六个房间">{rooms.map(r=><button key={r.id} onClick={()=>openRoom(r.id)}><span>0{r.index+1}</span>{r.label}<ArrowUpRight size={18}/></button>)}<button onClick={goIndex}><span>↳</span>作品索引<ArrowDown size={18}/></button></nav>}
        {phase==='town'&&<div className="intro-copy"><p className="intro-label">DESIGN PORTFOLIO / ELOWEN</p><h1>作品集</h1><p className="intro-description">欢迎来到我的创作小镇。<br/>请跟随我，一起浏览作品集。</p><div className="intro-actions"><button className="primary-link" onClick={()=>jumpTo(.19)}>开始浏览<ArrowDown size={18}/></button><button className="text-link" onClick={goIndex}>作品索引<ArrowUpRight size={16}/></button></div></div>}
        {phase==='ride'&&<div className="story-caption"><span>01 / ALONG THE STREET</span><h2>跟随我，走进小镇。</h2><p>向下滚动，沿街前往作品展厅。</p></div>}
        {phase==='cafe'&&<div className="story-caption cafe-caption"><span>02 / THE LITTLE ROSE HOUSE</span><h2>欢迎来到作品展厅。</h2><p>继续滚动或点击入口，进入展厅。<br/>也可以点击窗户和屋顶，发现小互动。</p><div><button className="primary-link" onClick={enter}>进入展厅<ArrowUpRight size={18}/></button></div></div>}
        {phase==='hall'&&<div className="hall-caption"><span>03 / THE CORRIDOR OF IDEAS</span><p>选择一扇门，浏览对应内容。</p><div><button className="text-link" aria-pressed={lookUp} onClick={()=>setLookUp(v=>!v)}>{lookUp?'低头看门':'抬头看灯'}<Sparkle size={16}/></button><button className="primary-link" onClick={()=>openRoom(currentDoor.id)}>进入{currentDoor.label}<ArrowUpRight size={17}/></button></div></div>}
        <div className="map-tools"><button className="icon-button" aria-label="恢复小镇全景" onClick={()=>jumpTo(0)}><ArrowsOut size={19}/></button><button className="icon-button" aria-label={soundOn?'暂停背景音乐《云村的夏天》':'播放背景音乐《云村的夏天》'} disabled={audioStatus==='loading'} aria-pressed={soundOn} onClick={async()=>setSoundOn(await sound.current.toggle())}>{soundOn?<SpeakerHigh size={19}/>:<SpeakerSlash size={19}/>}</button></div>
        {audioStatus!=='idle'&&<div className="music-caption" role="status"><strong>{backgroundMusic.title}<span> · {backgroundMusic.artist}</span></strong><span>{audioStatus==='loading'?'正在加载音乐…':audioStatus==='playing'?'正在播放':audioStatus==='paused'?'已暂停':'暂时无法播放'}</span>{audioStatus==='error'&&<a href={backgroundMusic.page} target="_blank" rel="noreferrer">在网易云收听 ↗</a>}</div>}
        <div className="journey-bottom"><p>{!ready?'小镇正在醒来':phase==='town'?'跟随骑行，点击小屋的门进入作品展厅':phase==='ride'?'向下滚动，跟随骑行前往我的小屋':phase==='cafe'?'点击小屋的门进入 · 窗户和屋顶藏着小互动':'继续滚动 · 点击彩色的门，走进作品'}</p><nav className="chapter-rail" aria-label="旅程章节"><button aria-current={phase==='town'?'step':undefined} onClick={()=>jumpTo(0)}>小镇</button><button aria-current={phase==='ride'?'step':undefined} onClick={()=>jumpTo(.24)}>骑行</button><button aria-current={phase==='cafe'?'step':undefined} onClick={()=>jumpTo(.41)}>小屋</button><button aria-current={phase==='hall'?'step':undefined} onClick={enter}>走廊</button></nav></div>
        <div className="journey-progress"><i ref={bar}/></div>
        {phase==='hall'&&<nav className="door-dots" aria-label="走廊中的六扇门">{rooms.map(r=><button key={r.id} className={r.index===door?'is-active':''} aria-label={`走到${r.label}门前`} aria-current={r.index===door?'step':undefined} style={{'--dot-color':r.color}} onClick={()=>jumpTo(doorProgress(r.index))}><span>0{r.index+1}</span><i/>{r.index===door&&<em>{r.label}</em>}</button>)}</nav>}
      </div></div>
    </section>
    <section ref={indexRef} className="work-index curated-index" id="work-index" aria-labelledby="index-title">
      <Blueprint/><div className="index-heading"><div><span className="index-small">SELECTED WORKS / ELOWEN</span><h2 id="index-title">作品索引</h2></div><p>从完整课程项目，到实习中的设计实践，<br/>再到关于形体、影像与时间的动效探索。</p></div>
      <div className="index-content"><div className="index-tabs" role="tablist" aria-label="作品分类" onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const i=districts.findIndex(d=>d.id===filter),n=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3;setFilter(districts[n].id);document.getElementById('tab-'+districts[n].id)?.focus();}}>
        {districts.map(d=><button key={d.id} id={'tab-'+d.id} role="tab" aria-label={`${d.title} ${d.count}`} tabIndex={filter===d.id?0:-1} aria-selected={filter===d.id} aria-controls="index-results" onClick={()=>setFilter(d.id)}><span className="index-tab-number">{d.number}</span><span className="index-tab-copy"><strong>{d.title}</strong><small>{d.english}</small></span><span className="index-tab-count">{d.count}</span></button>)}
      </div><div className="index-group-label"><span>{districts.find(d=>d.id===filter).kind}</span><span>{String(visibleProjects.length).padStart(2,'0')} SELECTED PROJECTS</span></div>
      <div className="project-grid" id="index-results" role="tabpanel" aria-labelledby={'tab-'+filter}>
        {visibleProjects.map(p=><button className="project-row" key={p.id} onClick={()=>select(p.id)}><span className="project-number">{p.number}</span><div className="project-thumb"><ProjectArt project={p}/></div><span className="project-text"><strong>{p.title}{p.sample&&<small className="project-placeholder">待补充</small>}</strong><span>{p.district==='motion'?p.type:p.tag}</span></span><ArrowUpRight size={22}/></button>)}
      </div><p className="sample-note">{visibleProjects.some(p=>!p.sample)?`已收录 ${visibleProjects.filter(p=>!p.sample).length} ${filter==='motion'?'组动效作品':filter==='web'?'个网页设计':'个完整项目'}${visibleProjects.some(p=>p.sample)?`，${visibleProjects.filter(p=>p.sample).length} 个项目位置待补充。`:'。'}`:'此分类暂为示意内容，作品待补充。'}</p></div>
      <div className="index-foot"><span>选择一个项目，查看背景、设计过程与最终成果。</span><button className="text-link" onClick={()=>jumpTo(0)}>返回小镇<ArrowUpRight size={16}/></button></div>
    </section>
    <footer className="site-footer"><button className="wordmark" onClick={()=>jumpTo(0)}><span className="brand-script">Elowen</span><span className="brand-small">design & motion portfolio</span></button><p>设计 / 动效 / 数字体验</p><button className="footer-about" onClick={()=>openRoom('about')}>认识这座小镇的创作者<ArrowUpRight size={18}/></button><span>ELOWEN / PORTFOLIO</span></footer>
    </div>
    {room&&<div inert={modal?true:undefined}><RoomPage id={room} onClose={closeRoom} onSelect={select} onGo={p=>{closeRoom();requestAnimationFrame(()=>jumpTo(p));}}/></div>}
    {project?.caseStudy&&<Suspense fallback={<div className="case-loading" role="status">正在打开项目…</div>}><ProjectCaseStudy key={project.id} project={project} onClose={close}/></Suspense>}
    {project?.media&&<Suspense fallback={<div className="case-loading" role="status">正在打开视频作品…</div>}><MotionProject key={project.id} project={project} onClose={close} onPlay={()=>{if(soundOn)sound.current?.toggle().then(setSoundOn);}}/></Suspense>}
    {project&&!project.caseStudy&&!project.media&&<Dialog label={project.title} onClose={close}><div className="project-dialog-top"><span>{districts.find(d=>d.id===project.district).title} / {project.number}</span><span>示意标题 · 作品待补充</span></div><h2>{project.title}</h2><p className="project-dialog-type">{project.type} · {project.tag}</p><div className="project-dialog-art"><ProjectArt project={project} large/></div><p className="project-lead">{project.description}</p><div className="project-chapters">{project.chapters.map((c,i)=><div key={c}><span>0{i+1}</span><h3>{c}</h3><p>{i===0?'介绍项目背景、个人角色与作品目标。':'这里将放入对应的图像、设计稿与过程说明。'}</p></div>)}</div><div className="project-dialog-bottom"><p>真实作品将沿着这份结构逐步展开。</p><button className="primary-link" onClick={close}><ArrowLeft size={17}/>返回浏览</button></div></Dialog>}
    {!entered&&<LoadingScreen ready={ready} reduced={reduced} onComplete={completeLoading} onSkip={()=>{setEntered(true);requestAnimationFrame(goIndex);}}/>}
  </main>;
}
