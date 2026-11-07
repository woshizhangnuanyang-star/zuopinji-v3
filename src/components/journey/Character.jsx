import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import FlowerBasket from './FlowerBasket';

/**
 * Flat-colour town figures. Walking faces +Z; cycling faces +X. Feet touch y=0.
 * Standing height 1.68–1.76; riding height ~1.79. The girl and the residents use
 * one vertex-coloured skinned mesh each, with cached geometry and unlit colours.
 * ref.current.updatePose({pedal,walk,wave}) updates poses without React state.
 * ref.current.group is the movable outer group. setDetail(false) retains the
 * same silhouette while hiding small accessories. Bicycle is rider-free.
 * Resident activity: walk | idle | read | water | chat | coffee | sit-coffee |
 * sit-read. Shared geometry/materials deliberately live for the app lifetime.
 */
export const CHARACTER_PALETTE=Object.freeze({aqua:'#b9e5e7',indigo:'#4b438a',pink:'#edb8d3',yellow:'#f2e999',cream:'#fff4e7'});
const {aqua,indigo,pink,yellow,cream}=CHARACTER_PALETTE;
const UP=new THREE.Vector3(0,1,0),cylinder=new THREE.CylinderGeometry(1,1,1,8),box=new THREE.BoxGeometry(1,1,1);
const humanGeometryCache=new Map();
const characterMaterial=new THREE.MeshBasicMaterial({vertexColors:true,toneMapped:false});
const colorways=[
  {coat:pink,shirt:cream,trousers:indigo,bag:aqua,shoe:cream,skin:'#f6dfcf',hair:indigo,trim:yellow},
  {coat:yellow,shirt:cream,trousers:indigo,bag:pink,shoe:cream,skin:'#f2d6c5',hair:indigo,trim:aqua},
  {coat:aqua,shirt:cream,trousers:indigo,bag:yellow,shoe:pink,skin:'#efd2c2',hair:indigo,trim:pink},
  {coat:indigo,shirt:yellow,trousers:aqua,bag:pink,shoe:cream,skin:'#f6dfcf',hair:'#413b72',trim:cream},
  {coat:pink,shirt:cream,trousers:aqua,bag:indigo,shoe:yellow,skin:'#e9c7b7',hair:indigo,trim:cream},
];
const mono={coat:'#ceccd3',shirt:'#f5f3f1',trousers:'#96939f',bag:'#dfdde2',shoe:'#f6f5f2',skin:'#e5e2df',hair:'#696573',trim:'#f2f0ef'};
const boneNames=['pelvis','torso','head','thighL','shinL','footL','thighR','shinR','footR','upperL','foreL','upperR','foreR','propL','propR'];
const boneIndex=Object.fromEntries(boneNames.map((name,i)=>[name,i+1]));
const matrix=new THREE.Matrix4(),quaternion=new THREE.Quaternion(),euler=new THREE.Euler();
const direction=new THREE.Vector3(),first=new THREE.Vector3(),second=new THREE.Vector3(),perpendicular=new THREE.Vector3();

// The pieces are rigidly weighted regions of one shared geometry, not meshes.
function buildHumanGeometry({variant=-1,grayscale=false,cycling=false,activity='walk',detail=true}){
  const key=[variant,grayscale,cycling,activity,detail].join(':');if(humanGeometryCache.has(key))return humanGeometryCache.get(key);
  const c=grayscale?mono:colorways[variant<0?0:1+((variant%4)+4)%4],pieces=[],radial=detail?10:6;
  const ball=new THREE.SphereGeometry(1,radial,detail?7:4),tube=new THREE.CylinderGeometry(1,1,1,radial);
  function part(geometry,bone,color,position=[0,0,0],scale=[1,1,1],rotation=[0,0,0]){
    const g=geometry.clone();matrix.compose(first.set(...position),quaternion.setFromEuler(euler.set(...rotation)),second.set(...scale));g.applyMatrix4(matrix);
    const count=g.attributes.position.count,colour=new THREE.Color(color),colours=new Float32Array(count*3),indices=new Uint16Array(count*4),weights=new Float32Array(count*4);
    for(let i=0;i<count;i++){colours.set([colour.r,colour.g,colour.b],i*3);indices[i*4]=boneIndex[bone];weights[i*4]=1;}
    g.setAttribute('color',new THREE.BufferAttribute(colours,3));g.setAttribute('skinIndex',new THREE.BufferAttribute(indices,4));g.setAttribute('skinWeight',new THREE.BufferAttribute(weights,4));pieces.push(g);
  }
  function link(bone,color,length,radius,otherRadius=radius){
    const g=new THREE.CylinderGeometry(otherRadius,radius,length,radial);part(g,bone,color);g.dispose();
    if(detail){part(ball,bone,color,[0,-length/2,0],[radius,radius,radius]);part(ball,bone,color,[0,length/2,0],[otherRadius,otherRadius,otherRadius]);}
  }
  const female=variant<0||variant===1||variant===3;
  const body=new THREE.CylinderGeometry(female?.155:.18,female?.197:.185,.445,radial);part(body,'torso',c.coat,[0,0,0],[1,1,.72]);body.dispose();
  part(ball,'pelvis',c.trousers,[0,0,0],[.16,.105,.115]);part(ball,'head',c.skin,[0,0,0],[.124,.157,.111]);part(tube,'head',c.skin,[0,-.173,-.005],[.041,.105,.042]);
  // Blank oval faces and a single hair shape match the architectural figures.
  const cap=new THREE.SphereGeometry(1,radial,detail?6:4,0,Math.PI*2,0,Math.PI*.56);part(cap,'head',c.hair,[0,.034,-.014],[.132,.145,.121]);cap.dispose();
  part(ball,'head',c.hair,[0,-.018,-.087],[.125,.123,.059]);
  if(female){
    part(ball,'head',c.hair,[.019,-.082,-.162],[.076,.135,.078],[.38,0,-.12]);part(ball,'head',c.hair,[.026,-.175,-.202],[.053,.082,.052],[.44,0,-.14]);
    if(detail)part(ball,'head',c.trim,[.018,-.024,-.153],[.057,.021,.048],[.25,0,0]);
  }
  if(variant===0){part(tube,'head',c.trim,[0,.133,-.014],[.186,.023,.164]);part(tube,'head',c.coat,[0,.185,-.019],[.119,.088,.107]);}
  if(detail){
    part(box,'torso',c.shirt,[0,.116,.115],[.115,.20,.014]);part(box,'torso',c.trim,[0,-.045,.14],[.009,.30,.012]);
    if(variant<0){part(ball,'torso',c.bag,[0,-.027,-.161],[.133,.17,.075]);[-1,1].forEach(s=>part(box,'torso',c.bag,[s*.109,.02,.12],[.018,.31,.012]));}
    else if(variant===2||variant===3){part(box,'torso',c.bag,[0,0,.137],[.024,.39,.016],[0,0,-.45]);part(ball,'torso',c.bag,[.20,-.18,.02],[.09,.12,.045]);}
  }
  // The tunic hem remains short enough for natural pedalling.
  if(female&&variant!==3){const hem=new THREE.CylinderGeometry(.17,.225,.17,radial);part(hem,'pelvis',c.coat,[0,.015,0],[1,1,.71]);hem.dispose();}
  if(variant===3&&!cycling){const skirt=new THREE.CylinderGeometry(.14,.27,.36,radial);part(skirt,'pelvis',c.coat,[0,-.14,0],[1,1,.76]);skirt.dispose();}
  for(const s of ['L','R']){
    link(`thigh${s}`,c.trousers,.39,.054,.059);link(`shin${s}`,c.trousers,.40,.047,.052);part(ball,`foot${s}`,c.shoe,[0,0,.033],[.058,.047,.105]);
    link(`upper${s}`,c.coat,.29,.047,.052);link(`fore${s}`,c.skin,.285,.032,.036);part(tube,`fore${s}`,c.coat,[0,-.097,0],[.039,.09,.039]);part(ball,`fore${s}`,c.skin,[0,.16,0],[.038,.051,.032]);
  }
  if(activity.includes('read')){
    part(box,'propR',c.hair,[0,-.006,0],[.30,.018,.21]);part(box,'propR',c.trim,[-.072,.012,0],[.14,.025,.195],[0,0,-.08]);part(box,'propR',grayscale?mono.shirt:cream,[.072,.012,0],[.14,.025,.195],[0,0,.08]);
    if(detail)part(box,'propR',c.coat,[.035,.03,.04],[.009,.003,.14]);
  }
  if(activity.includes('coffee')){
    const cup=new THREE.CylinderGeometry(.042,.033,.095,radial);part(cup,'propR',grayscale?mono.shirt:cream);cup.dispose();part(tube,'propR',grayscale?'#85818c':indigo,[0,.049,0],[.033,.003,.033]);
    if(detail){const handle=new THREE.TorusGeometry(.031,.009,5,12);part(handle,'propR',c.trim,[.043,0,0],[1,1,1],[0,Math.PI/2,0]);handle.dispose();}
  }
  if(activity==='water'){
    part(ball,'propL',c.bag,[0,-.07,.047],[.095,.08,.10]);const handle=new THREE.TorusGeometry(.092,.012,5,12);part(handle,'propL',c.bag,[0,-.01,.025],[.8,1,1]);handle.dispose();part(tube,'propL',c.bag,[0,-.067,.18],[.018,.22,.018],[Math.PI*.62,0,0]);
    if(detail)for(let i=0;i<4;i++)part(ball,'propL',grayscale?mono.shirt:aqua,[0,-.15-i*.055,.27+i*.025],[.01,.02,.01]);
  }
  const geometry=mergeGeometries(pieces,false);pieces.forEach(g=>g.dispose());ball.dispose();tube.dispose();geometry.computeBoundingSphere();humanGeometryCache.set(key,geometry);return geometry;
}
function makeRig(options){
  const group=new THREE.Group(),origin=new THREE.Bone(),bones={};origin.name='illustration-origin';
  boneNames.forEach(name=>{const bone=new THREE.Bone();bone.name=name;origin.add(bone);bones[name]=bone;});
  const skeleton=new THREE.Skeleton([origin,...boneNames.map(name=>bones[name])]);
  const far=new THREE.SkinnedMesh(buildHumanGeometry({...options,detail:false}),characterMaterial);
  far.add(origin);far.bind(skeleton);far.frustumCulled=false;group.add(far);return {group,bones,near:null,far,skeleton};
}
function setLink(bone,a,b,restLength){direction.subVectors(b,a);bone.position.copy(a).add(b).multiplyScalar(.5);bone.quaternion.setFromUnitVectors(UP,first.copy(direction).normalize());bone.scale.set(1,direction.length()/restLength,1);}
function solveJoint(a,b,upper,lower,bend,out){
  const axis=first.subVectors(b,a),distance=Math.max(.001,Math.min(axis.length(),upper+lower-.0001));axis.normalize();const along=(upper*upper-lower*lower+distance*distance)/(2*distance),height=Math.sqrt(Math.max(0,upper*upper-along*along));
  perpendicular.copy(bend).addScaledVector(axis,-bend.dot(axis));if(perpendicular.lengthSq()<.0001)perpendicular.set(0,0,1).addScaledVector(axis,-axis.z);return out.copy(a).addScaledVector(axis,along).addScaledVector(perpendicular.normalize(),height);
}
const Human=forwardRef(function Human({cycling=false,grayscale=false,variant=-1,activity='walk',waving=false},ref){
  const rig=useMemo(()=>makeRig({cycling,grayscale,variant,activity}),[cycling,grayscale,variant,activity]);
  const p=useMemo(()=>Object.fromEntries(['hipL','hipR','ankleL','ankleR','kneeL','kneeR','shoulderL','shoulderR','elbowL','elbowR','handL','handR','front','outL','outR','waveHand'].map(k=>[k,new THREE.Vector3()])),[]);
  p.front.set(0,0,1);p.outL.set(-1,-.1,0);p.outR.set(1,-.1,0);
  function pose(phase=0,wave=waving){
    const b=rig.bones,sitting=activity.startsWith('sit'),moving=cycling||activity==='walk',waveAmount=Number(wave)||0,bob=moving?(cycling?Math.sin(phase*2)*.005:Math.cos(phase*2)*.009):Math.sin(phase*.7)*.005;
    const hipY=cycling?1.085:sitting?.535:.845+bob,hipZ=cycling?-.29:0;
    b.pelvis.position.set(0,hipY+.018,hipZ);b.torso.position.set(0,cycling?1.285:sitting?.80+bob:1.115+bob,cycling?-.115:.005);b.torso.rotation.set(cycling?.44:sitting?.05:.025,0,0);
    b.torso.rotation.z=cycling?Math.sin(phase)*.012:moving?Math.sin(phase)*.018:Math.sin(phase*.4)*.009;
    b.head.position.set(0,cycling?1.605:sitting?1.205+bob:1.515+bob,cycling?.055:sitting?.035:.02);b.head.rotation.set(cycling?-.08:activity.includes('read')?.13:0,activity==='chat'?Math.sin(phase*.4)*.13:Math.sin(phase*.22)*.025,-waveAmount*.04);
    for(let side=0;side<2;side++){
      const sign=side===0?-1:1,s=side===0?'L':'R',phaseSide=phase+(side?Math.PI:0),hip=p[`hip${s}`],ankle=p[`ankle${s}`],knee=p[`knee${s}`];hip.set(sign*.08,hipY,hipZ);
      if(cycling)ankle.set(sign*.145,.49+Math.sin(phaseSide)*.17,-.24+Math.cos(phaseSide)*.17);
      else if(sitting){ankle.set(sign*.11,.065,.31);knee.set(sign*.105,.52,.37);}
      else if(moving)ankle.set(sign*.085,.065+Math.pow(Math.max(0,Math.cos(phaseSide)),2)*.07,Math.sin(phaseSide)*.215);
      else ankle.set(sign*.10,.065,side?.045:-.025);
      if(!sitting)solveJoint(hip,ankle,.39,.40,p.front,knee);setLink(b[`thigh${s}`],hip,knee,.39);setLink(b[`shin${s}`],knee,ankle,.40);
      b[`foot${s}`].position.copy(ankle);b[`foot${s}`].position.y-=.02;b[`foot${s}`].position.z+=.025;b[`foot${s}`].rotation.x=cycling?Math.sin(phaseSide)*.10:moving?-.10*Math.sin(phaseSide):0;
      const shoulder=p[`shoulder${s}`],hand=p[`hand${s}`],elbow=p[`elbow${s}`],base=sitting?-.31:0;shoulder.set(sign*.166,cycling?1.438:1.29+bob+base,cycling?.015:.015);
      if(cycling)hand.set(sign*.21,1.14,.51);
      else if(activity.includes('read'))hand.set(sign*.108,1.07+base,.295);
      else if(activity.includes('coffee')&&side===1){const cycle=(phase*.045)%1,sip=THREE.MathUtils.smoothstep(cycle,.2,.36)-THREE.MathUtils.smoothstep(cycle,.58,.76);hand.set(.18,1.10+base+sip*.14,.28-sip*.06);}
      else if(activity==='water'&&side===0)hand.set(-.20,.99+Math.sin(phase*.65)*.025,.31);
      else if(activity==='chat'&&side===1)hand.set(.30,1.07+Math.sin(phase*.9)*.07,.24);
      else if(sitting)hand.set(sign*.18,.58,.24);
      else hand.set(sign*.22,.84+bob+Math.cos(phaseSide)*(moving?.02:0),moving?-.15*Math.sin(phaseSide):.04);
      if(side===1&&waveAmount>0&&!cycling)hand.lerp(p.waveHand.set(.34+Math.sin(phase*2)*.045,1.62+base+Math.sin(phase*2)*.025,.06),waveAmount);
      solveJoint(shoulder,hand,cycling?.30:.29,cycling?.30:.285,side?p.outR:p.outL,elbow);setLink(b[`upper${s}`],shoulder,elbow,.29);setLink(b[`fore${s}`],elbow,hand,.285);
    }
    b.propL.position.copy(p.handL);b.propL.rotation.set(.12+Math.sin(phase*.65)*.055,0,0);
    if(activity.includes('read')){b.propR.position.set(0,sitting?.765:1.075,.33);b.propR.rotation.set(-.22,0,0);}else{b.propR.position.copy(p.handR).addScaledVector(p.front,.025);b.propR.rotation.set(0,0,-.08);}
  }
  function setDetail(value=true){if(value&&!rig.near){rig.near=new THREE.SkinnedMesh(buildHumanGeometry({cycling,grayscale,variant,activity,detail:true}),characterMaterial);rig.near.bind(rig.skeleton,new THREE.Matrix4());rig.near.frustumCulled=false;rig.group.add(rig.near);}if(rig.near)rig.near.visible=!!value;rig.far.visible=!value;}
  useImperativeHandle(ref,()=>({group:rig.group,update:pose,setDetail}),[rig,cycling,activity,waving]);useLayoutEffect(()=>{pose(0,waving);setDetail(variant<0);},[rig,waving]);
  return <primitive object={rig.group} dispose={null}/>;
});
function baked(parts){const objects=parts.map(([g,pos,scale,rotation=[0,0,0]])=>{const copy=g.clone();matrix.compose(first.set(...pos),quaternion.setFromEuler(euler.set(...rotation)),second.set(...scale));return copy.applyMatrix4(matrix);});const result=mergeGeometries(objects,false);objects.forEach(g=>g.dispose());return result;}
function tubeGeometry(a,b,radius=.02){const g=new THREE.CylinderGeometry(radius,radius,new THREE.Vector3(...a).distanceTo(new THREE.Vector3(...b)),7);first.set(...a);second.set(...b);quaternion.setFromUnitVectors(UP,direction.subVectors(second,first).normalize());g.applyQuaternion(quaternion);g.translate(...first.add(second).multiplyScalar(.5).toArray());return g;}
function tubes(segments,radius){const parts=segments.map(([a,b])=>tubeGeometry(a,b,radius));const result=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());return result;}
const tireGeometry=new THREE.TorusGeometry(.355,.031,6,32),rimGeometry=new THREE.TorusGeometry(.316,.009,4,28),gearGeometry=new THREE.TorusGeometry(.10,.008,4,20);
const frameGeometry=tubes([
  [[-.68,.39,0],[-.24,.49,0]],[[-.68,.39,0],[-.29,1.0,0]],[[-.29,1.0,0],[-.24,.49,0]],[[ -.29,1.0,0],[.42,.96,0]],[[.42,.96,0],[-.24,.49,0]],[[.42,.96,0],[.68,.39,0]],
],.024);
const chromeGeometry=tubes([
  [[-.29,.98,0],[-.29,1.075,0]],[[.42,.96,0],[.51,1.14,0]],[[.51,1.14,-.22],[.51,1.14,.22]],[[-.96,.85,-.15],[-.40,.85,-.15]],[[-.96,.85,.15],[-.40,.85,.15]],[[-.68,.39,-.045],[-.82,.85,-.15]],[[-.68,.39,.045],[-.82,.85,.15]],
],.012);
const darkBikeGeometry=baked([[box,[-.29,1.092,0],[.31,.06,.18]],[cylinder,[.51,1.14,-.22],[.024,.13,.024],[Math.PI/2,0,0]],[cylinder,[.51,1.14,.22],[.024,.13,.024],[Math.PI/2,0,0]]]);
const spokesGeometry=(()=>{const positions=[];for(let i=0;i<10;i++){const t=i/10*Math.PI*2;positions.push(0,0,0,Math.cos(t)*.312,Math.sin(t)*.312,0);}return new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3));})();
const spokeMaterial=new THREE.LineBasicMaterial({color:'#aca9c4',toneMapped:false});
// All strands of the open basket are merged into one mesh.
const basketGeometry=(()=>{const segments=[];
  for(let i=0;i<7;i++){const z=-.225+i*.075;segments.push([[.61,1.01,z],[.59,1.315,z*1.12]],[[.93,1.01,z],[.99,1.315,z*1.12]]);}
  for(let i=0;i<5;i++){const x=.61+i*.08;segments.push([[x,1.01,-.225],[x+(x-.61)*.18,1.315,-.252]],[[x,1.01,.225],[x+(x-.61)*.18,1.315,.252]]);}
  for(let i=0;i<6;i++){const y=1.01+i*.061,t=i/5,x1=.61-.02*t,x2=.93+.06*t,z=.225+.027*t;segments.push([[x1,y,-z],[x2,y,-z]],[[x1,y,z],[x2,y,z]],[[x1,y,-z],[x1,y,z]],[[x2,y,-z],[x2,y,z]]);}
  segments.push([[.62,1.015,-.22],[.93,1.015,.22]],[[.62,1.015,.22],[.93,1.015,-.22]],[[.51,1.13,-.15],[.62,1.15,-.15]],[[.51,1.13,.15],[.62,1.15,.15]]);return tubes(segments,.009);
})();
function painted(parts){const copies=parts.map(([g,hex,pos=[0,0,0],size=[1,1,1],r=[0,0,0]])=>{const copy=g.clone(),c=new THREE.Color(hex),a=new Float32Array(copy.attributes.position.count*3);for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b;}copy.setAttribute('color',new THREE.BufferAttribute(a,3));matrix.compose(first.set(...pos),quaternion.setFromEuler(euler.set(...r)),second.set(...size));copy.applyMatrix4(matrix);return copy;});const out=mergeGeometries(copies,false);copies.forEach(g=>g.dispose());return out;}
const bikeGeometry=painted([[frameGeometry,aqua],[chromeGeometry,cream],[darkBikeGeometry,indigo],[basketGeometry,'#e5d2ab'],[gearGeometry,cream,[-.24,.49,.035]]]);
const wheelGeometry=painted([[tireGeometry,indigo],[rimGeometry,cream]]);
const crankGeometry=painted([[box,cream,[0,0,0],[.018,.34,.025],[0,0,Math.PI/2]],[box,indigo,[.17,0,.145],[.13,.035,.15]],[box,indigo,[-.17,0,-.145],[.13,.035,.15]]]);
export const Bicycle=forwardRef(function Bicycle({grayscale=false,...groupProps},ref){
  const root=useRef(),wheels=useRef([]),cranks=useRef(),flowers=useRef();function update(pedal=0,time=0,butterflies=true){wheels.current.forEach(w=>{if(w)w.rotation.z=-pedal*1.6;});if(cranks.current)cranks.current.rotation.z=-pedal;flowers.current?.update(time,butterflies&&!grayscale);}
  useImperativeHandle(ref,()=>({group:root.current,update,updatePose:({pedal=0,time=0,butterflies=true}={})=>update(pedal,time,butterflies)}),[grayscale]);
  return <group ref={root} dispose={null} {...groupProps}>
    {[-.68,.68].map((x,i)=><group key={x} ref={el=>{wheels.current[i]=el;}} position={[x,.39,0]}><mesh geometry={wheelGeometry} material={characterMaterial}/><lineSegments geometry={spokesGeometry} material={spokeMaterial}/></group>)}
    <mesh geometry={bikeGeometry} material={characterMaterial}/><FlowerBasket ref={flowers}/>
    <group ref={cranks} position={[-.24,.49,0]}><mesh geometry={crankGeometry} material={characterMaterial}/></group>
  </group>;
});
const Traveller=forwardRef(function Traveller({mode='cycle',pedal=0,walk=0,grayscale=false,wave=false,...groupProps},ref){
  const root=useRef(),human=useRef(),bike=useRef(),cycling=mode==='cycle';
  function update(pedalPhase=0,walkPhase=0){bike.current?.update(pedalPhase);human.current?.update(cycling?-pedalPhase:walkPhase,wave);}
  function updatePose({pedal:pedalPhase=0,walk:walkPhase=0,wave:waveValue=wave,time=0,butterflies=true}={}){bike.current?.update(pedalPhase,time,butterflies);human.current?.update(cycling?-pedalPhase:walkPhase,waveValue);}
  useImperativeHandle(ref,()=>({group:root.current,update,updatePose,setDetail:value=>human.current?.setDetail(value)}),[cycling,wave]);useLayoutEffect(()=>{update(pedal,walk);},[mode,pedal,walk,wave]);
  return <group ref={root} dispose={null} {...groupProps}>{cycling&&<Bicycle ref={bike} grayscale={grayscale}/>}<group rotation={[0,cycling?Math.PI/2:0,0]}><Human ref={human} cycling={cycling} grayscale={grayscale} waving={wave}/></group></group>;
});
export const Resident=forwardRef(function Resident({variant=0,phase=0,waving=false,grayscale=false,activity='walk',...groupProps},ref){
  const root=useRef(),human=useRef(),waveAmount=useRef(0);function update(walkPhase=0,wave=waving){human.current?.update(walkPhase,wave);}
  function updatePose({walk:walkPhase=0,wave:waveValue=waving,detail,dt=1/60}={}){waveAmount.current=THREE.MathUtils.damp(waveAmount.current,waveValue?1:0,8,Math.min(dt,.1));human.current?.update(walkPhase,waveAmount.current);if(detail!==undefined)human.current?.setDetail(detail);}
  useImperativeHandle(ref,()=>({group:root.current,update,updatePose,setDetail:value=>human.current?.setDetail(value)}),[waving]);useLayoutEffect(()=>{update(phase,waving);},[phase,waving,variant,activity]);
  return <group ref={root} dispose={null} {...groupProps}><Human ref={human} grayscale={grayscale} variant={variant} activity={activity} waving={waving}/></group>;
});
export {Traveller};
export default Traveller;
