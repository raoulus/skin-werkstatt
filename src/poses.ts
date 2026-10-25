import type { PlayerModel } from './playerModel';

type PoseFn = (m: PlayerModel, t: number) => void;

export interface Pose {
  id: string;
  label: string;
  apply: PoseFn;
}

const { sin, PI } = Math;

const breathe: PoseFn = (m, t) => {
  m.parts.rightArm.rotation.z = -0.05 - sin(t * 2) * 0.03;
  m.parts.leftArm.rotation.z = 0.05 + sin(t * 2) * 0.03;
};

const walk = (m: PlayerModel, t: number, speed: number, swing: number) => {
  const s = sin(t * speed) * swing;
  m.parts.rightArm.rotation.x = s;
  m.parts.leftArm.rotation.x = -s;
  m.parts.rightLeg.rotation.x = -s;
  m.parts.leftLeg.rotation.x = s;
};

export const POSES: Pose[] = [
  { id: 'stand', label: '🧍 Stehen', apply: breathe },
  {
    id: 'forward',
    label: '🙌 Arme vorne',
    apply: (m, t) => {
      m.parts.rightArm.rotation.x = -PI / 2 + sin(t * 2) * 0.04;
      m.parts.leftArm.rotation.x = -PI / 2 - sin(t * 2) * 0.04;
    },
  },
  {
    id: 'zombie',
    label: '🧟 Zombie',
    apply: (m, t) => {
      walk(m, t, 4, 0.35);
      m.parts.rightArm.rotation.x = -PI / 2 + sin(t * 4) * 0.08;
      m.parts.leftArm.rotation.x = -PI / 2 - sin(t * 4) * 0.08;
      m.parts.head.rotation.z = sin(t * 2) * 0.12;
    },
  },
  { id: 'walk', label: '🚶 Laufen', apply: (m, t) => walk(m, t, 6, 0.7) },
  {
    id: 'wave',
    label: '👋 Winken',
    apply: (m, t) => {
      breathe(m, t);
      m.parts.rightArm.rotation.z = -2.7 + sin(t * 9) * 0.35;
      m.parts.head.rotation.z = sin(t * 2) * 0.05;
    },
  },
  {
    id: 'cheer',
    label: '🎉 Jubeln',
    apply: (m, t) => {
      const b = Math.abs(sin(t * 6));
      m.parts.rightArm.rotation.z = -2.8 + b * 0.25;
      m.parts.leftArm.rotation.z = 2.8 - b * 0.25;
      m.root.position.y = b * 2;
    },
  },
  {
    id: 'dance',
    label: '🕺 Tanzen',
    apply: (m, t) => {
      const s = sin(t * 5);
      m.root.rotation.y = s * 0.3;
      m.parts.head.rotation.z = s * 0.15;
      m.parts.rightArm.rotation.z = s > 0 ? -2.6 : -0.3;
      m.parts.leftArm.rotation.z = s > 0 ? 0.3 : 2.6;
      m.parts.rightLeg.rotation.z = -Math.max(0, s) * 0.3;
      m.parts.leftLeg.rotation.z = Math.max(0, -s) * 0.3;
    },
  },
];
