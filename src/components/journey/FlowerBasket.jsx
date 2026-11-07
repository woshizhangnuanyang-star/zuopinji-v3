import {forwardRef,useImperativeHandle,useLayoutEffect,useMemo,useRef} from 'react';
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Original low-poly flower shapes, baked once. The full bouquet is one draw call.
const vertexMaterial=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,toneMapped:false});
const petalShape=new THREE.Shape();petalShape.moveTo(0,0);petalShape.bezierCurveTo(-.05,.025,-.075,.10,-.025,.135);petalShape.bezierCurveTo(.035,.17,.075,.07,0,0);
const petal=new THREE.ShapeGeometry(petalShape,4),leaf=new THREE.ShapeGeometry(new THREE.Shape().moveTo(0,0).quadraticCurveTo(-.08,.1,0,.22).quadraticCurveTo(.085,.1,0,0),3),centre=new THREE.SphereGeometry(1,6,4);
const dummy=new THREE.Object3D(),q=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0);
function coloured(g,colour){const c=new THREE.Color(colour),a=new Float32Array(g.attributes.position.count*3);for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b;}g.setAttribute('color',new THREE.BufferAttribute(a,3));return g;}
function piece(out,g,c,p=[0,0,0],s=[1,1,1],r=[0,0,0]){const copy=g.clone();dummy.position.set(...p);dummy.scale.set(...s);dummy.rotation.set(...r);dummy.updateMatrix();copy.applyMatrix4(dummy.matrix);out.push(c?coloured(copy,c):copy);}
function merge(parts){const g=mergeGeometries(parts,false);parts.forEach(p=>p.dispose());return g;}
function stem(out,a,b,r=.007,c='#8cafad'){const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),d=B.clone().sub(A);const g=new THREE.CylinderGeometry(r,r,d.length(),5);q.setFromUnitVectors(up,d.normalize());g.applyQuaternion(q);g.translate(...A.add(B).multiplyScalar(.5).toArray());out.push(coloured(g,c));}
function flower(kind,c){const out=[],layers=kind===0?3:1,count=kind===0?7:kind===1?8:5;for(let k=0;k<layers;k++)for(let j=0;j<count;j++){const a=j/count*Math.PI*2+k*.38,scale=1-k*.23;piece(out,petal,k===2?'#fff2f7':c,[Math.sin(a)*.01,Math.cos(a)*.01,k*.013],[scale,scale*(kind===2?1.2:1),1],[k*.1,0,a]);}piece(out,centre,kind===0?'#f4e6ae':'#f4e999',[0,0,.032],[.025,.025,.022]);return merge(out);}
const blooms=[flower(0,'#edb8d3'),flower(1,'#fff4f7'),flower(2,'#b3a5df'),flower(0,'#c5e7f2'),flower(1,'#f5e99b'),flower(0,'#e5d9ef')];
const bouquetGeometry=(()=>{const out=[];for(let i=0;i<28;i++){const a=i*2.399,r=.08+Math.sqrt(i/28)*.23,x=.86+Math.cos(a)*r,z=Math.sin(a)*r,y=1.47+(i%5)*.065+(1-r)*.06;stem(out,[.79,1.13,0],[x,y,z]);piece(out,blooms[i%blooms.length],null,[x,y,z],[.65+(i%3)*.18,.65+(i%3)*.18,.8],[Math.sin(a)*.23,Math.cos(a)*.55,a*.24]);if(i%2===0)piece(out,leaf,i%4?'#a9c9ae':'#b9d9c7',[x-.03,y-.19,z],[.8,.8,.8],[0,a,-.6*Math.sin(a)]);}
  // Fine, airy sprays and draping bellflowers soften the basket's silhouette.
  for(let side=0;side<3;side++){const x=.94+side*.065,z=(side-1)*.20;stem(out,[.8,1.3,0],[x+.13,1.1,z],.004);for(let j=0;j<5;j++){const y=1.34-j*.072,xx=x+j*.045;stem(out,[x+.06,y+.08,z],[xx,y,z+.055],.003);piece(out,blooms[side%2?3:4],null,[xx,y,z+.06],[.28,.32,.28],[0,.3,j*.4]);}}
  return merge(out);
})();
const wingShape=new THREE.Shape();wingShape.moveTo(0,0);wingShape.bezierCurveTo(.04,.10,.15,.12,.13,.025);wingShape.bezierCurveTo(.17,-.06,.07,-.10,0,0);
const wingGeometry=new THREE.ShapeGeometry(wingShape,5),wingMaterial=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,toneMapped:false}),bodyMaterial=new THREE.MeshBasicMaterial({color:'#73629f',toneMapped:false});
const wingColours=new Float32Array(wingGeometry.attributes.position.count*3),wingInk=new THREE.Color('#8871b4'),wingPaper=new THREE.Color('#fff4fa'),wingColour=new THREE.Color();
for(let i=0;i<wingGeometry.attributes.position.count;i++){wingColour.copy(wingPaper).lerp(wingInk,Math.min(1,Math.max(0,(wingGeometry.attributes.position.getX(i)-.045)*12)));wingColours.set([wingColour.r,wingColour.g,wingColour.b],i*3);}wingGeometry.setAttribute('color',new THREE.BufferAttribute(wingColours,3));

export default forwardRef(function FlowerBasket(_,ref){
  const root=useRef(),flock=useRef(),wings=useRef(),bodies=useRef(),m=useMemo(()=>new THREE.Object3D(),[]);
  function update(time=0,enabled=true){
    root.current.rotation.x=Math.sin(time*1.7)*.018;root.current.rotation.z=Math.sin(time*1.2)*.014;
    flock.current.visible=enabled;
    if(!enabled)return;
    for(let i=0;i<2;i++){const a=time*(i?-.76:.91)+i*Math.PI,x=.88+Math.cos(a)*(.31+i*.06),y=1.95+Math.sin(a*1.8)*.12+i*.06,z=Math.sin(a)*.34,yaw=a+.7,roll=Math.sin(a*1.3)*.18;
      m.position.set(x,y,z);m.rotation.set(0,yaw,roll);m.scale.set(.012,.042,.012);m.updateMatrix();bodies.current.setMatrixAt(i,m.matrix);
      for(let side=0;side<2;side++){const sign=side?1:-1,flap=.25+Math.sin(time*13+i*2)*.9;m.position.set(x+sign*.009,y,z);m.rotation.set(.14,yaw+sign*flap,roll);m.scale.set(sign*.95,.95,.95);m.updateMatrix();wings.current.setMatrixAt(i*2+side,m.matrix);}
    }wings.current.instanceMatrix.needsUpdate=true;bodies.current.instanceMatrix.needsUpdate=true;
  }
  useImperativeHandle(ref,()=>({update}),[]);
  useLayoutEffect(()=>{const c=new THREE.Color();for(let i=0;i<4;i++)wings.current.setColorAt(i,c.set(i<2?'#beaff1':'#b9e5e7'));wings.current.instanceColor.needsUpdate=true;update(0,false);},[]);
  return <group dispose={null}><group ref={root}><mesh geometry={bouquetGeometry} material={vertexMaterial}/></group><group ref={flock}><instancedMesh ref={wings} args={[wingGeometry,wingMaterial,4]} frustumCulled={false}/><instancedMesh ref={bodies} args={[centre,bodyMaterial,2]} frustumCulled={false}/></group></group>;
});
