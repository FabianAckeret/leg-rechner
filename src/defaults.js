// Standardwerte. Alle Preise in Rappen pro kWh exkl. MWST, sofern nicht anders vermerkt.
// Quelle Tarife: IBB Energie AG, Preisblatt «Strompreise Basis 2026», Produkt IBB-Erneuerbar.

export const DEFAULT_TARIFF = {
  energie: 12.11, // Energiepreis IBB-Erneuerbar
  netz: 7.96, // Netznutzung (Arbeitspreis) – darauf gilt der LEG-Rabatt
  sdl: 0.27, // Systemdienstleistungen Swissgrid
  stromreserve: 0.41, // Winterreserve
  solidarisiert: 0.05, // solidarisierte Kosten Übertragungsnetz
  netzzuschlag: 2.3, // Netzzuschlag Bund (Förderung erneuerbare Energien)
  konzession: 0.52, // Konzessionsabgabe Gemeinde
  grundpreisMonat: 5.5, // CHF pro Monat und Zähler
  messpreisMonat: 6.5, // CHF pro Monat und Zähler
  rueckliefer: 6.0, // Annahme: Minimalvergütung PV < 30 kW ab 2026 – bitte mit IBB-Preisblatt prüfen
  mwst: 8.1,
};

export const DEFAULT_LEG = {
  rabatt: 40, // % auf Netznutzung: 40 % (nur Netzebene 7) oder 20 % (mit Transformation)
  preis: 10.0, // interner LEG-Energiepreis in Rp./kWh, von den Teilnehmenden festgelegt
  initialkosten: 600, // CHF einmalig (Annahme)
  jahreskosten: 0, // CHF pro Jahr für Verwaltung/Dienstleister (Admin übernimmt André)
  mutationGebuehr: 50, // CHF pro Mutation (Annahme – IBB-Preis erfragen)
  mutationenProJahr: 2,
  inklMwst: false,
};

let nextId = 1;
export const newId = () => `p${Date.now().toString(36)}${nextId++}`;

export const STREET = 'Fluhmattstrasse';
export const PLACE = '5222 Umiken';

// Alle Adressen der Fluhmattstrasse gemäss amtlichem Gebäudeadressverzeichnis (geo.admin.ch).
// Verbrauch, PV, Wärmepumpe und E-Auto sind BEISPIELWERTE (beispiel: true), bis jemand echte Werte erfasst.
const ex = (nr, verbrauch, pv = 0, wp = false, ev = false) => ({
  id: `fm-${nr}`, name: `${STREET} ${nr}`, verbrauch, pv, wp, ev, beispiel: true,
});
export const SAMPLE_PARTICIPANTS = [
  ex('1a', 4000), ex('1b', 3800, 0, false, true), ex('1c', 4200, 8), ex('1d', 3600),
  ex('1e', 4400), ex('1f', 4000),
  ex('3', 6500, 10, true), ex('5', 5200), ex('6', 9000, 15, true),
  ex('8', 4500), ex('10', 6000, 0, false, true), ex('12', 5500, 9),
  ex('14', 8000, 0, true), ex('16', 4800), ex('16.1', 2500), ex('18', 7000, 12, false, true),
];

// Kurzer Name für enge Darstellungen (z. B. «1a» statt «Fluhmattstrasse 1a»)
export const shortName = (name) => {
  const m = String(name).match(/(\d+[\w.]*)\s*$/);
  return m ? m[1] : String(name).slice(0, 8);
};
