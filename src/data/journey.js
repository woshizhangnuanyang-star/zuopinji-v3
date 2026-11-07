export const ENTRY = { x: -3.9, z: -3.5, doorX: -5.25, doorZ: -1.92 };
export const rooms = [
  { id: 'about', label: '个人介绍', subtitle: '认识小镇的创作者', color: '#a9d4c2' },
  { id: 'projects', label: '完整项目', subtitle: '6 个完整课程项目', color: '#e7b3cf' },
  { id: 'web', label: '网页设计', subtitle: '6 个实习期间落地项目', color: '#9ccedb' },
  { id: 'motion', label: '动效设计', subtitle: 'Blender / C4D / Spline / TouchDesigner', color: '#e5c877' },
  { id: 'other', label: '其他设计', subtitle: '智能光影与装置设计', color: '#dc9d91' },
  { id: 'vibecoding', label: 'vibecoding', subtitle: '把灵感写成可以体验的作品', color: '#b8acd5' },
].map((room, index) => ({ ...room, index, z: -7 - index * 7, side: index % 2 ? 1 : -1 }));

export const stops = [0, .19, .40, .560, .643, .726, .810, .893, .976];
export const clamp01 = v => Math.max(0, Math.min(1, v));
export const smooth = v => { const t = clamp01(v); return t * t * (3 - 2 * t); };
export function phaseAt(p) { return p < .13 ? 'town' : p < .35 ? 'ride' : p < .50 ? 'cafe' : 'hall'; }
export function corridorAt(p) { return clamp01((p - .50) / .50); }
export function travellerZ(p) { return -2 - corridorAt(p) * 42; }
export function doorAt(p) { return Math.max(0, Math.min(5, Math.round((-travellerZ(p) - 7) / 7))); }
export function doorProgress(index) { return .50 + ((5 + index * 7) / 42) * .50; }
export function rideAt(p) { return clamp01((p - .12) / .26); }
export function bikePosition(p) { const t = rideAt(p); return [-14.5 + 8.85 * t, 0.11, .50 - .60 * smooth(t)]; }
export function walkPosition(p) {
  const t = clamp01((p - .38) / .12);
  return [-5.65 + .40 * smooth(t), .11, -.1 - 1.88 * t];
}
export const exteriorFrames = [
  { p: 0, position: [-45.2, 45.8, 42.5], target: [-16.2, 2.6, -5.5], fov: 24 },
  { p: .10, position: [-44.2, 44.8, 41.5], target: [-16.2, 2.6, -5.5], fov: 24 },
  { p: .19, position: [-16, 4.5, 3], target: [-12.1, 1.15, .4], fov: 55 },
  { p: .32, position: [-11, 3.7, 2.7], target: [-7.7, 1.2, .05], fov: 55 },
  { p: .39, position: [-5.8, 3.4, 2.7], target: [-4.4, 2.6, -2], fov: 82 },
  { p: .44, position: [-4.6, 3.4, 2.7], target: [-3.9, 2.6, -2], fov: 82 },
  { p: .478, position: [-5.2, 1.9, .8], target: [-5.25, 1.5, -2.2], fov: 49 },
  { p: .50, position: [-5.25, 1.7, -1.2], target: [-5.25, 1.6, -4], fov: 51 },
];
