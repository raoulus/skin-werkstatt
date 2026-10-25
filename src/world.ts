import * as THREE from 'three';

const GRASS = ['#5fa33a', '#6cb043', '#579a33', '#74b84b', '#64a83e'];
const DIRT = ['#8a5a3b', '#7a4e33', '#966644', '#6e4630'];

/** Kleiner Zufallsgenerator mit festem Startwert, damit die Blöcke immer gleich aussehen. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pixelTexture(draw: (px: (x: number, y: number, c: string) => void) => void): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d')!;
  draw((x, y, color) => {
    g.fillStyle = color;
    g.fillRect(x, y, 1, 1);
  });
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 3×3 Grasblöcke, auf denen die Figur steht (1 Block = 16 Skin-Pixel). */
export function makeGrassPlatform(): THREE.Group {
  const rnd = seeded(7);
  const pick = (list: string[]) => list[Math.floor(rnd() * list.length)];

  const top = pixelTexture((px) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, pick(GRASS));
  });
  const side = pixelTexture((px) => {
    for (let x = 0; x < 16; x++) {
      const grassDepth = 2 + Math.floor(rnd() * 3);
      for (let y = 0; y < 16; y++) px(x, y, y < grassDepth ? pick(GRASS) : pick(DIRT));
    }
  });
  const bottom = pixelTexture((px) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, pick(DIRT));
  });

  const mats = [side, side, top, bottom, side, side].map((map) => new THREE.MeshLambertMaterial({ map }));
  const geo = new THREE.BoxGeometry(16, 16, 16);
  const group = new THREE.Group();
  for (const x of [-16, 0, 16]) {
    for (const z of [-16, 0, 16]) {
      const block = new THREE.Mesh(geo, mats);
      block.position.set(x, -8, z);
      group.add(block);
    }
  }
  return group;
}
