import React, { useEffect, useMemo, useState } from 'react';
import { DEFAULT_LEG, DEFAULT_TARIFF, SAMPLE_PARTICIPANTS } from './defaults.js';
import { simulate } from './engine.js';
import Explain from './pages/Explain.jsx';
import Animation from './pages/Animation.jsx';
import Calculator from './pages/Calculator.jsx';

const PAGES = [
  { id: 'erklaerung', label: 'So funktioniert’s' },
  { id: 'animation', label: 'Animation' },
  { id: 'rechner', label: 'Rechner' },
];
const STORE = 'leg-rechner-v1';

function load() {
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) return JSON.parse(raw);
  } catch { /* Speicher nicht verfügbar */ }
  return null;
}

export default function App() {
  const saved = useMemo(load, []);
  const [page, setPage] = useState(() => {
    const h = location.hash.replace('#', '');
    return PAGES.some((p) => p.id === h) ? h : 'erklaerung';
  });
  const [participants, setParticipants] = useState(saved?.participants ?? SAMPLE_PARTICIPANTS);
  const [tariff, setTariff] = useState({ ...DEFAULT_TARIFF, ...(saved?.tariff ?? {}) });
  const [leg, setLeg] = useState({ ...DEFAULT_LEG, ...(saved?.leg ?? {}) });

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
      // Messdaten (CSV) werden bewusst nicht gespeichert – sie bleiben nur in dieser Sitzung
      const slim = participants.map(({ data, ...p }) => p);
      localStorage.setItem(STORE, JSON.stringify({ participants: slim, tariff, leg }));
    } catch { /* ignorieren */ }
  }, [participants, tariff, leg]);

  const result = useMemo(() => simulate(participants, tariff, leg, { hourly: true }), [participants, tariff, leg]);

  const go = (id) => {
    setPage(id);
    history.replaceState(null, '', `#${id}`);
    scrollTo({ top: 0, behavior: 'smooth' });
  };

  const reset = () => {
    setParticipants(SAMPLE_PARTICIPANTS);
    setTariff(DEFAULT_TARIFF);
    setLeg(DEFAULT_LEG);
  };

  const usesSample = participants.every((p) => !p.data);

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <span className="sun-dot" aria-hidden />
          <div>
            <div className="brand-title">Quartierstrom</div>
            <div className="brand-sub">LEG-Rechner für unsere Nachbarschaft</div>
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

      {usesSample && (
        <div className="banner">
          Berechnet mit <strong>Beispieldaten</strong> (fiktive Häuser, simulierte Profile). Eigene Werte im{' '}
          <button className="link" onClick={() => go('rechner')}>Rechner</button> erfassen.
        </div>
      )}

      <main>
        {page === 'erklaerung' && <Explain tariff={tariff} leg={leg} result={result} go={go} />}
        {page === 'animation' && <Animation participants={participants} result={result} tariff={tariff} leg={leg} />}
        {page === 'rechner' && (
          <Calculator
            participants={participants} setParticipants={setParticipants}
            tariff={tariff} setTariff={setTariff}
            leg={leg} setLeg={setLeg}
            result={result} reset={reset}
          />
        )}
      </main>

      <footer className="foot">
        Alle Angaben ohne Gewähr. Tarife: IBB Preisblatt «Strompreise Basis 2026» (exkl. MWST). Die Berechnung ist eine
        Abschätzung und ersetzt keine Offerte der IBB. Eingaben bleiben in deinem Browser.
      </footer>
    </div>
  );
}
