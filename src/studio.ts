import * as THREE from 'three';
import { PlayerModel } from './playerModel';
import { SKIN_SIZE } from './skinLayout';

// Ein einziger unsichtbarer Renderer für alle Galerie-Vorschaubilder
// (Browser erlauben nur wenige WebGL-Kontexte gleichzeitig).

const W = 200;
const H = 260;

let studio: {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  model: PlayerModel;
  canvas: HTMLCanvasElement;
  texture: THREE.CanvasTexture;
  slim: boolean;
} | null = null;

function setup() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SKIN_SIZE;
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(2);
  renderer.setSize(W, H, false);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xdff1ff, 0x6b8f4e, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(30, 60, 40);
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(30, W / H, 1, 300);
  camera.position.set(22, 22, 58);
  camera.lookAt(0, 16, 0);

  const model = new PlayerModel(texture, false);
  walkingPose(model);
  scene.add(model.root);

  studio = { renderer, scene, camera, model, canvas, texture, slim: false };
  return studio;
}

/** Leichter Schritt, wirkt lebendiger als stramm stehen. */
function walkingPose(model: PlayerModel) {
  const p = model.parts;
  p.rightArm.rotation.set(-0.25, 0, -0.08);
  p.leftArm.rotation.set(0.25, 0, 0.08);
  p.rightLeg.rotation.x = 0.2;
  p.leftLeg.rotation.x = -0.2;
}

/** Rendert die Figur mit dem Skin und gibt ein PNG als data:-URL zurück. */
export function renderThumbnail(source: CanvasImageSource, slim: boolean): string {
  const s = studio ?? setup();
  if (s.slim !== slim) {
    s.model.build(slim);
    walkingPose(s.model);
    s.slim = slim;
  }
  const g = s.canvas.getContext('2d')!;
  g.clearRect(0, 0, SKIN_SIZE, SKIN_SIZE);
  g.drawImage(source, 0, 0, SKIN_SIZE, SKIN_SIZE);
  s.texture.needsUpdate = true;
  s.renderer.render(s.scene, s.camera);
  return s.renderer.domElement.toDataURL('image/png');
}
