// Aufbau einer Minecraft-Skin-Textur (64×64, Format seit 1.8, gilt auch für Bedrock).

export const SKIN_SIZE = 64;

export type FaceName = 'right' | 'front' | 'left' | 'back' | 'top' | 'bottom';
export type PartName = 'head' | 'body' | 'rightArm' | 'leftArm' | 'rightLeg' | 'leftLeg';
export type Layer = 'base' | 'overlay';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PartDef {
  name: PartName;
  /** Breite, Höhe, Tiefe in Pixeln */
  size: [number, number, number];
  base: [number, number];
  overlay: [number, number];
  mirror: PartName;
}

export interface Region {
  part: PartDef;
  layer: Layer;
  face: FaceName;
  rect: Rect;
}

export function partDefs(slim: boolean): PartDef[] {
  const aw = slim ? 3 : 4;
  return [
    { name: 'head', size: [8, 8, 8], base: [0, 0], overlay: [32, 0], mirror: 'head' },
    { name: 'body', size: [8, 12, 4], base: [16, 16], overlay: [16, 32], mirror: 'body' },
    { name: 'rightArm', size: [aw, 12, 4], base: [40, 16], overlay: [40, 32], mirror: 'leftArm' },
    { name: 'leftArm', size: [aw, 12, 4], base: [32, 48], overlay: [48, 48], mirror: 'rightArm' },
    { name: 'rightLeg', size: [4, 12, 4], base: [0, 16], overlay: [0, 32], mirror: 'leftLeg' },
    { name: 'leftLeg', size: [4, 12, 4], base: [16, 48], overlay: [0, 48], mirror: 'rightLeg' },
  ];
}

/** Die sechs Flächen eines Quaders im üblichen Minecraft-Netz ab Ursprung (u, v). */
export function faceRects([w, h, d]: [number, number, number], [u, v]: [number, number]): Record<FaceName, Rect> {
  return {
    top: { x: u + d, y: v, w, h: d },
    bottom: { x: u + d + w, y: v, w, h: d },
    right: { x: u, y: v + d, w: d, h },
    front: { x: u + d, y: v + d, w, h },
    left: { x: u + d + w, y: v + d, w: d, h },
    back: { x: u + 2 * d + w, y: v + d, w, h },
  };
}

const regionCache = new Map<boolean, Region[]>();

export function regions(slim: boolean): Region[] {
  let list = regionCache.get(slim);
  if (!list) {
    list = [];
    for (const part of partDefs(slim)) {
      for (const layer of ['base', 'overlay'] as const) {
        const rects = faceRects(part.size, part[layer]);
        for (const face of Object.keys(rects) as FaceName[]) {
          list.push({ part, layer, face, rect: rects[face] });
        }
      }
    }
    regionCache.set(slim, list);
  }
  return list;
}

export function inRect(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

export function regionAt(x: number, y: number, slim: boolean): Region | undefined {
  return regions(slim).find((r) => inRect(r.rect, x, y));
}

/** Spiegelpixel auf der anderen Körperseite (rechter Arm ↔ linker Arm usw.). */
export function mirrorPixel(x: number, y: number, slim: boolean): [number, number] | undefined {
  const r = regionAt(x, y, slim);
  if (!r) return undefined;
  const target = partDefs(slim).find((p) => p.name === r.part.mirror)!;
  const face: FaceName = r.face === 'left' ? 'right' : r.face === 'right' ? 'left' : r.face;
  const tr = faceRects(target.size, target[r.layer])[face];
  return [tr.x + (tr.w - 1 - (x - r.rect.x)), tr.y + (y - r.rect.y)];
}
