import { faceRects, partDefs, type FaceName, type Layer, type PartDef, type PartName } from './skinLayout';
import { HATS, applyHat, shade } from './hats';

type Rnd = () => number;

/** Malhilfe in Körperteil-Koordinaten statt in Texturpixeln. */
class SkinPainter {
  private parts: Record<PartName, PartDef>;

  constructor(
    private ctx: CanvasRenderingContext2D,
    slim: boolean,
    private rnd: Rnd,
  ) {
    this.parts = Object.fromEntries(partDefs(slim).map((p) => [p.name, p])) as Record<PartName, PartDef>;
  }

  size(part: PartName) {
    return this.parts[part].size;
  }

  faces(part: PartName, layer: Layer = 'base') {
    return faceRects(this.parts[part].size, this.parts[part][layer]);
  }

  /** Füllt ein Rechteck; noise variiert jedes Pixel leicht, das wirkt wie Stoff. */
  rect(
    part: PartName,
    face: FaceName,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string | null,
    layer: Layer = 'base',
    noise = 0,
  ) {
    const r = this.faces(part, layer)[face];
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        if (px < 0 || py < 0 || px >= r.w || py >= r.h) continue;
        if (!color) {
          this.ctx.clearRect(r.x + px, r.y + py, 1, 1);
          continue;
        }
        this.ctx.fillStyle = noise ? shade(color, (this.rnd() - 0.5) * noise) : color;
        this.ctx.fillRect(r.x + px, r.y + py, 1, 1);
      }
    }
  }

  px(part: PartName, face: FaceName, x: number, y: number, color: string | null, layer: Layer = 'base') {
    this.rect(part, face, x, y, 1, 1, color, layer);
  }

  /** Reihen y0..y1 rund um das Körperteil. */
  band(part: PartName, y0: number, y1: number, color: string | null, layer: Layer = 'base', noise = 0) {
    for (const f of ['front', 'back', 'left', 'right'] as const) {
      const r = this.faces(part, layer)[f];
      this.rect(part, f, 0, y0, r.w, y1 - y0 + 1, color, layer, noise);
    }
  }

  cap(part: PartName, face: 'top' | 'bottom', color: string | null, layer: Layer = 'base', noise = 0) {
    const r = this.faces(part, layer)[face];
    this.rect(part, face, 0, 0, r.w, r.h, color, layer, noise);
  }

  whole(part: PartName, color: string | null, layer: Layer = 'base', noise = 0) {
    this.band(part, 0, 99, color, layer, noise);
    this.cap(part, 'top', color, layer, noise);
    this.cap(part, 'bottom', color, layer, noise);
  }

  /** Seitenflächen von vorne gemessen (0 = vordere Kante), für beide Seiten gleichzeitig. */
  sides(
    part: PartName,
    fromFront: number,
    y: number,
    w: number,
    h: number,
    color: string | null,
    layer: Layer = 'base',
    noise = 0,
  ) {
    const d = this.size(part)[2];
    this.rect(part, 'left', fromFront, y, w, h, color, layer, noise);
    this.rect(part, 'right', d - fromFront - w, y, w, h, color, layer, noise);
  }

  pick<T>(list: readonly T[]): T {
    return list[Math.floor(this.rnd() * list.length)];
  }

  chance(p: number) {
    return this.rnd() < p;
  }
}

const SKIN_TONES = ['#f2c9a5', '#e3a77f', '#c98e66', '#a86e4a', '#7d4f33', '#5a3825'];
const HAIR = [
  '#2b1d14',
  '#5a3820',
  '#8b5a2b',
  '#d9a441',
  '#f0d27a',
  '#c0392b',
  '#1b1b1b',
  '#7f8c8d',
  '#8e44ad',
  '#2e86de',
];
const EYES = ['#3a5bd9', '#2e7d32', '#6d4c41', '#1b1b1b', '#00acc1', '#8e24aa'];
const CLOTHES = [
  '#e53935',
  '#fb8c00',
  '#fdd835',
  '#43a047',
  '#1e88e5',
  '#3949ab',
  '#8e24aa',
  '#f06292',
  '#2fa3a8',
  '#263238',
  '#eceff1',
  '#6d4c41',
  '#00897b',
  '#c0ca33',
];
const PANTS = ['#3d4fb8', '#263238', '#5d4037', '#455a64', '#1b5e20', '#37474f', '#795548', '#212121'];
const SHOES = ['#5b5b66', '#212121', '#6d4c41', '#eceff1', '#c62828', '#1565c0'];

interface HeadOpts {
  skin: string;
  hair?: string;
  hairStyle?: 'short' | 'long' | 'spiky' | 'buzz' | 'bald';
  eye?: string;
  eyeWhite?: string;
  mouth?: 'smile' | 'grin' | 'small' | 'line';
  beard?: boolean;
}

function drawHead(p: SkinPainter, o: HeadOpts) {
  p.whole('head', o.skin, 'base', 0.06);
  const hair = o.hair ?? '#2b1d14';
  const style = o.hairStyle ?? 'short';
  if (style !== 'bald') {
    p.cap('head', 'top', hair, 'base', 0.12);
    p.band('head', 0, style === 'buzz' ? 0 : 1, hair, 'base', 0.12);
  }
  if (style === 'short' || style === 'long' || style === 'spiky') {
    p.rect('head', 'back', 0, 2, 8, style === 'long' ? 6 : 4, hair, 'base', 0.12);
    p.sides('head', 3, 2, 5, style === 'long' ? 5 : 2, hair, 'base', 0.12);
    p.px('head', 'front', 0, 2, hair);
    p.px('head', 'front', 7, 2, hair);
  }
  if (style === 'long') {
    p.rect('head', 'front', 0, 3, 1, 4, hair, 'base', 0.12);
    p.rect('head', 'front', 7, 3, 1, 4, hair, 'base', 0.12);
  }
  if (style === 'spiky') {
    for (let x = 0; x < 8; x += 2) p.px('head', 'front', x + 1, 2, hair);
  }

  const eye = o.eye ?? '#3a5bd9';
  const white = o.eyeWhite ?? '#ffffff';
  p.px('head', 'front', 1, 4, white);
  p.px('head', 'front', 2, 4, eye);
  p.px('head', 'front', 5, 4, eye);
  p.px('head', 'front', 6, 4, white);
  p.rect('head', 'front', 3, 5, 2, 1, shade(o.skin, -0.12));

  const lip = shade(o.skin, -0.45);
  switch (o.mouth ?? 'smile') {
    case 'smile':
      p.rect('head', 'front', 3, 6, 2, 1, lip);
      p.px('head', 'front', 2, 5, lip);
      p.px('head', 'front', 5, 5, lip);
      break;
    case 'grin':
      p.rect('head', 'front', 2, 6, 4, 1, lip);
      p.rect('head', 'front', 3, 6, 2, 1, '#ffffff');
      break;
    case 'small':
      p.rect('head', 'front', 3, 6, 2, 1, lip);
      break;
    case 'line':
      p.rect('head', 'front', 2, 6, 4, 1, lip);
      break;
  }
  if (o.beard) {
    p.rect('head', 'front', 0, 6, 8, 2, hair, 'base', 0.12);
    p.rect('head', 'front', 0, 5, 1, 1, hair);
    p.rect('head', 'front', 7, 5, 1, 1, hair);
    p.rect('head', 'front', 3, 6, 2, 1, shade(hair, -0.4));
    p.sides('head', 0, 5, 2, 3, hair, 'base', 0.12);
  }
}

interface OutfitOpts {
  skin: string;
  shirt: string;
  pattern?: 'plain' | 'stripes' | 'logo' | 'jacket' | 'hoodie';
  accent?: string;
  sleeves?: 'short' | 'long';
  pants: string;
  shoes: string;
  belt?: string;
  noise?: number;
}

function drawOutfit(p: SkinPainter, o: OutfitOpts) {
  const n = o.noise ?? 0.08;
  const accent = o.accent ?? '#ffffff';
  p.whole('body', o.shirt, 'base', n);

  for (const arm of ['rightArm', 'leftArm'] as const) {
    p.whole(arm, o.skin, 'base', 0.06);
    const sleeveEnd = o.sleeves === 'long' ? 9 : 3;
    p.band(arm, 0, sleeveEnd, o.shirt, 'base', n);
    p.cap(arm, 'top', o.shirt, 'base', n);
    if (o.sleeves === 'long') p.band(arm, sleeveEnd, sleeveEnd, shade(o.shirt, -0.2));
  }

  switch (o.pattern) {
    case 'stripes':
      for (let y = 1; y < 12; y += 3) {
        p.band('body', y, y, accent, 'base', n);
        for (const arm of ['rightArm', 'leftArm'] as const)
          if (y <= (o.sleeves === 'long' ? 9 : 3)) p.band(arm, y, y, accent, 'base', n);
      }
      break;
    case 'logo':
      p.rect('body', 'front', 3, 3, 2, 2, accent);
      p.px('body', 'front', 2, 4, accent);
      p.px('body', 'front', 5, 4, accent);
      p.px('body', 'front', 3, 5, accent);
      p.px('body', 'front', 4, 5, accent);
      break;
    case 'jacket':
      p.rect('body', 'front', 2, 0, 4, 12, accent, 'base', n);
      p.rect('body', 'front', 3, 0, 2, 1, o.skin);
      break;
    case 'hoodie':
      p.rect('body', 'front', 4, 0, 1, 12, shade(o.shirt, -0.25));
      p.px('body', 'front', 3, 1, accent);
      p.px('body', 'front', 3, 2, accent);
      p.px('body', 'front', 5, 1, accent);
      p.px('body', 'front', 5, 2, accent);
      p.rect('body', 'front', 2, 7, 5, 2, shade(o.shirt, -0.12));
      break;
  }

  for (const leg of ['rightLeg', 'leftLeg'] as const) {
    p.whole(leg, o.pants, 'base', n);
    p.band(leg, 10, 11, o.shoes, 'base', n);
    p.cap(leg, 'bottom', o.shoes, 'base', n);
  }
  if (o.belt) {
    p.band('body', 11, 11, o.belt);
    p.rect('body', 'front', 3, 11, 2, 1, '#f7c948');
  }
}

function randomHead(p: SkinPainter, skin: string): HeadOpts {
  return {
    skin,
    hair: p.pick(HAIR),
    hairStyle: p.pick(['short', 'short', 'long', 'spiky', 'buzz', 'bald'] as const),
    eye: p.pick(EYES),
    mouth: p.pick(['smile', 'grin', 'small', 'line'] as const),
    beard: p.chance(0.12),
  };
}

function hat(ctx: CanvasRenderingContext2D, id: string, color: string) {
  applyHat(
    ctx,
    HATS.find((h) => h.id === id)!,
    color,
  );
}

// 3×5-Ziffern für Rückennummern
const DIGITS: Record<string, string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '.##', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'],
};

/** Rückennummer (1–2 Ziffern) mittig auf den Rücken. */
function drawNumber(p: SkinPainter, n: number, color: string) {
  const text = String(n);
  // Zwei Ziffern brauchen 7 Pixel (3 + 1 Abstand + 3), eine Ziffer 3
  let x = text.length === 2 ? 0 : 2;
  for (const ch of text) {
    DIGITS[ch].forEach((row, dy) => {
      [...row].forEach((c, dx) => {
        if (c === '#') p.px('body', 'back', x + dx, 3 + dy, color);
      });
    });
    x += 4;
  }
}

export interface Theme {
  id: string;
  label: string;
  icon: string;
  draw: (p: SkinPainter, ctx: CanvasRenderingContext2D) => void;
}

export const THEMES: Theme[] = [
  {
    id: 'random',
    label: 'Zufall',
    icon: '🎲',
    draw: (p, ctx) => {
      const skin = p.pick(SKIN_TONES);
      drawHead(p, randomHead(p, skin));
      const shirt = p.pick(CLOTHES);
      drawOutfit(p, {
        skin,
        shirt,
        accent: p.pick(CLOTHES.filter((c) => c !== shirt)),
        pattern: p.pick(['plain', 'stripes', 'logo', 'jacket', 'hoodie'] as const),
        sleeves: p.pick(['short', 'long'] as const),
        pants: p.pick(PANTS),
        shoes: p.pick(SHOES),
        belt: p.chance(0.3) ? '#3e2410' : undefined,
      });
      if (p.chance(0.4)) hat(ctx, p.pick(['cap', 'beanie', 'headphones', 'cowboy', 'crown'] as const), p.pick(CLOTHES));
    },
  },
  {
    id: 'knight',
    label: 'Ritter',
    icon: '⚔️',
    draw: (p, ctx) => {
      const skin = p.pick(SKIN_TONES);
      const metal = p.pick(['#aeb6c2', '#9aa3ad', '#c9ced6']);
      const tabard = p.pick(['#c62828', '#1565c0', '#2e7d32', '#6a1b9a', '#f9a825']);
      drawHead(p, { ...randomHead(p, skin), hairStyle: 'short' });
      drawOutfit(p, { skin, shirt: metal, sleeves: 'long', pants: metal, shoes: '#5b5f66', noise: 0.14 });
      for (const arm of ['rightArm', 'leftArm'] as const) {
        p.band(arm, 10, 11, shade(metal, -0.3), 'base', 0.1);
        p.cap(arm, 'bottom', shade(metal, -0.3));
      }
      for (const f of ['front', 'back'] as const) p.rect('body', f, 2, 0, 4, 12, tabard, 'base', 0.08);
      p.rect('body', 'front', 3, 2, 2, 7, '#ffffff');
      p.rect('body', 'front', 2, 4, 4, 2, '#ffffff');
      p.band('body', 8, 8, '#5d4037');
      hat(ctx, 'knight', tabard);
    },
  },
  {
    id: 'ninja',
    label: 'Ninja',
    icon: '🥷',
    draw: (p, ctx) => {
      const skin = p.pick(SKIN_TONES);
      const cloth = p.pick(['#22232b', '#1a237e', '#3e2723', '#263238']);
      const band = p.pick(['#e53935', '#fdd835', '#43a047', '#1e88e5', '#ffffff']);
      drawHead(p, { ...randomHead(p, skin), hairStyle: 'short', beard: false });
      drawOutfit(p, { skin, shirt: cloth, sleeves: 'long', pants: cloth, shoes: shade(cloth, -0.3), noise: 0.1 });
      p.band('body', 7, 8, band, 'base', 0.06);
      p.rect('body', 'front', 2, 0, 1, 7, shade(cloth, 0.15));
      p.rect('body', 'front', 5, 0, 1, 7, shade(cloth, 0.15));
      for (const arm of ['rightArm', 'leftArm'] as const) p.band(arm, 8, 9, shade(cloth, 0.2));
      for (const leg of ['rightLeg', 'leftLeg'] as const) p.band(leg, 7, 9, shade(cloth, 0.2));
      hat(ctx, 'ninja', band);
    },
  },
  {
    id: 'astronaut',
    label: 'Astronaut',
    icon: '🚀',
    draw: (p) => {
      const skin = p.pick(SKIN_TONES);
      const suit = '#e8ecf2';
      const accent = p.pick(['#1e88e5', '#e53935', '#fb8c00', '#43a047']);
      drawHead(p, { ...randomHead(p, skin), beard: false });
      drawOutfit(p, { skin: '#cfd6df', shirt: suit, sleeves: 'long', pants: suit, shoes: '#78909c', noise: 0.06 });
      for (const arm of ['rightArm', 'leftArm'] as const) {
        p.band(arm, 10, 11, '#90a4ae');
        p.band(arm, 5, 5, accent);
      }
      for (const leg of ['rightLeg', 'leftLeg'] as const) p.band(leg, 4, 4, accent);
      p.rect('body', 'front', 2, 2, 4, 4, '#78909c');
      p.px('body', 'front', 3, 3, '#e53935');
      p.px('body', 'front', 4, 3, '#43a047');
      p.px('body', 'front', 3, 4, '#fdd835');
      p.px('body', 'front', 4, 4, '#1e88e5');
      p.rect('body', 'back', 1, 1, 6, 9, '#b0bec5', 'base', 0.08);
      p.band('body', 11, 11, accent);
      // Helm auf der äußeren Schicht, Visier offen, damit man das Gesicht sieht
      p.whole('head', suit, 'overlay', 0.05);
      p.rect('head', 'front', 1, 2, 6, 5, '#90a4ae', 'overlay');
      p.rect('head', 'front', 2, 3, 4, 3, null, 'overlay');
      p.band('head', 7, 7, accent, 'overlay');
    },
  },
  {
    id: 'robot',
    label: 'Roboter',
    icon: '🤖',
    draw: (p) => {
      const metal = p.pick(['#9aa3ad', '#7f8fa6', '#b0a28f', '#8d9e8a']);
      const glow = p.pick(['#00e5ff', '#ff1744', '#76ff03', '#ffea00', '#e040fb']);
      for (const part of ['head', 'body', 'rightArm', 'leftArm', 'rightLeg', 'leftLeg'] as const)
        p.whole(part, metal, 'base', 0.16);
      p.rect('head', 'front', 1, 3, 2, 2, '#1c1f26');
      p.rect('head', 'front', 5, 3, 2, 2, '#1c1f26');
      p.px('head', 'front', 2, 4, glow);
      p.px('head', 'front', 5, 4, glow);
      for (let x = 2; x <= 5; x++) p.px('head', 'front', x, 6, x % 2 ? '#1c1f26' : shade(metal, 0.3));
      p.band('head', 7, 7, shade(metal, -0.3));
      p.px('head', 'top', 3, 3, glow);
      p.rect('body', 'front', 2, 2, 4, 5, '#2a2f3a');
      for (let i = 0; i < 4; i++)
        p.px('body', 'front', p.pick([2, 3, 4, 5]), 3 + i, p.chance(0.5) ? glow : shade(glow, -0.5));
      p.band('body', 10, 10, shade(metal, -0.35));
      for (const arm of ['rightArm', 'leftArm'] as const) {
        p.band(arm, 4, 4, shade(metal, -0.4));
        p.band(arm, 10, 11, shade(metal, -0.25));
      }
      for (const leg of ['rightLeg', 'leftLeg'] as const) {
        p.band(leg, 6, 6, shade(metal, -0.4));
        p.band(leg, 11, 11, shade(metal, -0.3));
      }
    },
  },
  {
    id: 'zombie',
    label: 'Zombie',
    icon: '🧟',
    draw: (p) => {
      const skin = p.pick(['#5f9b52', '#6aa84f', '#4e8a45', '#7cb36b']);
      drawHead(p, {
        skin,
        hair: '#2f3b2a',
        hairStyle: p.pick(['buzz', 'bald', 'short'] as const),
        eye: '#111111',
        eyeWhite: '#111111',
        mouth: 'line',
      });
      drawOutfit(p, {
        skin,
        shirt: p.pick(['#2fa3a8', '#7e57c2', '#8d6e63', '#607d8b']),
        sleeves: 'short',
        pants: p.pick(PANTS),
        shoes: '#3e3e46',
        noise: 0.18,
      });
      // Zerrissene Kleidung: zufällige Löcher zeigen die grüne Haut
      for (let i = 0; i < 10; i++) {
        const part = p.pick(['body', 'body', 'rightLeg', 'leftLeg'] as const);
        p.px(
          part,
          p.pick(['front', 'back', 'left', 'right'] as const),
          p.pick([0, 1, 2, 3]),
          p.pick([6, 7, 8, 9]),
          skin,
        );
      }
      for (const arm of ['rightArm', 'leftArm'] as const) p.px(arm, 'front', 1, 3, skin);
      for (let i = 0; i < 6; i++)
        p.px(
          'head',
          p.pick(['front', 'left', 'right'] as const),
          p.pick([0, 1, 6, 7]),
          p.pick([3, 5, 6, 7]),
          shade(skin, -0.25),
        );
    },
  },
  {
    id: 'pirate',
    label: 'Pirat',
    icon: '🏴‍☠️',
    draw: (p, ctx) => {
      const skin = p.pick(SKIN_TONES);
      drawHead(p, { ...randomHead(p, skin), beard: p.chance(0.6), hairStyle: p.pick(['long', 'short'] as const) });
      const striped = p.chance(0.5);
      drawOutfit(p, {
        skin,
        shirt: '#f5f5f5',
        pattern: striped ? 'stripes' : 'jacket',
        accent: striped ? '#c62828' : '#f5f5f5',
        sleeves: 'long',
        pants: p.pick(['#5d4037', '#3e2723', '#263238']),
        shoes: '#1b1b1b',
        belt: '#3e2410',
      });
      if (!striped) {
        p.rect('body', 'front', 0, 0, 2, 11, '#3e2723', 'base', 0.1);
        p.rect('body', 'front', 6, 0, 2, 11, '#3e2723', 'base', 0.1);
      }
      for (const leg of ['rightLeg', 'leftLeg'] as const) p.band(leg, 8, 11, '#1b1b1b', 'base', 0.1);
      hat(ctx, 'pirate', p.pick(['#c62828', '#1565c0', '#2e7d32', '#212121']));
    },
  },
  {
    id: 'hero',
    label: 'Superheld',
    icon: '🦸',
    draw: (p) => {
      const skin = p.pick(SKIN_TONES);
      const suit = p.pick(['#c62828', '#1565c0', '#2e7d32', '#6a1b9a', '#212121', '#f9a825']);
      const accent = p.pick(['#fdd835', '#ffffff', '#e53935', '#00e5ff'].filter((c) => c !== suit));
      drawHead(p, { ...randomHead(p, skin), beard: false });
      drawOutfit(p, {
        skin: suit,
        shirt: suit,
        sleeves: 'long',
        pants: suit,
        shoes: accent,
        belt: accent,
        noise: 0.06,
      });
      for (const arm of ['rightArm', 'leftArm'] as const) {
        p.band(arm, 9, 11, accent);
        p.cap(arm, 'bottom', accent);
      }
      for (const leg of ['rightLeg', 'leftLeg'] as const) p.band(leg, 8, 11, accent);
      // Abzeichen in Rautenform
      p.rect('body', 'front', 3, 2, 2, 1, accent);
      p.rect('body', 'front', 2, 3, 4, 2, accent);
      p.rect('body', 'front', 3, 5, 2, 1, accent);
      p.rect('body', 'front', 3, 3, 2, 2, suit);
      // Maske über den Augen
      p.rect('head', 'front', 0, 3, 8, 2, suit, 'overlay');
      p.rect('head', 'front', 1, 4, 2, 1, null, 'overlay');
      p.rect('head', 'front', 5, 4, 2, 1, null, 'overlay');
      p.sides('head', 0, 3, 8, 2, suit, 'overlay');
      p.rect('head', 'back', 0, 3, 8, 2, suit, 'overlay');
    },
  },
  {
    id: 'wizard',
    label: 'Zauberer',
    icon: '🧙',
    draw: (p) => {
      const skin = p.pick(SKIN_TONES);
      const robe = p.pick(['#4527a0', '#1a237e', '#6a1b9a', '#00695c', '#37474f']);
      const beard = p.pick(['#eceff1', '#bdbdbd', '#8d6e63']);
      drawHead(p, { skin, hair: beard, hairStyle: 'long', eye: p.pick(EYES), mouth: 'small', beard: true });
      drawOutfit(p, { skin, shirt: robe, sleeves: 'long', pants: robe, shoes: shade(robe, -0.4), noise: 0.1 });
      p.rect('body', 'front', 2, 0, 4, 4, beard, 'base', 0.1);
      p.rect('body', 'front', 3, 4, 2, 1, beard);
      p.band('body', 8, 8, '#f7c948');
      // Sterne auf dem Umhang
      for (let i = 0; i < 8; i++) {
        p.px(
          p.pick(['body', 'rightLeg', 'leftLeg'] as const),
          p.pick(['front', 'back', 'left', 'right'] as const),
          p.pick([0, 1, 2, 3]),
          p.pick([2, 5, 7, 9]),
          '#ffe082',
        );
      }
      // Hut: rundum mit goldenem Band und Sternen
      p.cap('head', 'top', robe, 'overlay', 0.08);
      p.band('head', 0, 2, robe, 'overlay', 0.08);
      p.band('head', 2, 2, '#f7c948', 'overlay');
      p.px('head', 'front', 2, 0, '#ffe082', 'overlay');
      p.px('head', 'front', 5, 1, '#ffe082', 'overlay');
      p.px('head', 'top', 3, 4, '#ffe082', 'overlay');
    },
  },
  {
    id: 'king',
    label: 'König',
    icon: '👑',
    draw: (p, ctx) => {
      const skin = p.pick(SKIN_TONES);
      const robe = p.pick(['#b71c1c', '#4a148c', '#0d47a1', '#1b5e20']);
      drawHead(p, { ...randomHead(p, skin), beard: p.chance(0.5) });
      drawOutfit(p, { skin, shirt: robe, sleeves: 'long', pants: '#263238', shoes: '#f7c948', noise: 0.08 });
      // Hermelin-Kragen: weiß mit schwarzen Tupfen
      p.band('body', 0, 1, '#fafafa');
      for (const f of ['front', 'back'] as const) for (const x of [1, 4, 6]) p.px('body', f, x, x % 2, '#212121');
      p.rect('body', 'front', 3, 2, 2, 10, '#f7c948');
      for (const y of [3, 6, 9]) p.rect('body', 'front', 3, y, 2, 1, '#c8901a');
      for (const arm of ['rightArm', 'leftArm'] as const) p.band(arm, 9, 9, '#fafafa');
      hat(ctx, 'crown', '#f7c948');
    },
  },
  {
    id: 'vampire',
    label: 'Vampir',
    icon: '🧛',
    draw: (p) => {
      const skin = p.pick(['#e8e4ec', '#d7d0dc', '#c9c1cf']);
      drawHead(p, { skin, hair: '#151515', hairStyle: 'short', eye: '#d50000', mouth: 'line' });
      p.px('head', 'front', 2, 7, '#ffffff');
      p.px('head', 'front', 5, 7, '#ffffff');
      p.rect('head', 'front', 3, 2, 2, 1, '#151515'); // Spitze am Haaransatz
      drawOutfit(p, { skin, shirt: '#151515', sleeves: 'long', pants: '#151515', shoes: '#0a0a0a', noise: 0.06 });
      p.rect('body', 'front', 2, 0, 4, 12, '#f5f5f5');
      p.rect('body', 'front', 3, 1, 2, 1, '#b71c1c');
      p.rect('body', 'front', 0, 0, 1, 12, '#b71c1c');
      p.rect('body', 'front', 7, 0, 1, 12, '#b71c1c');
      // Hoher Umhangkragen auf der äußeren Schicht
      p.rect('body', 'back', 0, 0, 8, 12, '#b71c1c', 'overlay', 0.06);
      p.sides('body', 2, 0, 2, 3, '#151515', 'overlay');
    },
  },
  {
    id: 'skeleton',
    label: 'Skelett',
    icon: '💀',
    draw: (p) => {
      const bone = p.pick(['#e6e6e6', '#d9d4c7', '#cfcfcf']);
      const dark = '#2b2b2b';
      for (const part of ['head', 'body', 'rightArm', 'leftArm', 'rightLeg', 'leftLeg'] as const)
        p.whole(part, bone, 'base', 0.1);
      p.rect('head', 'front', 1, 3, 2, 2, dark);
      p.rect('head', 'front', 5, 3, 2, 2, dark);
      p.px('head', 'front', 3, 5, dark);
      p.px('head', 'front', 4, 5, dark);
      for (let x = 1; x <= 6; x++) p.px('head', 'front', x, 6, x % 2 ? dark : bone);
      // Rippen und Wirbelsäule
      p.rect('body', 'front', 0, 0, 8, 12, dark);
      p.rect('body', 'front', 3, 0, 2, 12, bone);
      for (const y of [1, 3, 5, 7]) p.rect('body', 'front', 1, y, 6, 1, bone);
      p.rect('body', 'front', 1, 10, 6, 2, bone);
      for (const limb of ['rightArm', 'leftArm', 'rightLeg', 'leftLeg'] as const) p.band(limb, 5, 6, shade(bone, -0.2));
    },
  },
  {
    id: 'alien',
    label: 'Alien',
    icon: '👽',
    draw: (p) => {
      const skin = p.pick(['#7cb342', '#9ccc65', '#8e7cc3', '#4dd0e1', '#b0bec5']);
      const suit = p.pick(['#cfd8dc', '#90a4ae', '#ffd54f', '#212121']);
      p.whole('head', skin, 'base', 0.08);
      p.rect('head', 'front', 1, 2, 2, 3, '#111111');
      p.rect('head', 'front', 5, 2, 2, 3, '#111111');
      p.px('head', 'front', 1, 2, '#ffffff');
      p.px('head', 'front', 5, 2, '#ffffff');
      p.rect('head', 'front', 3, 6, 2, 1, shade(skin, -0.4));
      drawOutfit(p, { skin, shirt: suit, sleeves: 'long', pants: suit, shoes: shade(suit, -0.4), noise: 0.06 });
      p.rect('body', 'front', 3, 3, 2, 2, skin);
      p.band('body', 9, 9, shade(suit, -0.3));
      for (const arm of ['rightArm', 'leftArm'] as const) p.band(arm, 10, 11, skin);
    },
  },
  {
    id: 'viking',
    label: 'Wikinger',
    icon: '🪓',
    draw: (p) => {
      const skin = p.pick(SKIN_TONES);
      const hair = p.pick(['#d84315', '#f0d27a', '#8b5a2b', '#5a3820']);
      drawHead(p, { skin, hair, hairStyle: 'long', eye: p.pick(EYES), mouth: 'line', beard: true });
      drawOutfit(p, {
        skin,
        shirt: '#6d4c41',
        sleeves: 'short',
        pants: p.pick(['#33691e', '#4e342e', '#37474f']),
        shoes: '#8d6e63',
        noise: 0.18,
      });
      p.rect('body', 'front', 2, 0, 4, 12, '#a1887f', 'base', 0.12);
      p.band('body', 8, 8, '#3e2723');
      p.rect('body', 'front', 3, 8, 2, 1, '#bdbdbd');
      for (const arm of ['rightArm', 'leftArm'] as const) p.band(arm, 7, 9, '#4e342e');
      for (const leg of ['rightLeg', 'leftLeg'] as const) p.band(leg, 8, 11, '#a1887f', 'base', 0.15);
      // Helm mit Hörnern
      const metal = '#9aa3ad';
      p.cap('head', 'top', metal, 'overlay', 0.1);
      p.band('head', 0, 1, metal, 'overlay', 0.1);
      p.rect('head', 'front', 3, 2, 2, 2, metal, 'overlay');
      p.sides('head', 2, 0, 2, 3, '#efe6c8', 'overlay');
      p.sides('head', 3, 0, 1, 1, '#d7ccc8', 'overlay');
    },
  },
  {
    id: 'police',
    label: 'Polizei',
    icon: '👮',
    draw: (p) => {
      const skin = p.pick(SKIN_TONES);
      const navy = p.pick(['#1a237e', '#0d2c54', '#1b3a5c']);
      drawHead(p, { ...randomHead(p, skin), hairStyle: 'short' });
      drawOutfit(p, {
        skin,
        shirt: '#6f9fd8',
        sleeves: p.pick(['short', 'long'] as const),
        pants: navy,
        shoes: '#111111',
        belt: '#111111',
        noise: 0.06,
      });
      p.rect('body', 'front', 0, 0, 2, 11, navy);
      p.rect('body', 'front', 6, 0, 2, 11, navy);
      p.px('body', 'front', 6, 3, '#f7c948');
      p.rect('body', 'front', 3, 0, 2, 1, skin);
      p.rect('body', 'front', 3, 1, 2, 3, '#111111');
      // Mütze
      p.cap('head', 'top', navy, 'overlay');
      p.band('head', 0, 1, navy, 'overlay');
      p.rect('head', 'front', 0, 2, 8, 1, '#111111', 'overlay');
      p.rect('head', 'front', 3, 1, 2, 1, '#f7c948', 'overlay');
    },
  },
  {
    id: 'firefighter',
    label: 'Feuerwehr',
    icon: '🧑‍🚒',
    draw: (p) => {
      const skin = p.pick(SKIN_TONES);
      const suit = p.pick(['#1c2a3a', '#c9b37e', '#263238']);
      const stripe = '#eeff41';
      drawHead(p, { ...randomHead(p, skin), hairStyle: 'short' });
      drawOutfit(p, { skin, shirt: suit, sleeves: 'long', pants: suit, shoes: '#111111', noise: 0.08 });
      p.band('body', 9, 9, stripe);
      p.band('body', 10, 10, '#bdbdbd');
      for (const arm of ['rightArm', 'leftArm'] as const) {
        p.band(arm, 7, 7, stripe);
        p.band(arm, 10, 11, '#111111');
      }
      for (const leg of ['rightLeg', 'leftLeg'] as const) p.band(leg, 6, 6, stripe);
      // Roter Helm mit Abzeichen und langem Nackenschutz
      const red = '#d32f2f';
      p.cap('head', 'top', red, 'overlay', 0.06);
      p.band('head', 0, 1, red, 'overlay', 0.06);
      p.band('head', 2, 2, shade(red, -0.25), 'overlay');
      p.rect('head', 'back', 0, 3, 8, 2, shade(red, -0.25), 'overlay');
      p.rect('head', 'front', 3, 0, 2, 2, '#f7c948', 'overlay');
      p.rect('head', 'front', 0, 3, 1, 1, null, 'overlay');
    },
  },
  {
    id: 'soccer',
    label: 'Fußball',
    icon: '⚽',
    draw: (p) => {
      const skin = p.pick(SKIN_TONES);
      const jersey = p.pick(['#e53935', '#1e88e5', '#fdd835', '#43a047', '#fafafa', '#212121', '#fb8c00']);
      const number = p.pick(['#ffffff', '#212121'].filter((c) => c !== jersey));
      const shorts = p.pick(['#fafafa', '#212121', '#1a237e']);
      drawHead(p, randomHead(p, skin));
      drawOutfit(p, { skin, shirt: jersey, sleeves: 'short', pants: shorts, shoes: '#212121', noise: 0.05 });
      for (const arm of ['rightArm', 'leftArm'] as const) p.band(arm, 3, 3, number);
      for (const leg of ['rightLeg', 'leftLeg'] as const) {
        p.band(leg, 4, 5, skin, 'base', 0.05);
        p.band(leg, 6, 9, jersey, 'base', 0.05);
        p.band(leg, 6, 6, number);
      }
      drawNumber(p, p.pick([1, 4, 5, 7, 8, 9, 10, 11, 13, 17, 19, 23]), number);
      p.rect('body', 'front', 1, 2, 1, 1, number);
    },
  },
  {
    id: 'panda',
    label: 'Panda',
    icon: '🐼',
    draw: (p) => {
      const white = '#f2f2f2';
      const black = '#1e1e1e';
      p.whole('head', white, 'base', 0.06);
      for (const x of [0, 6]) {
        p.rect('head', 'top', x, 0, 2, 2, black);
        p.rect('head', 'front', x, 0, 2, 1, black);
      }
      p.rect('head', 'front', 1, 3, 2, 3, black);
      p.rect('head', 'front', 5, 3, 2, 3, black);
      p.px('head', 'front', 2, 4, '#ffffff');
      p.px('head', 'front', 5, 4, '#ffffff');
      p.rect('head', 'front', 3, 5, 2, 1, black);
      p.rect('head', 'front', 3, 6, 2, 1, '#9e9e9e');
      p.whole('body', white, 'base', 0.06);
      p.band('body', 0, 3, black, 'base', 0.06);
      for (const part of ['rightArm', 'leftArm', 'rightLeg', 'leftLeg'] as const) p.whole(part, black, 'base', 0.08);
    },
  },
  {
    id: 'fox',
    label: 'Fuchs',
    icon: '🦊',
    draw: (p) => {
      const fur = p.pick(['#e65100', '#ef6c00', '#d84315', '#8d6e63']);
      const cream = '#fff3e0';
      const dark = '#3e2723';
      p.whole('head', fur, 'base', 0.1);
      for (const x of [0, 6]) {
        p.rect('head', 'top', x, 0, 2, 2, dark);
        p.rect('head', 'front', x, 0, 2, 1, dark);
      }
      p.rect('head', 'front', 0, 5, 8, 3, cream, 'base', 0.05);
      p.rect('head', 'front', 2, 4, 4, 1, cream);
      p.px('head', 'front', 1, 3, '#ffffff');
      p.px('head', 'front', 2, 3, '#1b1b1b');
      p.px('head', 'front', 5, 3, '#1b1b1b');
      p.px('head', 'front', 6, 3, '#ffffff');
      p.rect('head', 'front', 3, 5, 2, 1, dark);
      p.whole('body', fur, 'base', 0.1);
      p.rect('body', 'front', 2, 0, 4, 12, cream, 'base', 0.05);
      for (const part of ['rightArm', 'leftArm', 'rightLeg', 'leftLeg'] as const) {
        p.whole(part, fur, 'base', 0.1);
        p.band(part, 8, 11, dark, 'base', 0.1);
        p.cap(part, 'bottom', dark);
      }
    },
  },
  {
    id: 'santa',
    label: 'Nikolaus',
    icon: '🎅',
    draw: (p) => {
      const skin = p.pick(SKIN_TONES);
      const red = '#c62828';
      const white = '#fafafa';
      drawHead(p, { skin, hair: white, hairStyle: 'short', eye: p.pick(EYES), mouth: 'smile', beard: true });
      p.rect('head', 'front', 2, 5, 4, 1, white);
      drawOutfit(p, { skin, shirt: red, sleeves: 'long', pants: red, shoes: '#111111', belt: '#111111', noise: 0.08 });
      p.rect('body', 'front', 3, 0, 2, 11, white);
      p.rect('body', 'front', 2, 0, 4, 3, white, 'base', 0.05);
      for (const arm of ['rightArm', 'leftArm'] as const) {
        p.band(arm, 9, 9, white);
        p.band(arm, 10, 11, '#111111');
      }
      for (const leg of ['rightLeg', 'leftLeg'] as const) p.band(leg, 7, 11, '#111111', 'base', 0.05);
      // Mütze mit weißem Rand und Bommel hinten
      p.cap('head', 'top', red, 'overlay', 0.06);
      p.band('head', 0, 1, red, 'overlay', 0.06);
      p.band('head', 2, 2, white, 'overlay');
      p.rect('head', 'back', 5, 3, 2, 2, white, 'overlay');
    },
  },
];

export type LockGroup = 'head' | 'top' | 'legs';

const LOCK_PARTS: Record<LockGroup, PartName[]> = {
  head: ['head'],
  top: ['body', 'rightArm', 'leftArm'],
  legs: ['rightLeg', 'leftLeg'],
};

/** Würfelt einen neuen Skin; gesperrte Körperteile bleiben wie sie waren. */
export function generateSkin(ctx: CanvasRenderingContext2D, slim: boolean, themeId: string, locked: Set<LockGroup>) {
  const before = ctx.getImageData(0, 0, 64, 64);
  ctx.clearRect(0, 0, 64, 64);
  const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];
  theme.draw(new SkinPainter(ctx, slim, Math.random), ctx);

  for (const group of locked) {
    for (const name of LOCK_PARTS[group]) {
      const def = partDefs(slim).find((p) => p.name === name)!;
      for (const layer of ['base', 'overlay'] as const) {
        for (const r of Object.values(faceRects(def.size, def[layer]))) {
          ctx.putImageData(before, 0, 0, r.x, r.y, r.w, r.h);
        }
      }
    }
  }
}
