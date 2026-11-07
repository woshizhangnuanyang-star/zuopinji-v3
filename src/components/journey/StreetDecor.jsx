import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildings, townPalette as P } from '../../data/townLayout';

// Entirely static, original street objects. Opaque vertex colour batches keep
// all the furniture and flat botanical silhouettes to one draw call.
const ignoreRaycast = () => {};

export function buildStreetGeometry(sparse = false) {
  const pieces = [];
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion();
  const matrix = new THREE.Matrix4();
  const local = new THREE.Object3D();

  function put(source, color, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) {
    const geometry = source.index ? source.toNonIndexed() : source;
    if (geometry !== source) source.dispose();
    local.position.set(...position); local.rotation.set(...rotation); local.scale.set(...scale); local.updateMatrix();
    geometry.applyMatrix4(local.matrix);
    geometry.deleteAttribute('uv');
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    // THREE.Color(hex) explicitly interprets the input as sRGB and stores linear.
    const c = new THREE.Color(color);
    const normal = geometry.attributes.normal;
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    for (let i = 0; i < normal.count; i++) {
      const shade = .94 + Math.max(0, normal.getY(i)) * .06;
      colors[i * 3] = c.r * shade; colors[i * 3 + 1] = c.g * shade; colors[i * 3 + 2] = c.b * shade;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    pieces.push(geometry);
  }

  const box = (x, y, z, w, h, d, color, ry = 0) => put(new THREE.BoxGeometry(w, h, d), color, [x, y, z], [0, ry, 0]);
  const cylinder = (x, y, z, rTop, rBottom, h, color, segments = 8) => put(new THREE.CylinderGeometry(rTop, rBottom, h, segments), color, [x, y, z]);
  function segment(a, b, radius, color) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b);
    const direction = B.clone().sub(A); const length = direction.length();
    q.setFromUnitVectors(up, direction.normalize());
    const geometry = new THREE.CylinderGeometry(radius, radius, length, 5);
    matrix.compose(A.add(B).multiplyScalar(.5), q, new THREE.Vector3(1, 1, 1));
    geometry.applyMatrix4(matrix); put(geometry, color);
  }

  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.bezierCurveTo(.13, .12, .12, .32, 0, .48);
  leafShape.bezierCurveTo(-.12, .32, -.13, .12, 0, 0);
  function leaf(x, y, z, scale, rz, ry, color) {
    put(new THREE.ShapeGeometry(leafShape, 3), color, [x, y, z], [0, ry, rz], [scale, scale, scale]);
  }

  function tree(x, z, height, angle = 0) {
    const C = Math.cos(angle), S = Math.sin(angle);
    const tx = (a, b, c = 0) => [x + a * C + c * S, .10 + b, z - a * S + c * C];
    segment(tx(0, 0), tx(.02, height), .024, '#8577a8');
    for (let i = 0; i < 5; i++) {
      const side = i % 2 ? 1 : -1;
      const y = height * (.27 + i * .115);
      const end = [side * (.34 + (i % 3) * .055), y + height * .16];
      segment(tx(.01, y), tx(...end), .0125, P.leaf);
      const tip = tx(...end);
      leaf(...tip, .85 + i * .03, side * -.68, angle, i % 2 ? '#8bbdb8' : P.leaf);
      const middle = tx(end[0] * .55, y + height * .1);
      leaf(...middle, .60, side * .25, angle, '#acd4c9');
    }
    const tip = tx(.02, height - .07);
    leaf(...tip, .77, -.12, angle, '#8bbdb8');
  }

  function planter(x, z, size = 1, variant = 0) {
    const y = .10;
    const pot = variant % 2 ? P.rose : '#b6a3d4';
    cylinder(x, y + .16 * size, z, .22 * size, .16 * size, .32 * size, pot);
    cylinder(x, y + .31 * size, z, .238 * size, .238 * size, .055 * size, P.pinkWhite);
    cylinder(x, y + .339 * size, z, .19 * size, .19 * size, .015 * size, '#8a7da4');
    for (let i = 0; i < 6; i++) {
      const a = i * 2.4;
      const xx = x + Math.sin(a) * .07 * size, zz = z + Math.cos(a) * .07 * size;
      leaf(xx, y + .31 * size, zz, (.75 + (i % 3) * .16) * size, Math.sin(a) * .65, a, i % 2 ? P.leaf : '#99c9c5');
    }
  }

  function lamp(x, z, height = 2.3) {
    cylinder(x, .17, z, .11, .15, .15, P.indigo);
    cylinder(x, height / 2 + .10, z, .025, .032, height, P.rose, 6);
    segment([x, height + .10, z], [x + .27, height + .18, z], .025, P.indigo);
    segment([x + .27, height + .18, z], [x + .34, height + .09, z], .025, P.indigo);
    cylinder(x + .34, height + .04, z, .065, .16, .10, P.indigo);
    put(new THREE.SphereGeometry(.072, 8, 5), P.yellow, [x + .34, height - .035, z], [0, 0, 0], [1, .7, 1]);
  }

  function bench(x, z, angle = 0) {
    const C = Math.cos(angle), S = Math.sin(angle);
    const tx = (a, y, b) => [x + a * C + b * S, y, z - a * S + b * C];
    const b = (a, y, c, w, h, d, color) => { const p = tx(a, y, c); box(...p, w, h, d, color, angle); };
    for (const a of [-.47, .47]) {
      b(a, .30, -.12, .045, .40, .045, P.indigo); b(a, .30, .16, .045, .40, .045, P.indigo);
      b(a, .63, -.18, .035, .58, .035, P.indigo);
    }
    for (let i = 0; i < 4; i++) b(0, .49, -.13 + i * .09, 1.25, .045, .071, i % 2 ? P.pinkWhite : P.rose);
    for (let i = 0; i < 3; i++) b(0, .68 + i * .09, -.18, 1.25, .06, .035, P.pinkWhite);
  }

  function chair(x, z, angle = 0) {
    cylinder(x, .44, z, .165, .165, .04, P.pinkWhite, 10);
    for (const a of [-1, 1]) for (const b of [-1, 1]) {
      box(x + a * .1, .28, z + b * .10, .022, .31, .022, P.indigo);
    }
    const bx = x + Math.sin(angle) * .14, bz = z + Math.cos(angle) * .14;
    box(bx, .65, bz, .30, .23, .025, P.rose, angle);
    for (const a of [-1, 1]) {
      box(bx + Math.cos(angle) * a * .14, .60, bz - Math.sin(angle) * a * .14, .023, .35, .023, P.indigo);
    }
  }

  function cafeTable(x, z, seed = 0) {
    cylinder(x, .72, z, .30, .30, .04, P.pinkWhite, 12);
    cylinder(x, .41, z, .024, .033, .58, P.indigo, 6);
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      segment([x, .14, z], [x + Math.cos(a) * .24, .13, z + Math.sin(a) * .24], .018, P.indigo);
    }
    // A tiny cup, saucer and folded rose menu make each table inhabited.
    cylinder(x - .09, .752, z, .065, .065, .012, P.rose, 10);
    cylinder(x - .09, .79, z, .035, .028, .06, P.pinkWhite, 8);
    box(x + .11, .765, z + .055, .11, .025, .17, P.rose, -.2);
    for (const angle of [.65 + seed, 3.5 + seed]) {
      chair(x + Math.sin(angle) * .57, z + Math.cos(angle) * .57, angle);
    }
  }

  function books(x, y, z, angle = 0) {
    box(x, y, z, .34, .07, .23, P.indigo, angle);
    box(x, y + .047, z, .31, .03, .21, P.pinkWhite, angle);
    box(x + .025, y + .095, z, .30, .065, .22, P.rose, angle + .13);
    box(x + .025, y + .14, z, .27, .025, .20, P.pinkWhite, angle + .13);
  }

  function bookCart(x, z) {
    box(x, .34, z, .72, .055, .39, P.rose);
    box(x, .78, z, .72, .045, .39, P.pinkWhite);
    for (const xx of [-.32, .32]) for (const zz of [-.16, .16]) box(x + xx, .55, z + zz, .025, .57, .025, P.indigo);
    for (const xx of [-.26, .26]) for (const zz of [-.20, .20]) {
      put(new THREE.TorusGeometry(.07, .017, 4, 10), P.indigo, [x + xx, .20, z + zz]);
    }
    books(x - .17, .83, z, -.07); books(x + .17, .39, z, .13);
  }

  function easel(x, z, angle = 0) {
    segment([x - .29, .11, z], [x, 1.43, z + .02], .025, P.indigo);
    segment([x + .29, .11, z], [x, 1.43, z + .02], .025, P.indigo);
    segment([x, 1.25, z + .02], [x, .11, z - .40], .022, P.indigo);
    box(x, .90, z + .055, .70, .82, .045, P.pinkWhite, angle);
    box(x, .47, z + .11, .82, .045, .14, P.rose, angle);
    box(x - .12, .86, z + .087, .25, .43, .01, P.aqua, angle);
    box(x + .13, .77, z + .096, .24, .28, .01, P.rose, angle);
    put(new THREE.CircleGeometry(.095, 12), P.yellow, [x + .13, 1.08, z + .10]);
  }

  function mailbox(x, z) {
    cylinder(x, .57, z, .027, .035, .93, P.indigo, 6);
    box(x, 1.08, z, .43, .34, .32, P.rose);
    box(x, 1.27, z, .48, .055, .36, P.pinkWhite);
    box(x, 1.14, z + .166, .25, .026, .012, P.indigo);
    box(x + .24, 1.20, z + .02, .025, .25, .025, P.indigo);
    box(x + .28, 1.31, z + .02, .10, .085, .025, P.yellow);
  }

  // These positions avoid both the bicycle lane and the cafe's door approach.
  const treePositions = [
    [-23, 3.8, 2.7, .25], [-17, 3.8, 2.5, -.25], [-11, 3.8, 2.7, .25],
    [-5, 3.8, 2.5, -.25], [1, 3.8, 2.7, .25], [7, 3.8, 2.5, -.25],
    [13, 3.8, 2.7, .25], [19, 3.8, 2.5, -.25], [25, 3.8, 2.7, .25],
  ];
  treePositions.slice(0, sparse ? 6 : 9).forEach(args => tree(...args));

  const planters = buildings.filter(b=>b.id!=='project-3').map(b=>[
    b.position[0]+1.7*b.scale,b.position[2]+1.65*b.scale,.85,
  ]);
  planters.slice(0, sparse ? 12 : planters.length).forEach(([x, z, size], i) => planter(x, z, size, i));
  [-20,-14,-8,-2,4,10,16,22].forEach((x,i)=>lamp(x,-1.15,i%2?2.15:2.35));
  [-20,-8,4,16].forEach(x=>bench(x,3.65,0));
  cafeTable(-2.15, -.35, 0); cafeTable(-.35, -1.05, .4);
  bookCart(-10.55, 3.45); mailbox(-6.6, 3.45); mailbox(22.6, -2.0);
  easel(10.2, 3.3, 0); easel(-.2, 3.3, 0);
  books(4.2, .56, 3.65, 0);

  const geometry = mergeGeometries(pieces, false);
  pieces.forEach(piece => piece.dispose());
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  geometry.name = 'merged-pastel-street-objects';
  return geometry;
}

export default function StreetDecor({ progress, reduced = false, eco = false }) {
  const root = useRef();
  const geometry = useMemo(() => buildStreetGeometry(eco || reduced), [eco, reduced]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(() => {
    if (root.current) root.current.visible = (progress?.current ?? 0) < .505;
  });
  return <group ref={root} name="StreetDecor">
    <mesh geometry={geometry} raycast={ignoreRaycast}>
      <meshBasicMaterial vertexColors side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  </group>;
}

export { StreetDecor };
