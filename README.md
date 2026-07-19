# Neon Night Bartender VR

Ein browserbasiertes WebXR-Barkeeper-Spiel für Meta Quest. Der Prototyp enthält eine atmosphärische 3D-Bar, drei Gäste, Dialogentscheidungen, ein Rezept-Tablet, verschiedene Gläser und Zutaten, Eis, Shaken, Servieren und ein Punktesystem.

## Spielen

1. Repository auf GitHub hochladen.
2. **Settings → Pages → Deploy from a branch** aktivieren.
3. `main` und `/(root)` auswählen.
4. Die HTTPS-Adresse im Meta Quest Browser öffnen.
5. **Bar öffnen** und danach **Enter VR** wählen.

WebXR benötigt für immersive Sitzungen HTTPS. GitHub Pages stellt HTTPS bereit.

## Steuerung

- **Quest:** Mit dem Controller zielen und Trigger drücken.
- **Desktop:** Mit der Maus zielen und klicken.

## Spielablauf

- Bestellung des Gasts lesen.
- Rezept auf dem Tablet prüfen.
- Glas auswählen, Zutaten und Eis hinzufügen, optional shaken.
- Währenddessen über die beiden Dialogoptionen mit dem Gast sprechen.
- Drink servieren und Punkte für Rezepttreue, Glas, Eis, Zubereitung und Gespräch sammeln.

## Technik

- Three.js über CDN
- WebXR Device API
- Keine Installation, kein Build-System, kein Backend

## Ausbauideen

3D-Modelle mit GLTF, Hand-Tracking, physisches Greifen und Ausgießen, Spracherkennung, Audio, mehr Rezepte, Schichten/Kampagne, Trinkgeld und persistente Highscores.
