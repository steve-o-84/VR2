# Velvet Hour Bartender VR — v0.3.1

WebXR-Prototyp für Desktop und Meta Quest Browser.

## Wichtig beim Aktualisieren

Alle Dateien aus diesem Ordner gemeinsam hochladen. Version 0.3.1 verwendet einen eindeutig versionierten JavaScript-Dateinamen, damit GitHub Pages und der Quest Browser keine alten Dateien mit einer neuen Startseite vermischen.

# Velvet Hour — Bartender VR

**Aktuelle Version: 0.3.0**

Spielbarer WebXR-Vertical-Slice für Meta Quest und Desktop-Browser. Die Versionsnummer steht direkt auf der Startseite und zusätzlich in der oberen Desktop-Leiste sowie auf den VR-Panels.

## Desktop

`index.html` über einen lokalen Webserver oder GitHub Pages öffnen. Danach **Am Bildschirm spielen** wählen. Die komplette Bedienung erfolgt über die sichtbaren Schaltflächen; die 3D-Kamera lässt sich mit gedrückter Maustaste drehen und mit dem Mausrad zoomen.

## Meta Quest

Die Seite über HTTPS im Quest Browser öffnen und **Auf Meta Quest spielen** wählen. Danach unten rechts **ENTER VR** drücken.

- Beide Controller besitzen einen Laserpointer.
- Mit dem Trigger werden räumliche Buttons ausgewählt.
- Hover-Markierung zeigt das aktuell anvisierte Element.
- Eine kurze Controller-Vibration bestätigt jede Auswahl.
- Rezeptbuch, Gastdialog, Gläser, Zutaten, Eis, Shaken, Leeren und Servieren sind vollständig in VR bedienbar.
- Die räumlichen Panels sind als Halbkreis hinter der Bar angeordnet.

## GitHub Pages

1. Alle Dateien in ein Repository hochladen.
2. Settings → Pages öffnen.
3. Deploy from a branch, `main`, `/(root)` auswählen.
4. Die veröffentlichte HTTPS-Adresse im Quest Browser öffnen.

## Inhalt

- Drei Gäste und drei Cocktailrezepte
- Dialogentscheidungen mit Reputationspunkten
- Gläser, Zutaten, Eis, Shaken und Servieren
- Detaillierte Drink-Auswertung
- Vollständige Desktop-Oberfläche
- Vollständige räumliche Quest-Oberfläche
- Controller-Haptik und Hover-Feedback

Three.js wird über jsDelivr geladen; beim ersten Start ist daher eine Internetverbindung erforderlich.
