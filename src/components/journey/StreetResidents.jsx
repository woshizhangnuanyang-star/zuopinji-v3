import {useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {Resident,CHARACTER_PALETTE} from './Character';

// A clear cycling lane is retained at z=-.1…+.5, x=-14.5…-5.65.
// All positions use the same 1.7-unit figure, with feet on the .11 pavement.
export const STREET_RESIDENTS=Object.freeze([
  {id:'gardener',position:[-13.6,.11,-1.48],yaw:0,variant:1,activity:'water'},
  {id:'reader',position:[-11.3,.11,2.22],yaw:Math.PI,variant:2,activity:'read'},
  {id:'hello-one',position:[-9.65,.11,-1.42],yaw:1.25,variant:0,activity:'chat'},
  {id:'hello-two',position:[-8.4,.11,-1.40],yaw:-1.25,variant:3,activity:'chat'},
  {id:'stroller',position:[-7.4,.11,2.20],yaw:-Math.PI/2,variant:1,activity:'walk',pace:.72,range:.9},
  {id:'cafe-guest',position:[-2.7,.11,2.65],yaw:Math.PI/2,variant:2,activity:'sit-coffee'},
  {id:'bench-reader',position:[.25,.11,-1.45],yaw:0,variant:3,activity:'sit-read'},
  {id:'window-shopper',position:[3.2,.11,2.20],yaw:-.7,variant:0,activity:'idle'},
  {id:'walker',position:[5.7,.11,-1.50],yaw:Math.PI/2,variant:2,activity:'walk',pace:.62,range:1.2},
  {id:'friends-one',position:[8.7,.11,2.25],yaw:1.25,variant:1,activity:'chat'},
  {id:'friends-two',position:[9.9,.11,2.30],yaw:-1.25,variant:0,activity:'chat'},
  {id:'morning-cup',position:[13.3,.11,-1.38],yaw:-.1,variant:3,activity:'coffee'},
]);

const propMaterial=new THREE.MeshBasicMaterial({vertexColors:true,toneMapped:false});
const shadowMaterial=new THREE.MeshBasicMaterial({color:CHARACTER_PALETTE.indigo,transparent:true,opacity:.12,depthWrite:false,toneMapped:false});
const unitBox=new THREE.BoxGeometry(1,1,1),unitCylinder=new THREE.CylinderGeometry(1,1,1,9),leaf=new THREE.SphereGeometry(1,7,4);
const matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3(),position=new THREE.Vector3();
function buildStreetProps(){
  const parts=[],{indigo,aqua,pink,yellow,cream}=CHARACTER_PALETTE;
  function part(g,color,pos,size,angles=[0,0,0],owner){
    const copy=g.clone();matrix.compose(position.set(...pos),rotation.setFromEuler(new THREE.Euler(...angles)),scale.set(...size));
    if(owner){const transform=new THREE.Matrix4().makeRotationY(owner.yaw);transform.setPosition(...owner.position);matrix.premultiply(transform);}
    copy.applyMatrix4(matrix);const c=new THREE.Color(color),colors=new Float32Array(copy.attributes.position.count*3);for(let i=0;i<copy.attributes.position.count;i++)colors.set([c.r,c.g,c.b],i*3);copy.setAttribute('color',new THREE.BufferAttribute(colors,3));parts.push(copy);
  }
  function chair(owner){
    part(unitBox,aqua,[0,.445,0],[.48,.07,.43],[0,0,0],owner);
    part(unitBox,aqua,[0,.70,-.22],[.47,.40,.045],[0,0,0],owner);
    [-1,1].forEach(x=>[-1,1].forEach(z=>part(unitCylinder,indigo,[x*.19,.22,z*.17],[.017,.44,.017],[0,0,0],owner)));
    part(unitBox,cream,[0,.45,0],[.39,.025,.34],[0,0,0],owner);
  }
  STREET_RESIDENTS.filter(r=>r.activity.startsWith('sit')).forEach(chair);
  const gardener=STREET_RESIDENTS[0];
  part(unitCylinder,pink,[-.2,.16,.78],[.20,.32,.20],[0,0,0],gardener);
  part(unitCylinder,indigo,[-.2,.326,.78],[.175,.012,.175],[0,0,0],gardener);
  for(let i=0;i<6;i++){
    const a=i*2.4,x=-.2+Math.cos(a)*.11,z=.78+Math.sin(a)*.12;
    part(unitCylinder,aqua,[x,.48,z],[.012,.32,.012],[0,0,.12*Math.sin(a)],gardener);
    part(leaf,aqua,[x,.56,z],[.10,.035,.048],[0,a,.5],gardener);
    part(leaf,yellow,[x,.65,z],[.04,.045,.035],[0,a,0],gardener);
  }
  // A small café table sits to the seated reader's side, away from the path.
  const cafe=STREET_RESIDENTS[5];
  part(unitCylinder,indigo,[.68,.36,.15],[.023,.72,.023],[0,0,0],cafe);
  part(unitCylinder,pink,[.68,.735,.15],[.38,.045,.38],[0,0,0],cafe);
  part(unitCylinder,indigo,[.68,.045,.15],[.20,.035,.20],[0,0,0],cafe);
  part(unitCylinder,yellow,[.72,.81,.14],[.055,.12,.055],[0,0,0],cafe);
  const merged=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());return merged;
}
const propsGeometry=buildStreetProps();
const shadowGeometry=(()=>{
  const parts=STREET_RESIDENTS.map(r=>{const circle=new THREE.CircleGeometry(.30,12);circle.rotateX(-Math.PI/2);circle.scale(1,1,.66);circle.translate(r.position[0]+.08,.113,r.position[2]+.04);return circle;});
  const g=mergeGeometries(parts,false);parts.forEach(p=>p.dispose());return g;
})();

/** Twelve consistent illustrated neighbours. Accepts a numeric progress or ref.
 * 12 human draw calls + one prop batch + one shadow batch. Near-detail is capped
 * at four figures (two in eco); far figures keep the same size and art direction.
 * Clicking any neighbour produces a short friendly wave and optional sound.
 */
export default function StreetResidents({progress,eco=false,reduced=false,play}){
  const root=useRef(),actors=useRef([]),waveUntil=useRef(new Float32Array(STREET_RESIDENTS.length)),time=useRef(0);
  const steps=useRef(new Float32Array(STREET_RESIDENTS.length)),previousX=useRef(new Float32Array(STREET_RESIDENTS.map(r=>r.position[0]))),lastPose=useRef(new Float32Array(STREET_RESIDENTS.length)),lastLOD=useRef(-1);
  const distances=useMemo(()=>STREET_RESIDENTS.map((_,i)=>({index:i,distance:0})),[]);
  const world=useMemo(()=>new THREE.Vector3(),[]),near=useMemo(()=>new Set(),[]);
  useFrame(({clock,camera},dt)=>{
    const p=typeof progress==='number'?progress:progress?.current??0;
    if(root.current)root.current.visible=p<.5;if(p>=.5)return;
    const t=reduced?0:clock.elapsedTime;time.current=clock.elapsedTime;
    STREET_RESIDENTS.forEach((resident,i)=>{
      const actor=actors.current[i];if(!actor)return;
      const group=actor.group,walking=resident.activity==='walk';
      if(walking){const phase=t*.45+i,offset=reduced?0:Math.sin(phase)*(resident.range||.4),x=resident.position[0]+offset;steps.current[i]+=Math.abs(x-previousX.current[i])*Math.PI/.43;previousX.current[i]=x;group.position.x=x;const yaw=Math.cos(phase)>0?Math.PI/2:-Math.PI/2,error=Math.atan2(Math.sin(yaw-group.rotation.y),Math.cos(yaw-group.rotation.y));group.rotation.y+=error*(1-Math.exp(-7*Math.min(dt,.08)));}
    });
    if(t-lastLOD.current>.2||lastLOD.current<0){lastLOD.current=t;STREET_RESIDENTS.forEach((r,i)=>{world.set(actors.current[i]?.group.position.x??r.position[0],r.position[1],r.position[2]);distances[i].index=i;distances[i].distance=world.distanceToSquared(camera.position);});distances.sort((a,b)=>a.distance-b.distance);near.clear();const limit=eco?2:4,threshold=eco?11*11:16*16;for(let i=0;i<Math.min(limit,distances.length);i++)if(distances[i].distance<threshold)near.add(distances[i].index);}
    STREET_RESIDENTS.forEach((resident,i)=>{
      const actor=actors.current[i];if(!actor)return;
      const waving=!reduced&&waveUntil.current[i]>time.current;
      const elapsed=t-lastPose.current[i];if(!near.has(i)&&!waving&&elapsed<1/15&&!reduced)return;lastPose.current[i]=t;
      actor.updatePose({walk:(resident.activity==='walk'?steps.current[i]:t)+i*1.63,wave:waving,detail:near.has(i),dt:elapsed||dt});
    });
  });
  function greet(event,index){event.stopPropagation();if(event.delta>5)return;waveUntil.current[index]=time.current+2.5;play?.('hover');}
  return <group ref={root} dispose={null}>
    <mesh geometry={propsGeometry} material={propMaterial}/><mesh geometry={shadowGeometry} material={shadowMaterial} raycast={()=>{}}/>
    {STREET_RESIDENTS.map((resident,i)=><Resident key={resident.id} ref={el=>{actors.current[i]=el;}} position={resident.position} rotation={[0,resident.yaw,0]} variant={resident.variant} activity={resident.activity} onClick={event=>greet(event,i)}/>)}
  </group>;
}

export {StreetResidents};
