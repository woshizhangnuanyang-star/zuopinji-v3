import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { DoorModel, LanternModel } from './DoorAndLantern';
import Traveller from './Character';
import { rooms, travellerZ, corridorAt, clamp01 } from '../../data/journey';

function architecture() {
  const points=[];
  const line=(a,b)=>points.push(...a,...b);
  for(let z=5;z>=-56;z-=1.75) line([-4.6,.005,z],[4.6,.005,z]);
  for(let x=-4.6;x<=4.7;x+=1.15)line([x,.005,5],[x,.005,-56]);
  for(const side of [-1,1]) {
    const x=side*4.6;
    for(const y of [.12,.30,3.8,6.8])line([x,y,5],[x,y,-56]);
    for(let z=5;z>=-56;z-=3.5){line([x,0,z],[x,6.8,z]);line([x,6.8,z],[0,7.9,z]);}
  }
  line([0,7.9,5],[0,7.9,-56]);
  line([-4.6,0,-56.7],[-4.6,6.8,-56.7]);line([4.6,0,-56.7],[4.6,6.8,-56.7]);line([-4.6,6.8,-56.7],[0,7.9,-56.7]);line([0,7.9,-56.7],[4.6,6.8,-56.7]);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));return geometry;
}

export default function Corridor({progress,labelRefs,onOpenRoom,play,reduced,eco,active}) {
  const doors=useRef([]),doorGroups=useRef([]),lamps=useRef([]),lampGroups=useRef([]),avatar=useRef(),walker=useRef(),lights=useRef([]),opening=useRef(null),timer=useRef();
  const lines=useMemo(architecture,[]),projected=useMemo(()=>new THREE.Vector3(),[]),wasVisible=useRef(false);
  const invalidate=useThree(s=>s.invalidate);
  const lanterns=useMemo(()=>Array.from({length:eco?12:18},(_,i)=>({z:1-i*(eco?4.6:3.1),x:[-1.9,.6,2,-.6][i%4],y:[5.6,4.8,5.2,5.8][i%4],variant:i%3})),[eco]);
  useEffect(()=>()=>{clearTimeout(timer.current);lines.dispose();},[lines]);
  function enter(i){if(opening.current!==null)return;opening.current={i,start:performance.now()};play('open');invalidate();timer.current=setTimeout(()=>{opening.current=null;onOpenRoom(rooms[i].id);},reduced?0:420);}
  useFrame(({camera,size},dt)=>{
    const p=progress.current,z=travellerZ(p),visible=p>=.5;
    if(!visible){if(wasVisible.current)labelRefs.current.forEach(label=>{if(label)label.style.visibility='hidden';});wasVisible.current=false;return;}wasVisible.current=true;
    if(active&&opening.current&&!reduced)invalidate();
    avatar.current.position.z=z;walker.current?.updatePose({walk:corridorAt(p)*94});
    rooms.forEach((r,i)=>{
      const d=Math.abs(z-r.z),near=clamp01(1-d/6),inView=visible&&r.z<z+4&&r.z>z-22;
      if(doorGroups.current[i])doorGroups.current[i].visible=inView;
      doors.current[i]?.setGlow(.12+near*.88);
      doors.current[i]?.setOpen(opening.current?.i===i?clamp01((performance.now()-opening.current.start)/400):0);
      const label=labelRefs.current[i];if(!label)return;
      projected.set(r.side*3.35,-80+3.85,r.z).project(camera);
      label.style.visibility=inView&&d<12&&projected.z<1&&projected.x>-1.1&&projected.x<1.1?'visible':'hidden';
      const margin=size.width<700?70:100,screenX=Math.max(margin,Math.min(size.width-margin,(projected.x*.5+.5)*size.width));
      label.style.transform=`translate(${screenX}px,${(-projected.y*.5+.5)*size.height}px)`;
      label.style.setProperty('--near',near.toFixed(3));
      label.dataset.active=near>.65?'true':'false';
    });
    lanterns.forEach((l,i)=>{
      const d=l.z-z,lit=clamp01(1-(z-l.z-1)/12);
      const brightness=1-clamp01((-d-3)/12);
      lamps.current[i]?.setBrightness(visible?Math.max(.025,brightness):0);
      if(lampGroups.current[i])lampGroups.current[i].visible=visible&&d<10&&d>-26;
    });
    lights.current.forEach((light,i)=>{if(light){light.position.set(i%2?2:-2,4.3,z+3-i*8);light.intensity=visible?5:0;}});
  });
  return <>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.015,-24]}><planeGeometry args={[9.2,65]}/><meshBasicMaterial color="#090d14"/></mesh>
    <lineSegments geometry={lines}><lineBasicMaterial color="#adb4bd" transparent opacity={.25}/></lineSegments>
    {rooms.map((r,i)=><group key={r.id} ref={el=>{doorGroups.current[i]=el;}} position={[r.side*3.65,0,r.z]} rotation={[0,-r.side*.92,0]}><DoorModel ref={el=>{doors.current[i]=el;}} variant={i} onClick={e=>{e.stopPropagation();enter(i);}} onPointerOver={()=>{document.body.style.cursor='pointer';}} onPointerOut={()=>{document.body.style.cursor='';}}/></group>)}
    {lanterns.map((l,i)=><group key={i} ref={el=>{lampGroups.current[i]=el;}} position={[l.x,l.y,l.z]}><line><bufferGeometry><bufferAttribute attach="attributes-position" args={[new Float32Array([0,.55,0,0,7.8-l.y,0]),3]}/></bufferGeometry><lineBasicMaterial color="#777b83" transparent opacity={.45}/></line><LanternModel variant={l.variant} ref={el=>{lamps.current[i]=el;}}/></group>)}
    {[0,1,2].map(i=><pointLight key={i} ref={el=>{lights.current[i]=el;}} color="#f4ebd8" intensity={5} distance={14} decay={2}/>)}
    <group ref={avatar} position={[0,0,-2]} rotation={[0,Math.PI,0]}><Traveller ref={walker} mode="walk" grayscale/></group>
  </>;
}
