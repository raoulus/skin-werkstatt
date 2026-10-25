import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PlayerModel, hitToPixel } from './playerModel';
import { POSES } from './poses';
import { SkinCanvas, rgbToHex } from './skinCanvas';
import { drawDefaultSkin } from './defaultSkin';
import {
  SKIN_SIZE,
  mirrorPixel,
  partDefs,
  regionAt,
  regions,
  type FaceName,
  type Layer,
  type PartName,
} from './skinLayout';
import { HATS, applyHat } from './hats';
import { THEMES, generateSkin, type LockGroup } from './randomSkin';
import { makeGrassPlatform } from './world';
import { initGallery } from './gallery';
import { $, loadImage, saveBlob } from './ui';
import { PACK_POSES, buildPosePack } from './resourcePack';

type Tool = 'pencil' | 'eraser' | 'fill' | 'picker' | 'rotate';

const STORAGE_KEY = 'skin-werkstatt:aktuell';
const PALETTE = [
  '#000000',
  '#ffffff',
  '#7f7f7f',
  '#e53935',
  '#fb8c00',
  '#fdd835',
  '#43a047',
  '#1e88e5',
  '#8e24aa',
  '#f06292',
  '#6d4c41',
  '#e3a77f',
  '#ffcc99',
  '#2fa3a8',
  '#3d4fb8',
  '#1b5e20',
];

const state = {
  tool: 'pencil' as Tool,
  color: '#e53935',
  mirror: false,
  layer: 'base' as Layer,
  showOverlay: true,
  slim: false,
  pose: 'stand',
  spin: false,
  recent: [] as string[],
  theme: 'random',
  locked: new Set<LockGroup>(),
};

// Bezug zur Galerie: welcher gespeicherte Skin gerade offen ist und ob er Änderungen hat.
let currentId: string | null = null;
let dirty = false;

// ---------- Skin-Textur ----------

const skin = new SkinCanvas();
const texture = new THREE.CanvasTexture(skin.canvas);
texture.magFilter = THREE.NearestFilter;
texture.minFilter = THREE.NearestFilter;
texture.generateMipmaps = false;
texture.colorSpace = THREE.SRGBColorSpace;

// Die Grundschicht zeigt unbemalte (durchsichtige) Pixel als graues Karo,
// sonst wäre eine leere Figur unsichtbar. Exportiert wird natürlich nur der echte Skin.
const display = document.createElement('canvas');
display.width = display.height = SKIN_SIZE;
const displayCtx = display.getContext('2d')!;
const baseTexture = new THREE.CanvasTexture(display);
baseTexture.magFilter = THREE.NearestFilter;
baseTexture.minFilter = THREE.NearestFilter;
baseTexture.generateMipmaps = false;
baseTexture.colorSpace = THREE.SRGBColorSpace;

function updateDisplay() {
  displayCtx.clearRect(0, 0, SKIN_SIZE, SKIN_SIZE);
  for (const r of regions(state.slim)) {
    if (r.layer !== 'base') continue;
    for (let y = r.rect.y; y < r.rect.y + r.rect.h; y++) {
      for (let x = r.rect.x; x < r.rect.x + r.rect.w; x++) {
        displayCtx.fillStyle = (x + y) % 2 ? '#c4cad4' : '#b1b8c4';
        displayCtx.fillRect(x, y, 1, 1);
      }
    }
  }
  displayCtx.drawImage(skin.canvas, 0, 0);
  baseTexture.needsUpdate = true;
}

skin.onChange(() => {
  texture.needsUpdate = true;
  updateDisplay();
  dirty = true;
  drawFlat();
});

// ---------- 3D-Szene ----------

const viewport = $<HTMLElement>('#viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
viewport.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 1, 500);
camera.position.set(34, 30, 76);

scene.add(new THREE.HemisphereLight(0xdff1ff, 0x6b8f4e, 2.2));
const sun = new THREE.DirectionalLight(0xffffff, 1.6);
sun.position.set(30, 60, 40);
scene.add(sun);

const model = new PlayerModel(texture, state.slim, baseTexture);
scene.add(model.root);
scene.add(makeShadow());
scene.add(makeGrassPlatform());

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 14, 0);
controls.enableDamping = true;
controls.minDistance = 25;
controls.maxDistance = 160;
controls.maxPolarAngle = Math.PI * 0.62;
controls.update();

function makeShadow(): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 4, 32, 32, 32);
  grad.addColorStop(0, 'rgba(0,0,0,0.45)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 26),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.1;
  return mesh;
}

function resize() {
  const { clientWidth: w, clientHeight: h } = viewport;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewport);

const clock = new THREE.Clock();
// Dauer-Drehung wird separat aufsummiert, weil resetPose die Rotation jedes Bild zurücksetzt.
let spinAngle = 0;
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  model.resetPose();
  POSES.find((p) => p.id === state.pose)!.apply(model, t);
  if (state.spin && !painting) spinAngle += 0.01;
  model.root.rotation.y += spinAngle;
  controls.update();
  renderer.render(scene, camera);
});

// ---------- Malen ----------

let painting = false;
let lastPixel = '';
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const activePointers = new Set<number>();

function pickPixel(e: PointerEvent, layer: Layer | 'any'): [number, number] | undefined {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  model.root.updateMatrixWorld();

  if (layer === 'any') {
    // Pipette: erstes sichtbares, nicht durchsichtiges Pixel.
    const meshes = state.showOverlay ? [...model.overlayMeshes, ...model.baseMeshes] : model.baseMeshes;
    for (const hit of raycaster.intersectObjects(meshes, false)) {
      const px = hitToPixel(hit);
      if (px && skin.getPixel(...px)[3] > 0) return px;
    }
    return undefined;
  }
  const meshes = layer === 'overlay' ? model.overlayMeshes : model.baseMeshes;
  const hit = raycaster.intersectObjects(meshes, false)[0];
  return hit ? hitToPixel(hit) : undefined;
}

function applyTool(x: number, y: number) {
  const key = `${x},${y}`;
  if (key === lastPixel && state.tool !== 'fill') return;
  lastPixel = key;

  if (state.tool === 'picker') {
    const [r, g, b, a] = skin.getPixel(x, y);
    if (a > 0) setColor(rgbToHex(r, g, b));
    setTool('pencil');
    return;
  }
  const color = state.tool === 'eraser' ? null : state.color;
  const targets: [number, number][] = [[x, y]];
  if (state.mirror) {
    const m = mirrorPixel(x, y, state.slim);
    if (m) targets.push(m);
  }
  for (const [tx, ty] of targets) {
    if (state.tool === 'fill') skin.fill(tx, ty, color, state.slim);
    else skin.setPixel(tx, ty, color);
  }
  skin.changed();
}

function beginStroke() {
  painting = true;
  lastPixel = '';
  if (state.tool !== 'picker') skin.snapshot();
}

function endStroke() {
  if (!painting) return;
  painting = false;
  if (state.tool !== 'picker' && state.tool !== 'eraser') addRecent(state.color);
  save();
}

// Lauscht in der Capture-Phase am Container, also vor OrbitControls:
// Trifft der Finger die Figur, wird gemalt statt gedreht.
viewport.addEventListener(
  'pointerdown',
  (e) => {
    if (e.target !== renderer.domElement) return;
    activePointers.add(e.pointerId);
    if (activePointers.size > 1) {
      // Zweiter Finger: Zoom/Drehen hat Vorrang, angefangenen Strich beenden.
      if (painting) endStroke();
      controls.enabled = true;
      return;
    }
    if (state.tool === 'rotate') return;
    const px = pickPixel(e, state.tool === 'picker' ? 'any' : state.layer);
    if (!px) return;
    controls.enabled = false;
    renderer.domElement.setPointerCapture(e.pointerId);
    beginStroke();
    applyTool(...px);
    hideHint();
  },
  { capture: true },
);

renderer.domElement.addEventListener('pointermove', (e) => {
  if (!painting || state.tool === 'fill' || state.tool === 'picker') return;
  for (const ev of e.getCoalescedEvents?.() ?? [e]) {
    const px = pickPixel(ev, state.layer);
    if (px) applyTool(...px);
  }
});

const releasePointer = (e: PointerEvent) => {
  activePointers.delete(e.pointerId);
  if (activePointers.size === 0) {
    endStroke();
    controls.enabled = true;
  }
};
renderer.domElement.addEventListener('pointerup', releasePointer);
renderer.domElement.addEventListener('pointercancel', releasePointer);

// ---------- 2D-Textur ----------

const flat = $<HTMLCanvasElement>('#flat');
const flatCtx = flat.getContext('2d')!;
const SCALE = flat.width / SKIN_SIZE;

function drawFlat() {
  const g = flatCtx;
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#141826';
  g.fillRect(0, 0, flat.width, flat.height);

  for (const r of regions(state.slim)) {
    const { x, y, w, h } = r.rect;
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        g.fillStyle = (px + py) % 2 ? '#3a4058' : '#2e3348';
        g.fillRect(px * SCALE, py * SCALE, SCALE, SCALE);
      }
    }
  }
  g.drawImage(skin.canvas, 0, 0, flat.width, flat.height);

  g.lineWidth = 1;
  for (const r of regions(state.slim)) {
    const { x, y, w, h } = r.rect;
    if (r.layer !== state.layer) {
      g.fillStyle = 'rgba(20,24,38,0.55)';
      g.fillRect(x * SCALE, y * SCALE, w * SCALE, h * SCALE);
    }
    g.strokeStyle = r.layer === state.layer ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.1)';
    g.strokeRect(x * SCALE + 0.5, y * SCALE + 0.5, w * SCALE - 1, h * SCALE - 1);
  }

  // Beschriftung in der freien Ecke links oben jedes aufgeklappten Körperteils
  g.font = '600 12px "Pixelify Sans", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const def of partDefs(state.slim)) {
    const [u, v] = def[state.layer];
    const d = def.size[2];
    g.fillStyle = PART_COLORS[def.name];
    g.fillText(PART_SHORT[def.name], (u + d / 2) * SCALE, (v + d / 2) * SCALE);
  }
}

const PART_NAMES: Record<PartName, string> = {
  head: 'Kopf',
  body: 'Körper',
  rightArm: 'Rechter Arm',
  leftArm: 'Linker Arm',
  rightLeg: 'Rechtes Bein',
  leftLeg: 'Linkes Bein',
};
const PART_SHORT: Record<PartName, string> = {
  head: 'Kopf',
  body: 'Bauch',
  rightArm: 'Arm R',
  leftArm: 'Arm L',
  rightLeg: 'Bein R',
  leftLeg: 'Bein L',
};
const PART_COLORS: Record<PartName, string> = {
  head: '#ffd54a',
  body: '#7ee081',
  rightArm: '#7cc7ff',
  leftArm: '#7cc7ff',
  rightLeg: '#ff9f7a',
  leftLeg: '#ff9f7a',
};
const FACE_NAMES: Record<FaceName, string> = {
  front: 'vorne',
  back: 'hinten',
  left: 'linke Seite',
  right: 'rechte Seite',
  top: 'oben',
  bottom: 'unten',
};

const flatInfo = $('#flat-info');
flat.addEventListener('pointermove', (e) => {
  const px = flatPixel(e);
  const r = px && regionAt(px[0], px[1], state.slim);
  if (!r) {
    flatInfo.textContent = 'Hier ist nichts – dieser Teil wird nicht benutzt.';
    return;
  }
  const layer = r.layer === 'overlay' ? (r.part.name === 'head' ? ' (Hut-Schicht)' : ' (Jacken-Schicht)') : '';
  flatInfo.innerHTML = `<b style="color:${PART_COLORS[r.part.name]}">${PART_NAMES[r.part.name]}</b> · ${FACE_NAMES[r.face]}${layer}`;
});

let flatLast: [number, number] | null = null;

function flatPixel(e: PointerEvent): [number, number] | undefined {
  const rect = flat.getBoundingClientRect();
  const x = Math.floor(((e.clientX - rect.left) / rect.width) * SKIN_SIZE);
  const y = Math.floor(((e.clientY - rect.top) / rect.height) * SKIN_SIZE);
  if (x < 0 || y < 0 || x >= SKIN_SIZE || y >= SKIN_SIZE) return undefined;
  return [x, y];
}

flat.addEventListener('pointerdown', (e) => {
  const px = flatPixel(e);
  if (!px || state.tool === 'rotate') return;
  flat.setPointerCapture(e.pointerId);
  beginStroke();
  flatLast = px;
  applyTool(...px);
});

flat.addEventListener('pointermove', (e) => {
  if (!painting || !flatLast || state.tool === 'fill' || state.tool === 'picker') return;
  for (const ev of e.getCoalescedEvents?.() ?? [e]) {
    const px = flatPixel(ev);
    if (!px) continue;
    // Linie zwischen den Punkten, damit schnelle Striche keine Lücken haben.
    for (const p of line(flatLast, px)) applyTool(...p);
    flatLast = px;
  }
});

const endFlat = () => {
  flatLast = null;
  endStroke();
};
flat.addEventListener('pointerup', endFlat);
flat.addEventListener('pointercancel', endFlat);

function line([x0, y0]: [number, number], [x1, y1]: [number, number]): [number, number][] {
  const pts: [number, number][] = [];
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    pts.push([x0, y0]);
    if (x0 === x1 && y0 === y1) return pts;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
}

// ---------- Oberfläche ----------

function setTool(tool: Tool) {
  state.tool = tool;
  document.querySelectorAll<HTMLButtonElement>('#tools [data-tool]').forEach((b) => {
    b.classList.toggle('active', b.dataset.tool === tool);
  });
}

document.querySelectorAll<HTMLButtonElement>('#tools [data-tool]').forEach((b) => {
  b.addEventListener('click', () => setTool(b.dataset.tool as Tool));
});

const colorInput = $<HTMLInputElement>('#color');
function setColor(c: string) {
  state.color = c;
  colorInput.value = c;
  document.querySelectorAll<HTMLElement>('.swatch').forEach((s) => s.classList.toggle('active', s.dataset.color === c));
  if (state.tool === 'eraser' || state.tool === 'rotate') setTool('pencil');
}
colorInput.addEventListener('input', () => setColor(colorInput.value));

function swatch(c: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = 'swatch';
  b.dataset.color = c;
  b.style.background = c;
  b.title = c;
  b.addEventListener('click', () => setColor(c));
  return b;
}
$('#swatches').append(...PALETTE.map(swatch));

function addRecent(c: string) {
  if (PALETTE.includes(c)) return;
  state.recent = [c, ...state.recent.filter((r) => r !== c)].slice(0, 8);
  $('#recent').replaceChildren(...state.recent.map(swatch));
}

function toggle(sel: string, key: 'mirror' | 'showOverlay' | 'spin', after?: () => void) {
  const btn = $<HTMLButtonElement>(sel);
  btn.addEventListener('click', () => {
    state[key] = !state[key];
    btn.classList.toggle('active', state[key]);
    after?.();
  });
}
toggle('#btn-mirror', 'mirror');
toggle('#btn-overlay', 'showOverlay', () => (model.overlayVisible = state.showOverlay));
toggle('#btn-spin', 'spin');

$('#btn-layer').addEventListener('click', () => {
  state.layer = state.layer === 'base' ? 'overlay' : 'base';
  $('#btn-layer').classList.toggle('active', state.layer === 'overlay');
  $('#layer-label').textContent = state.layer === 'base' ? 'Grundschicht' : 'Jacke & Hut';
  if (state.layer === 'overlay') ensureOverlayVisible();
  drawFlat();
});

$('#btn-undo').addEventListener('click', () => {
  skin.undo();
  save();
});
$('#btn-redo').addEventListener('click', () => {
  skin.redo();
  save();
});

document.querySelectorAll<HTMLButtonElement>('#model-type button').forEach((b) => {
  b.addEventListener('click', () => setSlim(b.dataset.slim === '1'));
});

function setSlim(slim: boolean) {
  state.slim = slim;
  document.querySelectorAll<HTMLButtonElement>('#model-type button').forEach((b) => {
    b.classList.toggle('active', (b.dataset.slim === '1') === slim);
  });
  model.build(slim);
  model.overlayVisible = state.showOverlay;
  updateDisplay();
  drawFlat();
  save();
}

$('#btn-default').addEventListener('click', () => {
  skin.snapshot();
  drawDefaultSkin(skin.ctx, state.slim);
  skin.changed();
  save();
});
$('#btn-clear').addEventListener('click', () => {
  skin.snapshot();
  skin.clear();
  skin.changed();
  save();
});

const posesEl = $('#poses');
for (const p of POSES) {
  const b = document.createElement('button');
  b.textContent = p.label;
  b.classList.toggle('active', p.id === state.pose);
  b.addEventListener('click', () => {
    state.pose = p.id;
    posesEl.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
  });
  posesEl.append(b);
}

function ensureOverlayVisible() {
  if (!state.showOverlay) $<HTMLButtonElement>('#btn-overlay').click();
}

// ---------- Hüte ----------

const hatsEl = $('#hats');
for (const hat of [...HATS, null]) {
  const b = document.createElement('button');
  b.className = 'tile';
  b.innerHTML = hat ? `<i>${hat.icon}</i>${hat.label}` : '<i>🚫</i>Ohne';
  b.addEventListener('click', () => {
    skin.snapshot();
    applyHat(skin.ctx, hat, state.color);
    skin.changed();
    ensureOverlayVisible();
    save();
    hideHint();
  });
  hatsEl.append(b);
}

// ---------- Zufalls-Skins ----------

const themesEl = $('#themes');
for (const theme of THEMES) {
  const b = document.createElement('button');
  b.className = 'tile';
  b.dataset.theme = theme.id;
  b.classList.toggle('active', theme.id === state.theme);
  b.innerHTML = `<i>${theme.icon}</i>${theme.label}`;
  b.addEventListener('click', () => {
    state.theme = theme.id;
    themesEl.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
    roll();
  });
  themesEl.append(b);
}

document.querySelectorAll<HTMLButtonElement>('[data-lock]').forEach((b) => {
  const group = b.dataset.lock as LockGroup;
  b.addEventListener('click', () => {
    if (state.locked.has(group)) state.locked.delete(group);
    else state.locked.add(group);
    const on = state.locked.has(group);
    b.classList.toggle('active', on);
    b.textContent = `${on ? '🔒' : '🔓'} ${b.textContent!.slice(3)}`;
  });
});

$('#btn-roll').addEventListener('click', roll);

function roll() {
  skin.snapshot();
  generateSkin(skin.ctx, state.slim, state.theme, state.locked);
  skin.changed();
  ensureOverlayVisible();
  save();
  hideHint();
  const btn = $('#btn-roll');
  btn.classList.remove('rolling');
  void btn.offsetWidth;
  btn.classList.add('rolling');
}

let hintHidden = false;
function hideHint() {
  if (hintHidden) return;
  hintHidden = true;
  $('#hint').classList.add('gone');
}

// Kein Seiten-Zoom per Geste auf dem iPad, das stört beim Malen.
document.addEventListener('gesturestart', (e) => e.preventDefault());

// ---------- Import / Export ----------

const fileInput = $<HTMLInputElement>('#file');
$('#btn-import').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  fileInput.value = '';
  if (!file) return;
  try {
    const img = await loadImage(URL.createObjectURL(file));
    if (img.width !== img.height && img.width !== img.height * 2) throw new Error('Kein Skin-Format');
    skin.snapshot();
    skin.loadImage(img);
    skin.changed();
    save();
  } catch {
    alert('Das Bild ist kein Minecraft-Skin (64×64 oder 64×32 Pixel).');
  }
});

const dialog = $<HTMLDialogElement>('#export-dialog');
$('#btn-download').addEventListener('click', () => {
  $<HTMLImageElement>('#export-preview').src = skin.canvas.toDataURL('image/png');
  $('#export-model').textContent = state.slim ? 'schmales' : 'breites';
  const canShare = typeof navigator.canShare === 'function' && navigator.canShare({ files: [pngFile(new Blob())] });
  $('#btn-share').hidden = !canShare;
  // Ohne HTTPS (z. B. im Heimnetz) gibt es kein Teilen-Menü; dann per langem Druck aufs Bild sichern.
  $('#step-share').hidden = !canShare;
  $('#step-hold').hidden = canShare;
  dialog.showModal();
});
$('#btn-close-dialog').addEventListener('click', () => dialog.close());

function pngFile(blob: Blob) {
  return new File([blob], 'mein-skin.png', { type: 'image/png' });
}

$('#btn-share').addEventListener('click', async () => {
  try {
    await navigator.share({ files: [pngFile(await skin.toBlob())] });
  } catch (err) {
    if ((err as Error).name !== 'AbortError') downloadFile();
  }
});
$('#btn-save-file').addEventListener('click', async () => saveBlob(await skin.toBlob(), 'mein-skin.png'));

async function downloadFile() {
  saveBlob(await skin.toBlob(), 'mein-skin.png');
}

document.querySelectorAll<HTMLButtonElement>('#export-tabs button').forEach((b) => {
  b.addEventListener('click', () => {
    document.querySelectorAll('#export-tabs button').forEach((x) => x.classList.toggle('active', x === b));
    document.querySelectorAll<HTMLElement>('#export-dialog [data-panel]').forEach((p) => {
      p.hidden = p.dataset.panel !== b.dataset.tab;
    });
  });
});

let packPose = PACK_POSES[0];
const packPosesEl = $('#pack-poses');
for (const pose of PACK_POSES) {
  const b = document.createElement('button');
  b.className = 'tile';
  b.innerHTML = `<i>${pose.icon}</i>${pose.label}`;
  b.classList.toggle('active', pose === packPose);
  b.addEventListener('click', () => {
    packPose = pose;
    packPosesEl.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
  });
  packPosesEl.append(b);
}

$('#btn-pack').addEventListener('click', async () => {
  const name = packPose.label.toLowerCase().replace(/\s+/g, '-');
  saveBlob(await buildPosePack(packPose, skin.canvas), `pose-${name}.mcpack`);
});

// ---------- Speichern im Browser ----------

function save() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ png: skin.canvas.toDataURL('image/png'), slim: state.slim, id: currentId, dirty }),
    );
  } catch {
    // Privater Modus o. Ä.: dann eben ohne Zwischenspeichern.
  }
}

async function restore() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (saved?.png) {
      if (saved.slim) setSlim(true);
      skin.loadImage(await loadImage(saved.png));
      skin.changed();
      currentId = saved.id ?? null;
      dirty = saved.dirty ?? true;
      return;
    }
  } catch {
    // Ungültiger Speicherstand: Start-Skin verwenden.
  }
  drawDefaultSkin(skin.ctx, state.slim);
  skin.changed();
}

async function loadIntoEditor(png: string, slim: boolean, id: string | null) {
  const img = await loadImage(png);
  skin.snapshot();
  if (slim !== state.slim) setSlim(slim);
  skin.loadImage(img);
  skin.changed();
  currentId = id;
  dirty = false;
  save();
}

initGallery({
  skin,
  getSlim: () => state.slim,
  load: loadIntoEditor,
  currentId: () => currentId,
  setCurrentId: (id) => {
    currentId = id;
    save();
  },
  isDirty: () => dirty,
  markSaved: () => {
    dirty = false;
    save();
  },
});

setColor(state.color);
restore();
// Die Beschriftung im Bastelbogen nutzt die Pixel-Schrift, sobald sie geladen ist.
document.fonts.ready.then(drawFlat);
