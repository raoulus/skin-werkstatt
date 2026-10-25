// Kleine DOM-Helfer, die mehrere Module teilen.

export const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) =>
  root.querySelector(sel) as T;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> & { className?: string } = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

export function button(html: string, onClick: () => void, className = ''): HTMLButtonElement {
  const b = el('button', { className, innerHTML: html });
  b.addEventListener('click', onClick);
  return b;
}

let toastTimer = 0;
export function toast(message: string) {
  let t = document.getElementById('toast');
  if (!t) {
    t = el('div', { id: 'toast', className: 'toast' });
    document.body.append(t);
  }
  t.textContent = message;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t!.classList.remove('show'), 2600);
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Zweistufiges Bestätigen ohne Browser-Dialog: erster Tipp „Sicher?“, zweiter führt aus. */
export function confirmButton(html: string, onConfirm: () => void, className = ''): HTMLButtonElement {
  let armed = false;
  const b = button(
    html,
    () => {
      if (!armed) {
        armed = true;
        b.innerHTML = 'Sicher?';
        b.classList.add('danger');
        setTimeout(() => {
          armed = false;
          b.innerHTML = html;
          b.classList.remove('danger');
        }, 3000);
        return;
      }
      onConfirm();
    },
    className,
  );
  return b;
}

export const TAGS = [
  'Ritter',
  'Ninja',
  'Astronaut',
  'Roboter',
  'Zombie',
  'Pirat',
  'Superheld',
  'Tier',
  'Lustig',
  'Cool',
  'Sonstiges',
];
