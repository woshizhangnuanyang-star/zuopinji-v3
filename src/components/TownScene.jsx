import { assetPath } from "../lib/assetPath.js";
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import gsap from 'gsap';
import { projects, districts } from '../data/portfolio';

const palette = { ground: '#d9cbd1', road: '#ded6d3', violet: '#4b438a', pink: '#e8a8c8', yellow: '#f3df93', green: '#88b74e', trunk: '#a58a7c' };
const vertex = `varying vec2 vUv; varying vec3 vWorld; void main(){vUv=uv;vec4 world=modelMatrix*vec4(position,1.);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`;
const waterFragment = `
  uniform float uTime; uniform vec3 uLight; uniform vec3 uDark; uniform vec3 uRipple[4];
  varying vec2 vUv; varying vec3 vWorld;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  void main(){
    float gradient=smoothstep(-19.,23.,vWorld.z*.9+vWorld.x*.13);
    vec3 color=mix(uLight,uDark,gradient);
    float grain=(hash(gl_FragCoord.xy)-.5)*.028;
    float waves=sin(vWorld.x*2.1+sin(vWorld.z*1.7+uTime*.25))*.003;
    color+=grain+waves;
    for(int i=0;i<4;i++){
      float age=uTime-uRipple[i].z;
      if(age<0.||age>=3.2)continue;
      float d=length(vWorld.xz-uRipple[i].xy);
      float ring=1.-smoothstep(.02,.065,abs(d-age*1.15));
      color+=ring*max(0.,1.-age/3.2)*.11;
    }
    float thin=1.-smoothstep(.015,.035,abs(sin(vWorld.x*.28+vWorld.z*.4+uTime*.18)));
    color+=thin*.013;
    gl_FragColor=vec4(color,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
const groundFragment = `
  uniform vec3 uColor; varying vec2 vUv; varying vec3 vWorld;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  void main(){vec2 g=fract(vWorld.xz*3.6);float dots=(1.-smoothstep(.035,.065,length(g-.5)))*.15;
    float grid=(1.-smoothstep(.018,.03,min(g.x,g.y)))*.03;
    gl_FragColor=vec4(uColor+vec3(dots-grid+(hash(gl_FragCoord.xy)-.5)*.035),1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

function FrameClock({ active, eco, reduced }) {
  const invalidate = useThree(s => s.invalidate);
  useEffect(() => {
    if (!active || reduced) return;
    // Ambient motion is slower than the display; scrolling still invalidates directly.
    invalidate();
    const timer=setInterval(()=>{if(!document.hidden)invalidate();},1000/(eco?24:30));
    return()=>clearInterval(timer);
  }, [active, eco, reduced, invalidate]);
  return null;
}

function CameraRig({ district, focus, reset, scroll, reduced, onDragState }) {
  const { camera, gl, size, invalidate } = useThree();
  const controls = useRef({ x: 0, z: 0, zoom: 1, panX: 0, panZ: 0 });
  const drag = useRef(null);
  useEffect(() => {
    const target = focus ? projects.find(p => p.id === focus)?.position : districts.find(d => d.id === district)?.position;
    const tween=gsap.to(controls.current, { x: target?.[0] || 0, z: target?.[2] || 0, zoom: focus ? 1.55 : district === 'all' ? 1 : 1.24,
      panX: 0, panZ: 0, duration: reduced ? 0 : 1.25, ease: 'power3.inOut', onUpdate: invalidate, overwrite: true });
    return()=>tween.kill();
  }, [district, focus, reset, reduced, invalidate]);
  useEffect(() => {
    const element = gl.domElement;
    const down = e => { if (e.button !== 0 || e.target.closest?.('button')) return; drag.current = { x: e.clientX, y: e.clientY, moved: false }; };
    const move = e => {
      if (!drag.current) return;
      const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) { drag.current.moved = true; onDragState(true); }
      if (drag.current.moved) {
        controls.current.panX = THREE.MathUtils.clamp(controls.current.panX - dx * .019 - dy * .013, -7, 7);
        controls.current.panZ = THREE.MathUtils.clamp(controls.current.panZ + dx * .014 - dy * .017, -5, 5);
      }
      drag.current.x = e.clientX; drag.current.y = e.clientY; invalidate();
    };
    const up = () => { drag.current = null; setTimeout(() => onDragState(false), 0); };
    element.addEventListener('pointerdown', down); window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    return () => { element.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
  }, [gl, invalidate, onDragState]);
  useFrame(() => {
    const c = controls.current, mobile = size.width < 700;
    const baseZoom = mobile ? size.width / 36 : Math.min(size.width / 49, size.height / 28);
    const x = c.x * .67 + c.panX, z = c.z * .7 + c.panZ;
    // Fixed orthographic orientation preserves the architectural illustration's composition.
    camera.position.set(x - 29, 33 - scroll.current * 3, z + 37);
    camera.lookAt(x - (mobile ? 0 : 3.5), 0, z);
    camera.zoom = baseZoom * c.zoom * (1 + scroll.current * .04);
    if (mobile) camera.setViewOffset(size.width,size.height,0,-size.height*.13,size.width,size.height); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  });
  return null;
}

function Water({ reduced, play }) {
  const material = useRef();
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uLight: { value: new THREE.Color('#bce8e8') }, uDark: { value: new THREE.Color('#5b56a3') }, uRipple: { value: Array.from({ length: 4 }, () => new THREE.Vector3(999, 999, -100)) } }), []);
  const rippleIndex = useRef(0);
  useFrame(({ clock }) => { if (material.current) material.current.uniforms.uTime.value = reduced ? 0 : clock.elapsedTime; });
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.24, 0]} onClick={e => {
    if (e.delta > 5) return; const time = material.current.uniforms.uTime.value;
    uniforms.uRipple.value[rippleIndex.current++ % 4].set(e.point.x, e.point.z, time); play('water');
  }}>
    <planeGeometry args={[220, 220]} /><shaderMaterial ref={material} vertexShader={vertex} fragmentShader={waterFragment} uniforms={uniforms} />
  </mesh>;
}

function Ground() {
  const uniforms=useMemo(()=>({uColor:{value:new THREE.Color('#c8c4d4')}}),[]);
  const geometry=useMemo(()=>{
    const shape=points=>{const s=new THREE.Shape();points.forEach(([x,z],i)=>i?s.lineTo(x,-z):s.moveTo(x,-z));s.closePath();return s;};
    const island=shape([[-26.5,-28],[26.5,-28],[29,-25.5],[29,9.5],[26.5,12],[-26.5,12],[-29,9.5],[-29,-25.5]]);
    const street=shape([[-26,-1.35],[26,-1.35],[26,4.1],[-26,4.1]]);
    const promenade=shape([[-26,10],[26,10],[26,11.35],[-26,11.35]]);
    const backStreets=[[-10.2,1.9],[-17,1.75],[-23.1,1.35]].map(([z,width])=>new THREE.ShapeGeometry(shape([[-26,z-width/2],[26,z-width/2],[26,z+width/2],[-26,z+width/2]])));
    const sideWalks=[-26.9,26.9].map(x=>new THREE.ShapeGeometry(shape([[x-.5,-25.5],[x+.5,-25.5],[x+.5,10],[x-.5,10]])));
    const colour=(g,hex)=>{const c=new THREE.Color(hex),a=new Float32Array(g.attributes.position.count*3);for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b;}g.setAttribute('color',new THREE.BufferAttribute(a,3));return g;};
    const paved=[colour(new THREE.ShapeGeometry(street),'#e2dee8'),colour(new THREE.ShapeGeometry(promenade),'#e0d7e6'),...[...backStreets,...sideWalks].map(g=>colour(g,'#dedbe7'))];paved.forEach(g=>{g.rotateX(-Math.PI/2);g.translate(0,.078,0);});
    const furniture=[];const box=(pos,size,c)=>{const g=colour(new THREE.BoxGeometry(...size),c);g.translate(...pos);furniture.push(g);};
    box([29.6,.06,-5.8],[6.4,.17,2.1],'#edb8d3');[-6.75,-4.85].forEach(z=>box([29.6,.28,z],[6.4,.3,.11],'#d789bc'));for(let i=0;i<10;i++)box([6.8,.04-i*.016,11.55+i*.13],[5,.05,.12],'#bcb4cf');
    const roads=mergeGeometries(paved,false),details=mergeGeometries(furniture,false);[...paved,...furniture].forEach(g=>g.dispose());
    return {base:new THREE.ExtrudeGeometry(island,{depth:.28,bevelEnabled:false}),top:new THREE.ShapeGeometry(island),roads,details};
  },[]);
  useEffect(()=>()=>Object.values(geometry).forEach(g=>g.dispose()),[geometry]);
  return <group>
    <mesh geometry={geometry.base} rotation={[-Math.PI/2,0,0]} position={[0,-.24,0]}><meshBasicMaterial color="#b2a7c7"/></mesh>
    <mesh geometry={geometry.top} rotation={[-Math.PI/2,0,0]} position={[0,.045,0]}><shaderMaterial vertexShader={vertex} fragmentShader={groundFragment} uniforms={uniforms}/></mesh>
    <mesh geometry={geometry.roads}><meshBasicMaterial vertexColors/></mesh>
    <mesh geometry={geometry.details}><meshBasicMaterial vertexColors/></mesh>
  </group>;
}

function ModelBatch({model,...props}) {
  const gltf=useLoader(GLTFLoader,assetPath(`/assets/${model}.glb`));
  return <ModelInstances model={model} gltf={gltf} {...props}/>;
}

function ModelInstances({ gltf, model, entries, hovered, selected, onSelect, onHover, reduced, dragRef, progress, cafeState, onInteract, interactive=true }) {
  const refs = useRef([]), values = useRef({}),motion = useRef({});
  const paper = useRef(null);
  const gl = useThree(s => s.gl);
  const parts = useMemo(() => {
    gltf.scene.updateMatrixWorld(true);
    const output = [];
    gltf.scene.traverse(object => {
      if (!object.isMesh) return;
      const source = Array.isArray(object.material) ? object.material[0] : object.material;
      const material = new THREE.MeshBasicMaterial({ color: source.color, vertexColors: !!object.geometry.attributes.color, side: THREE.DoubleSide });
      const name=`${object.name} ${object.parent?.name || ''}`;
      output.push({ geometry: object.geometry, material, matrix: object.matrixWorld.clone(), name,door:/door/i.test(name),awning:/awning/i.test(name),blinds:/blinds/i.test(name) });
    });
    return output;
  }, [gltf]);
  useEffect(() => {
    const dispose=()=>parts.forEach(part=>part.material.dispose());
    // Journey GLBs have vertex colours and no UVs; do not fetch seven unused textures.
    if(!parts.some(part=>part.geometry.attributes.uv))return dispose;
    const loader = new KTX2Loader().detectSupport(gl); let mounted = true;
    loader.load(assetPath('/assets/paper-grain.ktx2'), texture => {
      if (!mounted) { texture.dispose(); return; }
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(4, 4); paper.current = texture;
      parts.forEach(part => { if(part.geometry.attributes.uv) {part.material.map = texture;part.material.needsUpdate = true;} });
    }, undefined, () => {});
    return () => { mounted = false; dispose(); paper.current?.dispose(); loader.dispose(); };
  }, [gl, parts]);
  const scratch = useMemo(() => ({ matrix: new THREE.Matrix4(), extra: new THREE.Matrix4(), quaternion: new THREE.Quaternion(), euler: new THREE.Euler(), color: new THREE.Color(), pos: new THREE.Vector3(), scale: new THREE.Vector3() }), []);
  const dirty=useMemo(()=>new Uint8Array(parts.length),[parts]),isCafe=model.includes('rose-cafe');
  useFrame(({ clock }, dt) => {
    if(progress?.current>=.5)return;
    dirty.fill(0);
    const t = reduced ? 0 : clock.elapsedTime,doorAmount=progress?THREE.MathUtils.smoothstep(progress.current,.448,.489):0,blinds=cafeState?.current?.blinds||0,awning=Math.sin(t*1.8)*.008;
    const doorChanged=motion.current.door!==doorAmount,blindsChanged=motion.current.blinds!==blinds,awningChanged=motion.current.awning!==awning;
    motion.current.door=doorAmount;motion.current.blinds=blinds;motion.current.awning=awning;
    entries.forEach((entry, i) => {
      const emphasis = selected === entry.id ? 1 : hovered === entry.id ? .32 : 0;
      const previous=values.current[entry.id],damped=THREE.MathUtils.damp(previous||0,emphasis,7,Math.min(dt,.08)),h=Math.abs(damped-emphasis)<.0001?emphasis:damped,changed=previous!==h;
      values.current[entry.id]=h;
      if(!changed&&!isCafe)return;
      parts.forEach((part, j) => {
        if(!changed&&!(isCafe&&((part.door&&doorChanged)||(part.blinds&&blindsChanged)||(part.awning&&awningChanged))))return;
        scratch.pos.set(entry.position[0], .1, entry.position[2]);
        scratch.euler.set(0, entry.rotation, 0); scratch.quaternion.setFromEuler(scratch.euler);
        scratch.scale.setScalar(entry.scale * (1 + h * .065)); scratch.matrix.compose(scratch.pos, scratch.quaternion, scratch.scale).multiply(part.matrix);
        if(isCafe) {
          if(part.door)scratch.matrix.multiply(scratch.extra.makeRotationY(doorAmount*1.25));
          if(part.awning)scratch.matrix.multiply(scratch.extra.makeRotationX(awning+h*.035));
          if(part.blinds)scratch.matrix.multiply(scratch.extra.makeScale(1,1-blinds*.88,1));
        }
        refs.current[j]?.setMatrixAt(i, scratch.matrix);
        dirty[j]|=1;
        if(changed){refs.current[j]?.setColorAt(i,scratch.color.setRGB(1+h*.13,1+h*.13,1+h*.13));dirty[j]|=2;}
      });
    });
    refs.current.forEach((mesh,j) => { if(mesh){if(dirty[j]&1)mesh.instanceMatrix.needsUpdate=true;if(dirty[j]&2&&mesh.instanceColor)mesh.instanceColor.needsUpdate=true;} });
  });
  return parts.map((part, j) => <instancedMesh key={j} ref={el => { refs.current[j] = el; }} args={[part.geometry, part.material, entries.length]} frustumCulled={false}
    onPointerOver={interactive?e => { e.stopPropagation(); if (!dragRef?.current) onHover(entries[e.instanceId].id); }:undefined}
    onPointerOut={interactive?()=>onHover(null):undefined}
    onClick={interactive?e => { e.stopPropagation(); if (e.delta < 5 && !dragRef?.current) {if(onInteract)onInteract(entries[e.instanceId].id,part.name,e.point);else onSelect?.(entries[e.instanceId].id);} }:undefined} />);
}

function GraphicShadows() {
  return <group>{projects.map(p => <mesh key={p.id} position={[p.position[0] + 1.8, .085, p.position[2] + 1.1]} rotation={[-Math.PI / 2, 0, .44]}>
    <planeGeometry args={[2.2 * p.scale, 6 * p.scale]} /><meshBasicMaterial color="#686188" transparent opacity={.13} depthWrite={false} />
  </mesh>)}</group>;
}

function Trees() {
  const trunks = useRef(), leaves = useRef();
  const positions = useMemo(() => [[-16,-6],[-15,5],[-14,8],[-7,-8],[-5,-7],[.8,-7],[3,-8],[15,-7],[16,-2],[15,4],[15.5,7],[12,8],[2.5,7],[2.5,8],[-13.4,2.9],[-6,8],[-3,8],[16,8]], []);
  useEffect(() => {
    const dummy = new THREE.Object3D();
    positions.forEach(([x,z],i) => {
      dummy.position.set(x,.85,z);dummy.scale.set(.065,1.6,.065);dummy.rotation.set(0,0,0);dummy.updateMatrix();trunks.current.setMatrixAt(i,dummy.matrix);
      for(let j=0;j<4;j++) { dummy.position.set(x+Math.sin(j*2.4)*.28,1.2+j*.28,z+Math.cos(j*2.4)*.2);dummy.scale.set(.44-j*.045,.35,.27);dummy.rotation.set(0,j,0);dummy.updateMatrix();leaves.current.setMatrixAt(i*4+j,dummy.matrix); }
    });trunks.current.instanceMatrix.needsUpdate=true;leaves.current.instanceMatrix.needsUpdate=true;
  },[positions]);
  return <group><instancedMesh ref={trunks} args={[undefined,undefined,positions.length]}><boxGeometry /><meshBasicMaterial color={palette.trunk}/></instancedMesh><instancedMesh ref={leaves} args={[undefined,undefined,positions.length*4]}><icosahedronGeometry args={[1,0]}/><meshLambertMaterial color={palette.green}/></instancedMesh></group>;
}

function Residents({ reduced, eco, play }) {
  const refs=useRef([]), wave=useRef(-1), count=eco?26:44;
  const dummy=useMemo(()=>new THREE.Object3D(),[]);
  const residents=useMemo(()=>Array.from({length:count},(_,i)=>({seed:i*2.399, lane:i%3, color:['#ec9bb7','#86cbd0','#f0dc80','#aeafd5','#c1ce85'][i%5]})),[count]);
  useEffect(()=>{residents.forEach((r,i)=>refs.current[0]?.setColorAt(i,new THREE.Color(r.color)));if(refs.current[0])refs.current[0].instanceColor.needsUpdate=true;},[residents]);
  useFrame(({clock})=>{
    const t=reduced?0:clock.elapsedTime;
    residents.forEach((r,i)=>{
      const x=((i*2.79+t*(i%2?-.27:.24)+70)%30+30)%30-15;
      const z=r.lane===0?.3+Math.sin(r.seed)*.6:r.lane===1?8.3+Math.sin(r.seed)*.35:-.9;
      const stride=reduced?0:Math.sin(t*4+r.seed), facing=i%2?-1:1;
      const set=(part,px,py,pz,sx,sy,sz,rx=0,rz=0)=>{dummy.position.set(px,py,pz);dummy.scale.set(sx,sy,sz);dummy.rotation.set(rx,0,rz);dummy.updateMatrix();refs.current[part]?.setMatrixAt(i,dummy.matrix);};
      set(0,x,.58,z,.18,.32,.12);set(1,x,.85,z,.105,.105,.105);
      set(2,x-.053,.26,z+stride*.045,.043,.29,.045,stride*.25);
      set(3,x+.053,.26,z-stride*.045,.043,.29,.045,-stride*.25);
      set(4,x-.14,.59,z,.035,.27,.035,-stride*.2,.12);
      set(5,x+.14,.63,z,.035,.27,.035,stride*.2,wave.current===i?-.8+Math.sin(t*7)*.35:-.14);
      set(6,x,.91,z-.015,.108,.065,.105);
    });refs.current.forEach(ref=>{if(ref)ref.instanceMatrix.needsUpdate=true;});
  });
  return <group>{['body','head','legL','legR','armL','armR','hair'].map((part,i)=><instancedMesh key={part} ref={el=>{refs.current[i]=el;}} args={[undefined,undefined,count]} frustumCulled={false} onClick={e=>{if(e.delta>5)return;e.stopPropagation();wave.current=e.instanceId;play('hover');}}>
    {i===1||i===6?<sphereGeometry args={[1,7,5]}/>:<boxGeometry/>}<meshBasicMaterial color={i===0?'white':i===1||i===4||i===5?'#efd1b4':i===6?'#8e746e':'#a3a7c6'}/>
  </instancedMesh>)}</group>;
}

function TownFurniture() {
  return <group>
    {[-13,-6,1,8,15].map((x,i)=><group key={x} position={[x,0,2.2]}>
      <mesh position={[0,1.15,0]}><cylinderGeometry args={[.035,.035,2.2,5]}/><meshBasicMaterial color="#e69275"/></mesh>
      <mesh position={[0,2.3,0]}><sphereGeometry args={[.13,8,6]}/><meshBasicMaterial color="#f6e89f"/></mesh>
      {i%2===0&&<><mesh position={[.5,.42,.3]}><boxGeometry args={[1.15,.1,.38]}/><meshBasicMaterial color="#aaa3bb"/></mesh><mesh position={[.5,.68,.5]}><boxGeometry args={[1.15,.36,.08]}/><meshBasicMaterial color="#b1a8be"/></mesh></>}
    </group>)}
    <group position={[-16.5,0,.5]}><mesh position={[0,.5,0]}><boxGeometry args={[1.7,.9,.75]}/><meshBasicMaterial color="#f3df7c"/></mesh><mesh position={[.3,.75,.39]}><planeGeometry args={[.8,.23]}/><meshBasicMaterial color="#d6e4d2"/></mesh>{[-.5,.5].map(x=><mesh key={x} rotation={[Math.PI/2,0,0]} position={[x,.18,.39]}><cylinderGeometry args={[.16,.16,.07,10]}/><meshBasicMaterial color="#665d90"/></mesh>)}</group>
  </group>;
}

function Sailboat({ position, phase, reduced, play }) {
  const group=useRef();
  const sail=useMemo(()=>{const s=new THREE.Shape();s.moveTo(0,0);s.lineTo(0,3.6);s.lineTo(-1.35,.1);s.closePath();return s;},[]);
  useFrame(({clock})=>{if(!group.current)return;const t=reduced?0:clock.elapsedTime;group.current.position.y=-.05+Math.sin(t*.75+phase)*.065;group.current.rotation.z=Math.sin(t*.6+phase)*.025;group.current.rotation.y=.25+Math.sin(t*.12+phase)*.08;});
  return <group ref={group} position={position} onClick={e=>{if(e.delta>5)return;e.stopPropagation();play('water');gsap.to(group.current.rotation,{y:group.current.rotation.y+.7,duration:1,yoyo:true,repeat:1});}}>
    <mesh position={[0,.05,0]}><boxGeometry args={[2.5,.22,.75]}/><meshToonMaterial color="#edabc6"/></mesh>
    <mesh position={[0,1.8,0]}><cylinderGeometry args={[.025,.025,3.6,5]}/><meshBasicMaterial color="#fff1d8"/></mesh>
    <mesh position={[0,.25,0]}><shapeGeometry args={[sail]}/><meshBasicMaterial color="#f5df8c" side={THREE.DoubleSide}/></mesh>
    <mesh position={[.1,.25,0]} scale={[-.65,.88,1]}><shapeGeometry args={[sail]}/><meshBasicMaterial color="#fff2b1" side={THREE.DoubleSide}/></mesh>
  </group>;
}

function BirdSprites({ reduced }) {
  const refs=useRef([]);
  const textures=useMemo(()=>{
    const c=document.createElement('canvas');c.width=512;c.height=64;const ctx=c.getContext('2d');
    for(let i=0;i<8;i++){const x=i*64+32,flap=.35+Math.abs(Math.sin(i/8*Math.PI))*.65;ctx.save();ctx.translate(x,32);ctx.strokeStyle='#fff8ed';ctx.lineWidth=3;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-21,-16*flap);ctx.quadraticCurveTo(-10,-18*flap,0,0);ctx.quadraticCurveTo(10,-18*flap,21,-16*flap);ctx.stroke();ctx.restore();}
    const base=new THREE.CanvasTexture(c);return Array.from({length:5},()=>{const texture=base.clone();texture.repeat.set(1/8,1);return texture;});
  },[]);
  useEffect(()=>()=>textures.forEach(t=>t.dispose()),[textures]);
  useFrame(({clock})=>{const t=reduced?0:clock.elapsedTime;refs.current.forEach((r,i)=>{if(!r)return;r.position.set(Math.sin(t*.12+i)*13,5.5+Math.sin(t*.24+i)*.8,Math.cos(t*.11+i)*9);textures[i].offset.x=(Math.floor(t*7+i)%8)/8;});});
  return textures.map((map,i)=><sprite key={i} ref={el=>{refs.current[i]=el;}} scale={[1,1,1]}><spriteMaterial map={map} transparent depthWrite={false}/></sprite>);
}

function DistrictSignPositions({ labelRefs }) {
  const v=useMemo(()=>new THREE.Vector3(),[]);
  useFrame(({camera,size})=>{
    districts.forEach((d,i)=>{
      const el=labelRefs.current[i];if(!el)return;
      v.set(d.position[0],4.8,d.position[2]).project(camera);
      const x=(v.x*.5+.5)*size.width,y=(-v.y*.5+.5)*size.height;
      el.style.transform=`translate(${x}px,${y}px) translate(-50%,-100%)`;
      el.style.visibility=x<40||x>size.width-40||y<70||y>size.height-60?'hidden':'visible';
    });
  });
  return null;
}

function FocusHalo({ id }) {
  const project=projects.find(p=>p.id===id);if(!project)return null;
  return <mesh position={[project.position[0],.11,project.position[2]]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[1.9,1.98,40]}/><meshBasicMaterial color="#fff4ad" transparent opacity={.9}/></mesh>;
}

// A single light post-process pass: depth outlines and subtle printed-paper grain.
function PaperPass({ enabled, journeyProgress }) {
  const { gl, size }=useThree();
  const resources=useMemo(()=>{
    const target=new THREE.WebGLRenderTarget(1,1,{depthBuffer:true});target.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedShortType);
    const material=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,uniforms:{tColor:{value:target.texture},tDepth:{value:target.depthTexture},uResolution:{value:new THREE.Vector2(1,1)}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader:`uniform sampler2D tColor;uniform sampler2D tDepth;uniform vec2 uResolution;varying vec2 vUv;
      void main(){vec4 c=texture2D(tColor,vUv);vec2 px=1./uResolution;float d=texture2D(tDepth,vUv).x;
      float edge=abs(d-texture2D(tDepth,vUv+vec2(px.x,0.)).x)+abs(d-texture2D(tDepth,vUv+vec2(0.,px.y)).x);
      float line=smoothstep(.00075,.004,edge)*.22;c.rgb=mix(c.rgb,vec3(.23,.19,.43),line);
      float grain=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5;c.rgb+=grain*.009;gl_FragColor=c;
      #include <colorspace_fragment>
      }`});
    const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1),quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);scene.add(quad);
    return {target,material,scene,camera,quad};
  },[]);
  useEffect(()=>{const ratio=gl.getPixelRatio(),w=Math.round(size.width*ratio),h=Math.round(size.height*ratio);resources.target.setSize(w,h);resources.material.uniforms.uResolution.value.set(w,h);},[size,gl,resources]);
  useEffect(()=>()=>{resources.target.dispose();resources.target.depthTexture.dispose();resources.material.dispose();resources.quad.geometry.dispose();},[resources]);
  useFrame(({scene,camera})=>{
    if(!enabled||journeyProgress?.current>=.49){gl.setRenderTarget(null);gl.render(scene,camera);gl.domElement.dataset.drawCalls=String(gl.info.render.calls);return;}
    gl.setRenderTarget(resources.target);gl.render(scene,camera);gl.domElement.dataset.drawCalls=String(gl.info.render.calls+1);gl.setRenderTarget(null);gl.render(resources.scene,resources.camera);
  },1);
  return null;
}

export { FrameClock, Water, Ground, ModelBatch, ModelInstances, GraphicShadows, Trees, Residents, TownFurniture, Sailboat, BirdSprites, PaperPass };

function Scene({ district, focus, reset, scroll, eco, reduced, active, onSelect, onHover, play, onReady, labelRefs }) {
  const [hovered,setHovered]=useState(null);const dragRef=useRef(false);
  const dragState=useMemo(()=>value=>{dragRef.current=value;},[]);
  const hover=id=>{setHovered(id);onHover(id);if(id)play('hover');};
  useEffect(()=>{document.body.style.cursor=hovered?'pointer':'';return()=>{document.body.style.cursor='';};},[hovered]);
  useEffect(()=>{onReady();},[onReady]);
  return <>
    <ambientLight intensity={1.9}/><directionalLight position={[-12,30,-15]} intensity={2.1} color="#fff4ee"/><directionalLight position={[15,7,20]} intensity={.6} color="#b9dce9"/>
    <FrameClock active={active} eco={eco} reduced={reduced}/><CameraRig district={district} focus={focus} reset={reset} scroll={scroll} reduced={reduced} onDragState={dragState}/>
    <Water reduced={reduced} play={play}/><Ground/><GraphicShadows/>
    <Suspense fallback={null}>{['gable-house','atelier','pavilion'].map(model=><ModelBatch key={model} model={model} entries={projects.filter(p=>p.model===model)} hovered={hovered} selected={focus} onSelect={onSelect} onHover={hover} reduced={reduced} dragRef={dragRef}/>)}</Suspense>
    <Trees/><TownFurniture/><Residents reduced={reduced} eco={eco} play={play}/><BirdSprites reduced={reduced}/>
    <Sailboat position={[17,0,11.8]} phase={0} reduced={reduced} play={play}/><Sailboat position={[-15,0,-15]} phase={3} reduced={reduced} play={play}/>
    <FocusHalo id={hovered||focus}/><DistrictSignPositions labelRefs={labelRefs}/><PaperPass enabled={!eco}/>
  </>;
}

export default function TownScene(props) {
  const labelRefs=useRef([]);
  return <div className="scene-layer"><Canvas orthographic frameloop="demand" camera={{position:[-29,33,37],near:.1,far:350,zoom:22}} dpr={[1,props.eco?1:1.5]} gl={{antialias:true,alpha:false,powerPreference:props.eco?'low-power':'high-performance'}}
    onCreated={({gl})=>{gl.setClearColor('#b9e5e7');gl.toneMapping=THREE.NoToneMapping;}} fallback={<img className="fallback-town" src={assetPath("/assets/town-poster.svg")} alt="滨水创作小镇平面导览"/>}>
    <Scene {...props} labelRefs={labelRefs}/>
  </Canvas><div className="labels-layer">{districts.map((d,i)=><button key={d.id} ref={el=>{labelRefs.current[i]=el;}} className={`district-sign ${props.district===d.id?'is-active':''}`} onClick={()=>props.onDistrict(d.id)}><span>{d.number}</span>{d.title}<span className="sign-arrow">↗</span></button>)}</div></div>;
}
