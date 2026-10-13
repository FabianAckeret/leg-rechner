import React from 'react';
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { abgabenSumme, legBezugPreis, netzbezugPreis } from '../engine.js';
import { chf, kwh, num, pct, rp } from '../format.js';

function Section({ n, title, children }) {
  return (
    <section className="ex-section">
      <div className="ex-num">{n}</div>
      <div className="ex-body">
        <h2>{title}</h2>
        {children}
      </div>
    </section>
  );
}

// Kaskade: wohin geht eine Solar-kWh?
function Cascade() {
  const steps = [
    { t: 'Eigenverbrauch', d: 'Solarstrom deckt zuerst den eigenen Bedarf im Haus. Das ist schon heute so und kostet nichts.', c: 'var(--sun)' },
    { t: 'Nachbarn in der LEG', d: 'Was übrig bleibt, geht übers öffentliche Netz an LEG-Mitglieder, die gerade Strom brauchen.', c: 'var(--leg)' },
    { t: 'IBB-Netz', d: 'Erst der Rest wird zur normalen Rückliefervergütung an die IBB verkauft.', c: 'var(--grid)' },
  ];
  return (
    <ol className="cascade">
      {steps.map((s, i) => (
        <li key={s.t} style={{ '--c': s.c }}>
          <span className="cascade-step">{i + 1}</span>
          <div>
            <strong>{s.t}</strong>
            <p>{s.d}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

// Beispiel zur Verteilung in einem 15-Minuten-Intervall
function AllocationExample() {
  const give = [{ n: 'Haus A', v: 3 }, { n: 'Haus B', v: 1 }];
  const need = [{ n: 'Haus D', v: 2 }, { n: 'Haus E', v: 1 }];
  const S = 4, D = 3, X = Math.min(S, D);
  return (
    <div className="alloc">
      <svg viewBox="0 0 340 190" role="img" aria-label="Beispiel Verteilung">
        <text x="10" y="18" className="svg-cap">Überschuss</text>
        <text x="330" y="18" textAnchor="end" className="svg-cap">Bedarf</text>
        {give.map((g, i) => (
          <g key={g.n} transform={`translate(10 ${32 + i * 64})`}>
            <rect width="92" height="46" rx="10" className="svg-house prod" />
            <text x="46" y="20" textAnchor="middle" className="svg-t">{g.n}</text>
            <text x="46" y="37" textAnchor="middle" className="svg-v">{g.v} kWh</text>
          </g>
        ))}
        {need.map((g, i) => (
          <g key={g.n} transform={`translate(238 ${32 + i * 64})`}>
            <rect width="92" height="46" rx="10" className="svg-house cons" />
            <text x="46" y="20" textAnchor="middle" className="svg-t">{g.n}</text>
            <text x="46" y="37" textAnchor="middle" className="svg-v">{g.v} kWh</text>
          </g>
        ))}
        <circle cx="170" cy="87" r="34" className="svg-pool" />
        <text x="170" y="83" textAnchor="middle" className="svg-t">LEG-Topf</text>
        <text x="170" y="99" textAnchor="middle" className="svg-v">{X} kWh</text>
        <path d="M102 55 C125 55 125 80 136 84" className="svg-flow leg" />
        <path d="M102 119 C125 119 125 94 136 92" className="svg-flow leg" />
        <path d="M204 84 C215 80 215 55 238 55" className="svg-flow leg" />
        <path d="M204 92 C215 94 215 119 238 119" className="svg-flow leg" />
        <path d="M170 121 L170 158" className="svg-flow grid" />
        <text x="170" y="178" textAnchor="middle" className="svg-cap">Rest {S - X} kWh → IBB</text>
      </svg>
      <div className="alloc-text">
        <p>
          Haus A und B haben zusammen <strong>{S} kWh</strong> übrig, Haus D und E brauchen <strong>{D} kWh</strong>.
          Also wechseln {X} kWh innerhalb der LEG den Besitzer.
        </p>
        <p>
          Geliefert wird anteilig zum Überschuss: A liefert {num((3 * X) / S, 2)} kWh, B {num((1 * X) / S, 2)} kWh.
          Die restliche {num(S - X, 0)} kWh geht an die IBB.
        </p>
        <p className="muted">
          Dieser Schlüssel heisst «dynamisch» und wird für jedes 15-Minuten-Intervall neu angewendet. Die Gemeinschaft
          kann auch einen anderen Schlüssel vereinbaren.
        </p>
      </div>
    </div>
  );
}

function PriceStack({ tariff, leg }) {
  const ab = abgabenSumme(tariff);
  const netzLeg = tariff.netz * (1 - leg.rabatt / 100);
  const data = [
    { name: 'Von der IBB', energie: tariff.energie, netz: tariff.netz, abgaben: ab, total: netzbezugPreis(tariff) },
    { name: 'Aus der LEG', energie: leg.preis, netz: netzLeg, abgaben: ab, total: legBezugPreis(tariff, leg) },
  ];
  const fmt = (v) => num(v, 2);
  return (
    <div className="chart-card">
      <div className="chart-title">Preis für 1 kWh, die ich beziehe (Rp., exkl. MWST)</div>
      <ResponsiveContainer width="100%" height={150}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, bottom: 4, left: 0 }}>
          <XAxis type="number" hide domain={[0, 'dataMax']} />
          <YAxis type="category" dataKey="name" width={92} tick={{ fontSize: 12, fill: 'var(--ink-2)' }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v, n) => [`${fmt(v)} Rp.`, n]} cursor={{ fill: 'var(--hover)' }} contentStyle={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, fontSize: 13 }} />
          <Bar dataKey="energie" name="Energie" stackId="a" fill="var(--sun)" radius={[6, 0, 0, 6]} />
          <Bar dataKey="netz" name="Netznutzung" stackId="a" fill="var(--grid)" />
          <Bar dataKey="abgaben" name="Abgaben" stackId="a" fill="var(--muted-bar)" radius={[0, 6, 6, 0]}>
            <LabelList dataKey="total" position="right" formatter={fmt} style={{ fontSize: 12, fill: 'var(--ink)', fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="legend">
        <span><i style={{ background: 'var(--sun)' }} />Energie</span>
        <span><i style={{ background: 'var(--grid)' }} />Netznutzung</span>
        <span><i style={{ background: 'var(--muted-bar)' }} />Abgaben</span>
      </div>
    </div>
  );
}

export default function Explain({ tariff, leg, result, go }) {
  const s = result.summary;
  const full = netzbezugPreis(tariff);
  const legP = legBezugPreis(tariff, leg);
  const rabattRp = tariff.netz * (leg.rabatt / 100);
  const kuchen = tariff.energie - tariff.rueckliefer + rabattRp;
  const vorteilBezug = full - legP;
  const vorteilProd = leg.preis - tariff.rueckliefer;

  return (
    <div className="explain">
      <section className="hero">
        <p className="eyebrow">Lokale Elektrizitätsgemeinschaft</p>
        <h1>Unser Solarstrom bleibt im Quartier.</h1>
        <p className="lead">
          Seit 2026 dürfen Nachbarn Solarstrom übers öffentliche Netz untereinander verkaufen. Wer bezieht, zahlt weniger
          als bei der IBB. Wer produziert, erhält mehr als die Rückliefervergütung. Hier steht, wie das funktioniert.
        </p>
        <div className="kpis">
          <div className="kpi"><span className="kpi-v">{chf(s.ersparnisNetto)}</span><span className="kpi-l">Vorteil pro Jahr für alle zusammen</span></div>
          <div className="kpi"><span className="kpi-v">{kwh(s.leg)}</span><span className="kpi-l">Solarstrom, der im Quartier bleibt</span></div>
          <div className="kpi"><span className="kpi-v">{pct(s.autarkieOhne)} → {pct(s.autarkieMit)}</span><span className="kpi-l">Anteil lokaler Strom am Verbrauch</span></div>
        </div>
        <p className="hint">Werte aus dem Beispiel bzw. deinen Eingaben im Rechner.</p>
      </section>

      <Section n="1" title="Was ist eine LEG?">
        <p>
          Eine <strong>Lokale Elektrizitätsgemeinschaft</strong> ist ein Zusammenschluss von Produzenten (PV-Anlagen),
          Verbrauchern und allenfalls Speichern in derselben Gemeinde. Sie tauschen Solarstrom übers Netz der IBB aus und
          legen den Preis dafür selbst fest.
        </p>
        <p>
          Weil das öffentliche Netz genutzt wird, fallen Netzkosten an, aber mit Rabatt: <strong>40 %</strong> auf die
          Netznutzung, wenn alle an derselben Netzebene (Niederspannung, Netzebene 7) hängen. Braucht der Austausch eine
          Transformation über eine höhere Netzebene, sind es <strong>20 %</strong>. Abgaben wie Netzzuschlag,
          Stromreserve oder Konzessionsabgabe bleiben voll geschuldet.
        </p>
        <div className="callout">
          <strong>Warum nicht vZEV?</strong> Ein virtueller Zusammenschluss zum Eigenverbrauch funktioniert nur hinter
          demselben Netzanschluss, ganz ohne öffentliches Netz. Laut IBB geht das bei uns nur mit einer einzigen
          Liegenschaft. Die LEG ist darum der Weg, das ganze Quartier einzubinden.
        </div>
      </Section>

      <Section n="2" title="Der Weg einer Solar-Kilowattstunde">
        <Cascade />
        <p className="muted">
          Physikalisch fliesst Strom immer zum nächsten Verbraucher. Die LEG ist eine <strong>Abrechnung</strong>: Die
          Smart Meter messen alle 15 Minuten, wer wie viel eingespeist und bezogen hat. Daraus rechnet die IBB, welcher
          Anteil als LEG-Strom gilt.
        </p>
        <button className="btn ghost" onClick={() => go('animation')}>Als Animation ansehen →</button>
      </Section>

      <Section n="3" title="Wie wird verteilt?">
        <AllocationExample />
      </Section>

      <Section n="4" title="Was kostet eine Kilowattstunde?">
        <PriceStack tariff={tariff} leg={leg} />
        <p>
          Bei der IBB kostet eine kWh heute <strong>{rp(full)}</strong>. Aus der LEG sind es <strong>{rp(legP)}</strong>:
          der vereinbarte LEG-Preis von {rp(leg.preis)} für die Energie, die Netznutzung mit {leg.rabatt} % Rabatt und
          die unveränderten Abgaben. Grund- und Messpreis bleiben gleich.
        </p>
      </Section>

      <Section n="5" title="Wer profitiert und wieso?">
        <div className="who">
          <div className="who-card" style={{ '--c': 'var(--grid)' }}>
            <span className="who-l">Bezüger</span>
            <span className="who-v">−{rp(vorteilBezug)}</span>
            <span className="who-d">pro kWh aus der LEG, verglichen mit IBB-Strom</span>
          </div>
          <div className="who-card" style={{ '--c': 'var(--sun)' }}>
            <span className="who-l">Produzenten</span>
            <span className="who-v">+{rp(vorteilProd)}</span>
            <span className="who-d">pro kWh an Nachbarn statt {rp(tariff.rueckliefer)} Rückliefervergütung</span>
          </div>
        </div>
        <p>
          Pro getauschter kWh entsteht ein «Kuchen» von <strong>{rp(kuchen)}</strong>: die Differenz zwischen
          IBB-Energiepreis und Rückliefervergütung plus der Netzrabatt. Der <strong>LEG-Preis</strong> entscheidet, wie
          dieser Kuchen zwischen Produzenten und Bezügern aufgeteilt wird. Liegt er in der Mitte, profitieren beide etwa
          gleich.
        </p>
        <p className="muted">
          Wichtig: Wer eine PV-Anlage hat, braucht seinen Strom weiterhin zuerst selbst. Die LEG betrifft nur den
          Überschuss. Und wenn die Sonne nicht scheint, kommt der Strom wie heute von der IBB.
        </p>
      </Section>

      <Section n="6" title="Was gilt es zu beachten?">
        <ul className="checks">
          <li><strong>Gleiche Gemeinde, gleicher Netzbetreiber, gleiche Netzebene.</strong> Welche Adressen passen, prüft die IBB.</li>
          <li><strong>Smart Meter</strong> bei allen Teilnehmenden, damit 15-Minuten-Werte vorliegen.</li>
          <li><strong>Vertrag</strong> unter den Teilnehmenden: Preis, Verteilschlüssel, Ein- und Austritt, Abrechnung.</li>
          <li><strong>Eine Vertretung</strong> gegenüber der IBB, die die interne Abrechnung macht (André hat angeboten, das zu übernehmen).</li>
          <li><strong>Kosten:</strong> Initialkosten sowie IBB-Gebühren für jede Mutation (Ein-/Austritt, Preisänderung). Diese teilen sich alle.</li>
          <li>Alle bleiben <strong>Kunde der IBB</strong>. Netz und Abgaben rechnet weiterhin die IBB ab. Jede Person kann nur in einer LEG sein.</li>
        </ul>
      </Section>

      <Section n="7" title="Häufige Fragen">
        <details>
          <summary>Muss ich eine PV-Anlage haben, um mitzumachen?</summary>
          <p>Nein. Gerade Haushalte ohne eigene Anlage sind als Bezüger wichtig, sonst geht der Überschuss weiterhin günstig an die IBB.</p>
        </details>
        <details>
          <summary>Bekomme ich wirklich den Strom vom Nachbarn?</summary>
          <p>Bilanziell ja. Physikalisch nimmt Strom den kürzesten Weg, und das ist im Quartier meistens tatsächlich das Nachbarhaus.</p>
        </details>
        <details>
          <summary>Was passiert im Winter?</summary>
          <p>Es gibt weniger Überschuss, also weniger LEG-Strom. Der Rest kommt ganz normal von der IBB. Schlechter als heute wird es nicht, ausser durch die Fixkosten der LEG.</p>
        </details>
        <details>
          <summary>Kann ich wieder austreten?</summary>
          <p>Ja, gemäss Vertrag. Die IBB verlangt dafür eine Mutationsgebühr.</p>
        </details>
        <details>
          <summary>Was kann ich selbst beitragen?</summary>
          <p>Verbrauch in die Sonnenstunden legen: Waschmaschine, Geschirrspüler, E-Auto laden oder Boiler am Mittag. Dann steigt der Anteil LEG-Strom.</p>
        </details>
      </Section>

      <div className="cta">
        <button className="btn" onClick={() => go('rechner')}>Zum Rechner</button>
        <button className="btn ghost" onClick={() => go('animation')}>Animation ansehen</button>
      </div>

      <p className="sources">
        Grundlagen: StromVG Art. 17d–17e, StromVV Art. 19e ff. (in Kraft seit 1.1.2026); IBB Preisblatt «Strompreise
        Basis 2026». Die Rückliefervergütung ist eine Annahme und im Rechner anpassbar.
      </p>
    </div>
  );
}
