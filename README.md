# NEON POUR: Afterdark — WebXR Edition

**Version 0.5.0**

Ein GitHub-Pages-kompatibler Cyberpunk-Barkeeper-Prototyp für Desktop und Meta Quest Browser.

## Veröffentlichung

1. Alle Dateien aus diesem Ordner in das Stammverzeichnis eines GitHub-Repositories hochladen.
2. In GitHub unter **Settings → Pages**:
   - Source: **Deploy from a branch**
   - Branch: **main**
   - Folder: **/(root)**
3. Die veröffentlichte HTTPS-Adresse im Meta Quest Browser öffnen.
4. Auf **In VR starten** drücken.

## Dateien

- `index.html`
- `styles.v0.5.0.css`
- `game.v0.5.0.js`

Die Versionsnummer ist sichtbar auf der Startseite und in der Spieloberfläche. Ein Versionsparameter in der URL ist nicht erforderlich.

## Bedienung

### Desktop
- Linke Maustaste und Mausbewegung: Kamera
- Mausrad: Zoom
- Bedienung über das rechte Interface

### Meta Quest
- Die Seite im Quest Browser öffnen
- **In VR starten**
- In dieser Version bleibt die Gameplay-Steuerung als 2D-HUD verfügbar; echte direkte Handinteraktion mit Flaschen und Shaker ist der nächste Entwicklungsschritt.

## Enthalten

- Cyberpunk-Bar mit Nebel, Neonlicht und PBR-Materialien
- Rezept-Tablet mit drei Drinks
- sichtbarer Shaker- und Glasfüllstand
- dynamische Farbmischung
- sichtbarer Gießstrahl
- Eiswürfel
- Schüttelanimation
- Punktesystem
- Desktop- und WebXR-Start
- keine Build-Pipeline notwendig

## Wichtige Einschränkung

Diese Version ist ein WebXR-Vertical-Slice. Hochwertige, fotorealistische Figuren und AAA-Assets sind ohne externe 3D-Modelle, Texturen, Animationen und Audio nicht im ZIP enthalten. Die Spielstruktur ist aber vollständig GitHub-Pages-kompatibel.
