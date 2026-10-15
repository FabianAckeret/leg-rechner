import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_LEG, DEFAULT_TARIFF, SAMPLE_PARTICIPANTS } from './defaults.js';
import { simulate } from './engine.js';
import { fetchOwn, fetchPublic, forgetToken, readToken, saveOwn } from './api.js';
import Explain from './pages/Explain.jsx';
import Animation from './pages/Animation.jsx';
import Calculator from './pages/Calculator.jsx';

const PAGES = [
  { id: 'erklaerung', label: 'So funktioniert’s' },
  { id: 'animation', label: 'Animation' },
  { id: 'rechner', label: 'Rechner' },
];
const STORE = 'leg-rechner-v3';

function load() {
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) return JSON.parse(raw);
  } catch { /* Speicher nicht verfügbar */ }
  return null;
}

const sampleFor = (id) => SAMPLE_PARTICIPANTS.find((s) => s.id === id);

// Eigene Angaben als Formularwerte; fehlen sie, dienen die Beispielwerte als Ausgangspunkt
export function draftFrom(own) {
  const s = sampleFor(own.id) ?? { verbrauch: 4500, pv: 0, wp: false, ev: false };
  const has = own.verbrauch != null;
  return {
    status: own.status,
    verbrauch: has ? +own.verbrauch : s.verbrauch,
    pv: has ? +own.pv || 0 : s.pv,
    wp: has ? own.wp : s.wp,
    ev: has ? own.ev : s.ev,
    beispiel: !has,
  };
}

// Teilnehmende für die Simulation: eigenes Haus, anonymisierte Zusagen, offene Adressen mit Beispielwerten
function buildParticipants(community, own, draft, ownData, includeOpen) {
  if (!community) return SAMPLE_PARTICIPANTS;
  const list = [];
  if (own && draft.status !== 'nein') {
    list.push({ id: own.id, name: own.address, verbrauch: draft.verbrauch, pv: draft.pv, wp: draft.wp, ev: draft.ev, beispiel: draft.beispiel, own: true, data: ownData });
  }
  // Stabile Reihenfolge, damit «Haus A» beim nächsten Laden dasselbe Haus bleibt
  const values = [...community.values].sort((a, b) => a.verbrauch - b.verbrauch || a.pv - b.pv);
  values.forEach((v, i) => list.push({
    id: `anon-${i}`, name: `Haus ${String.fromCharCode(65 + i)}`, verbrauch: +v.verbrauch, pv: +v.pv || 0, wp: v.wp, ev: v.ev,
  }));
  if (includeOpen) {
    for (const h of community.households) {
      if (h.status === 'offen' && h.id !== own?.id && sampleFor(h.id)) list.push(sampleFor(h.id));
    }
  }
  return list;
}

export default function App() {
  const saved = useMemo(load, []);
  const [page, setPage] = useState(() => {
    const h = location.hash.replace('#', '');
    return PAGES.some((p) => p.id === h) ? h : 'erklaerung';
  });
  const [tariff, setTariff] = useState({ ...DEFAULT_TARIFF, ...(saved?.tariff ?? {}) });
  const [leg, setLeg] = useState({ ...DEFAULT_LEG, ...(saved?.leg ?? {}) });
  const [includeOpen, setIncludeOpen] = useState(saved?.includeOpen ?? true);

  const [token, setToken] = useState(readToken);
  const [community, setCommunity] = useState(null);
  const [net, setNet] = useState('loading'); // loading | ok | offline
  const [own, setOwn] = useState(null);
  const [badLink, setBadLink] = useState(false);
  const [draft, setDraft] = useState(null);
  const [ownData, setOwnData] = useState(undefined); // Messdaten nur in dieser Sitzung

  const refresh = useCallback(async () => {
    try {
      const [pub, mine] = await Promise.all([fetchPublic(token), token ? fetchOwn(token) : null]);
      setCommunity(pub);
      setNet('ok');
      if (token) {
        setBadLink(!mine);
        setOwn(mine);
        setDraft((d) => d ?? (mine ? draftFrom(mine) : null));
      }
    } catch {
      setNet('offline');
    }
  }, [token]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const onHash = () => {
      const h = location.hash.replace('#', '');
      if (PAGES.some((p) => p.id === h)) setPage(h);
    };
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify({ tariff, leg, includeOpen }));
    } catch { /* ignorieren */ }
  }, [tariff, leg, includeOpen]);

  const participants = useMemo(
    () => buildParticipants(community, own, draft, ownData, includeOpen),
    [community, own, draft, ownData, includeOpen],
  );
  const result = useMemo(() => simulate(participants, tariff, leg, { hourly: true }), [participants, tariff, leg]);

  const save = async () => {
    const mine = await saveOwn(token, draft);
    setOwn(mine);
    setDraft(draftFrom(mine));
    const pub = await fetchPublic(token);
    setCommunity(pub);
  };

  const logout = () => {
    forgetToken();
    setToken(null);
    setOwn(null);
    setDraft(null);
    setOwnData(undefined);
    setBadLink(false);
  };

  const go = (id) => {
    setPage(id);
    history.replaceState(null, '', `${location.search}#${id}`);
    scrollTo({ top: 0, behavior: 'smooth' });
  };

  const reset = () => {
    setTariff(DEFAULT_TARIFF);
    setLeg(DEFAULT_LEG);
  };

  const usesSample = participants.some((p) => p.beispiel);

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <span className="sun-dot" aria-hidden />
          <div>
            <div className="brand-title">Quartierstrom</div>
            <div className="brand-sub">Fluhmattstrasse · 5222 Umiken</div>
          </div>
        </div>
        <nav className="tabs" aria-label="Seiten">
          {PAGES.map((p) => (
            <button key={p.id} className={page === p.id ? 'tab active' : 'tab'} onClick={() => go(p.id)}>
              {p.label}
            </button>
          ))}
        </nav>
      </header>

      {net === 'offline' && (
        <div className="banner">
          Die gemeinsamen Angaben der Nachbarschaft lassen sich gerade nicht laden. Der Rechner zeigt Beispielwerte.{' '}
          <button className="link" onClick={refresh}>Nochmals versuchen</button>
        </div>
      )}
      {badLink && (
        <div className="banner">
          Dieser persönliche Link ist ungültig. Bitte prüfe, ob du ihn vollständig kopiert hast.{' '}
          <button className="link" onClick={logout}>Ohne Link weiter</button>
        </div>
      )}
      {net === 'ok' && !badLink && usesSample && (
        <div className="banner">
          Noch nicht alle Häuser haben ihre Angaben erfasst. Für offene Adressen rechnet der Rechner mit <strong>Beispielwerten</strong>.{' '}
          {own ? (
            <>Deine Angaben erfasst du im <button className="link" onClick={() => go('rechner')}>Rechner</button>.</>
          ) : (
            <>Mit deinem persönlichen Link erfasst du die Werte für dein Haus.</>
          )}
        </div>
      )}

      <main>
        {page === 'erklaerung' && <Explain tariff={tariff} leg={leg} result={result} go={go} />}
        {page === 'animation' && <Animation participants={participants} result={result} tariff={tariff} leg={leg} />}
        {page === 'rechner' && (
          <Calculator
            community={community} net={net} own={own} draft={draft} setDraft={setDraft}
            ownData={ownData} setOwnData={setOwnData} save={save} logout={logout}
            includeOpen={includeOpen} setIncludeOpen={setIncludeOpen}
            tariff={tariff} setTariff={setTariff}
            leg={leg} setLeg={setLeg}
            result={result} reset={reset}
          />
        )}
      </main>

      <footer className="foot">
        Alle Angaben ohne Gewähr. Tarife: IBB Preisblatt «Strompreise Basis 2026» (exkl. MWST). Die Berechnung ist eine
        Abschätzung und ersetzt keine Offerte der IBB. Angaben der Nachbarn erscheinen nur anonym («Haus A», «Haus B» …);
        sichtbar sind nur Adresse und Teilnahme.
      </footer>
    </div>
  );
}
