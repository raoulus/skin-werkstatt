import { strToU8, zipSync } from 'fflate';

// Bedrock-Resource-Pack (.mcpack = ZIP), das die Arm-Animation des Spielers überschreibt.
// Vanilla definiert "animation.player.move.arms" (Armschwingen beim Laufen). Ein Pack, das
// dieselbe ID definiert, ersetzt sie. Andere Animationen (Schlagen, Halten, Wippen) werden
// weiterhin dazuaddiert, deshalb funktionieren die Arme beim Abbauen etc. noch.

export interface PackPose {
  id: string;
  label: string;
  icon: string;
  /** Molang-Rotation [x, y, z] in Grad für rechten und linken Arm. */
  right: [string, string, string];
  left: [string, string, string];
}

// Kleines Mitschwingen beim Laufen, damit es nicht steif wirkt (tcos0 kommt aus player.entity.json).
const swing = (sign: '+' | '-') => `${sign} variable.tcos0 * 0.25`;

export const PACK_POSES: PackPose[] = [
  {
    id: 'forward',
    label: 'Arme vorne',
    icon: '🙌',
    right: [`-90 ${swing('-')}`, '0', '0'],
    left: [`-90 ${swing('+')}`, '0', '0'],
  },
  {
    id: 'zombie',
    label: 'Zombie-Wackeln',
    icon: '🧟',
    right: ['-90 + math.sin(query.life_time * 200) * 6', '0', '0'],
    left: ['-90 - math.sin(query.life_time * 200) * 6', '0', '0'],
  },
  {
    id: 'up',
    label: 'Arme hoch',
    icon: '🙆',
    right: ['-170', '0', '0'],
    left: ['-170', '0', '0'],
  },
  {
    id: 'point',
    label: 'Ein Arm vorne',
    icon: '👉',
    right: ['-90', '0', '0'],
    left: [`0 ${swing('+')}`, '0', '0'],
  },
];

/** UUID v4; crypto.randomUUID gibt es nur über HTTPS, getRandomValues auch im Heimnetz. */
function uuid(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Packsymbol: das Gesicht des aktuellen Skins, groß und pixelig. */
async function packIcon(skin: HTMLCanvasElement): Promise<Uint8Array> {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#62b33a';
  g.fillRect(0, 0, 128, 128);
  g.drawImage(skin, 8, 8, 8, 8, 8, 8, 112, 112); // Gesicht
  g.drawImage(skin, 40, 8, 8, 8, 4, 4, 120, 120); // Hut-Schicht
  const blob = await new Promise<Blob>((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('Icon fehlgeschlagen'))), 'image/png'),
  );
  return new Uint8Array(await blob.arrayBuffer());
}

export async function buildPosePack(pose: PackPose, skin: HTMLCanvasElement): Promise<Blob> {
  const manifest = {
    format_version: 2,
    header: {
      name: `${pose.label} (Skin-Werkstatt)`,
      description: `Spieler-Pose: ${pose.label}. Nur für dich sichtbar.`,
      uuid: uuid(),
      version: [1, 0, 0],
      min_engine_version: [1, 20, 0],
    },
    modules: [{ type: 'resources', uuid: uuid(), version: [1, 0, 0] }],
  };

  const animations = {
    format_version: '1.8.0',
    animations: {
      'animation.player.move.arms': {
        loop: true,
        bones: {
          rightarm: { rotation: pose.right },
          leftarm: { rotation: pose.left },
        },
      },
    },
  };

  const json = (o: unknown) => strToU8(JSON.stringify(o, null, 2));
  const zip = zipSync({
    'manifest.json': json(manifest),
    'pack_icon.png': [await packIcon(skin), { level: 0 }],
    'animations/skinwerkstatt_pose.animation.json': json(animations),
  });
  // octet-stream, damit Safari die Endung .mcpack nicht in .zip umbenennt
  return new Blob([zip as BlobPart], { type: 'application/octet-stream' });
}
