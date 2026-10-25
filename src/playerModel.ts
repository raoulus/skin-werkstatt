import * as THREE from 'three';
import { SKIN_SIZE, faceRects, partDefs, type Layer, type PartName, type Rect } from './skinLayout';

// Reihenfolge der Flächen in THREE.BoxGeometry: +x, -x, +y, -y, +z, -z.
// Die Figur schaut nach +z, ihre rechte Seite liegt also bei -x.
const FACE_ORDER = ['left', 'right', 'top', 'bottom', 'front', 'back'] as const;

export interface PaintTarget {
  layer: Layer;
  /** Pro BoxGeometry-Fläche das zugehörige Rechteck in der Textur. */
  rects: Rect[];
}

/** Gelenkpositionen in Pixeln, Ursprung zwischen den Füßen. */
function joints(slim: boolean): Record<PartName, { pivot: [number, number, number]; offset: number }> {
  const armX = 4 + (slim ? 1.5 : 2);
  return {
    head: { pivot: [0, 24, 0], offset: 4 },
    body: { pivot: [0, 24, 0], offset: -6 },
    rightArm: { pivot: [-armX, 22, 0], offset: -4 },
    leftArm: { pivot: [armX, 22, 0], offset: -4 },
    rightLeg: { pivot: [-2, 12, 0], offset: -6 },
    leftLeg: { pivot: [2, 12, 0], offset: -6 },
  };
}

export class PlayerModel {
  readonly root = new THREE.Group();
  readonly parts = {} as Record<PartName, THREE.Group>;
  readonly baseMeshes: THREE.Mesh[] = [];
  readonly overlayMeshes: THREE.Mesh[] = [];
  private readonly baseMaterial: THREE.MeshLambertMaterial;
  private readonly overlayMaterial: THREE.MeshLambertMaterial;

  /** baseTexture: eigene, deckende Textur für die Grundschicht (sonst wird die Skin-Textur genutzt). */
  constructor(texture: THREE.Texture, slim: boolean, baseTexture?: THREE.Texture) {
    this.baseMaterial = baseTexture
      ? new THREE.MeshLambertMaterial({ map: baseTexture })
      : new THREE.MeshLambertMaterial({ map: texture, alphaTest: 0.5 });
    this.overlayMaterial = new THREE.MeshLambertMaterial({ map: texture, alphaTest: 0.5, side: THREE.DoubleSide });
    this.build(slim);
  }

  build(slim: boolean) {
    for (const mesh of [...this.baseMeshes, ...this.overlayMeshes]) mesh.geometry.dispose();
    this.root.clear();
    this.baseMeshes.length = 0;
    this.overlayMeshes.length = 0;

    const j = joints(slim);
    for (const def of partDefs(slim)) {
      const group = new THREE.Group();
      group.position.set(...j[def.name].pivot);
      const inflate = def.name === 'head' ? 1 : 0.5;
      const base = this.box(def.size, def.base, 0, this.baseMaterial, 'base');
      const overlay = this.box(def.size, def.overlay, inflate, this.overlayMaterial, 'overlay');
      for (const mesh of [base, overlay]) {
        mesh.position.y = j[def.name].offset;
        group.add(mesh);
      }
      this.baseMeshes.push(base);
      this.overlayMeshes.push(overlay);
      this.parts[def.name] = group;
      this.root.add(group);
    }
  }

  set overlayVisible(v: boolean) {
    for (const m of this.overlayMeshes) m.visible = v;
  }

  resetPose() {
    for (const g of Object.values(this.parts)) g.rotation.set(0, 0, 0);
    this.root.position.y = 0;
    this.root.rotation.set(0, 0, 0);
  }

  private box(
    size: [number, number, number],
    uvOrigin: [number, number],
    inflate: number,
    material: THREE.Material,
    layer: Layer,
  ): THREE.Mesh {
    const [w, h, d] = size;
    const geo = new THREE.BoxGeometry(w + inflate, h + inflate, d + inflate);
    const rects = faceRects(size, uvOrigin);
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    // Minimal nach innen versetzt, sonst blitzen an den Kanten Nachbarpixel durch.
    const e = 0.01;
    FACE_ORDER.forEach((name, i) => {
      const r = rects[name];
      const u0 = (r.x + e) / SKIN_SIZE;
      const u1 = (r.x + r.w - e) / SKIN_SIZE;
      const v0 = 1 - (r.y + e) / SKIN_SIZE;
      const v1 = 1 - (r.y + r.h - e) / SKIN_SIZE;
      uv.setXY(i * 4, u0, v0);
      uv.setXY(i * 4 + 1, u1, v0);
      uv.setXY(i * 4 + 2, u0, v1);
      uv.setXY(i * 4 + 3, u1, v1);
    });
    uv.needsUpdate = true;
    const mesh = new THREE.Mesh(geo, material);
    mesh.userData.paint = { layer, rects: FACE_ORDER.map((n) => rects[n]) } satisfies PaintTarget;
    return mesh;
  }
}

/** Rechnet einen Treffer auf dem Modell in ein Texturpixel um. */
export function hitToPixel(hit: THREE.Intersection): [number, number] | undefined {
  const target = hit.object.userData.paint as PaintTarget | undefined;
  if (!target || !hit.uv || hit.faceIndex == null) return undefined;
  const r = target.rects[Math.floor(hit.faceIndex / 2)];
  const x = Math.floor(hit.uv.x * SKIN_SIZE);
  const y = Math.floor((1 - hit.uv.y) * SKIN_SIZE);
  return [clamp(x, r.x, r.x + r.w - 1), clamp(y, r.y, r.y + r.h - 1)];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
