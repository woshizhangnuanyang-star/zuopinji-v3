import { assetPath } from "../../lib/assetPath.js";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildings, modelNames } from '../../data/townLayout';
import { ENTRY, bikePosition, walkPosition, rideAt, clamp01 } from '../../data/journey';
import { Water, Ground, ModelInstances, Sailboat, BirdSprites } from '../TownScene';
import Traveller, { Bicycle } from './Character';
import StreetResidents from './StreetResidents';
import StreetDecor from './StreetDecor';
import PetalTrail from './PetalTrail';
import BackdropQuarter from './BackdropQuarter';

const buildingGroups=modelNames.map(model=>({model,entries:buildings.filter(p=>p.model===model)}));
const buildingUrls=modelNames.map(model=>assetPath(`/assets/${model}.glb`));

function WindowLettering(){
  const texture=useMemo(()=>{const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;const c=canvas.getContext('2d');c.fillStyle='#fff3d7';c.textAlign='center';c.font='italic 140px "Segoe Print", cursive';c.fillText('Elowen',512,233);c.font='29px Georgia, serif';c.fillText('DESIGN PORTFOLIO',512,321);c.strokeStyle='#fff3d7';c.lineWidth=2;c.beginPath();c.moveTo(220,364);c.lineTo(804,364);c.stroke();const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;return map;},[]);
  useEffect(()=>()=>texture.dispose(),[texture]);
  return <mesh position={[ENTRY.x+.67,1.56,ENTRY.z+1.64]} raycast={()=>{}}><planeGeometry args={[2.03,1.015]}/><meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false}/></mesh>;
}

function Guide({progress,reduced}) {
  const rider=useRef(),walker=useRef(),riderGroup=useRef(),walkerGroup=useRef(),parked=useRef(),parkedBike=useRef();
  useFrame(({clock})=>{
    const p=progress.current,ride=rideAt(p),bike=bikePosition(p),walk=walkPosition(p);
    if(p>=.5)return;
    riderGroup.current.position.set(...bike);riderGroup.current.visible=p<.385;
    if(p<.385)rider.current?.updatePose({pedal:ride*33,walk:0,time:reduced?0:clock.elapsedTime,butterflies:!reduced&&p>.12});
    walkerGroup.current.visible=p>=.385&&p<.505;walkerGroup.current.position.set(...walk);walkerGroup.current.rotation.y=2.932;
    if(p>=.385)walker.current?.updatePose({walk:clamp01((p-.385)/.115)*20,pedal:0});
    parked.current.visible=p>=.385&&p<.505;
    if(p>=.385)parkedBike.current?.updatePose({time:reduced?0:clock.elapsedTime,butterflies:!reduced});
  });
  return <>
    <group ref={riderGroup}><Traveller ref={rider} mode="cycle"/></group>
    <group ref={walkerGroup}><Traveller ref={walker} mode="walk"/></group>
    <group ref={parked} position={[-5.65,.11,-.1]} rotation={[0,0,-.08]}><Bicycle ref={parkedBike}/></group>
  </>;
}

function CafeBirds({progress,signal,reduced,hovered,highlighted}) {
  const root=useRef(),start=useRef(-100),time=useRef(0),lift=useRef(0),wings=useRef([]);
  useEffect(()=>{if(signal)start.current=time.current;},[signal]);
  useFrame(({clock},dt)=>{
    root.current.visible=progress.current<.5;
    if(!root.current.visible)return;
    time.current=clock.elapsedTime;const t=Math.max(0,clock.elapsedTime-start.current),fly=t<4&&!reduced;
    lift.current=THREE.MathUtils.damp(lift.current,highlighted?1:hovered?.32:0,6,dt);
    root.current.position.set(ENTRY.x-1.3+(fly?t*1.2:0),5.37+lift.current*.34+(fly?Math.sin(Math.min(t,2)/2*Math.PI/2)*2.5:0),ENTRY.z+1.64+(fly?-t*.7:0));
    wings.current.forEach((w,i)=>{if(w)w.rotation.z=fly?Math.sin(t*13)*(i%2?1:-1)*.8:0;});
  });
  return <group ref={root}>{[0,.3].map((x,i)=><group key={i} position={[x,i*.085,0]}>
    <mesh scale={[.065,.085,.13]}><sphereGeometry args={[1,8,5]}/><meshBasicMaterial color={i?'#fff0f5':'#595180'}/></mesh>
    <mesh position={[0,.105,.08]} scale={[.05,.055,.05]}><sphereGeometry args={[1,7,4]}/><meshBasicMaterial color={i?'#fff0f5':'#595180'}/></mesh>
    <mesh position={[0,.10,.147]} rotation={[Math.PI/2,0,0]}><coneGeometry args={[.022,.07,4]}/><meshBasicMaterial color="#f2e999"/></mesh>
    {[-1,1].map((side,j)=><group key={side} ref={el=>{wings.current[i*2+j]=el;}} position={[side*.052,.015,-.01]}><mesh position={[side*.035,0,0]} scale={[.07,.025,.105]}><sphereGeometry args={[1,6,4]}/><meshBasicMaterial color={i?'#d4cce4':'#4b438a'}/></mesh></group>)}
  </group>)}</group>;
}

export default function TownWorld({progress,eco,reduced,play,onReady,onEnter}) {
  const models=useLoader(GLTFLoader,buildingUrls);
  const invalidate=useThree(s=>s.invalidate);
  const [hovered,setHovered]=useState(null),[birdSignal,setBirdSignal]=useState(0);
  const cafeState=useRef({blinds:0}),blindsTarget=useRef(false);
  const interaction=useCallback((id,part,point)=>{
    if(id==='project-3') {
      if(/windows|blinds/.test(part)||(point?.y>2.95&&point?.y<4.8)){blindsTarget.current=!blindsTarget.current;play('hover');}
      else if(/roof/.test(part)||point?.y>=4.8){setBirdSignal(v=>v+1);play('hover');}
      else if(/door/.test(part)){play('open');onEnter();}
      else if(/awning/.test(part)){blindsTarget.current=!blindsTarget.current;play('hover');}
      else {setBirdSignal(v=>v+1);play('hover');}
    }
  },[onEnter,play]);
  useFrame((_,dt)=>{cafeState.current.blinds=THREE.MathUtils.damp(cafeState.current.blinds,blindsTarget.current?1:0,5,dt);});
  useEffect(()=>{
    invalidate();
    let frame=requestAnimationFrame(()=>{frame=requestAnimationFrame(onReady);});
    return()=>cancelAnimationFrame(frame);
  },[invalidate,onReady]);
  useEffect(()=>{document.body.style.cursor=hovered?'pointer':'';return()=>{document.body.style.cursor='';};},[hovered]);
  return <>
    <Water reduced={reduced} play={play}/><Ground/><BackdropQuarter progress={progress}/><StreetDecor progress={progress} reduced={reduced} eco={eco}/>
    {buildingGroups.map(({model,entries},i)=><ModelInstances key={model} gltf={models[i]} model={model} entries={entries} hovered={hovered} interactive={model.includes('rose-cafe')} onHover={setHovered} reduced={reduced} progress={progress} cafeState={cafeState} onInteract={interaction}/>)}
    <StreetResidents progress={progress} reduced={reduced} eco={eco} play={play}/><Guide progress={progress} reduced={reduced}/><PetalTrail progress={progress} reduced={reduced}/>
    <WindowLettering/><CafeBirds progress={progress} signal={birdSignal} reduced={reduced} hovered={hovered==='project-3'}/>
    <BirdSprites reduced={reduced}/><Sailboat position={[17,0,11.8]} phase={0} reduced={reduced} play={play}/><Sailboat position={[-30.5,0,-11.5]} phase={3} reduced={reduced} play={play}/>
  </>;
}
