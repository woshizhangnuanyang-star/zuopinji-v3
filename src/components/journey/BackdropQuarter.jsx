import {useEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {smooth} from '../../data/journey';

const P={aqua:'#c5ebec',pink:'#f5dce9',white:'#fff4f9',indigo:'#62579d',glass:'#b9e5e7'};
export const backdropHouses=[
  ...[-12.9,-19.2,-25.2].flatMap((z,row)=>
    [-24.5,-17.5,-10.5,-3.5,3.5,10.5,17.5,24.5].map((x,i)=>({x:x+Math.sin(i*1.7+row)*.55,z:z+Math.sin(i*2.3+row)*.46,variant:(i+row*2)%6,mist:[.24,.43,.6][row]}))),
].map((v,i)=>({...v,scale:.87+(i%3)*.065,height:.89+(i%4)*.09,angle:Math.sin(i*1.4)*.045}));

function makeHouse(v){
  const pieces=[],dummy=new THREE.Object3D();
  const wall=[P.aqua,P.white,P.pink,P.white,P.aqua,P.pink][v];
  function put(g,color,pos=[0,0,0],rotation=[0,0,0],scale=[1,1,1]){if(g.index){const old=g;g=g.toNonIndexed();old.dispose();}dummy.position.set(...pos);dummy.rotation.set(...rotation);dummy.scale.set(...scale);dummy.updateMatrix();g.applyMatrix4(dummy.matrix);g.deleteAttribute('uv');const c=new THREE.Color(color),colors=new Float32Array(g.attributes.position.count*3);for(let i=0;i<colors.length;i+=3){colors[i]=c.r;colors[i+1]=c.g;colors[i+2]=c.b;}g.setAttribute('color',new THREE.BufferAttribute(colors,3));pieces.push(g);}
  const box=(x,y,z,w,h,d,c,r=0)=>put(new THREE.BoxGeometry(w,h,d),c,[x,y,z],[0,0,r]);
  function gable(x,width,base,peak){const s=new THREE.Shape();s.moveTo(x-width/2,base);s.lineTo(x,peak);s.lineTo(x+width/2,base);s.closePath();put(new THREE.ExtrudeGeometry(s,{depth:2.5,bevelEnabled:false}),wall,[0,0,-1.25]);const rise=peak-base,run=width/2,length=Math.hypot(run,rise);box(x-run/2,base+rise/2,0,length+.16,.11,2.78,P.indigo,Math.atan2(rise,run));box(x+run/2,base+rise/2,0,length+.16,.11,2.78,P.indigo,-Math.atan2(rise,run));}
  const tower=v===4,w=tower?1.95:3.2,h=tower?4.3:3.25;
  box(0,h/2,0,w,h,2.5,wall);box(0,.13,1.29,w+.12,.22,.10,P.white);
  if(v===2){box(0,h+.10,0,w+.24,.22,2.7,P.white);box(0,h+.23,0,w-.12,.06,2.36,P.indigo);}
  else if(v===3){put(new THREE.SphereGeometry(1,12,6,0,Math.PI*2,0,Math.PI/2),P.indigo,[0,h,0],[0,0,0],[1.69,1.05,1.36]);}
  else if(tower){put(new THREE.ConeGeometry(1.65,1.75,4),P.indigo,[0,h+.86,0],[0,Math.PI/4,0]);put(new THREE.CircleGeometry(.42,14),P.white,[0,h-.67,1.27]);box(0,h-.65,1.29,.025,.48,.03,P.indigo);box(.10,h-.67,1.3,.23,.025,.025,P.indigo);}
  else if(v===5){gable(-.8,1.6,h,h+.95);gable(.8,1.6,h,h+1.17);}
  else{gable(0,w,h,h+(v===1?1.35:1.05));box(.9,h+.86,-.4,.25,1.02,.31,P.pink);}
  for(const y of [.93,2.28])for(const x of tower?[0]:[-.80,.80]){box(x,y,1.29,.72,.96,.08,P.white);box(x,y,1.34,.55,.77,.02,P.glass);box(x,y,1.36,.025,.77,.02,P.white);}
  box(0,.65,1.31,.53,1.16,.06,P.indigo);
  const result=mergeGeometries(pieces,false);pieces.forEach(p=>p.dispose());return result;
}

export default function BackdropQuarter({progress}){
  const root=useRef(),refs=useRef([]);
  const resources=useMemo(()=>{
    const material=new THREE.MeshBasicMaterial({vertexColors:true,toneMapped:false});
    material.onBeforeCompile=s=>{s.vertexShader='attribute float instanceMist;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <color_vertex>','#include <color_vertex>\nvColor.rgb=mix(vColor.rgb,vec3(.69,.845,.90),instanceMist);');};
    material.customProgramCacheKey=()=> 'elowen-background-mist';
    return {material,groups:Array.from({length:6},(_,v)=>{const entries=backdropHouses.filter(h=>h.variant===v),geometry=makeHouse(v);geometry.setAttribute('instanceMist',new THREE.InstancedBufferAttribute(new Float32Array(entries.map(e=>e.mist)),1));return {geometry,entries};})};
  },[]);
  useEffect(()=>{const d=new THREE.Object3D();resources.groups.forEach((g,j)=>{g.entries.forEach((e,i)=>{d.position.set(e.x,.085,e.z);d.rotation.set(0,e.angle,0);d.scale.set(e.scale,e.height,e.scale);d.updateMatrix();refs.current[j]?.setMatrixAt(i,d.matrix);});if(refs.current[j])refs.current[j].instanceMatrix.needsUpdate=true;});return()=>{resources.material.dispose();resources.groups.forEach(g=>g.geometry.dispose());};},[resources]);
  useFrame(()=>{const fade=1-smooth((progress.current-.13)/.10);root.current.visible=fade>0;resources.material.transparent=fade<1;resources.material.opacity=fade;resources.material.depthWrite=fade===1;});
  return <group ref={root} dispose={null}>{resources.groups.map((g,i)=><instancedMesh key={i} ref={el=>{refs.current[i]=el;}} args={[g.geometry,resources.material,g.entries.length]} frustumCulled={false} raycast={()=>{}}/>)}</group>;
}
