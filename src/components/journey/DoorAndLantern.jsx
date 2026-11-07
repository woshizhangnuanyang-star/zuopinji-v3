import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Reusable visual assets only. The owning scene drives the imperative refs;
// neither asset creates a render loop or React state updates.
const doorCache = new Map();
const lampCache = new Map();
const doorColors = ['#9fc8b9', '#ddb6c9', '#a6c9d8', '#ddc56b', '#d58a79', '#b8a6d2'];
const doorInk = ['#426d64', '#88506f', '#50798d', '#897b3d', '#8b534b', '#6b568c'];
const cream = '#e1e2e6';
const darkCap = new THREE.Color('#0c1421');
const litCap = new THREE.Color('#466465');
const darkRib = new THREE.Color('#182029');
const litRib = new THREE.Color('#d7c38e');

function lineGeometry(segments) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(segments, 3));
  return geometry;
}

function addPath(lines, points, close = false, z = .12) {
  const values = points.map(p => [p[0], p[1], p[2] ?? z]);
  for (let i = 1; i < values.length; i++) lines.push(...values[i - 1], ...values[i]);
  if (close && values.length > 1) lines.push(...values[values.length - 1], ...values[0]);
}

function rect(lines, x, y, w, h, z = .12) {
  addPath(lines, [[x,y],[x+w,y],[x+w,y+h],[x,y+h]], true, z);
}

function arcPoints(cx, cy, rx, ry, start = 0, end = Math.PI, count = 32) {
  return Array.from({ length: count + 1 }, (_,i) => {
    const t = start + (end - start) * i / count;
    return [cx + Math.cos(t)*rx, cy + Math.sin(t)*ry];
  });
}

function shapeGeometry(points, depth = .06) {
  const shape = new THREE.Shape();
  points.forEach((v,i) => i ? shape.lineTo(v[0],v[1]) : shape.moveTo(v[0],v[1]));
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 16 });
}

function merge(items) {
  if (!items.length) return new THREE.BufferGeometry();
  const normalized = items.map(g => g.index ? g.toNonIndexed() : g);
  const result = mergeGeometries(normalized, false);
  items.forEach(g => g.dispose());
  normalized.forEach(g => { if (!items.includes(g)) g.dispose(); });
  return result;
}

function makeDoor(variant) {
  if (doorCache.has(variant)) return doorCache.get(variant);
  const frame = [], fanLines = [], decoration = [], glassPieces = [], knobs = [];
  const isArch = [0,3,4].includes(variant), isPoint = variant === 5;
  const leafHeight = isArch || isPoint ? 2.42 : 2.80;
  const leafWidth = .81;
  const panel = shapeGeometry([[0,0],[leafWidth,0],[leafWidth,leafHeight],[0,leafHeight]], .075);
  const edge = new THREE.EdgesGeometry(panel, 22);
  // Slender line-box pilasters retain the corridor's monochrome drawing style.
  for (const side of [-1,1]) {
    const x = side * .955;
    rect(frame,x-.075,0,.15,leafHeight+.04,.08);
    rect(frame,x-.075,0,.15,leafHeight+.04,-.10);
    for(const xx of [x-.075,x+.075]) addPath(frame,[[xx,0,-.10],[xx,0,.08],[xx,leafHeight+.04,.08],[xx,leafHeight+.04,-.10]]);
    rect(frame,x-.12,.02,.24,.12,.09);
    rect(frame,x-.12,leafHeight-.04,.24,.13,.09);
    addPath(frame,[[x-.03,.19],[x-.03,leafHeight-.12]],false,.095);
    addPath(frame,[[x+.03,.19],[x+.03,leafHeight-.12]],false,.095);
  }
  rect(frame,-1.06,0,2.12,.10,.12);
  addPath(frame,[[-1.13,-.065],[1.13,-.065]],false,.24);
  let fan = new THREE.BufferGeometry();
  if (isArch) {
    const outer = arcPoints(0,2.42,.98,.98);
    const inner = arcPoints(0,2.42,.84,.84);
    addPath(frame,outer,false,.095); addPath(frame,inner,false,.095);
    addPath(frame,[[-.98,2.42],[.98,2.42]],false,.095);
    fan = shapeGeometry([[.81,2.42],...arcPoints(0,2.42,.81,.81,0,Math.PI),[-.81,2.42]],.045);
    addPath(fanLines,arcPoints(0,2.42,.78,.78),false,.09);
    for(let i=0;i<=6;i++) {
      const t=i/6*Math.PI;
      addPath(fanLines,[[0,2.42],[Math.cos(t)*.79,2.42+Math.sin(t)*.79]],false,.10);
    }
    if(variant===4) {
      for(let i=0;i<17;i++) {
        const t=i/16*Math.PI;
        addPath(frame,[[Math.cos(t)*.85,2.42+Math.sin(t)*.85],[Math.cos(t)*.98,2.42+Math.sin(t)*.98]],false,.10);
      }
      for(const side of [-1,1])for(let y=.2;y<2.35;y+=.22)addPath(frame,[[side*.88,y],[side*1.02,y]],false,.10);
      rect(frame,-.10,3.33,.20,.12,.10);
    }
  } else if (variant === 1) {
    for(const y of [2.84,2.95,3.06])rect(frame,-1.07,y,2.14,.07,.10);
    addPath(frame,[[-.72,3.12],[-.61,3.26],[-.20,3.28],[-.15,3.40],[.15,3.40],[.20,3.28],[.61,3.26],[.72,3.12]],false,.10);
    for(const side of [-1,1]) {
      const curve=[];
      for(let i=0;i<=32;i++){const t=i/32*Math.PI*3;const r=.10*(1-i/40);curve.push([side*(.79+Math.cos(t)*r),3.20+Math.sin(t)*r]);}
      addPath(frame,curve,false,.10);
    }
  } else if (variant === 2) {
    addPath(frame,[[-1.06,2.92],[0,3.4],[1.06,2.92],[-1.06,2.92]],false,.09);
    addPath(frame,[[-.84,2.98],[0,3.30],[.84,2.98]],false,.10);
    for(const y of [2.82,2.89])rect(frame,-1.08,y,2.16,.05,.10);
    fan = shapeGeometry([[-.67,3.00],[0,3.25],[.67,3.00]],.025);
  } else {
    const outerCurve = new THREE.CubicBezierCurve3(new THREE.Vector3(-.98,2.45,.10),new THREE.Vector3(-1.1,3.00,.10),new THREE.Vector3(-.25,3.05,.10),new THREE.Vector3(0,3.4,.10));
    const pts=outerCurve.getPoints(24).map(v=>[v.x,v.y,v.z]);
    addPath(frame,pts);addPath(frame,pts.map(v=>[-v[0],v[1],v[2]]));
    const inner=pts.map(([x,y,z])=>[x*.83,2.42+(y-2.42)*.80,z]);
    addPath(frame,inner);addPath(frame,inner.map(v=>[-v[0],v[1],v[2]]));
    const fanPoints=[[-.81,2.42],...inner.map(v=>[v[0],v[1]]),...inner.slice(0,-1).reverse().map(v=>[-v[0],v[1]]),[.81,2.42]];
    fan=shapeGeometry(fanPoints,.04);
    for(const x of [-.53,-.27,0,.27,.53])addPath(fanLines,[[x,2.45],[x,2.80-Math.abs(x)*.23]],false,.105);
    addPath(fanLines,[[-.75,2.62],[.75,2.62]],false,.105);
  }
  // Panel reliefs live on the left leaf and are mirrored for the right leaf.
  rect(decoration,.075,.12,.66,leafHeight-.24,.09);
  const panelRect=(x,y,w,h)=>{rect(decoration,x,y,w,h,.101);rect(decoration,x+.025,y+.025,w-.05,h-.05,.105);};
  if(variant===0) {
    for(const y of [.28,1.22]) {
      panelRect(.15,y,.51,.80);
      // A paired curling vine, interpreted as restrained engraved ornament.
      for(const sign of [-1,1]) {
        const vine=[];
        for(let j=0;j<26;j++){const t=j/25*Math.PI*2.5;vine.push([.405+sign*(.095*Math.sin(t))*(1-j/35),y+.14+j/25*.53]);}
        addPath(decoration,vine,false,.112);
      }
    }
  } else if(variant===1) {
    const diamond=[[.405,1.74],[.665,2.13],[.405,2.53],[.145,2.13]];
    glassPieces.push(shapeGeometry(diamond,.016).translate(0,0,.085)); addPath(decoration,diamond,true,.112);
    panelRect(.15,.29,.51,.92); panelRect(.15,1.32,.51,.25);
    const curl=arcPoints(.405,.80,.105,.14,-Math.PI*.25,Math.PI*1.60,20);addPath(decoration,curl,false,.115);
  } else if(variant===2) {
    for(let row=0;row<4;row++)for(let col=0;col<2;col++) {
      const x=.145+col*.275,y=.27+row*.57;panelRect(x,y,.235,.44);
      if(row>1)glassPieces.push(shapeGeometry([[x+.03,y+.04],[x+.205,y+.04],[x+.205,y+.40],[x+.03,y+.40]],.009).translate(0,0,.091));
    }
  } else if(variant===3) {
    for(const y of [.24,.94,1.64]) {panelRect(.16,y,.49,.53);addPath(decoration,[[.19,y+.08],[.405,y+.18],[.62,y+.08]],false,.113);}
  } else if(variant===4) {
    for(const y of [.25,1.20]) {
      const outline=[[.16,y],[.65,y],[.65,y+.52],...arcPoints(.405,y+.52,.245,.25,0,Math.PI,16),[.16,y]];
      addPath(decoration,outline,true,.112);
    }
  } else {
    for(const y of [.27,1.36]) {
      panelRect(.15,y,.51,.84);
      const diamond=[[.405,y+.08],[.62,y+.42],[.405,y+.76],[.19,y+.42]];
      addPath(decoration,diamond,true,.112);
      if(y>1)glassPieces.push(shapeGeometry(diamond,.012).translate(0,0,.09));
      else addPath(decoration,[[.405,y+.08],[.405,y+.76],[.19,y+.42],[.62,y+.42]],false,.113);
    }
  }
  const knob=new THREE.SphereGeometry(.034,8,6).translate(.70,1.13,.14);knobs.push(knob);
  knobs.push(new THREE.BoxGeometry(.045,.16,.025).translate(.70,1.13,.105));
  const result={panel,edge,frame:lineGeometry(frame),fan,fanLines:lineGeometry(fanLines),decoration:lineGeometry(decoration),glass:merge(glassPieces),knobs:merge(knobs),leafHeight};
  doorCache.set(variant,result);return result;
}

export const DoorModel = forwardRef(function DoorModel({variant=0,onClick,onPointerOver,onPointerOut},ref) {
  const v=((variant%6)+6)%6,asset=useMemo(()=>makeDoor(v),[v]);
  const left=useRef(),right=useRef();
  const materials=useMemo(()=>({
    panel:new THREE.MeshBasicMaterial({color:doorColors[v],side:THREE.DoubleSide}),
    glass:new THREE.MeshBasicMaterial({color:new THREE.Color(doorColors[v]).lerp(new THREE.Color('#f3ecd1'),.56),side:THREE.DoubleSide}),
    fan:new THREE.MeshBasicMaterial({color:new THREE.Color(doorColors[v]).lerp(new THREE.Color('#f1e6ba'),.30),side:THREE.DoubleSide}),
    ink:new THREE.LineBasicMaterial({color:doorInk[v],transparent:true,opacity:.88}),
    frame:new THREE.LineBasicMaterial({color:cream,transparent:true,opacity:.80}),
    metal:new THREE.MeshBasicMaterial({color:'#e0cf9d'}),
  }),[v]);
  useImperativeHandle(ref,()=>({
    setOpen(value){const a=THREE.MathUtils.clamp(value,0,1)*1.12;if(left.current)left.current.rotation.y=-a;if(right.current)right.current.rotation.y=a;},
    setGlow(value){materials.frame.opacity=.55+THREE.MathUtils.clamp(value,0,1)*.45;},
  }),[materials]);
  useEffect(()=>()=>Object.values(materials).forEach(m=>m.dispose()),[materials]);
  const leaf=(rightSide=false)=><group ref={rightSide?right:left} position={[rightSide ? .82 : -.82,.055,0]}>
    <group scale={[rightSide?-1:1,1,1]}>
      <mesh geometry={asset.panel} material={materials.panel}/>
      <lineSegments geometry={asset.edge} material={materials.ink}/>
      <lineSegments geometry={asset.decoration} material={materials.ink}/>
      {asset.glass.getAttribute('position')&&<mesh geometry={asset.glass} material={materials.glass}/>}
      <mesh geometry={asset.knobs} material={materials.metal}/>
    </group>
  </group>;
  return <group onClick={onClick} onPointerOver={onPointerOver} onPointerOut={onPointerOut} dispose={null}>
    <lineSegments geometry={asset.frame} material={materials.frame}/>
    {asset.fan.getAttribute('position')&&<mesh geometry={asset.fan} material={materials.fan}/>}
    {asset.fanLines.getAttribute('position')?.count>0&&<lineSegments geometry={asset.fanLines} material={materials.frame}/>}
    {leaf()}{leaf(true)}
  </group>;
});

function mosaicTexture(variant) {
  const canvas=document.createElement('canvas');canvas.width=384;canvas.height=256;const ctx=canvas.getContext('2d');
  const backgrounds=['#58a9b4','#bb8fbc','#d1ba66'];
  const colors=['#a2e1d1','#e7b0ce','#eedc85','#608eae','#a19bce','#74c5b7'];
  ctx.fillStyle=backgrounds[variant%3];ctx.fillRect(0,0,384,256);
  for(let row=-1;row<8;row++)for(let col=-1;col<12;col++) {
    const x=col*36+(row%2)*18,y=row*38;
    ctx.save();ctx.translate(x,y);ctx.fillStyle=colors[(col+row*3+24)%colors.length];
    const petals=variant===2?6:8;
    for(let j=0;j<petals;j++){ctx.save();ctx.rotate(j/petals*Math.PI*2);ctx.beginPath();ctx.ellipse(0,10,3.2,5.1,0,0,Math.PI*2);ctx.fill();ctx.restore();}
    ctx.fillStyle='#eddaa6';ctx.beginPath();ctx.arc(0,0,2.2,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  ctx.strokeStyle='rgba(236,218,161,.58)';ctx.lineWidth=1.0;
  for(let x=0;x<=384;x+=48){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,256);ctx.stroke();}
  ctx.strokeRect(.5,.5,383,255);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=THREE.RepeatWrapping;texture.anisotropy=2;return texture;
}

function makeLamp(variant) {
  if(lampCache.has(variant))return lampCache.get(variant);
  const profiles=[
    [[.07,-.37],[.24,-.28],[.36,-.12],[.38,.07],[.29,.25],[.12,.35]],
    [[.17,-.38],[.24,-.33],[.245,.28],[.18,.36]],
    [[.06,-.37],[.25,-.29],[.35,-.12],[.36,.10],[.25,.28],[.07,.37]],
  ];
  const profile=profiles[variant%3];
  const glass=new THREE.LatheGeometry(profile.map(([x,y])=>new THREE.Vector2(x,y)),32);
  const top=new THREE.LatheGeometry([[.12,.30],[.22,.34],[.18,.40],[.08,.46],[.025,.52]].map(p=>new THREE.Vector2(...p)),24);
  const bottom=new THREE.LatheGeometry([[.16,-.31],[.22,-.35],[.14,-.39],[.045,-.46]].map(p=>new THREE.Vector2(...p)),24);
  const ring=new THREE.TorusGeometry(.055,.010,5,16).translate(0,.55,0);
  const caps=merge([top,bottom,ring]);const ribs=[];
  for(let meridian=0;meridian<8;meridian++) {
    const angle=meridian/8*Math.PI*2;
    addPath(ribs,profile.map(([r,y])=>[Math.cos(angle)*(r+.003),y,Math.sin(angle)*(r+.003)]));
  }
  for(const y of [-.27,.24]) {
    let radius=profile.reduce((best,p)=>Math.abs(p[1]-y)<Math.abs(best[1]-y)?p:best,profile[0])[0];
    addPath(ribs,Array.from({length:49},(_,i)=>[Math.cos(i/48*Math.PI*2)*(radius+.003),y,Math.sin(i/48*Math.PI*2)*(radius+.003)]));
  }
  const tassel=[];addPath(tassel,[[0,-.44,0],[0,-.61,0]]);
  for(let i=0;i<5;i++)addPath(tassel,[[0,-.60,0],[Math.sin(i*2.4)*.035,-.74,Math.cos(i*2.4)*.035]]);
  const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=128;const ctx=glowCanvas.getContext('2d');
  const gradient=ctx.createRadialGradient(64,64,4,64,64,64);gradient.addColorStop(0,'rgba(255,237,174,.72)');gradient.addColorStop(.28,'rgba(255,224,156,.24)');gradient.addColorStop(1,'rgba(255,223,160,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
  const glow=new THREE.CanvasTexture(glowCanvas);
  const result={glass,caps,ribs:lineGeometry(ribs),tassel:lineGeometry(tassel),map:mosaicTexture(variant),glow};lampCache.set(variant,result);return result;
}

export const LanternModel = forwardRef(function LanternModel({variant=0},ref) {
  const v=((variant%3)+3)%3,asset=useMemo(()=>makeLamp(v),[v]);
  const materials=useMemo(()=>({
    glass:new THREE.MeshStandardMaterial({map:asset.map,emissiveMap:asset.map,color:'#080b12',emissive:'#ffffff',emissiveIntensity:.001,roughness:.68,metalness:.12,side:THREE.DoubleSide}),
    caps:new THREE.MeshBasicMaterial({color:'#0d1520'}),
    ribs:new THREE.LineBasicMaterial({color:'#182029',transparent:true,opacity:.75}),
    glow:new THREE.SpriteMaterial({map:asset.glow,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,color:'#fff0b7'}),
  }),[asset]);
  useImperativeHandle(ref,()=>({
    setBrightness(value){const b=THREE.MathUtils.clamp(value,0,1);materials.glass.color.setRGB(.025+b*.65,.025+b*.65,.025+b*.65);materials.glass.emissiveIntensity=b*1.5;
      materials.caps.color.lerpColors(darkCap,litCap,b);
      materials.ribs.color.lerpColors(darkRib,litRib,b);materials.ribs.opacity=.30+b*.65;materials.glow.opacity=b*.68;},
  }),[materials]);
  useEffect(()=>()=>Object.values(materials).forEach(m=>m.dispose()),[materials]);
  return <group dispose={null}>
    <mesh geometry={asset.glass} material={materials.glass}/><mesh geometry={asset.caps} material={materials.caps}/>
    <lineSegments geometry={asset.ribs} material={materials.ribs}/><lineSegments geometry={asset.tassel} material={materials.ribs}/>
    <sprite scale={[2.2,2.2,1]} material={materials.glow}/>
  </group>;
});

/** Call only after all instances have been unmounted. */
export function disposeDoorAndLanternAssets() {
  doorCache.forEach(asset=>Object.values(asset).forEach(value=>value?.dispose?.()));doorCache.clear();
  lampCache.forEach(asset=>Object.values(asset).forEach(value=>value?.dispose?.()));lampCache.clear();
}
