import React, { useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { abgabenSumme, legBezugPreis, netzbezugPreis, parseCsv } from '../engine.js';
import { chf, kwh, num, pct, rp } from '../format.js';
import { HOURS } from '../profiles.js';

const tip = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, fontSize: 13, color: 'var(--ink)' };

function NumField({ label, value, onChange, unit, step = 1, min = 0, hint }) {
  return (
    <label className="field">
      <span className="field-l">{label}</span>
      <span className="field-in">
        <input
          type="number" inputMode="decimal" value={Number.isFinite(value) ? value : ''} step={step} min={min}
          onChange={(e) => onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))}
        />
        {unit && <span className="unit">{unit}</span>}
      </span>
      {hint && <span className="field-h">{hint}</span>}
    </label>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className={checked ? 'toggle on' : 'toggle'}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

const STATUS = [
  { id: 'ja', label: 'Mache mit' },
  { id: 'offen', label: 'Noch unsicher' },
  { id: 'nein', label: 'Mache nicht mit' },
];

function OwnCard({ own, draft, setDraft, ownData, setOwnData, save, clear, logout, go }) {
  const fileRef = useRef();
  const [msg, setMsg] = useState('');
  const [state, setState] = useState('idle'); // idle | saving | saved | cleared | error
  const [err, setErr] = useState('');
  const [consent, setConsent] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const set = (patch) => { setDraft((d) => ({ ...d, ...patch, beispiel: false })); setState('idle'); };
  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const parsed = parseCsv(await f.text());
      setOwnData({ load: parsed.load, pv: parsed.pv ?? undefined, file: f.name });
      set({ verbrauch: Math.round(parsed.load.reduce((a, b) => a + b, 0)) });
      setMsg(`${f.name}: ${num(parsed.rows)} Werte (${parsed.resolution}) geladen.`);
    } catch (error) {
      setMsg(`Fehler: ${error.message}`);
    }
    e.target.value = '';
  };
  const run = async (action, done) => {
    setState('saving');
    try {
      await action();
      setState(done);
    } catch (error) {
      setErr(error.message);
      setState('error');
    }
  };
  const dirty = draft.status !== own.status || own.verbrauch == null || draft.verbrauch !== +own.verbrauch
    || draft.pv !== (+own.pv || 0) || draft.wp !== own.wp || draft.ev !== own.ev;
  const off = draft.status === 'nein';
  const needsConsent = !own.consent;
  return (
    <div className="pcard own">
      <div className="pcard-top">
        <strong className="own-name">{own.address}</strong>
        <button className="link small" onClick={logout}>Nicht dein Haus?</button>
      </div>
      <div className="seg small" role="radiogroup" aria-label="Teilnahme">
        {STATUS.map((s) => (
          <button key={s.id} role="radio" aria-checked={draft.status === s.id} className={draft.status === s.id ? 'active' : ''}
            onClick={() => { setDraft((d) => ({ ...d, status: s.id })); setState('idle'); }}>{s.label}</button>
        ))}
      </div>
      {off ? (
        <div className="pcard-note">Wenn du nicht mitmachst, speichert der Rechner nur das, keine Verbrauchswerte.</div>
      ) : (
        <>
          {draft.beispiel && <div className="pcard-chip">Beispielwerte, bitte mit deinen Angaben ersetzen</div>}
          <div className="pcard-grid">
            <NumField label="Verbrauch" unit="kWh/Jahr" step={100} value={draft.verbrauch} onChange={(v) => set({ verbrauch: v })}
              hint="Steht auf der IBB-Jahresrechnung" />
            <NumField label="PV-Anlage" unit="kWp" step={0.5} value={draft.pv} onChange={(v) => set({ pv: v })} hint="0, wenn keine Anlage" />
          </div>
          <div className="pcard-row">
            <Toggle label="Wärmepumpe" checked={draft.wp} onChange={(v) => set({ wp: v })} />
            <Toggle label="E-Auto" checked={draft.ev} onChange={(v) => set({ ev: v })} />
            {ownData ? (
              <button className="link small" onClick={() => { setOwnData(undefined); setMsg(''); }}>Messdaten entfernen</button>
            ) : (
              <button className="link small" onClick={() => fileRef.current?.click()}>Messdaten (CSV) laden</button>
            )}
            <input ref={fileRef} type="file" accept=".csv,.txt" hidden onChange={onFile} />
          </div>
          {ownData && (
            <div className="pcard-note">
              Rechnet mit Messdaten aus «{ownData.file}». Die Werte gehen nur für die Berechnung an den Server und werden
              nicht gespeichert. Gespeichert wird nur der Jahresverbrauch.
            </div>
          )}
          {msg && !ownData && <div className="pcard-note warn">{msg}</div>}
        </>
      )}
      {needsConsent && (
        <label className="consent">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            Ich bin einverstanden, dass meine Angaben für die Abklärung der LEG gespeichert werden, wie im{' '}
            <button className="link" onClick={() => go('datenschutz')}>Datenschutzhinweis</button> beschrieben.
          </span>
        </label>
      )}
      <div className="save-row">
        <button className="btn" onClick={() => run(() => save(consent), 'saved')}
          disabled={state === 'saving' || (needsConsent && !consent) || (!dirty && !needsConsent && state !== 'error')}>
          {state === 'saving' ? 'Speichert …' : 'Speichern'}
        </button>
        {state === 'saved' && !dirty && <span className="save-msg ok">Gespeichert. Danke!</span>}
        {state === 'cleared' && <span className="save-msg ok">Deine Angaben sind gelöscht.</span>}
        {state === 'error' && <span className="save-msg warn">Fehlgeschlagen: {err}</span>}
        {state === 'idle' && dirty && !needsConsent && <span className="save-msg">Noch nicht gespeichert</span>}
      </div>
      {own.consent && (
        <div className="clear-row">
          {confirmClear ? (
            <>
              <span className="save-msg">Alle gespeicherten Angaben zu deinem Haus löschen?</span>
              <button className="btn danger small" onClick={() => { setConfirmClear(false); run(clear, 'cleared'); }}>Ja, löschen</button>
              <button className="link small" onClick={() => setConfirmClear(false)}>Abbrechen</button>
            </>
          ) : (
            <button className="link small" onClick={() => setConfirmClear(true)}>Meine Angaben löschen</button>
          )}
        </div>
      )}
    </div>
  );
}

function Street({ counts }) {
  return (
    <div className="street-sum">
      <span><b>{counts.ja}</b> machen mit</span>
      <span><b>{counts.offen}</b> noch offen</span>
      <span><b>{counts.nein}</b> machen nicht mit</span>
    </div>
  );
}

function OwnResult({ r }) {
  return (
    <>
      <div className="kpis wide">
        <div className="kpi accent">
          <span className={r.ersparnis >= 0 ? 'kpi-v' : 'kpi-v neg'}>{chf(r.ersparnis)}</span>
          <span className="kpi-l">Vorteil für dein Haus pro Jahr</span>
        </div>
        <div className="kpi"><span className="kpi-v">{chf(r.kostenOhne)}</span><span className="kpi-l">Stromkosten heute pro Jahr</span></div>
        <div className="kpi"><span className="kpi-v">{kwh(r.bezogen)}</span><span className="kpi-l">bezogen aus der LEG</span></div>
        <div className="kpi"><span className="kpi-v">{kwh(r.geliefert)}</span><span className="kpi-l">geliefert an die LEG</span></div>
      </div>
      <p className="hint">Kosten = Stromrechnung minus Erlöse aus Einspeisung und LEG-Verkauf, inkl. Grund- und Messpreis und Anteil LEG-Jahreskosten.</p>
    </>
  );
}

// Eine Zeile pro Stunde ab 1. Januar 00:00; parseCsv liest die Werte nach Reihenfolge, nicht nach Zeitstempel
function downloadTemplate() {
  const lines = ['verbrauch_kwh;produktion_kwh'];
  for (let i = 0; i < HOURS; i++) lines.push('0.000;0.000');
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'vorlage-messdaten.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Calculator({
  server, net, own, draft, setDraft, ownData, setOwnData, save, clear, logout, go, includeOpen, setIncludeOpen,
  tariff, setTariff, leg, setLeg, result, reset,
}) {
  const { summary: s, monthly } = result;
  const [confirmReset, setConfirmReset] = useState(false);
  const T = (k) => (v) => setTariff((t) => ({ ...t, [k]: v }));
  const L = (k) => (v) => setLeg((l) => ({ ...l, [k]: v }));

  const full = netzbezugPreis(tariff);
  const legP = legBezugPreis(tariff, leg);
  const rl = s.rlEffektiv ?? tariff.rlMittelSommer;
  const priceMin = rl + leg.gebuehrKwh; // darunter erhalten Produzenten weniger als heute
  const priceMax = tariff.energie + tariff.netz * (leg.rabatt / 100);
  const amort = Number.isFinite(s.amortisationJahre) ? `${num(s.amortisationJahre, 1)} Jahre` : 'nie';

  return (
    <div className="calc">
      <div className="anim-head">
        <h1>Wirtschaftlichkeit</h1>
        <p className="lead">Passe Preise und Kosten an. Alles wird sofort neu gerechnet, über alle 8760 Stunden eines Jahres.</p>
      </div>

      <h2 className="h2">Ganze Strasse</h2>
      {server?.counts && <Street counts={server.counts} />}
      <div className="kpis wide">
        <div className="kpi accent"><span className="kpi-v">{chf(s.ersparnisNetto)}</span><span className="kpi-l">Vorteil pro Jahr für alle zusammen, nach LEG-Kosten</span></div>
        <div className="kpi"><span className="kpi-v">{amort}</span><span className="kpi-l">bis die Einrichtungskosten von {chf(s.initialkosten)} gedeckt sind</span></div>
        <div className="kpi"><span className="kpi-v">{kwh(s.leg)}</span><span className="kpi-l">LEG-Strom pro Jahr ({pct(s.legAnteilUeberschuss)} der Überschüsse)</span></div>
        <div className="kpi"><span className="kpi-v">{pct(s.autarkieMit)}</span><span className="kpi-l">lokaler Anteil am Verbrauch (ohne LEG {pct(s.autarkieOhne)})</span></div>
      </div>
      {s.ersparnisNetto <= 0 && (
        <div className="callout warn">Mit diesen Annahmen decken die Einsparungen die LEG-Kosten nicht. Mehr Bezüger, ein anderer LEG-Preis oder tiefere Kosten ändern das.</div>
      )}
      <div className="row-actions">
        <Toggle label="Offene Adressen mit Beispielwerten einrechnen" checked={includeOpen} onChange={setIncludeOpen} />
      </div>
      <p className="hint">
        {net === 'loading' && !server ? 'Lädt … ' : ''}
        Die Strasse erscheint nur als Summe, gerundet auf 1000 kWh und 10 CHF. Einzelne Häuser sind nicht sichtbar.
        {server && server.examples > 0 && ` ${server.examples} von ${server.participants} Häusern in dieser Rechnung sind Beispielwerte.`}
      </p>

      <h2 className="h2">Dein Haus</h2>
      {own && draft ? (
        <>
          <OwnCard own={own} draft={draft} setDraft={setDraft} ownData={ownData} setOwnData={setOwnData}
            save={save} clear={clear} logout={logout} go={go} />
          {result.own && draft.status !== 'nein' && <OwnResult r={result.own} />}
        </>
      ) : (
        <p className="hint">
          Mit deinem persönlichen Link erfasst du Verbrauch, PV-Anlage und Teilnahme für dein Haus und siehst dein eigenes
          Ergebnis. Du hast keinen Link bekommen? Melde dich bei Fabian Ackeret.
        </p>
      )}
      <div className="row-actions">
        <button className="btn ghost" onClick={downloadTemplate}>CSV-Vorlage für Messdaten</button>
      </div>
      <p className="hint">
        Zwei Spalten, Verbrauch und Produktion in kWh. Eine Zeile pro Stunde (8760 Zeilen) oder pro 15 Minuten
        (35040 Zeilen), beginnend am 1. Januar um 00:00.
      </p>

      <h2 className="h2">Verlauf übers Jahr</h2>
      <div className="chart-card">
        <div className="chart-title">Woher kommt der Strom? (kWh pro Monat, alle Häuser)</div>
        <ResponsiveContainer width="100%" height={230}>
          <BarChart data={monthly} margin={{ top: 8, right: 4, bottom: 0, left: -10 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="monat" tick={{ fontSize: 11, fill: 'var(--ink-2)' }} axisLine={false} tickLine={false} interval={0} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--ink-2)' }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v, n) => [kwh(v), n]} cursor={{ fill: 'var(--hover)' }} contentStyle={tip} />
            <Bar dataKey="eigen" name="Eigenverbrauch" stackId="a" fill="var(--sun)" />
            <Bar dataKey="leg" name="Aus der LEG" stackId="a" fill="var(--leg)" />
            <Bar dataKey="netz" name="Von der IBB" stackId="a" fill="var(--grid)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <div className="legend">
          <span><i style={{ background: 'var(--sun)' }} />Eigenverbrauch</span>
          <span><i style={{ background: 'var(--leg)' }} />Aus der LEG</span>
          <span><i style={{ background: 'var(--grid)' }} />Von der IBB</span>
        </div>
      </div>

      <h2 className="h2">LEG-Einstellungen</h2>
      <div className="settings">
        <div className="field">
          <span className="field-l">Rabatt auf Netznutzung</span>
          <div className="seg small">
            {[40, 20].map((v) => (
              <button key={v} className={leg.rabatt === v ? 'active' : ''} onClick={() => L('rabatt')(v)}>{v} %</button>
            ))}
          </div>
          <span className="field-h">40 % wenn alle am selben Trafokreis angeschlossen sind; sonst 20 %.</span>
        </div>
        <div className="field span2">
          <span className="field-l">Interner LEG-Preis: <b>{rp(leg.preis)}</b> pro kWh</span>
          <input type="range" min={Math.floor(priceMin)} max={Math.ceil(priceMax)} step="0.1" value={leg.preis} onChange={(e) => L('preis')(+e.target.value)} />
          <span className="field-h">
            Bezüger zahlen {rp(legP)} statt {rp(full)}. Produzenten erhalten {rp(leg.preis - leg.gebuehrKwh)} (nach IBB-Gebühr)
            statt durchschnittlich {rp(rl)} Abnahmevergütung. Faire Mitte: {rp((priceMin + priceMax) / 2)}.
          </span>
        </div>
        <NumField label="Verwaltung" unit="CHF/Jahr" step={50} value={leg.jahreskosten} onChange={L('jahreskosten')} hint="0, wenn intern erledigt" />
        <NumField label="Ein- und Austritte pro Jahr" step={1} value={leg.mutationenProJahr} onChange={L('mutationenProJahr')} hint="Mieter- und Eigentümerwechsel sind gratis" />
        <div className="field">
          <span className="field-l">Darstellung</span>
          <Toggle label="inkl. MWST" checked={leg.inklMwst} onChange={L('inklMwst')} />
        </div>
      </div>

      <h2 className="h2">IBB-Gebühren LEGPLUS 2026</h2>
      <p className="hint">
        CHF exkl. MWST, gemäss Preisblatt «Preise für LEGPLUS» ab 1. Januar 2026. Die IBB stellt sie der LEG-Vertretung
        in Rechnung. Für diese Rechnung: einmalig {chf(s.initialkosten)}, jährlich {chf(s.legJahr)} plus{' '}
        {chf(s.legGebuehrKwh)} kWh-Gebühr. Ein Haus mit PV-Anlage zählt mit zwei Messpunkten (Annahme).
      </p>
      <div className="settings">
        <NumField label="Einrichtung pro LEG" unit="CHF" step={10} value={leg.einrichtungLeg} onChange={L('einrichtungLeg')} hint="einmalig" />
        <NumField label="Einrichtung pro PV-Anlage" unit="CHF" step={10} value={leg.einrichtungAnlage} onChange={L('einrichtungAnlage')} hint="einmalig" />
        <NumField label="Einrichtung pro Messpunkt" unit="CHF" step={5} value={leg.einrichtungMesspunkt} onChange={L('einrichtungMesspunkt')} hint="einmalig, pro Haus" />
        <NumField label="Abrechnung pro Messpunkt" unit="CHF/Mt." step={0.05} value={leg.messpunktMonat} onChange={L('messpunktMonat')} />
        <NumField label="Gebühr pro kWh LEG-Strom" unit="Rp." step={0.1} value={leg.gebuehrKwh} onChange={L('gebuehrKwh')} hint="geht vom Erlös der Produzenten ab" />
        <NumField label="Mutation" unit="CHF" step={5} value={leg.mutationGebuehr} onChange={L('mutationGebuehr')} hint="pro Ein- oder Austritt" />
        <div className="field">
          <span className="field-l">Gründungsberatung IBB</span>
          <Toggle label={`einrechnen (${chf(leg.beratungKosten)})`} checked={leg.beratung} onChange={L('beratung')} />
          <span className="field-h">optional</span>
        </div>
      </div>

      <h2 className="h2">Tarife IBB 2026</h2>
      <p className="hint">Rp./kWh exkl. MWST, gemäss Preisblatt «Strompreise Basis 2026» (IBB-Erneuerbar). Total heute {rp(full)}, davon Abgaben {rp(abgabenSumme(tariff))}.</p>
      <div className="settings">
        <NumField label="Energie" unit="Rp." step={0.01} value={tariff.energie} onChange={T('energie')} />
        <NumField label="Netznutzung" unit="Rp." step={0.01} value={tariff.netz} onChange={T('netz')} />
        <NumField label="Netzzuschlag" unit="Rp." step={0.01} value={tariff.netzzuschlag} onChange={T('netzzuschlag')} />
        <NumField label="Systemdienstleistungen" unit="Rp." step={0.01} value={tariff.sdl} onChange={T('sdl')} />
        <NumField label="Stromreserve" unit="Rp." step={0.01} value={tariff.stromreserve} onChange={T('stromreserve')} />
        <NumField label="Solidarisierte Kosten" unit="Rp." step={0.01} value={tariff.solidarisiert} onChange={T('solidarisiert')} />
        <NumField label="Konzessionsabgabe" unit="Rp." step={0.01} value={tariff.konzession} onChange={T('konzession')} />
        <NumField label="Abnahmevergütung bis 2 kW" unit="Rp." step={0.1} value={tariff.rlKlein} onChange={T('rlKlein')} hint="IBB ab 2027" />
        <NumField label="Abnahmevergütung 2–30 kW, Winter" unit="Rp." step={0.1} value={tariff.rlMittelWinter} onChange={T('rlMittelWinter')} hint="Okt–Mär" />
        <NumField label="Abnahmevergütung 2–30 kW, Sommer" unit="Rp." step={0.1} value={tariff.rlMittelSommer} onChange={T('rlMittelSommer')} hint="Apr–Sep" />
        <NumField label="Abnahmevergütung 30–150 kW, Winter" unit="Rp." step={0.1} value={tariff.rlGrossWinter} onChange={T('rlGrossWinter')} hint="Okt–Mär" />
        <NumField label="Abnahmevergütung 30–150 kW, Sommer" unit="Rp." step={0.1} value={tariff.rlGrossSommer} onChange={T('rlGrossSommer')} hint="Apr–Sep" />
        <NumField label="Grundpreis" unit="CHF/Mt." step={0.1} value={tariff.grundpreisMonat} onChange={T('grundpreisMonat')} />
        <NumField label="Messpreis" unit="CHF/Mt." step={0.1} value={tariff.messpreisMonat} onChange={T('messpreisMonat')} />
      </div>
      <div className="row-actions">
        {confirmReset ? (
          <button className="btn danger" onClick={() => { reset(); setConfirmReset(false); }}>Wirklich zurücksetzen?</button>
        ) : (
          <button className="btn ghost" onClick={() => setConfirmReset(true)}>Einstellungen zurücksetzen</button>
        )}
      </div>
      <p className="hint">LEG-Einstellungen und Tarife gelten nur in deinem Browser. Andere sehen deine Änderungen nicht.</p>

      <details className="method">
        <summary>So rechnet das Modell</summary>
        <ol>
          <li>Für jede Stunde des Jahres werden Verbrauch und Produktion je Haus bestimmt (Messdaten oder typische Profile für Mittelland, ~1000 kWh pro kWp).</li>
          <li>Eigener Solarstrom deckt zuerst den eigenen Verbrauch.</li>
          <li>Alle Überschüsse werden proportional auf den Restbedarf der anderen verteilt (dynamischer Verteilschlüssel).</li>
          <li>Restbedarf kommt von der IBB zum vollen Tarif, Restüberschuss geht zur Abnahmevergütung an die IBB.</li>
          <li>LEG-Strom kostet den LEG-Preis plus Netznutzung mit Rabatt plus volle Abgaben. Der LEG-Preis geht an die Produzenten, abzüglich der IBB-Gebühr pro kWh.</li>
          <li>Die IBB-Abrechnungsgebühr trägt jedes Haus für seine eigenen Messpunkte. Verwaltung und Mutationen werden gleichmässig auf alle verteilt.</li>
        </ol>
        <p className="muted">Vereinfachungen: Stundenwerte statt 15 Minuten (bei Messdaten werden 15-Minuten-Werte zu Stunden summiert), keine Batterien, Rabatt nur auf den Arbeitspreis der Netznutzung.</p>
      </details>
    </div>
  );
}
