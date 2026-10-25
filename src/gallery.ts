import { deleteSkin, getSkin, listSkins, newId, putSkin, type StoredSkin } from './db';
import type { SkinCanvas } from './skinCanvas';
import { renderThumbnail } from './studio';
import { $, TAGS, button, confirmButton, el, saveBlob, toast } from './ui';

export interface EditorApi {
  skin: SkinCanvas;
  getSlim(): boolean;
  /** Lädt einen Skin in den Editor; id = null heißt „neuer, noch nicht gespeicherter Skin“. */
  load(png: string, slim: boolean, id: string | null): Promise<void>;
  currentId(): string | null;
  setCurrentId(id: string | null): void;
  isDirty(): boolean;
  markSaved(): void;
}

export function initGallery(editor: EditorApi) {
  const saveDialog = $<HTMLDialogElement>('#save-dialog');
  const galleryDialog = $<HTMLDialogElement>('#gallery-dialog');
  const nameInput = $<HTMLInputElement>('#save-name');
  const tagBox = $('#save-tags');
  const grid = $('#gallery-grid');
  const filterBox = $('#gallery-filter');
  let selectedTags = new Set<string>();
  let filter: string | null = null;

  // ---------- Speichern ----------

  for (const tag of TAGS) {
    const b = button(
      tag,
      () => {
        if (selectedTags.has(tag)) selectedTags.delete(tag);
        else selectedTags.add(tag);
        b.classList.toggle('active', selectedTags.has(tag));
      },
      'chip',
    );
    b.dataset.tag = tag;
    tagBox.append(b);
  }

  async function openSave() {
    const current = editor.currentId() ? await getSkin(editor.currentId()!) : undefined;
    const count = (await listSkins()).length;
    nameInput.value = current?.name ?? `Mein Skin ${count + 1}`;
    selectedTags = new Set(current?.tags ?? []);
    tagBox
      .querySelectorAll<HTMLButtonElement>('.chip')
      .forEach((b) => b.classList.toggle('active', selectedTags.has(b.dataset.tag!)));
    $('#btn-save-copy').hidden = !current;
    $('#btn-save-confirm').textContent = current ? '💾 Überschreiben' : '💾 Speichern';
    $<HTMLImageElement>('#save-preview').src = renderThumbnail(editor.skin.canvas, editor.getSlim());
    saveDialog.showModal();
  }

  async function store(asNew: boolean) {
    const name = nameInput.value.trim().slice(0, 40) || 'Ohne Namen';
    const existing = !asNew && editor.currentId() ? await getSkin(editor.currentId()!) : undefined;
    const now = Date.now();
    const record: StoredSkin = {
      id: existing?.id ?? newId(),
      name,
      png: editor.skin.canvas.toDataURL('image/png'),
      thumb: renderThumbnail(editor.skin.canvas, editor.getSlim()),
      slim: editor.getSlim(),
      tags: [...selectedTags],
      created: existing?.created ?? now,
      updated: now,
    };
    try {
      await putSkin(record);
    } catch {
      toast('Speichern hat nicht geklappt – ist der Speicher voll?');
      return;
    }
    editor.setCurrentId(record.id);
    editor.markSaved();
    saveDialog.close();
    toast(`„${name}“ ist in der Galerie 🎉`);
  }

  $('#btn-save').addEventListener('click', openSave);
  $('#btn-save-confirm').addEventListener('click', () => store(false));
  $('#btn-save-copy').addEventListener('click', () => store(true));
  $('#btn-save-cancel').addEventListener('click', () => saveDialog.close());
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') store(false);
  });

  // ---------- Galerie ----------

  async function render() {
    const skins = await listSkins();
    const used = TAGS.filter((t) => skins.some((s) => s.tags.includes(t)));
    if (filter && !used.includes(filter)) filter = null;

    filterBox.replaceChildren(
      ...[null, ...used].map((t) => {
        const b = button(
          t ?? 'Alle',
          () => {
            filter = t;
            render();
          },
          'chip',
        );
        b.classList.toggle('active', t === filter);
        return b;
      }),
    );
    filterBox.hidden = used.length === 0;
    $('#gallery-count').textContent = skins.length === 1 ? '1 Skin' : `${skins.length} Skins`;

    const shown = filter ? skins.filter((s) => s.tags.includes(filter!)) : skins;
    if (!skins.length) {
      grid.replaceChildren(
        el('p', {
          className: 'empty',
          innerHTML: 'Noch keine Skins gespeichert.<br>Tippe oben auf <b>💾 Speichern</b>, dann landet dein Skin hier.',
        }),
      );
      return;
    }
    grid.replaceChildren(...shown.map(card));
  }

  function card(s: StoredSkin): HTMLElement {
    const isCurrent = s.id === editor.currentId();
    const open = async (asCopy: boolean) => {
      await editor.load(s.png, s.slim, asCopy ? null : s.id);
      galleryDialog.close();
      toast(asCopy ? `Kopie von „${s.name}“ – speichere sie unter neuem Namen` : `„${s.name}“ geöffnet`);
    };

    // Ungespeicherte Änderungen nicht stillschweigend verwerfen.
    const guarded = (html: string, asCopy: boolean, className: string) =>
      editor.isDirty() && !isCurrent
        ? confirmButton(html, () => open(asCopy), className)
        : button(html, () => open(asCopy), className);

    return el(
      'article',
      { className: 'skin-card' + (isCurrent ? ' current' : '') },
      el('div', { className: 'thumb' }, el('img', { src: s.thumb, alt: s.name, loading: 'lazy' })),
      el('h3', {}, s.name),
      el('div', { className: 'tags' }, ...s.tags.map((t) => el('span', {}, t))),
      el(
        'div',
        { className: 'actions' },
        guarded('✏️ Öffnen', false, 'primary'),
        guarded('📄', true, 'icon-sm'),
        button('⬇️', async () => saveBlob(await (await fetch(s.png)).blob(), `${fileName(s.name)}.png`), 'icon-sm'),
        confirmButton(
          '🗑️',
          async () => {
            await deleteSkin(s.id);
            if (isCurrent) editor.setCurrentId(null);
            render();
            toast(`„${s.name}“ gelöscht`);
          },
          'icon-sm',
        ),
      ),
    );
  }

  $('#btn-gallery').addEventListener('click', async () => {
    await render();
    galleryDialog.showModal();
  });
  $('#btn-gallery-close').addEventListener('click', () => galleryDialog.close());
  $('#btn-gallery-new').addEventListener('click', async () => {
    const blank = document.createElement('canvas');
    blank.width = blank.height = 64;
    await editor.load(blank.toDataURL('image/png'), editor.getSlim(), null);
    galleryDialog.close();
    toast('Neuer leerer Skin – viel Spaß!');
  });

  // Klick auf den abgedunkelten Hintergrund schließt die Dialoge.
  for (const d of [saveDialog, galleryDialog]) {
    d.addEventListener('click', (e) => {
      if (e.target === d) d.close();
    });
  }
}

function fileName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[äöüß]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' })[c]!)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'skin'
  );
}
