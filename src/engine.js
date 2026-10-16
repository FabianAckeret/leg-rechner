import { HOURS, loadProfile, productionProfile } from './profiles.js';

export const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export const monthOfHour = (() => {
  const m = new Uint8Array(HOURS);
  let i = 0;
  MONTH_DAYS.forEach((days, mi) => { for (let k = 0; k < days * 24; k++) m[i++] = mi; });
  return m;
})();

export const abgabenSumme = (t) => t.sdl + t.stromreserve + t.solidarisiert + t.netzzuschlag + t.konzession;
export const netzbezugPreis = (t) => t.energie + t.netz + abgabenSumme(t);
// Was ein Bezüger für 1 kWh LEG-Strom bezahlt (Rp.)
export const legBezugPreis = (t, leg) => leg.preis + t.netz * (1 - leg.rabatt / 100) + abgabenSumme(t);

// Liefert Zeitreihen je Teilnehmer: eigene Messdaten (CSV) haben Vorrang vor Beispielprofil
export function seriesFor(p) {
  return {
    load: p.data?.load ?? loadProfile(p),
    pv: p.data?.pv ?? productionProfile(p),
  };
}

/**
 * Stündliche Simulation.
 * Reihenfolge pro Stunde und Teilnehmer:
 *  1. Eigenverbrauch: eigener Solarstrom deckt zuerst den eigenen Bedarf.
 *  2. LEG: Überschüsse aller Produzenten bilden einen Topf. Dieser wird
 *     proportional zum Restbedarf an die Bezüger verteilt (dynamischer Verteilschlüssel).
 *     Liefern mehrere Produzenten, wird proportional zum jeweiligen Überschuss abgerechnet.
 *  3. Netz: Restbedarf kommt von der IBB, Restüberschuss geht ins IBB-Netz.
 */
export function simulate(participants, tariff, leg, opts = {}) {
  const n = participants.length;
  const series = participants.map(seriesFor);
  const z = () => new Float64Array(n);
  const tot = { load: z(), pv: z(), self: z(), given: z(), received: z(), gridImport: z(), feedIn: z() };
  const monthly = MONTHS.map((m) => ({ monat: m, eigen: 0, leg: 0, netz: 0, einspeisung: 0, produktion: 0, verbrauch: 0 }));
  const keepHourly = opts.hourly;
  const hourly = keepHourly ? { given: [], received: [], gridImport: [], feedIn: [], self: [] } : null;
  if (keepHourly) for (const k in hourly) for (let i = 0; i < n; i++) hourly[k].push(new Float32Array(HOURS));

  const surplus = new Float64Array(n);
  const deficit = new Float64Array(n);
  for (let h = 0; h < HOURS; h++) {
    let S = 0, D = 0;
    for (let i = 0; i < n; i++) {
      const l = series[i].load[h], p = series[i].pv[h];
      const s = Math.min(l, p);
      surplus[i] = p - s; deficit[i] = l - s;
      S += surplus[i]; D += deficit[i];
      tot.load[i] += l; tot.pv[i] += p; tot.self[i] += s;
      if (keepHourly) hourly.self[i][h] = s;
    }
    const X = Math.min(S, D); // LEG-intern ausgetauschte Energie
    const fg = S > 0 ? X / S : 0, fr = D > 0 ? X / D : 0;
    const m = monthOfHour[h];
    for (let i = 0; i < n; i++) {
      const g = surplus[i] * fg, r = deficit[i] * fr;
      const gi = deficit[i] - r, fi = surplus[i] - g;
      tot.given[i] += g; tot.received[i] += r; tot.gridImport[i] += gi; tot.feedIn[i] += fi;
      monthly[m].eigen += Math.min(series[i].load[h], series[i].pv[h]);
      monthly[m].netz += gi; monthly[m].einspeisung += fi;
      monthly[m].produktion += series[i].pv[h]; monthly[m].verbrauch += series[i].load[h];
      if (keepHourly) {
        hourly.given[i][h] = g; hourly.received[i][h] = r;
        hourly.gridImport[i][h] = gi; hourly.feedIn[i][h] = fi;
      }
    }
    monthly[m].leg += X;
  }

  // Kosten (CHF pro Jahr)
  const mw = leg.inklMwst ? 1 + tariff.mwst / 100 : 1;
  const full = netzbezugPreis(tariff) * mw; // Rp/kWh, von IBB verrechnet
  const legNetzAbgaben = (tariff.netz * (1 - leg.rabatt / 100) + abgabenSumme(tariff)) * mw;
  const fix = (tariff.grundpreisMonat + tariff.messpreisMonat) * 12 * mw;

  // IBB-Gebühren LEGPLUS. Annahme: Ein Haus mit PV-Anlage zählt mit zwei Messpunkten (Bezug und Produktion).
  const anlagen = tot.pv.reduce((a, v) => a + (v > 0 ? 1 : 0), 0);
  const messpunkte = n + anlagen;
  const initialkosten = n ? (leg.einrichtungLeg + (leg.beratung ? leg.beratungKosten : 0)
    + leg.einrichtungAnlage * anlagen + leg.einrichtungMesspunkt * n) * mw : 0;
  const messpunktJahr = leg.messpunktMonat * 12 * mw;
  const gebuehrKwh = leg.gebuehrKwh * mw; // Rp., wird den Produzenten vom LEG-Erlös abgezogen
  // Verwaltung und Mutationen tragen alle gleich, die Messpunkt-Gebühr jedes Haus für seine eigenen Messpunkte
  const gemeinsam = leg.jahreskosten + leg.mutationGebuehr * leg.mutationenProJahr * mw;
  const legJahr = gemeinsam + messpunkte * messpunktJahr;
  const gemeinsamProKopf = n ? gemeinsam / n : 0;

  const rows = participants.map((p, i) => {
    const deficitTot = tot.gridImport[i] + tot.received[i];
    const surplusTot = tot.feedIn[i] + tot.given[i];
    const ohne = (deficitTot * full - surplusTot * tariff.rueckliefer) / 100 + fix;
    const legFix = gemeinsamProKopf + (tot.pv[i] > 0 ? 2 : 1) * messpunktJahr;
    const mit = (tot.gridImport[i] * full + tot.received[i] * (leg.preis + legNetzAbgaben)
      - tot.given[i] * (leg.preis - gebuehrKwh) - tot.feedIn[i] * tariff.rueckliefer) / 100 + fix + legFix;
    return {
      id: p.id, name: p.name, pvKwp: +p.pv || 0,
      verbrauch: tot.load[i], produktion: tot.pv[i], eigen: tot.self[i],
      geliefert: tot.given[i], bezogen: tot.received[i],
      netzbezug: tot.gridImport[i], einspeisung: tot.feedIn[i],
      kostenOhne: ohne, kostenMit: mit, ersparnis: ohne - mit,
      ersparnisBezug: tot.received[i] * (full - leg.preis - legNetzAbgaben) / 100,
      mehrerloesLieferung: tot.given[i] * (leg.preis - gebuehrKwh - tariff.rueckliefer) / 100,
    };
  });

  const sum = (k) => rows.reduce((a, r) => a + r[k], 0);
  // Brutto ist schon nach Abzug der kWh-Gebühr, netto zusätzlich nach den festen LEG-Kosten
  const ersparnisBrutto = sum('ersparnisBezug') + sum('mehrerloesLieferung');
  const ersparnisNetto = ersparnisBrutto - legJahr;
  const summary = {
    verbrauch: sum('verbrauch'), produktion: sum('produktion'), eigen: sum('eigen'),
    leg: sum('bezogen'), netzbezug: sum('netzbezug'), einspeisung: sum('einspeisung'),
    ersparnisBrutto, legJahr, ersparnisNetto,
    legGebuehrKwh: sum('geliefert') * gebuehrKwh / 100,
    initialkosten, messpunkte, anlagen,
    amortisationJahre: ersparnisNetto > 0 ? initialkosten / ersparnisNetto : Infinity,
  };
  summary.autarkieOhne = summary.verbrauch ? summary.eigen / summary.verbrauch : 0;
  summary.autarkieMit = summary.verbrauch ? (summary.eigen + summary.leg) / summary.verbrauch : 0;
  summary.legAnteilUeberschuss = summary.produktion - summary.eigen > 0 ? summary.leg / (summary.produktion - summary.eigen) : 0;

  monthly.forEach((m) => {
    for (const k of ['eigen', 'leg', 'netz', 'einspeisung', 'produktion', 'verbrauch']) m[k] = Math.round(m[k]);
  });

  return { rows, summary, monthly, hourly, series };
}

// Wählt einen sonnigen, typischen Tag rund um ein Zieldatum (Tag im Jahr)
export function pickDay(series, target) {
  let best = target, bestVal = -1;
  for (let d = target - 7; d <= target + 7; d++) {
    if (d < 0 || d > 364) continue;
    let v = 0;
    for (const s of series) for (let h = 0; h < 24; h++) v += s.pv[d * 24 + h];
    if (v > bestVal) { bestVal = v; best = d; }
  }
  return best;
}

export function parseCsv(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) throw new Error('Datei ist leer.');
  const sep = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';
  const head = lines[0].toLowerCase().split(sep);
  const hasHeader = head.some((c) => /[a-zäöü]/.test(c) && isNaN(parseFloat(c.replace(',', '.'))));
  const rows = (hasHeader ? lines.slice(1) : lines).map((l) => l.split(sep));
  let iLoad = head.findIndex((c) => /verbr|bezug|load|consum/.test(c));
  let iPv = head.findIndex((c) => /prod|pv|solar|einspeis/.test(c));
  if (!hasHeader || iLoad < 0) {
    // Fallback: erste Spalte Zeit, zweite Verbrauch, dritte Produktion
    const numericFirst = !isNaN(parseFloat((rows[0][0] || '').replace(',', '.'))) && rows[0].length <= 2;
    iLoad = numericFirst ? 0 : 1;
    iPv = rows[0].length > iLoad + 1 ? iLoad + 1 : -1;
  }
  const num = (v) => { const x = parseFloat(String(v ?? '').replace(/'/g, '').replace(',', '.')); return isFinite(x) ? x : 0; };
  const load = rows.map((r) => num(r[iLoad]));
  const pv = iPv >= 0 ? rows.map((r) => num(r[iPv])) : null;
  const step = rows.length > 20000 ? 4 : 1; // 15-Minuten-Werte zu Stunden zusammenfassen
  const agg = (arr) => {
    const out = new Float64Array(HOURS);
    for (let k = 0; k < arr.length && k / step < HOURS; k++) out[Math.floor(k / step)] += arr[k];
    return out;
  };
  return { load: agg(load), pv: pv ? agg(pv) : null, rows: rows.length, resolution: step === 4 ? '15 Minuten' : 'Stunde' };
}
