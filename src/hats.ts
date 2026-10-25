import { faceRects, type FaceName } from './skinLayout';

// Hüte liegen auf der äußeren Kopfschicht (Hut-Ebene ab 32,0). Mehr Platz gibt es bei
// normalen Skins nicht: Alles muss in den 8×8×8-Würfel um den Kopf passen.
const HEAD = faceRects([8, 8, 8], [32, 0]);
const SIDES = ['front', 'back', 'left', 'right'] as const;

type Color = string | null;

export class HatPainter {
  constructor(private ctx: CanvasRenderingContext2D) {}

  rect(face: FaceName, x: number, y: number, w: number, h: number, c: Color) {
    const r = HEAD[face];
    if (c) {
      this.ctx.fillStyle = c;
      this.ctx.fillRect(r.x + x, r.y + y, w, h);
    } else {
      this.ctx.clearRect(r.x + x, r.y + y, w, h);
    }
  }

  px(face: FaceName, x: number, y: number, c: Color) {
    this.rect(face, x, y, 1, 1, c);
  }

  /** Pixel auf beiden Kopfseiten, gemessen ab der Vorderkante (0 = vorne). */
  sides(fromFront: number, y: number, c: Color) {
    this.px('left', fromFront, y, c);
    this.px('right', 7 - fromFront, y, c);
  }

  /** Reihen y0..y1 einmal rundherum. */
  ring(y0: number, y1: number, c: Color) {
    for (const f of SIDES) this.rect(f, 0, y0, 8, y1 - y0 + 1, c);
  }

  /** Oberseite: x von rechter zu linker Kopfseite, y von hinten (0) nach vorne (7). */
  top(c: Color, x = 0, y = 0, w = 8, h = 8) {
    this.rect('top', x, y, w, h, c);
  }

  clearAll() {
    for (const f of Object.keys(HEAD) as FaceName[]) this.rect(f, 0, 0, 8, 8, null);
  }
}

export interface Hat {
  id: string;
  label: string;
  icon: string;
  draw: (p: HatPainter, color: string) => void;
}

export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (v: number) => Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount);
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => mix(v).toString(16).padStart(2, '0')).join('');
}

export const HATS: Hat[] = [
  {
    id: 'cap',
    label: 'Kappe',
    icon: '🧢',
    draw: (p, c) => {
      p.top(c);
      p.top(shade(c, -0.2), 3, 3, 2, 2);
      p.ring(0, 1, c);
      p.rect('front', 0, 2, 8, 1, shade(c, -0.3));
      p.sides(0, 2, shade(c, -0.3));
      p.sides(1, 2, shade(c, -0.3));
      p.rect('front', 3, 1, 2, 1, '#ffffff');
      p.rect('back', 3, 1, 2, 1, null);
    },
  },
  {
    id: 'beanie',
    label: 'Mütze',
    icon: '🧶',
    draw: (p, c) => {
      p.top(c);
      p.ring(0, 1, c);
      p.ring(1, 1, shade(c, 0.25));
      p.ring(2, 2, shade(c, -0.25));
      p.top('#ffffff', 3, 3, 2, 2);
    },
  },
  {
    id: 'crown',
    label: 'Krone',
    icon: '👑',
    draw: (p) => {
      const gold = '#f7c948';
      p.ring(1, 1, gold);
      p.ring(2, 2, '#c8901a');
      for (const f of SIDES) for (const x of [0, 3, 4, 7]) p.px(f, x, 0, gold);
      p.rect('front', 3, 1, 2, 1, '#e53935');
      p.rect('back', 3, 1, 2, 1, '#43a047');
      p.sides(3, 1, '#1e88e5');
      p.sides(4, 1, '#1e88e5');
    },
  },
  {
    id: 'knight',
    label: 'Ritter',
    icon: '🛡️',
    draw: (p, c) => {
      const metal = '#aeb6c2';
      const dark = '#6c7480';
      const slit = '#1c1f26';
      p.top(metal);
      p.ring(0, 7, metal);
      p.ring(7, 7, dark);
      p.rect('front', 0, 3, 8, 1, dark);
      p.rect('front', 1, 4, 6, 1, slit);
      p.rect('front', 0, 5, 8, 1, dark);
      for (const x of [2, 5]) p.px('front', x, 6, slit);
      // Federbusch als Kamm von vorne nach hinten
      p.top(c, 3, 0, 2, 8);
      p.rect('front', 3, 0, 2, 1, c);
      p.rect('back', 3, 0, 2, 3, c);
    },
  },
  {
    id: 'pirate',
    label: 'Pirat',
    icon: '🏴‍☠️',
    draw: (p, c) => {
      p.top(c);
      p.ring(0, 2, c);
      for (const f of SIDES) {
        for (let y = 0; y <= 2; y++) for (let x = 0; x < 8; x++) if ((x * 2 + y) % 5 === 0) p.px(f, x, y, '#ffffff');
      }
      p.rect('back', 3, 3, 2, 2, c);
      p.px('back', 2, 5, c);
      p.px('back', 5, 5, c);
      // Augenklappe mit Band
      p.rect('front', 0, 3, 8, 1, '#111111');
      p.rect('front', 1, 4, 2, 2, '#111111');
      for (let f = 0; f < 8; f++) p.sides(f, 3, '#111111');
      p.rect('back', 0, 3, 3, 1, '#111111');
      p.rect('back', 5, 3, 3, 1, '#111111');
    },
  },
  {
    id: 'headphones',
    label: 'Kopfhörer',
    icon: '🎧',
    draw: (p, c) => {
      const band = '#2b2b33';
      p.top(band, 0, 3, 8, 2);
      for (let y = 0; y <= 2; y++) {
        p.sides(3, y, band);
        p.sides(4, y, band);
      }
      for (let y = 3; y <= 6; y++) for (let f = 2; f <= 5; f++) p.sides(f, y, c);
      for (let y = 4; y <= 5; y++) for (let f = 3; f <= 4; f++) p.sides(f, y, shade(c, 0.35));
    },
  },
  {
    id: 'cowboy',
    label: 'Cowboy',
    icon: '🤠',
    draw: (p, c) => {
      const brown = '#8b5a2b';
      p.top(brown);
      p.top(shade(brown, -0.25), 2, 3, 4, 2);
      p.ring(0, 1, brown);
      p.ring(2, 2, c);
      p.ring(3, 3, '#a8743f');
    },
  },
  {
    id: 'ninja',
    label: 'Ninja',
    icon: '🥷',
    draw: (p, c) => {
      const mask = '#22232b';
      p.top(mask);
      p.ring(0, 7, mask);
      p.rect('front', 1, 3, 6, 2, null);
      p.ring(1, 1, c);
      for (let y = 2; y <= 5; y++) p.px('back', y % 2 ? 5 : 6, y, c);
    },
  },
];

export function applyHat(ctx: CanvasRenderingContext2D, hat: Hat | null, color: string) {
  const p = new HatPainter(ctx);
  p.clearAll();
  hat?.draw(p, color);
}
