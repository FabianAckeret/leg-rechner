# Quartierstrom – LEG-Rechner

Web-App, mit der die Nachbarschaft an der Fluhmattstrasse in 5222 Umiken prüfen kann, ob sich eine **Lokale Elektrizitätsgemeinschaft (LEG)** lohnt.

- **So funktioniert’s:** Erklärseite – was eine LEG ist, warum nicht vZEV, wie der Strom verteilt wird, was eine kWh kostet, wer profitiert.
- **Animation:** Ein Sommer-, Frühlings- oder Wintertag im Quartier mit animierten Energieflüssen (Eigenverbrauch → Nachbarn → IBB).
- **Rechner:** Teilnehmende, Tarife und LEG-Kosten erfassen; Simulation über alle 8760 Stunden eines Jahres, Ergebnis pro Haus.

Vorerfasst sind alle Adressen der Fluhmattstrasse gemäss amtlichem Gebäudeadressverzeichnis (geo.admin.ch). Solange ein Haus keine Angaben erfasst hat, rechnet der Rechner mit Beispielwerten.

## Gemeinsame Daten

Jedes Haus erhält einen persönlichen Link (`…/leg-rechner/?key=<token>#rechner`). Damit erfasst es Teilnahme, Jahresverbrauch, PV-Leistung, Wärmepumpe und E-Auto. Die Angaben liegen in einer Supabase-Datenbank (Free Tier, Region Zürich, Projekt `leg-rechner`).

- Die Berechnung läuft in der Edge Function `simulate` (`supabase/functions/simulate/index.ts`, nutzt `src/engine.js`). Der Browser erhält nur Summen über die Strasse (gerundet auf 1000 kWh und 10 CHF), die Anzahl Zusagen und mit Link das Ergebnis des eigenen Hauses.
- Echte Angaben fliessen erst ein, wenn mindestens drei andere Häuser mitmachen. Bis dahin rechnet der Server mit Beispielwerten.
- Speichern verlangt beim ersten Mal die Einwilligung zum Datenschutzhinweis (Seite `#datenschutz`). «Mache nicht mit» löscht die Werte, **Meine Angaben löschen** setzt das Haus ganz zurück.
- Schreiben und Lesen des eigenen Hauses gehen nur über `save_household`, `get_household` und `clear_household` mit gültigem Token. Die Tabelle `households` ist für anonyme Zugriffe gesperrt (RLS ohne Policies).
- Die Animation zeigt erfundene Beispielhäuser («Haus A», «Haus B» …), nie echte Angaben.
- Tarife und LEG-Einstellungen bleiben pro Browser (localStorage). Messdaten-Dateien gehen nur zur Berechnung an den Server und werden nicht gespeichert.
- Edge Function nach Änderungen an `src/engine.js`, `src/profiles.js` oder `src/defaults.js` neu deployen: `npx supabase functions deploy simulate --no-verify-jwt --project-ref rdrtyknlrihvyvsitkig`
- Links neu auflisten: im Supabase SQL-Editor `select address, 'https://fabianackeret.github.io/leg-rechner/?key=' || edit_token || '#rechner' from households order by sort;`
- Link eines Hauses ersetzen: `update households set edit_token = encode(extensions.gen_random_bytes(16), 'hex') where id = 'fm-6';`
- Weitere Adresse: `insert into households (id, address, sort) values ('fm-20', 'Fluhmattstrasse 20', 17);`

Supabase pausiert Free-Projekte nach etwa einer Woche ohne Zugriffe. Dann zeigt die Seite Beispielwerte, bis das Projekt im Supabase-Dashboard wieder gestartet ist.

## Rechenmodell

Pro Stunde und Haus:

1. Eigener Solarstrom deckt zuerst den eigenen Verbrauch.
2. Überschüsse aller Produzenten werden proportional auf den Restbedarf der übrigen verteilt (dynamischer Verteilschlüssel).
3. Restbedarf kommt von der IBB, Restüberschuss geht zur Abnahmevergütung an die IBB (nach Anlagenleistung und Saison).

Kosten LEG-Strom für Bezüger = LEG-Preis + Netznutzung × (1 − Rabatt) + volle Abgaben. Der LEG-Preis geht an die Produzenten, abzüglich der IBB-Gebühr pro kWh.
Die IBB-Abrechnungsgebühr trägt jedes Haus für seine eigenen Messpunkte (ein Haus mit PV-Anlage zählt mit zwei). Verwaltung und Mutationen werden gleichmässig verteilt.
Die Amortisation rechnet mit den einmaligen IBB-Einrichtungspauschalen.

Ohne Messdaten werden typische Profile simuliert (PV ~1000 kWh/kWp, Haushalt, Wärmepumpe, E-Auto).
Messdaten können pro Haus als CSV geladen werden (15-Minuten- oder Stundenwerte ab 1. Januar 00:00, Spalten `verbrauch_kwh;produktion_kwh`).

## Standardwerte

| Wert | Quelle |
|---|---|
| Energie 12.11, Netz 7.96, Abgaben 3.55 Rp./kWh, Grund- 5.50 und Messpreis 6.50 CHF/Mt. | IBB Preisblatt «Strompreise Basis 2026», IBB-Erneuerbar, exkl. MWST |
| Netzrabatt 40 % (alle am selben Trafokreis) / 20 % | StromVG Art. 17e, StromVV Art. 19h, IBB-Preisblatt LEGPLUS |
| Einrichtung 350 CHF pro LEG, 150 CHF pro PV-Anlage, 25 CHF pro Messpunkt; Beratung 500 CHF (optional); Abrechnung 2.75 CHF pro Messpunkt und Monat plus 1.00 Rp./kWh LEG-Strom; Mutation 95 CHF | IBB Preisblatt «Preise für LEGPLUS» ab 1.1.2026, exkl. MWST |
| Zwei Messpunkte pro Haus mit PV-Anlage | **Annahme** – bei der IBB bestätigen |
| Abnahmevergütung ab 1.1.2027: bis 2 kW 10.0; 2–30 kW Winter 13.0 / Sommer 8.0; 30–150 kW Winter 11.0 / Sommer 6.0 Rp./kWh (Winter = Okt–Mär) | IBB Preisblatt «Abnahmevergütung 2027», exkl. MWST, Festpreis. Dafür müssen die Herkunftsnachweise an die IBB gehen; die Marktpreis-Variante (und Anlagen ab 150 kW) sind nicht gerechnet |
| LEG-Preis 10 Rp., 1 Ein- oder Austritt pro Jahr | **Annahmen**, im Rechner anpassbar |

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
