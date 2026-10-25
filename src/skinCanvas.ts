import { SKIN_SIZE, regionAt, inRect, type Rect } from './skinLayout';

const MAX_HISTORY = 60;

/** Die eigentliche Skin-Textur samt Rückgängig/Wiederholen. */
export class SkinCanvas {
  readonly canvas = document.createElement('canvas');
  readonly ctx: CanvasRenderingContext2D;
  private undoStack: ImageData[] = [];
  private redoStack: ImageData[] = [];
  private listeners: (() => void)[] = [];

  constructor() {
    this.canvas.width = this.canvas.height = SKIN_SIZE;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
  }

  onChange(fn: () => void) {
    this.listeners.push(fn);
  }

  changed() {
    for (const fn of this.listeners) fn();
  }

  /** Vor jeder Änderung aufrufen, damit sie rückgängig gemacht werden kann. */
  snapshot() {
    this.undoStack.push(this.ctx.getImageData(0, 0, SKIN_SIZE, SKIN_SIZE));
    if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift();
    this.redoStack = [];
  }

  undo() {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.redoStack.push(this.ctx.getImageData(0, 0, SKIN_SIZE, SKIN_SIZE));
    this.ctx.putImageData(prev, 0, 0);
    this.changed();
  }

  redo() {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(this.ctx.getImageData(0, 0, SKIN_SIZE, SKIN_SIZE));
    this.ctx.putImageData(next, 0, 0);
    this.changed();
  }

  setPixel(x: number, y: number, color: string | null) {
    if (color) {
      this.ctx.fillStyle = color;
      this.ctx.fillRect(x, y, 1, 1);
    } else {
      this.ctx.clearRect(x, y, 1, 1);
    }
  }

  getPixel(x: number, y: number): [number, number, number, number] {
    const d = this.ctx.getImageData(x, y, 1, 1).data;
    return [d[0], d[1], d[2], d[3]];
  }

  /** Füllt gleichfarbige Nachbarpixel, aber nur innerhalb der Fläche (z. B. Gesicht). */
  fill(x: number, y: number, color: string | null, slim: boolean) {
    const bounds: Rect = regionAt(x, y, slim)?.rect ?? { x: 0, y: 0, w: SKIN_SIZE, h: SKIN_SIZE };
    const img = this.ctx.getImageData(0, 0, SKIN_SIZE, SKIN_SIZE);
    const d = img.data;
    const idx = (px: number, py: number) => (py * SKIN_SIZE + px) * 4;
    const start = idx(x, y);
    const target = [d[start], d[start + 1], d[start + 2], d[start + 3]];
    const fill = color ? hexToRgba(color) : [0, 0, 0, 0];
    if (target.every((v, i) => v === fill[i])) return;

    const same = (i: number) =>
      d[i] === target[0] && d[i + 1] === target[1] && d[i + 2] === target[2] && d[i + 3] === target[3];
    const stack: [number, number][] = [[x, y]];
    while (stack.length) {
      const [px, py] = stack.pop()!;
      if (!inRect(bounds, px, py)) continue;
      const i = idx(px, py);
      if (!same(i)) continue;
      d.set(fill, i);
      stack.push([px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]);
    }
    this.ctx.putImageData(img, 0, 0);
  }

  clear() {
    this.ctx.clearRect(0, 0, SKIN_SIZE, SKIN_SIZE);
  }

  /** Lädt ein Bild; alte 64×32-Skins werden auf 64×64 erweitert. */
  loadImage(img: CanvasImageSource & { width: number; height: number }) {
    this.clear();
    this.ctx.drawImage(img, 0, 0, SKIN_SIZE, img.height === img.width / 2 ? SKIN_SIZE / 2 : SKIN_SIZE);
    if (img.height === img.width / 2) upgradeLegacy(this.ctx);
  }

  toBlob(): Promise<Blob> {
    return new Promise((resolve, reject) =>
      this.canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG-Export fehlgeschlagen'))), 'image/png'),
    );
  }
}

function hexToRgba(hex: string): number[] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/** Alte Skins haben kein eigenes linkes Bein/Arm: rechte Seite gespiegelt übernehmen. */
function upgradeLegacy(ctx: CanvasRenderingContext2D) {
  const copy = (sx: number, sy: number, w: number, h: number, dx: number, dy: number) => {
    ctx.save();
    ctx.translate(dx + w, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(ctx.canvas, sx, sy, w, h, 0, 0, w, h);
    ctx.restore();
  };
  for (const [sx, dx] of [
    [0, 16],
    [40, 32],
  ] as const) {
    copy(sx + 4, 16, 4, 4, dx + 4, 48); // oben
    copy(sx + 8, 16, 4, 4, dx + 8, 48); // unten
    copy(sx + 0, 20, 4, 12, dx + 8, 52); // außen → innen
    copy(sx + 4, 20, 4, 12, dx + 4, 52); // vorne
    copy(sx + 8, 20, 4, 12, dx + 0, 52); // innen → außen
    copy(sx + 12, 20, 4, 12, dx + 12, 52); // hinten
  }
}
