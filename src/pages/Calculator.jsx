import React, { useRef, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { abgabenSumme, legBezugPreis, netzbezugPreis, parseCsv } from '../engine.js';
import { chf, kwh, num, pct, rp } from '../format.js';

const tip = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, fontSize: 13 };

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
const STATUS_LABEL = { ja: 'macht mit', offen: 'noch offen', nein: 'macht nicht mit' };

function OwnCard({ own, draft, setDraft, ownData, setOwnData, save, logout }) {
  const fileRef = useRef();
  const [msg, setMsg] = useState('');
  const [state, setState] = useState('idle'); // idle | saving | saved | error
  const [err, setErr] = useState('');
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
  const onSave = async () => {
    setState('saving');
    try {
      await save();
      setState('saved');
    } catch (error) {
      setErr(error.message);
      setState('error');
    }
  };
  const dirty = draft.status !== own.status || own.verbrauch == null || draft.verbrauch !== +own.verbrauch
    || draft.pv !== (+own.pv || 0) || draft.wp !== own.wp || draft.ev !== own.ev;
  const off = draft.status === 'nein';
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
      {!off && (
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
          {ownData && <div className="pcard-note">Rechnet mit Messdaten aus «{ownData.file}». Die Datei bleibt in deinem Browser, gespeichert wird nur der Jahresverbrauch.</div>}
          {msg && !ownData && <div className="pcard-note warn">{msg}</div>}
        </>
      )}
      <div className="save-row">
        <button className="btn" onClick={onSave} disabled={state === 'saving' || (!dirty && state !== 'error')}>
          {state === 'saving' ? 'Speichert …' : 'Speichern'}
        </button>
        {state === 'saved' && !dirty && <span className="save-msg ok">Gespeichert. Danke!</span>}
        {state === 'error' && <span className="save-msg warn">Speichern fehlgeschlagen: {err}</span>}
        {state === 'idle' && dirty && <span className="save-msg">Noch nicht gespeichert</span>}
      </div>
    </div>
  );
}

function Street({ community, own }) {
  const hs = community.households;
  const count = (st) => hs.filter((h) => h.status === st).length;
  return (
    <div className="street">
      <div className="street-sum">
        <span><b>{count('ja')}</b> machen mit</span>
        <span><b>{count('offen')}</b> noch offen</span>
        <span><b>{count('nein')}</b> machen nicht mit</span>
      </div>
      <ul className="street-list">
        {hs.map((h) => (
          <li key={h.id} className={h.id === own?.id ? 'mine' : ''}>
            <span>{h.address}{h.id === own?.id ? ' (du)' : ''}</span>
            <span className={`st st-${h.status}`}>{STATUS_LABEL[h.status]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function downloadTemplate() {
  const lines = ['zeitpunkt;verbrauch_kwh;produktion_kwh'];
  const start = new Date(Date.UTC(2026, 0, 1));
  for (let i = 0; i < 96; i++) {
    const d = new Date(start.getTime() + i * 15 * 60000);
    lines.push(`${d.toISOString().slice(0, 16).replace('T', ' ')};0.120;0.000`);
  }
  lines.push('… (bis 31.12. 23:45, total 35040 Zeilen)');
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'vorlage-messdaten.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Calculator({
  community, net, own, draft, setDraft, ownData, setOwnData, save, logout, includeOpen, setIncludeOpen,
  tariff, setTariff, leg, setLeg, result, reset,
}) {
  const { rows, summary: s, monthly } = result;
  const [confirmReset, setConfirmReset] = useState(false);
  const T = (k) => (v) => setTariff((t) => ({ ...t, [k]: v }));
  const L = (k) => (v) => setLeg((l) => ({ ...l, [k]: v }));

  const full = netzbezugPreis(tariff);
  const legP = legBezugPreis(tariff, leg);
  const priceMin = tariff.rueckliefer;
  const priceMax = tariff.energie + tariff.netz * (leg.rabatt / 100);
  const savingsData = rows.map((r) => ({ name: r.name, v: Math.round(r.ersparnis) }));
  const amort = Number.isFinite(s.amortisationJahre) ? `${num(s.amortisationJahre, 1)} Jahre` : 'nie';

  return (
    <div className="calc">
      <div className="anim-head">
        <h1>Wirtschaftlichkeit</h1>
        <p className="lead">Passe Teilnehmende, Preise und Kosten an. Alles wird sofort neu gerechnet, über alle 8760 Stunden eines Jahres.</p>
      </div>

      <div className="kpis wide">
        <div className="kpi accent"><span className="kpi-v">{chf(s.ersparnisNetto)}</span><span className="kpi-l">Vorteil pro Jahr, nach LEG-Kosten</span></div>
        <div className="kpi"><span className="kpi-v">{amort}</span><span className="kpi-l">bis die Initialkosten von {chf(leg.initialkosten)} gedeckt sind</span></div>
        <div className="kpi"><span className="kpi-v">{kwh(s.leg)}</span><span className="kpi-l">LEG-Strom pro Jahr ({pct(s.legAnteilUeberschuss)} der Überschüsse)</span></div>
        <div className="kpi"><span className="kpi-v">{pct(s.autarkieMit)}</span><span className="kpi-l">lokaler Anteil am Verbrauch (ohne LEG {pct(s.autarkieOhne)})</span></div>
      </div>
      {s.ersparnisNetto <= 0 && (
        <div className="callout warn">Mit diesen Annahmen decken die Einsparungen die LEG-Kosten nicht. Mehr Bezüger, ein anderer LEG-Preis oder tiefere Kosten ändern das.</div>
      )}

      <h2 className="h2">Dein Haus</h2>
      {own && draft ? (
        <OwnCard own={own} draft={draft} setDraft={setDraft} ownData={ownData} setOwnData={setOwnData} save={save} logout={logout} />
      ) : (
        <p className="hint">
          Mit deinem persönlichen Link erfasst du Verbrauch, PV-Anlage und Teilnahme für dein Haus. Du hast keinen Link
          bekommen? Melde dich bei Fabian Ackeret.
        </p>
      )}

      <h2 className="h2">Stand an der Fluhmattstrasse</h2>
      {community ? (
        <>
          <Street community={community} own={own} />
          <div className="row-actions">
            <Toggle label="Offene Adressen mit Beispielwerten einrechnen" checked={includeOpen} onChange={setIncludeOpen} />
            <button className="btn ghost" onClick={downloadTemplate}>CSV-Vorlage</button>
          </div>
          <p className="hint">
            Angaben anderer Häuser erscheinen in den Resultaten nur anonym («Haus A», «Haus B» …). Offene Adressen
            rechnet der Rechner mit Beispielwerten, solange der Schalter an ist.
          </p>
        </>
      ) : (
        <p className="hint">{net === 'loading' ? 'Lädt …' : 'Nicht verfügbar. Der Rechner zeigt Beispielwerte.'}</p>
      )}

      <h2 className="h2">Ergebnis pro Haus</h2>
      <div className="chart-card">
        <div className="chart-title">Vorteil pro Jahr (CHF)</div>
        <ResponsiveContainer width="100%" height={Math.max(160, rows.length * 30)}>
          <BarChart data={savingsData} layout="vertical" margin={{ top: 4, right: 40, bottom: 4, left: 0 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={84} tick={{ fontSize: 12, fill: 'var(--ink-2)' }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v) => [chf(v), 'Vorteil']} cursor={{ fill: 'var(--hover)' }} contentStyle={tip} />
            <Bar dataKey="v" radius={[0, 6, 6, 0]} label={{ position: 'right', fontSize: 12, fill: 'var(--ink)' }}>
              {savingsData.map((d) => <Cell key={d.name} fill={d.v >= 0 ? 'var(--leg)' : 'var(--neg)'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Haus</th><th>Verbrauch</th><th>Produktion</th><th>An LEG</th><th>Aus LEG</th>
              <th>Kosten heute</th><th>Mit LEG</th><th>Vorteil</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.id === own?.id ? 'mine' : undefined}>
                <td>{r.name}</td>
                <td>{num(r.verbrauch)}</td>
                <td>{num(r.produktion)}</td>
                <td>{num(r.geliefert)}</td>
                <td>{num(r.bezogen)}</td>
                <td>{num(r.kostenOhne)}</td>
                <td>{num(r.kostenMit)}</td>
                <td className={r.ersparnis >= 0 ? 'pos' : 'neg'}>{num(r.ersparnis)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint">kWh pro Jahr und CHF pro Jahr. Kosten = Stromrechnung minus Erlöse aus Einspeisung bzw. LEG-Verkauf, inkl. Grund- und Messpreis und Anteil LEG-Jahreskosten.</p>
      </div>

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
          <span className="field-h">40 % wenn alle auf Netzebene 7 ohne Transformation; sonst 20 %.</span>
        </div>
        <div className="field span2">
          <span className="field-l">Interner LEG-Preis: <b>{rp(leg.preis)}</b> pro kWh</span>
          <input type="range" min={Math.floor(priceMin)} max={Math.ceil(priceMax)} step="0.1" value={leg.preis} onChange={(e) => L('preis')(+e.target.value)} />
          <span className="field-h">
            Bezüger zahlen {rp(legP)} statt {rp(full)}. Produzenten erhalten {rp(leg.preis)} statt {rp(tariff.rueckliefer)}. Faire Mitte: {rp((priceMin + priceMax) / 2)}.
          </span>
        </div>
        <NumField label="Initialkosten" unit="CHF" step={50} value={leg.initialkosten} onChange={L('initialkosten')} hint="einmalig, Annahme" />
        <NumField label="Verwaltung" unit="CHF/Jahr" step={50} value={leg.jahreskosten} onChange={L('jahreskosten')} hint="0, wenn intern erledigt" />
        <NumField label="IBB-Gebühr pro Mutation" unit="CHF" step={10} value={leg.mutationGebuehr} onChange={L('mutationGebuehr')} hint="Annahme, bei IBB erfragen" />
        <NumField label="Mutationen pro Jahr" step={1} value={leg.mutationenProJahr} onChange={L('mutationenProJahr')} hint="Ein-/Austritte, Preisänderungen" />
        <div className="field">
          <span className="field-l">Darstellung</span>
          <Toggle label="inkl. MWST" checked={leg.inklMwst} onChange={L('inklMwst')} />
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
        <NumField label="Rückliefervergütung" unit="Rp." step={0.1} value={tariff.rueckliefer} onChange={T('rueckliefer')} hint="Annahme, IBB-Preisblatt prüfen" />
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
          <li>Restbedarf kommt von der IBB zum vollen Tarif, Restüberschuss geht zur Rückliefervergütung an die IBB.</li>
          <li>LEG-Strom kostet den LEG-Preis plus Netznutzung mit Rabatt plus volle Abgaben. Der LEG-Preis geht an die Produzenten.</li>
          <li>LEG-Jahreskosten (Verwaltung, Mutationen) werden gleichmässig auf alle verteilt.</li>
        </ol>
        <p className="muted">Vereinfachungen: Stundenwerte statt 15 Minuten (bei Messdaten werden 15-Minuten-Werte zu Stunden summiert), keine Batterien, Rabatt nur auf den Arbeitspreis der Netznutzung.</p>
      </details>
    </div>
  );
}
