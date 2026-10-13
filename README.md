# Quartierstrom – LEG-Rechner

Web-App, mit der unsere Nachbarschaft prüfen kann, ob sich eine **Lokale Elektrizitätsgemeinschaft (LEG)** lohnt.

- **So funktioniert’s:** Erklärseite – was eine LEG ist, warum nicht vZEV, wie der Strom verteilt wird, was eine kWh kostet, wer profitiert.
- **Animation:** Ein Sommer-, Frühlings- oder Wintertag im Quartier mit animierten Energieflüssen (Eigenverbrauch → Nachbarn → IBB).
- **Rechner:** Teilnehmende, Tarife und LEG-Kosten erfassen; Simulation über alle 8760 Stunden eines Jahres, Ergebnis pro Haus.

Alles läuft im Browser. Eingaben werden lokal gespeichert (localStorage), Messdaten-Dateien verlassen den Browser nicht.

## Rechenmodell

Pro Stunde und Haus:

1. Eigener Solarstrom deckt zuerst den eigenen Verbrauch.
2. Überschüsse aller Produzenten werden proportional auf den Restbedarf der übrigen verteilt (dynamischer Verteilschlüssel).
3. Restbedarf kommt von der IBB, Restüberschuss geht zur Rückliefervergütung an die IBB.

Kosten LEG-Strom für Bezüger = LEG-Preis + Netznutzung × (1 − Rabatt) + volle Abgaben. Der LEG-Preis geht an die Produzenten.
LEG-Jahreskosten (Verwaltung, IBB-Mutationsgebühren) werden gleichmässig verteilt.

Ohne Messdaten werden typische Profile simuliert (PV ~1000 kWh/kWp, Haushalt, Wärmepumpe, E-Auto).
Messdaten können pro Haus als CSV geladen werden (15-Minuten- oder Stundenwerte, Spalten `zeitpunkt;verbrauch_kwh;produktion_kwh`).

## Standardwerte

| Wert | Quelle |
|---|---|
| Energie 12.11, Netz 7.96, Abgaben 3.55 Rp./kWh, Grund- 5.50 und Messpreis 6.50 CHF/Mt. | IBB Preisblatt «Strompreise Basis 2026», IBB-Erneuerbar, exkl. MWST |
| Netzrabatt 40 % / 20 % | StromVG Art. 17e, StromVV Art. 19h |
| Rückliefervergütung 6.0 Rp./kWh | **Annahme** (Minimalvergütung) – IBB-Preisblatt «Vergütung Stromproduzenten 2026» prüfen |
| LEG-Preis 10 Rp., Initialkosten 600 CHF, Mutationsgebühr 50 CHF | **Annahmen**, im Rechner anpassbar |

## Entwicklung

```bash
npm install
npm run dev          # lokale Entwicklung
npm run build        # Build für GitHub Pages (dist/)
npm run build:single # alles in einer HTML-Datei (dist-single/index.html)
```

Deployment auf GitHub Pages läuft automatisch über `.github/workflows/deploy.yml` bei jedem Push auf `main`
(einmalig unter *Settings → Pages → Source* «GitHub Actions» wählen).

Alle Angaben ohne Gewähr. Die Berechnung ist eine Abschätzung und ersetzt keine Offerte der IBB.
