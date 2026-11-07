import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { bikePosition, rideAt } from '../../data/journey';

// Fixed pool, emitted by cycling distance; no timer emits petals while parked.
export default function PetalTrail({progress,reduced}){
  const mesh=useRef(),last=useRef(null),cursor=useRef(0),pool=useRef(Array.from({length:48},()=>({born:-100,x:0,z:0,seed:0})));
  const dummy=useMemo(()=>new THREE.Object3D(),[]),colors=useMemo(()=>['#edb8d3','#fff0f5','#b9e5e7','#d1c5e5'].map(c=>new THREE.Color(c)),[]);
  useFrame(({clock})=>{
    const p=progress.current,t=rideAt(p),riding=p>.125&&p<.385,position=bikePosition(p);
    if(p>=.5){mesh.current.visible=false;return;}
    if(last.current===null)last.current=t;
    if(riding&&t-last.current>.018){const n=Math.min(8,Math.floor((t-last.current)/.018));for(let j=0;j<n;j++){const i=cursor.current++%48,b=pool.current[i];b.x=position[0]+.91-j*.13;b.z=position[2]+Math.sin(i*2.4)*.08;b.born=clock.elapsedTime;b.seed=i*2.399;mesh.current.setColorAt(i,colors[i%4]);}mesh.current.instanceColor.needsUpdate=true;last.current=t;}
    if(t<last.current||!riding)last.current=t;
    if(cursor.current===0){mesh.current.visible=false;return;}mesh.current.visible=true;
    pool.current.forEach((b,i)=>{const age=clock.elapsedTime-b.born,alive=age>=0&&age<7&&p<.5,fall=reduced?1:Math.min(1,age/2.6);const s=alive?Math.min(1,7-age):0;dummy.position.set(b.x-age*.06+Math.sin(age*3+b.seed)*.1*(1-fall),1.17-fall*1.03,b.z+Math.sin(age*2+b.seed)*.17+age*.025);dummy.rotation.set(-Math.PI/2+Math.sin(age*2+b.seed)*.5*(1-fall),b.seed+age*.4,Math.cos(age*3+b.seed)*.3);dummy.scale.set(.075*s,.04*s,.013*s);dummy.updateMatrix();mesh.current.setMatrixAt(i,dummy.matrix);});mesh.current.instanceMatrix.needsUpdate=true;
  });
  return <instancedMesh ref={mesh} args={[undefined,undefined,48]} frustumCulled={false} raycast={()=>{}}><sphereGeometry args={[1,7,4]}/><meshBasicMaterial color="white" side={THREE.DoubleSide}/></instancedMesh>;
}
