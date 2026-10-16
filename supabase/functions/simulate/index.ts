// Rechnet die LEG für die ganze Strasse auf dem Server. Der Browser erhält nur gerundete Summen,
// das Ergebnis des eigenen Hauses (mit persönlichem Link) und die Anzahl Zusagen. Einzelwerte
// anderer Häuser verlassen die Datenbank nie.
import { simulate } from '../../../src/engine.js';
import { DEFAULT_LEG, DEFAULT_TARIFF, SAMPLE_PARTICIPANTS } from '../../../src/defaults.js';

// Echte Angaben fliessen erst ein, wenn mindestens so viele andere Häuser mitmachen
const MIN_OTHERS = 3;
const HOURS = 8760;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const num = (v: unknown, min: number, max: number, fallback: number) => {
  const x = Number(v);
  return Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : fallback;
};

// Nur bekannte Zahlenfelder übernehmen, Werte begrenzen
function clean<T extends Record<string, number | boolean>>(input: unknown, defaults: T): T {
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const out = { ...defaults } as Record<string, number | boolean>;
  for (const [k, d] of Object.entries(defaults)) {
    out[k] = typeof d === 'boolean' ? Boolean(src[k] ?? d) : num(src[k], 0, 10000, d as number);
  }
  return out as T;
}

function series(arr: unknown) {
  if (!Array.isArray(arr) || arr.length !== HOURS) return undefined;
  const out = new Float64Array(HOURS);
  for (let i = 0; i < HOURS; i++) out[i] = num(arr[i], 0, 1000, 0);
  return out;
}

const round = (v: number, step: number) => Math.round(v / step) * step;
const sampleFor = (id: string) => SAMPLE_PARTICIPANTS.find((s) => s.id === id);

type Row = { id: string; status: string; verbrauch: number | null; pv: number | null; wp: boolean; ev: boolean; token: string };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return reply({ message: 'Nur POST' }, 405);
  if (Number(req.headers.get('content-length') ?? 0) > 1_000_000) return reply({ message: 'Anfrage zu gross' }, 413);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return reply({ message: 'Ungültige Anfrage' }, 400);
  }

  const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/rpc/simulation_input`, {
    method: 'POST',
    headers: {
      apikey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  if (!res.ok) return reply({ message: 'Datenbank nicht erreichbar' }, 502);
  const rows: Row[] = await res.json();

  const token = typeof body.token === 'string' ? body.token : '';
  const ownRow = token ? rows.find((r) => r.token === token) : undefined;
  const tariff = clean(body.tariff, DEFAULT_TARIFF);
  const leg = clean(body.leg, DEFAULT_LEG);
  const includeOpen = body.includeOpen !== false;

  const participants: Record<string, unknown>[] = [];
  // Eigenes Haus mit den Werten aus dem Formular, auch wenn sie noch nicht gespeichert sind
  const own = (body.own && typeof body.own === 'object' ? body.own : null) as Record<string, unknown> | null;
  if (ownRow && own && own.status !== 'nein') {
    const data = body.ownData as Record<string, unknown> | undefined;
    const load = series(data?.load);
    participants.push({
      id: ownRow.id, name: 'Dein Haus', own: true,
      verbrauch: num(own.verbrauch, 0, 200000, 0), pv: num(own.pv, 0, 200, 0), wp: !!own.wp, ev: !!own.ev,
      data: load ? { load, pv: series(data?.pv) } : undefined,
    });
  }

  const others = rows.filter((r) => r !== ownRow);
  const real = others.filter((r) => r.status === 'ja' && r.verbrauch != null);
  const useReal = real.length >= MIN_OTHERS;
  let examples = 0;
  for (const r of others) {
    if (r.status === 'ja' && r.verbrauch != null && useReal) {
      participants.push({ id: r.id, name: r.id, verbrauch: +r.verbrauch, pv: +(r.pv ?? 0), wp: r.wp, ev: r.ev });
    } else if (r.status === 'ja' || (r.status === 'offen' && includeOpen)) {
      const s = sampleFor(r.id);
      if (s) { participants.push(s); examples++; }
    }
  }

  const { rows: results, summary: s, monthly } = simulate(participants, tariff, leg);
  // Grob runden, damit sich aus zwei Abfragen kein einzelnes Haus herausrechnen lässt
  const kwhKeys = ['verbrauch', 'produktion', 'eigen', 'leg', 'netzbezug', 'einspeisung'];
  const summary: Record<string, number> = {
    legJahr: round(s.legJahr, 10), initialkosten: round(s.initialkosten, 10), legGebuehrKwh: round(s.legGebuehrKwh, 10),
  };
  for (const k of kwhKeys) summary[k] = round(s[k], 1000);
  summary.ersparnisBrutto = round(s.ersparnisBrutto, 10);
  summary.ersparnisNetto = round(s.ersparnisNetto, 10);
  summary.amortisationJahre = summary.ersparnisNetto > 0 ? summary.initialkosten / summary.ersparnisNetto : null as unknown as number;
  for (const k of ['autarkieOhne', 'autarkieMit', 'legAnteilUeberschuss']) summary[k] = round(s[k], 0.01);
  const ownResult = results.find((r: { id: string }) => r.id === ownRow?.id) ?? null;

  const count = (st: string) => rows.filter((r) => r.status === st).length;
  return reply({
    summary,
    monthly: monthly.map((m: Record<string, number | string>) => {
      const o: Record<string, number | string> = { monat: m.monat };
      for (const k of ['eigen', 'leg', 'netz', 'einspeisung', 'produktion', 'verbrauch']) o[k] = round(m[k] as number, 100);
      return o;
    }),
    own: ownResult,
    counts: { ja: count('ja'), offen: count('offen'), nein: count('nein') },
    participants: participants.length,
    examples,
    usesReal: useReal,
    minOthers: MIN_OTHERS,
  });
});
