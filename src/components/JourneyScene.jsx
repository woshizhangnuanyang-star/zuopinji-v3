import { assetPath } from "../lib/assetPath.js";
import { Suspense, lazy, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { FrameClock } from './TownScene';
import TownWorld from './journey/TownWorld';
import { rooms, exteriorFrames, smooth, travellerZ } from '../data/journey';

const mobileForFit=size=>size.width<700;
const loadCorridor=()=>import('./journey/Corridor');
const Corridor=lazy(loadCorridor);

function Camera({progress,lookUp,invalidateRef,reduced,active}) {
  const {camera,size,invalidate}=useThree(),target=useMemo(()=>new THREE.Vector3(),[]),scratch=useMemo(()=>new THREE.Vector3(),[]),look=useRef(0),last=useRef({});
  useEffect(()=>{
    if(!active)return;
    invalidateRef.current=invalidate;
    invalidate();
    return()=>{invalidateRef.current=null;};
  },[active,invalidate,invalidateRef]);
  useEffect(()=>{if(active)invalidate();},[active,lookUp,invalidate]);
  useFrame((_,dt)=>{
    const p=progress.current,mobile=size.width<700;
    const goal=lookUp?1:0;
    look.current=reduced?goal:THREE.MathUtils.damp(look.current,goal,5,Math.min(dt,.1));
    if(Math.abs(look.current-goal)<.0001)look.current=goal;
    if(active&&p>=.5&&look.current!==goal)invalidate();
    if(last.current.p===p&&last.current.w===size.width&&last.current.h===size.height&&last.current.look===look.current)return;
    last.current={p,w:size.width,h:size.height,look:look.current};
    if(p<.5){
      let i=exteriorFrames.findIndex((f,j)=>j<exteriorFrames.length-1&&p>=f.p&&p<exteriorFrames[j+1].p);if(i<0)i=0;
      const a=exteriorFrames[i],b=exteriorFrames[i+1],t=smooth((p-a.p)/(b.p-a.p));
      camera.position.set(...a.position).lerp(scratch.set(...b.position),t);
      target.set(...a.target).lerp(scratch.set(...b.target),t);
      const overview=1-smooth((p-.1)/.09);
      if(mobile){target.x+=17.2*overview;target.z-=.5*overview;target.y+=5.6*overview;camera.position.x+=6.2*overview;camera.position.y-=3.8*overview;camera.position.z+=6.5*overview;camera.position.sub(target).multiplyScalar(1+overview*.70).add(target);}
      camera.fov=THREE.MathUtils.lerp(a.fov,b.fov,t)+(mobile?(p<.19?8+overview*15:8+smooth((p-.32)/.06)*12):0);
    } else {
      const z=travellerZ(p),up=look.current;
      camera.position.set(mobile?0:.7,-80+3.1+up*.9,z+(mobile?13.6:8.8));
      target.set(0,-80+2.6+up*6.6,z-4);
      camera.fov=mobile?80:57;
    }
    if(!mobileForFit(size)&&p<.19){const weight=1-smooth((p-.1)/.09),aspect=size.width/size.height;const fit=2*Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)*Math.max(1,1.62/aspect));camera.fov=THREE.MathUtils.lerp(camera.fov,THREE.MathUtils.radToDeg(fit),weight);}
    camera.lookAt(target);camera.updateProjectionMatrix();camera.updateMatrixWorld();
  },-2);
  return null;
}

function World(props){
  const outside=useRef(),inside=useRef(),day=useRef(),night=useRef(),{scene}=useThree();
  const [hallMounted,setHallMounted]=useState(false),preloaded=useRef(false),hallRequested=useRef(false),lastHall=useRef(null);
  const sky=useMemo(()=>new THREE.Color('#b9e5e7'),[]),dark=useMemo(()=>new THREE.Color('#080c13'),[]);
  useFrame(()=>{
    const p=props.progress.current,hall=p>=.5;
    if(p>.1&&!preloaded.current){preloaded.current=true;loadCorridor().catch(()=>{});}
    if(p>.43&&!hallRequested.current){hallRequested.current=true;startTransition(()=>setHallMounted(true));}
    if(lastHall.current===hall)return;
    lastHall.current=hall;
    outside.current.visible=!hall;inside.current.visible=hall;day.current.visible=!hall;night.current.visible=hall;
    scene.background=hall?dark:sky;
  },-1);
  return <>
    <FrameClock active={props.active&&!props.inHall} eco={props.eco} reduced={props.reduced}/><Camera {...props}/>
    <group ref={day}><ambientLight intensity={.9}/><directionalLight position={[-12,30,20]} intensity={.65} color="#ffffff"/><directionalLight position={[15,7,-20]} intensity={.2} color="#d1e6f5"/></group>
    <group ref={night}><ambientLight intensity={1.35}/></group>
    <group ref={outside}><Suspense fallback={null}><TownWorld {...props}/></Suspense></group>
    <group ref={inside} position={[0,-80,0]}><Suspense fallback={null}>{hallMounted&&<Corridor {...props}/>}</Suspense></group>
    <RenderBudget sample={props.active&&!props.inHall&&!props.reduced} onTightBudget={props.onTightBudget}/>
  </>;
}

// One native MSAA render, with no full-screen colour/depth target or second pass.
// Diagnostics are DOM data attributes for QA; nothing is added to the UI.
function RenderBudget({sample,onTightBudget}){
  const stats=useRef({last:0,frames:0,total:0,pressure:0,adjusted:false});
  useEffect(()=>{stats.current.pressure=0;},[sample]);
  useFrame(({gl,clock},dt)=>{
    const s=stats.current;
    s.frames++;s.total++;
    if(sample&&!s.adjusted&&gl.getPixelRatio()>1){
      s.pressure=Math.max(0,s.pressure+(dt>.050?Math.min(dt,.16):-.045));
      if(s.pressure>.45){s.adjusted=true;onTightBudget();}
    }
    if(s.total===1||clock.elapsedTime-s.last>1){
      const d=gl.domElement.dataset;
      d.drawCalls=String(gl.info.render.calls);d.triangles=String(gl.info.render.triangles);d.geometries=String(gl.info.memory.geometries);
      d.renderFps=(s.frames/Math.max(1,clock.elapsedTime-s.last)).toFixed(1);
      d.renderFrames=String(s.total);d.pixelRatio=String(gl.getPixelRatio());
      s.frames=0;s.last=clock.elapsedTime;
    }
  });
  return null;
}

export default function JourneyScene(props) {
  const labelRefs=useRef([]);
  const [dprLimit,setDprLimit]=useState(1.25);
  const onTightBudget=useCallback(()=>setDprLimit(1),[]);
  return <div className="scene-layer"><Canvas frameloop="demand" camera={{position:[-34,37,48],fov:32,near:.1,far:250}} dpr={[1,props.eco?1:dprLimit]} gl={{antialias:true,alpha:false,powerPreference:props.eco?'low-power':'high-performance'}} onCreated={({gl})=>{gl.setClearColor('#b9e5e7');gl.toneMapping=THREE.NoToneMapping;}} fallback={<img className="fallback-town" src={assetPath("/assets/town-poster.svg")} alt="创作小镇平面导览"/>}><World {...props} onTightBudget={onTightBudget} labelRefs={labelRefs}/></Canvas><div className="door-labels">{rooms.map((r,i)=><div className="door-label-anchor" ref={el=>{labelRefs.current[i]=el;}} key={r.id}><button style={{'--door-color':r.color}} onClick={()=>props.onOpenRoom(r.id)}><small>0{i+1} / ENTER</small><strong>{r.label}</strong><span>{r.subtitle} ↗</span></button></div>)}</div></div>;
}
