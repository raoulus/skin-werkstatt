# Projektplan Skin-Werkstatt

Stand: 25.10.2026 (zuletzt aktualisiert nach Schritt 4)

## Ausgangswunsch

- Minecraft-Skin-Editor, der auf dem **iPad** funktioniert
- Skins sollen **die Arme nach vorne** haben können (Wunsch des Sohns)
- Eine **coole 3D-Ansicht**
- Skins **komplett neu entwerfen** oder schneller **zufällig erzeugen**
- Skins in **Minecraft Bedrock auf dem iPad** importieren können, also herunterladen
- Eine **Webseite**, die man später hosten kann, mit einer **Galerie** aller erstellten Skins
- Gespielt wird vor allem auf dem **Hive-Server**

## Wichtige Rahmenbedingungen

### Arme nach vorne

Ein Minecraft-Skin ist nur ein 64×64-PNG, also eine Textur. **Die Pose legt das Spiel fest, nicht der Skin.**

- **In der 3D-Ansicht** geht jede Pose: Arme vorne, Zombie, Winken, Jubeln usw. ✅
- **Im Spiel mit normalem Skin**: nicht möglich.
- **Im Spiel per Resource Pack (.mcpack)**: Ein Pack könnte die Spieler-Animation ändern. Das wirkt
  aber nur in eigenen Welten und ist nur für den eigenen Spieler sichtbar. Ob es in der aktuellen
  Bedrock-Version zuverlässig klappt, muss getestet werden. Gilt als interessante Zusatzvariante.

### The Hive

Hive ist ein Bedrock-Server. Normale importierte Skins (klassische Skins, 64×64) werden dort
angezeigt, auch die äußere Schicht mit Hüten und Jacken. Ein Resource Pack für die Arm-Pose wirkt auf
Hive voraussichtlich **nicht**, weil Server eigene Packs und Animationen verwenden.

### Hüte

Hüte liegen auf der äußeren Kopfschicht, einem Würfel etwa einen halben Pixel um den Kopf.
Kappen, Mützen, Kronen, Helme und Masken gehen. Dinge, die weit abstehen (hoher Zylinder, breite
Krempe), gehen mit klassischen Skins nicht.

### Import in Bedrock (iPad)

Umkleide → Klassische Skins → Eigene → Neuen Skin wählen → Bild aus Fotos. Darum bietet die Seite
„In Fotos sichern“ über das Teilen-Menü von iOS an.

## Grundfunktionen

1. **3D-Editor** mit Three.js: mit einem Finger drehen, mit zwei Fingern zoomen, direkt aufs Modell
   malen. Dazu die 2D-Textur als Alternative.
2. **Werkzeuge**: Stift, Radierer, Füllen, Pipette, Spiegeln, zweite Schicht (Jacke/Hut) an und aus,
   Rückgängig/Wiederholen.
3. **Zufallsgenerator**: kombiniert Bausteine (Haare, Gesicht, Shirt, Hose, Schuhe, Accessoires) in
   passenden Farben. Einzelne Teile festhalten, den Rest neu würfeln.
4. **Download als PNG** für den Import in Minecraft.
5. **Galerie**: alle erstellten Skins mit 3D-Vorschau, als Vorlage übernehmen und herunterladen.

## Zusatzideen

- 🎲 **Zufallsthemen**: Ritter, Ninja, Astronaut, Roboter, Zombie, Pirat …
- 🧬 **Skins mischen**: Kopf von Skin A, Körper von Skin B
- 🎨 **Sticker und Stempel**: fertige Augen, Münder, Logos, Muster zum Draufklicken
- 🕺 **Animationen in der Vorschau**: laufen, winken, tanzen, Zombie-Arme. Export als GIF/Video.
- 🌍 **Vorschau-Hintergründe**: Wiese, Nether, Ende, Höhle
- 👕 **Slim oder klassisch**: 3-Pixel-Arme (Alex) oder 4-Pixel-Arme (Steve)
- ❤️ **Galerie mit Likes und Tags**, „Skin des Tages“
- 🔗 **QR-Code oder Teilen-Link** pro Skin
- 📱 **PWA**: zum Home-Bildschirm hinzufügen, funktioniert offline
- 👨‍👩‍👦 **Eltern-Freigabe** für die öffentliche Galerie
- 🎩 **Hüte** (später dazugekommen)

## Technik

- **Frontend**: Vite + TypeScript + Three.js, für Touch und iPad optimiert
- **Galerie, Stufe 1**: lokal im Browser (IndexedDB), ohne Server
- **Galerie, Stufe 2**: kleines Backend (z. B. Node + SQLite oder Cloudflare/Supabase), damit alle
  Skins für alle sichtbar sind
- **Hosting**: zunächst **GitHub Pages** als rein statische Seite (entschieden am 25.10.2026). Die
  Web-App braucht keinen Server. Über HTTPS funktionieren dort auch „In Fotos sichern“ und später die
  PWA. Eine Server-Galerie bräuchte ein separates Backend, das die Seite per API anspricht.

## Reihenfolge und Stand

| #   | Schritt                                       | Stand                                |
| --- | --------------------------------------------- | ------------------------------------ |
| 1   | 3D-Ansicht mit Posen, inkl. Arme nach vorne   | ✅ fertig                            |
| 2   | Malen auf dem Modell, Werkzeuge, PNG-Download | ✅ fertig                            |
| 3   | Zufallsgenerator mit Themen und Festhalten    | ✅ fertig (20 Themen)                |
| 4   | Lokale Galerie (IndexedDB)                    | ✅ fertig                            |
| 5   | Extras und Server-Galerie                     | 💤 später, auf Wunsch zurückgestellt |

### Bei Schritt 5 schon erledigt

- Slim/Classic-Umschalter
- Animationen in der Vorschau (ohne GIF-Export)
- Hüte
- Hintergrund „Wiese“ mit Grasblöcken
- Resource Pack (.mcpack) mit Posen: Arme vorne, Zombie-Wackeln, Arme hoch, Ein Arm vorne

### Lokale Galerie (Schritt 4)

- **💾 Speichern** mit Name und optionalen Schlagwörtern. Ein bereits gespeicherter Skin wird
  überschrieben oder als neuer Skin kopiert.
- **🖼️ Galerie** mit 3D-Vorschaubildern, Filter nach Schlagwort, Öffnen, Kopie als Vorlage,
  PNG-Download und Löschen (mit Rückfrage)
- Warnung beim Öffnen eines anderen Skins, wenn der aktuelle ungespeicherte Änderungen hat
- Gespeichert wird in IndexedDB, also nur auf diesem Gerät und in diesem Browser.

### Zurückgestellt (Schritt 5, später)

Am 25.10.2026 entschieden: erst mal nur die Galerie. Folgendes bleibt für später:

- Skins mischen, Sticker und Stempel
- GIF-/Video-Export
- Weitere Hintergründe (Nether, Ende, Höhle)
- QR-Code / Teilen-Link
- PWA (offline, Home-Bildschirm)
- Server-Galerie für alle mit Likes, Skin des Tages und Eltern-Freigabe (eigenes Backend nötig)
- GitHub-Actions-Workflow, der bei jedem Push automatisch auf GitHub Pages veröffentlicht

## Noch zu testen

- Import des exportierten PNG in Bedrock auf dem iPad
- Anzeige auf Hive
- Posen-Pack: Import per Dateien-App, Wirkung in eigenen Welten, Ego-Perspektive (Arm darf nicht stören)
- Malen per Touch auf dem iPad (Treffgenauigkeit, Spiegeln)
- Galerie auf dem iPad: Speichern, Vorschaubilder, Öffnen
