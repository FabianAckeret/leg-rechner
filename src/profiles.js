// Synthetische Stundenprofile für ein Jahr (8760 Stunden, Standort Mittelland ~47.5° N).
// Ziel: realistische Grössenordnung und Tages-/Saisonverlauf, keine exakte Prognose.

export const HOURS = 8760;
const LAT = (47.48 * Math.PI) / 180;
const PV_YIELD = 1000; // kWh pro kWp und Jahr (typisch Mittelland)

// Deterministischer Zufallsgenerator, damit Beispieldaten stabil bleiben
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

let pvCache = null;
// Normiertes PV-Profil für 1 kWp (Summe = PV_YIELD)
export function pvProfile() {
  if (pvCache) return pvCache;
  const r = rng(20260101);
  const out = new Float64Array(HOURS);
  let cloud = 0.6;
  for (let d = 0; d < 365; d++) {
    const decl = (23.44 * Math.PI) / 180 * Math.sin((2 * Math.PI * (284 + d + 1)) / 365);
    // Bewölkung: Winter (Nebel) trüber, Sommer klarer; Wetterlagen halten einige Tage an
    const season = 0.5 - 0.5 * Math.cos((2 * Math.PI * (d - 15)) / 365); // 0 Winter … 1 Sommer
    const meanClear = 0.38 + 0.4 * season;
    cloud = 0.55 * cloud + 0.45 * Math.min(1, Math.max(0.05, meanClear + (r() - 0.5) * 0.9));
    for (let h = 0; h < 24; h++) {
      const solarHour = h + 0.5 - 12.6; // Sonnenmittag ~12:36 MEZ (DST ignoriert)
      const ha = (solarHour * 15 * Math.PI) / 180;
      const sinEl = Math.sin(LAT) * Math.sin(decl) + Math.cos(LAT) * Math.cos(decl) * Math.cos(ha);
      out[d * 24 + h] = sinEl > 0 ? Math.pow(sinEl, 1.25) * (0.15 + 0.85 * cloud) : 0;
    }
  }
  const sum = out.reduce((a, b) => a + b, 0);
  for (let i = 0; i < HOURS; i++) out[i] *= PV_YIELD / sum;
  pvCache = out;
  return out;
}

// Tagesform Haushalt (relativ), Werktag und Wochenende
const HH_WEEK = [0.3, 0.25, 0.22, 0.22, 0.24, 0.35, 0.7, 0.95, 0.8, 0.6, 0.55, 0.65, 0.8, 0.65, 0.55, 0.55, 0.65, 0.9, 1.2, 1.3, 1.15, 0.95, 0.7, 0.45];
const HH_WEEKEND = [0.35, 0.28, 0.24, 0.22, 0.22, 0.25, 0.35, 0.55, 0.85, 1.0, 1.0, 1.1, 1.15, 0.9, 0.75, 0.7, 0.75, 0.95, 1.2, 1.25, 1.1, 0.95, 0.75, 0.5];
// Wärmepumpe: eher flach, mehr nachts/morgens
const WP_SHAPE = [1.1, 1.1, 1.1, 1.15, 1.2, 1.25, 1.3, 1.2, 1.0, 0.85, 0.75, 0.7, 0.65, 0.65, 0.7, 0.75, 0.85, 0.95, 1.0, 1.05, 1.05, 1.05, 1.1, 1.1];
// E-Auto: Laden abends nach Feierabend
const EV_SHAPE = [0.4, 0.2, 0.1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.3, 1.2, 1.5, 1.5, 1.3, 1.0, 0.7];

function normalize(arr, total) {
  const s = arr.reduce((a, b) => a + b, 0) || 1;
  for (let i = 0; i < arr.length; i++) arr[i] *= total / s;
  return arr;
}

// Verbrauchsprofil eines Teilnehmers (kWh pro Stunde)
export function loadProfile(p) {
  const r = rng(hashStr(p.id + p.name));
  const total = Math.max(0, +p.verbrauch || 0);
  const evKwh = p.ev ? Math.min(2500, total * 0.3) : 0;
  const wpKwh = p.wp ? (total - evKwh) * 0.55 : 0;
  const baseKwh = total - evKwh - wpKwh;
  const base = new Float64Array(HOURS);
  const wp = new Float64Array(HOURS);
  const ev = new Float64Array(HOURS);
  for (let d = 0; d < 365; d++) {
    const weekday = (d + 3) % 7; // 1.1.2026 = Donnerstag → 0 = Montag
    const weekend = weekday >= 5;
    const seasonal = 1 + 0.22 * Math.cos((2 * Math.PI * (d - 15)) / 365); // Winter mehr
    const temp = 9.5 - 9.5 * Math.cos((2 * Math.PI * (d - 20)) / 365); // Tagesmittel °C
    const heat = Math.max(0, 16 - temp) + 0.9; // Heizgradtage + Warmwasser
    const evDay = r() < 0.6 ? 1 : 0.2;
    for (let h = 0; h < 24; h++) {
      const i = d * 24 + h;
      const noise = 0.8 + 0.4 * r();
      base[i] = (weekend ? HH_WEEKEND : HH_WEEK)[h] * seasonal * noise;
      wp[i] = WP_SHAPE[h] * heat * (0.85 + 0.3 * r());
      ev[i] = EV_SHAPE[h] * evDay;
    }
  }
  normalize(base, baseKwh);
  normalize(wp, wpKwh);
  normalize(ev, evKwh);
  const out = new Float64Array(HOURS);
  for (let i = 0; i < HOURS; i++) out[i] = base[i] + wp[i] + ev[i];
  return out;
}

export function productionProfile(p) {
  const kwp = Math.max(0, +p.pv || 0);
  const norm = pvProfile();
  const out = new Float64Array(HOURS);
  for (let i = 0; i < HOURS; i++) out[i] = norm[i] * kwp;
  return out;
}
