import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Area, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { legBezugPreis, netzbezugPreis, pickDay } from '../engine.js';
import { chf, kw, num } from '../format.js';
import { shortName } from '../defaults.js';

const SEASONS = [
  { id: 'sommer', label: 'Sommertag', target: 172, daylen: 15.8 },
  { id: 'uebergang', label: 'Frühling', target: 105, daylen: 13.2 },
  { id: 'winter', label: 'Wintertag', target: 352, daylen: 8.6 },
];

const H = 385, STREET = 262;

const lerp = (a, b, f) => a + (b - a) * f;
const mix = (c1, c2, f) => {
  const p = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [a, b] = [p(c1), p(c2)];
  return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], f))).join(',')})`;
};

function skyColor(h, daylen) {
  const rise = 12.6 - daylen / 2, set = 12.6 + daylen / 2;
  const day = Math.max(0, Math.min(1, Math.min(h - rise + 0.6, set + 0.6 - h)));
  const dusk = Math.max(0, 1 - Math.min(Math.abs(h - rise), Math.abs(h - set)) / 1.2);
  const base = mix('#18203a', '#bfe0fb', day);
  return { top: base, bottom: dusk > 0 ? mix(day > 0.5 ? '#e7f3fd' : '#2a3352', '#f6c27a', dusk * 0.8) : mix('#232c4a', '#eef7ff', day), day };
}

function flowWidth(v) {
  return Math.min(9, 1.2 + v * 1.4);
}

function Flow({ d, value, kind, reverse }) {
  if (value < 0.03) return <path d={d} className="wire-idle" />;
  return (
    <path
      d={d}
      className={`flow ${kind} ${reverse ? 'rev' : ''}`}
      style={{ strokeWidth: flowWidth(value), animationDuration: `${Math.max(0.35, 1.2 - value * 0.12)}s` }}
    />
  );
}

export default function Animation({ participants, result, tariff, leg }) {
  const [season, setSeason] = useState(SEASONS[0]);
  const [t, setT] = useState(10.5);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [selected, setSelected] = useState(null);
  const raf = useRef();
  const last = useRef();

  const { hourly, series } = result;
  const day = useMemo(() => pickDay(series, season.target), [series, season]);

  useEffect(() => {
    if (!playing) return undefined;
    const tick = (ts) => {
      if (last.current != null) {
        const dt = (ts - last.current) / 1000;
        setT((v) => (v + dt * 0.9 * speed) % 24);
      }
      last.current = ts;
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf.current); last.current = null; };
  }, [playing, speed]);

  const n = participants.length;
  // Wert zum Zeitpunkt t (lineare Interpolation zwischen Stundenmittelpunkten)
  const at = (arr) => {
    const x = t - 0.5;
    const h0 = Math.floor(x), f = x - h0;
    const i0 = day * 24 + Math.max(0, Math.min(23, h0));
    const i1 = day * 24 + Math.max(0, Math.min(23, h0 + 1));
    return lerp(arr[i0], arr[i1], f);
  };

  const houses = participants.map((p, i) => ({
    p,
    pv: at(series[i].pv),
    load: at(series[i].load),
    self: at(hourly.self[i]),
    given: at(hourly.given[i]),
    received: at(hourly.received[i]),
    imp: at(hourly.gridImport[i]),
    exp: at(hourly.feedIn[i]),
  }));
  const sum = (k) => houses.reduce((a, h) => a + h[k], 0);
  const tot = { pv: sum('pv'), load: sum('load'), self: sum('self'), leg: sum('received'), imp: sum('imp'), exp: sum('exp') };

  // Tageskurve
  const dayData = useMemo(() => {
    const rows = [];
    for (let h = 0; h < 24; h++) {
      const i = day * 24 + h;
      let pv = 0, self = 0, legv = 0, imp = 0;
      for (let k = 0; k < n; k++) { pv += series[k].pv[i]; self += hourly.self[k][i]; legv += hourly.received[k][i]; imp += hourly.gridImport[k][i]; }
      rows.push({ h: h + 0.5, eigen: +self.toFixed(2), leg: +legv.toFixed(2), netz: +imp.toFixed(2), pv: +pv.toFixed(2) });
    }
    return rows;
  }, [day, hourly, series, n]);
  const dayLeg = dayData.reduce((a, r) => a + r.leg, 0);
  const daySaving = (dayLeg * (netzbezugPreis(tariff) - legBezugPreis(tariff, leg)) + dayLeg * (leg.preis - tariff.rueckliefer)) / 100;

  // Geometrie
  const cols = Math.max(1, Math.ceil(n / 2));
  const W = Math.max(360, 30 + cols * 44 + 56);
  const TRAFO_X = W - 42;
  const span = TRAFO_X - 30;
  const cw = span / cols;
  const hw = Math.min(58, cw - 10);
  const pos = houses.map((_, i) => {
    const row = i < cols ? 0 : 1;
    const col = row === 0 ? i : i - cols;
    return { x: 12 + col * cw + cw / 2, row };
  });

  const sky = skyColor(t, season.daylen);
  const sunF = (t - 12.6) / (season.daylen / 2);
  const sunUp = Math.abs(sunF) < 1.05;
  const sunX = W / 2 + sunF * W * 0.42;
  const sunY = 92 - Math.cos(Math.max(-1, Math.min(1, sunF)) * Math.PI / 2) * 62;
  const hh = Math.floor(t), mm = Math.floor((t - hh) * 60 / 15) * 15;
  const clock = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  const sel = selected != null ? houses.find((h) => h.p.id === selected) : null;
  const netToGrid = tot.exp - tot.imp;

  return (
    <div className="anim">
      <div className="anim-head">
        <h1>Ein Tag im Quartier</h1>
        <p className="lead">Tippe auf ein Haus, um seine Werte zu sehen. Die Linien zeigen, wohin der Strom gerade fliesst. Die Häuser sind ein Beispiel mit erfundenen Werten.</p>
      </div>

      <div className="seg" role="tablist">
        {SEASONS.map((s) => (
          <button key={s.id} className={season.id === s.id ? 'active' : ''} onClick={() => setSeason(s)}>{s.label}</button>
        ))}
      </div>

      <div className="scene-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} className="scene" role="img" aria-label="Animierte Energieflüsse im Quartier">
          <defs>
            <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={sky.top} />
              <stop offset="1" stopColor={sky.bottom} />
            </linearGradient>
            <radialGradient id="sunGlow">
              <stop offset="0" stopColor="#ffd34d" stopOpacity="0.9" />
              <stop offset="1" stopColor="#ffd34d" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width={W} height={H} fill="url(#sky)" rx="18" />
          <rect y="215" width={W} height={H - 215} fill="var(--ground)" />
          {sunUp ? (
            <g>
              <circle cx={sunX} cy={sunY} r={20 + tot.pv * 0.6} fill="url(#sunGlow)" />
              <circle cx={sunX} cy={sunY} r="13" fill="#ffc21a" />
            </g>
          ) : (
            <g>
              <circle cx={W - 60} cy="46" r="12" fill="#e9ecf5" />
              <circle cx={W - 54} cy="42" r="11" fill={sky.top} />
              {[40, 90, 150, 220, 250].map((x, i) => <circle key={x} cx={x} cy={30 + (i % 3) * 18} r="1.2" fill="#fff" opacity="0.7" />)}
            </g>
          )}
          <text x="16" y="30" className="clock" fill={sky.day > 0.5 ? '#13213a' : '#fff'}>{clock}</text>

          {/* Strasse mit Netz */}
          <rect x="0" y={STREET - 14} width={W} height="28" fill="var(--street)" />
          <path d={`M14 ${STREET - 5} H${TRAFO_X - 16}`} className={tot.leg > 0.03 ? 'flow leg bus' : 'wire-idle'} style={{ strokeWidth: tot.leg > 0.03 ? flowWidth(tot.leg / 2) : undefined }} />
          <Flow d={`M14 ${STREET + 5} H${TRAFO_X - 16}`} value={Math.abs(netToGrid)} kind={netToGrid > 0 ? 'exp' : 'imp'} reverse={netToGrid < 0} />

          {/* IBB Trafostation */}
          <g transform={`translate(${TRAFO_X - 16} ${STREET - 28})`}>
            <rect width="40" height="56" rx="6" className="trafo" />
            <path d="M20 10 l-7 14 h8 l-5 14 l12 -18 h-8 l5 -10z" fill="#fff" />
            <text x="20" y="72" textAnchor="middle" className="svg-cap">IBB</text>
          </g>

          {houses.map((h, i) => {
            const { x, row } = pos[i];
            const top = row === 0;
            const baseY = top ? 214 : 312;
            const bodyH = 40;
            const houseTop = top ? baseY - bodyH : baseY;
            const roofY = houseTop - 18;
            const doorSide = top ? baseY : houseTop;
            const legOut = h.given > 0.03;
            const gridOut = h.exp > 0.03;
            const legD = `M${x - 6} ${doorSide} V${STREET - 5}`;
            const gridD = `M${x + 6} ${doorSide} V${STREET + 5}`;
            const pvShare = h.p.pv > 0 ? Math.min(1, h.pv / (h.p.pv * 0.75)) : 0;
            const isSel = selected === h.p.id;
            const night = sky.day < 0.4;
            return (
              <g key={h.p.id} className="house-g" onClick={() => setSelected(isSel ? null : h.p.id)}>
                <Flow d={legD} value={h.given + h.received} kind="leg" reverse={legOut ? false : true} />
                <Flow d={gridD} value={h.exp + h.imp} kind={gridOut ? 'exp' : 'imp'} reverse={!gridOut} />
                <g transform={`translate(${x - hw / 2} 0)`}>
                  <path d={`M-3 ${houseTop} L${hw / 2} ${roofY} L${hw + 3} ${houseTop} Z`} className={isSel ? 'roof sel' : 'roof'} />
                  {h.p.pv > 0 && (
                    <path
                      d={`M${hw * 0.12} ${houseTop - 3} L${hw / 2 - 2} ${roofY + 6} L${hw / 2 + 2} ${roofY + 6} L${hw * 0.88} ${houseTop - 3} Z`}
                      fill={mix('#29405f', '#ffd24a', pvShare)}
                      stroke="#1b2a40" strokeWidth="0.6"
                    />
                  )}
                  <rect y={houseTop} width={hw} height={bodyH} rx="2" className={isSel ? 'body sel' : 'body'} />
                  <rect x={hw * 0.18} y={houseTop + 10} width="9" height="9" rx="1.5" fill={night && h.load > 0.25 ? '#ffd76a' : 'var(--window)'} />
                  <rect x={hw * 0.82 - 9} y={houseTop + 10} width="9" height="9" rx="1.5" fill={night && h.load > 0.6 ? '#ffd76a' : 'var(--window)'} />
                  <text x={hw / 2} y={top ? roofY - 6 : houseTop + bodyH + 13} textAnchor="middle" className="house-name" style={top ? { fill: night ? '#fff' : '#13213a', stroke: 'none' } : undefined}>{shortName(h.p.name)}</text>
                  <text x={hw / 2} y={houseTop + 33} textAnchor="middle" className="house-kw">{num(h.load, 1)} kW</text>
                </g>
              </g>
            );
          })}
        </svg>

        <div className="scene-controls">
          <button className="btn round" onClick={() => setPlaying((v) => !v)} aria-label={playing ? 'Pause' : 'Abspielen'}>
            {playing ? '❚❚' : '▶'}
          </button>
          <input
            type="range" min="0" max="23.99" step="0.05" value={t}
            onChange={(e) => { setPlaying(false); setT(+e.target.value); }}
            aria-label="Uhrzeit"
          />
          <button className="btn chip" onClick={() => setSpeed((s) => (s >= 4 ? 0.5 : s * 2))}>{speed}×</button>
        </div>
      </div>

      <div className="flow-legend">
        <span><i className="sw leg" />Solarstrom zwischen Nachbarn (LEG)</span>
        <span><i className="sw imp" />Strom von der IBB</span>
        <span><i className="sw exp" />Überschuss an die IBB</span>
      </div>

      {sel ? (
        <div className="panel">
          <div className="panel-head">
            <strong>{sel.p.name}</strong>
            <button className="link" onClick={() => setSelected(null)}>Ganzes Quartier</button>
          </div>
          <div className="stats">
            <div><span>Produziert</span><b>{kw(sel.pv)}</b></div>
            <div><span>Verbraucht</span><b>{kw(sel.load)}</b></div>
            <div><span>Davon selbst gedeckt</span><b>{kw(sel.self)}</b></div>
            <div className="leg"><span>{sel.given > sel.received ? 'Liefert an Nachbarn' : 'Bezieht von Nachbarn'}</span><b>{kw(Math.max(sel.given, sel.received))}</b></div>
            <div className="imp"><span>Von der IBB</span><b>{kw(sel.imp)}</b></div>
            <div className="exp"><span>An die IBB</span><b>{kw(sel.exp)}</b></div>
          </div>
        </div>
      ) : (
        <div className="panel">
          <div className="panel-head"><strong>Ganzes Quartier · {clock}</strong></div>
          <div className="stats">
            <div><span>Solarproduktion</span><b>{kw(tot.pv)}</b></div>
            <div><span>Verbrauch</span><b>{kw(tot.load)}</b></div>
            <div><span>Eigenverbrauch</span><b>{kw(tot.self)}</b></div>
            <div className="leg"><span>LEG-Austausch</span><b>{kw(tot.leg)}</b></div>
            <div className="imp"><span>Von der IBB</span><b>{kw(tot.imp)}</b></div>
            <div className="exp"><span>An die IBB</span><b>{kw(tot.exp)}</b></div>
          </div>
        </div>
      )}

      <div className="chart-card">
        <div className="chart-title">Woher kommt der Strom an diesem Tag? (kW)</div>
        <ResponsiveContainer width="100%" height={190}>
          <ComposedChart data={dayData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
            <XAxis dataKey="h" type="number" domain={[0, 24]} ticks={[0, 6, 12, 18, 24]} tickFormatter={(v) => `${v}h`} tick={{ fontSize: 11, fill: 'var(--ink-2)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--ink-2)' }} axisLine={false} tickLine={false} />
            <Tooltip labelFormatter={(v) => `${Math.floor(v)}–${Math.floor(v) + 1} Uhr`} formatter={(v, name) => [`${num(v, 1)} kW`, name]} contentStyle={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, fontSize: 13, color: 'var(--ink)' }} />
            <Area type="monotone" dataKey="eigen" name="Eigenverbrauch" stackId="1" stroke="none" fill="var(--sun)" fillOpacity={0.85} />
            <Area type="monotone" dataKey="leg" name="Aus der LEG" stackId="1" stroke="none" fill="var(--leg)" fillOpacity={0.85} />
            <Area type="monotone" dataKey="netz" name="Von der IBB" stackId="1" stroke="none" fill="var(--grid)" fillOpacity={0.55} />
            <Line type="monotone" dataKey="pv" name="Solarproduktion" stroke="var(--sun-deep)" strokeWidth={2} dot={false} strokeDasharray="4 3" />
            <ReferenceLine x={t} stroke="var(--ink)" strokeWidth={1.5} />
          </ComposedChart>
        </ResponsiveContainer>
        <p className="chart-foot">
          An diesem Tag bleiben <strong>{num(dayLeg, 0)} kWh</strong> Solarstrom im Quartier. Vorteil für alle zusammen:{' '}
          <strong>{chf(daySaving, 2)}</strong>.
        </p>
      </div>
    </div>
  );
}
