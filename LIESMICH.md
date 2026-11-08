# Der Boden ist Lava! 🌋

Ein Hüpfspiel fürs iPad: Von Möbel zu Möbel springen, Sterne sammeln, das Ziel erreichen – und bloß nicht den Boden berühren.

- 12 Level in 4 Räumen (Wohnzimmer, Kinderzimmer, Garten, Spielplatz)
- Sinkende Kissen, Trampoline (2 Felder weit springen), fahrende Rollbretter
- Profile mit Figurenauswahl, Sterne werden auf der Synology gespeichert
- 2-Spieler-Wettrennen an einem iPad (nebeneinander oder gegenüber sitzend)
- Geräusche und Musik, beide abschaltbar

## Auf der Synology installieren

1. Den Ordner `lava-spiel` z. B. nach `/volume1/docker/lava-spiel` kopieren.
2. **Container Manager → Projekt → Erstellen**
   - Name: `lava-spiel`
   - Pfad: `/docker/lava-spiel`
   - Quelle: „Vorhandene docker-compose.yml verwenden“
3. Fertigstellen – das Spiel läuft dann unter `http://<IP-der-Synology>:3040`.
4. Optional: Im Reverse Proxy (Systemsteuerung → Anmeldeportal → Erweitert) eine HTTPS-Adresse auf Port 3040 einrichten, wie bei deinen anderen Spielen.

**Aufs iPad legen:** Seite in Safari öffnen → Teilen → „Zum Home-Bildschirm“. Dann startet das Spiel im Vollbild wie eine App.

## Änderungen ohne Neubau

Die Ordner `public/` und `data/` sowie `server.js` sind live in den Container eingehängt:

| Was geändert?                    | Was tun?                              |
|----------------------------------|---------------------------------------|
| Bilder, Level, `config.js`        | Im Browser neu laden – fertig         |
| `server.js`                       | Container neu starten                 |
| `Dockerfile` / `docker-compose.yml` | Projekt neu erstellen               |

Die Spielstände liegen in `data/spielstand.json`. Zum Zurücksetzen einfach die Datei löschen und den Container neu starten.

## Eigene Bilder einsetzen

1. Bilder in `public/bilder/` ablegen (am besten quadratische PNGs mit durchsichtigem Hintergrund, ca. 256 × 256 Pixel).
2. In `public/config.js` den Dateinamen eintragen, z. B.:

```js
figuren: [
  { name: 'Meine Figur', bild: 'bilder/figuren/meine-figur.png', farbe: '#3d7be0' },
  ...
],
bilder: {
  moebel: { wohnzimmer: 'bilder/sofa.png', ... },
  kissen: 'bilder/kissen.png',
  ...
  titelbild: 'bilder/titel.png',
},
```

Leere Felder (`''`) bedeuten: Das Spiel zeichnet die Grafik selbst.
Figuren werden rund ausgeschnitten, das Motiv sollte also mittig sitzen.
Eigene Musik: MP3 in `public/musik/` legen und bei `musik:` eintragen.

## Eigene Level bauen

In `public/levels.js` steht jedes Level als kleine Karte aus Zeichen:

```
.  Lava      #  Möbel     K  Kissen (sinkt)    T  Trampolin
S  Start     Z  Ziel      *  Stern auf Möbel   +  Stern auf Kissen
```

Rollbretter fahren in einer reinen Lava-Zeile: `bretter: [{ zeile: 2, von: 0, bis: 6, takt: 1000 }]`.
Jede Zeile muss gleich lang sein. Neue Level einfach hinten anhängen.
