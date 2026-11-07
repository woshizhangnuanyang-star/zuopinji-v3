import { ENTRY } from './journey';

export const townPalette = {
  aqua: '#b9e5e7', indigo: '#4b438a', pinkWhite: '#fff0f5',
  rose: '#edb8d3', yellow: '#f2e999', lilac: '#b6a3d4', leaf: '#6da4a1',
};

// Two inhabited street fronts, with modest setbacks and the cafe at its anchor.
// The 5.45-unit avenue keeps the cycling route and door approach unobstructed.
// Waterfront buildings stay behind the street-level camera at z=2.7.
const plan = {
  'project-1': { model: 'blue-gable', position: [-16.4, 0, -4.5], rotation: -.03, scale: .96 },
  'project-2': { model: 'mint-twin', position: [-10.6, 0, -3.95], rotation: .035, scale: .91 },
  'project-3': { model: 'rose-cafe', position: [ENTRY.x, 0, ENTRY.z], rotation: 0, scale: 1 },
  'project-4': { model: 'rose-arch', position: [2, 0, -4.35], rotation: -.04, scale: .92 },
  'project-5': { model: 'ochre-mansard', position: [8.2, 0, -4.9], rotation: .025, scale: .96 },
  'project-6': { model: 'lilac-balcony', position: [14.1, 0, -4.1], rotation: -.025, scale: .92 },
  'motion-blender': { model: 'lilac-balcony', position: [-18.8, 0, 7.5], rotation: .035, scale: 1.01 },
  'motion-ai': { model: 'blue-gable', position: [-12.7, 0, 6.8], rotation: -.03, scale: .91 },
  'motion-ae': { model: 'mint-twin', position: [-6.2, 0, 7.45], rotation: .025, scale: 1.01 },
  'web-1': { model: 'gallery-flat', position: [-.1, 0, 6.8], rotation: 0, scale: 1.00 },
  'web-2': { model: 'rose-arch', position: [6.5, 0, 7.5], rotation: -.02, scale: .97 },
  'web-3': { model: 'blue-gable', position: [12.2, 0, 6.9], rotation: .04, scale: .86 },
  'web-4': { model: 'ochre-mansard', position: [18.6, 0, 7.7], rotation: -.035, scale: .90 },
  'web-5': { model: 'gallery-flat', position: [21.5, 0, -5.2], rotation: .04, scale: .86 },
};

// Street buildings are scenery; portfolio entries are reached through the cafe.
// Keep this composition stable when work is added to any room.
export const buildings = Object.entries(plan).map(([id, placement]) => ({
  id, ...placement, model: `journey/${placement.model}`,
}));

export const modelNames = [...new Set(buildings.map(building => building.model))];
