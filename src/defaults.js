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

// Fiktive Beispiel-Nachbarschaft
export const SAMPLE_PARTICIPANTS = [
  { id: 'a', name: 'Haus A', verbrauch: 4500, pv: 10, wp: false, ev: false },
  { id: 'b', name: 'Haus B', verbrauch: 9500, pv: 15, wp: true, ev: false },
  { id: 'c', name: 'Haus C', verbrauch: 6500, pv: 8, wp: false, ev: true },
  { id: 'd', name: 'Haus D', verbrauch: 4500, pv: 0, wp: false, ev: false },
  { id: 'e', name: 'Haus E', verbrauch: 3500, pv: 0, wp: false, ev: false },
  { id: 'f', name: 'Haus F', verbrauch: 8000, pv: 0, wp: true, ev: false },
  { id: 'g', name: 'Wohnung G', verbrauch: 2500, pv: 0, wp: false, ev: false },
  { id: 'h', name: 'Haus H', verbrauch: 6000, pv: 0, wp: false, ev: true },
];
