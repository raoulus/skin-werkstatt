import { faceRects, partDefs, type FaceName, type PartName } from './skinLayout';

/** Ein eigener Start-Skin (kein Mojang-Material), damit man nicht vor einer leeren Figur sitzt. */
export function drawDefaultSkin(ctx: CanvasRenderingContext2D, slim: boolean) {
  const parts = Object.fromEntries(partDefs(slim).map((p) => [p.name, p]));
  const face = (part: PartName, f: FaceName) => faceRects(parts[part].size, parts[part].base)[f];
  const fillPart = (part: PartName, color: string, fromRow = 0, toRow = 99) => {
    for (const f of ['right', 'front', 'left', 'back'] as const) {
      const r = face(part, f);
      const top = r.y + fromRow;
      const h = Math.min(r.h, toRow) - fromRow;
      if (h > 0) rect(r.x, top, r.w, h, color);
    }
  };
  const rect = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };

  const skin = '#e3a77f';
  const hair = '#5a3820';
  const shirt = '#2fa3a8';
  const pants = '#3d4fb8';
  const shoes = '#5b5b66';

  ctx.clearRect(0, 0, 64, 64);

  // Kopf
  fillPart('head', skin);
  const top = face('head', 'top');
  rect(top.x, top.y, top.w, top.h, hair);
  rect(face('head', 'bottom').x, face('head', 'bottom').y, 8, 8, skin);
  fillPart('head', hair, 0, 2);
  const back = face('head', 'back');
  rect(back.x, back.y, back.w, 6, hair);
  for (const f of ['left', 'right'] as const) {
    const r = face('head', f);
    rect(f === 'right' ? r.x : r.x + 4, r.y, 4, 5, hair);
  }
  const fr = face('head', 'front');
  rect(fr.x, fr.y + 2, 1, 1, hair);
  rect(fr.x + 7, fr.y + 2, 1, 1, hair);
  rect(fr.x + 1, fr.y + 4, 1, 1, '#ffffff');
  rect(fr.x + 2, fr.y + 4, 1, 1, '#3a5bd9');
  rect(fr.x + 5, fr.y + 4, 1, 1, '#3a5bd9');
  rect(fr.x + 6, fr.y + 4, 1, 1, '#ffffff');
  rect(fr.x + 3, fr.y + 5, 2, 1, '#c98a66');
  rect(fr.x + 2, fr.y + 6, 4, 1, '#8a4f3a');

  // Körper
  fillPart('body', shirt);
  for (const f of ['top', 'bottom'] as const) {
    const r = face('body', f);
    rect(r.x, r.y, r.w, r.h, shirt);
  }
  const bf = face('body', 'front');
  rect(bf.x + 3, bf.y, 2, 1, skin);

  // Arme: kurze Ärmel, dann Haut
  for (const arm of ['rightArm', 'leftArm'] as const) {
    fillPart(arm, skin);
    fillPart(arm, shirt, 0, 4);
    rect(face(arm, 'top').x, face(arm, 'top').y, parts[arm].size[0], 4, shirt);
    rect(face(arm, 'bottom').x, face(arm, 'bottom').y, parts[arm].size[0], 4, skin);
  }

  // Beine: Hose und Schuhe
  for (const leg of ['rightLeg', 'leftLeg'] as const) {
    fillPart(leg, pants);
    fillPart(leg, shoes, 10);
    rect(face(leg, 'top').x, face(leg, 'top').y, 4, 4, pants);
    rect(face(leg, 'bottom').x, face(leg, 'bottom').y, 4, 4, shoes);
  }
}
