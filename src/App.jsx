import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_LEG, DEFAULT_TARIFF, SAMPLE_PARTICIPANTS } from './defaults.js';
import { simulate } from './engine.js';
import { clearOwn, fetchOwn, fetchResult, forgetToken, readToken, saveOwn } from './api.js';
import Explain from './pages/Explain.jsx';
import Animation from './pages/Animation.jsx';
import Calculator from './pages/Calculator.jsx';
import Privacy from './pages/Privacy.jsx';

const PAGES = [
  { id: 'erklaerung', label: 'So funktioniert’s' },
  { id: 'animation', label: 'Animation' },
  { id: 'rechner', label: 'Rechner' },
];
// Seiten, die über Links erreichbar sind, aber nicht in der Navigation stehen
const HIDDEN = ['datenschutz'];
const known = (h) => PAGES.some((p) => p.id === h) || HIDDEN.includes(h);
const STORE = 'leg-rechner-v4'; // v4: IBB-Gebühren LEGPLUS 2026 ersetzen die alten Annahmen

// Die Animation zeigt erfundene Beispielhäuser, nie echte Angaben
const EXAMPLES = SAMPLE_PARTICIPANTS.map((p, i) => ({ ...p, name: `Haus ${String.fromCharCode(65 + i)}` }));

function load() {
  try {
    const raw = localStorage.getItem(STORE);
    if (raw) return JSON.parse(raw);
  } catch { /* Speicher nicht verfügbar */ }
  return null;
}

// Eigene Angaben als Formularwerte; fehlen sie, dienen die Beispielwerte als Ausgangspunkt
function draftFrom(own) {
  const s = SAMPLE_PARTICIPANTS.find((p) => p.id === own.id) ?? { verbrauch: 4500, pv: 0, wp: false, ev: false };
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

export default function App() {
  const saved = useMemo(load, []);
  const [page, setPage] = useState(() => {
    const h = location.hash.replace('#', '');
    return known(h) ? h : 'erklaerung';
  });
  const [tariff, setTariff] = useState({ ...DEFAULT_TARIFF, ...(saved?.tariff ?? {}) });
  const [leg, setLeg] = useState({ ...DEFAULT_LEG, ...(saved?.leg ?? {}) });
  const [includeOpen, setIncludeOpen] = useState(saved?.includeOpen ?? true);

  const [token, setToken] = useState(readToken);
  const [own, setOwn] = useState(null);
  const [badLink, setBadLink] = useState(false);
  const [draft, setDraft] = useState(null);
  const [ownData, setOwnData] = useState(undefined); // Messdaten nur in dieser Sitzung

  const [server, setServer] = useState(null);
  const [net, setNet] = useState('loading'); // loading | ok | offline
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!token) return;
    fetchOwn(token)
      .then((mine) => {
        setBadLink(!mine);
        setOwn(mine);
        setDraft(mine ? draftFrom(mine) : null);
      })
      .catch(() => setNet('offline'));
  }, [token]);

  // Ergebnis vom Server; kurz warten, damit nicht jeder Tastendruck eine Anfrage auslöst
  useEffect(() => {
    if (token && !own && !badLink) return undefined; // eigenes Haus wird noch geladen
    const ctrl = new AbortController();
    const id = setTimeout(() => {
      fetchResult({ token: own ? token : null, draft: own ? draft : null, ownData, tariff, leg, includeOpen }, ctrl.signal)
        .then((r) => { setServer(r); setNet('ok'); })
        .catch((e) => { if (e.name !== 'AbortError') setNet('offline'); });
    }, 350);
    return () => { clearTimeout(id); ctrl.abort(); };
  }, [token, own, badLink, draft, ownData, tariff, leg, includeOpen, retry]);

  useEffect(() => {
    const onHash = () => {
      const h = location.hash.replace('#', '');
      if (known(h)) setPage(h);
    };
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify({ tariff, leg, includeOpen }));
    } catch { /* ignorieren */ }
  }, [tariff, leg, includeOpen]);

  const example = useMemo(() => simulate(EXAMPLES, tariff, leg, { hourly: true }), [tariff, leg]);
  // Ohne Server rechnet die Seite mit den Beispielhäusern
  const result = server && net !== 'offline' ? server : { summary: example.summary, monthly: example.monthly, own: null, counts: null };

  const save = async (consent) => {
    const mine = await saveOwn(token, draft, consent);
    setOwn(mine);
    setDraft(draftFrom(mine));
  };

  const clear = async () => {
    const mine = await clearOwn(token);
    setOwnData(undefined);
    setOwn(mine);
    setDraft(draftFrom(mine));
  };

  const logout = () => {
    forgetToken();
    setToken(null);
    setOwn(null);
    setDraft(null);
    setOwnData(undefined);
    setBadLink(false);
  };

  const go = useCallback((id) => {
    setPage(id);
    history.replaceState(null, '', `${location.search}#${id}`);
    scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const reset = () => {
    setTariff(DEFAULT_TARIFF);
    setLeg(DEFAULT_LEG);
  };

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
          Die Angaben der Nachbarschaft lassen sich gerade nicht laden. Der Rechner zeigt Beispielwerte.{' '}
          <button className="link" onClick={() => { setNet('loading'); setRetry((n) => n + 1); }}>Nochmals versuchen</button>
        </div>
      )}
      {badLink && (
        <div className="banner">
          Dieser persönliche Link ist ungültig. Bitte prüfe, ob du ihn vollständig kopiert hast.{' '}
          <button className="link" onClick={logout}>Ohne Link weiter</button>
        </div>
      )}
      {net === 'ok' && !badLink && server && !server.usesReal && (
        <div className="banner">
          Erst wenn mindestens {server.minOthers} Häuser ihre Angaben erfasst haben, rechnet der Rechner mit echten Werten.
          Bis dahin zeigt er <strong>Beispielwerte</strong>.{' '}
          {own && <>Deine Angaben erfasst du im <button className="link" onClick={() => go('rechner')}>Rechner</button>.</>}
        </div>
      )}

      <main>
        {page === 'erklaerung' && <Explain tariff={tariff} leg={leg} result={result} go={go} />}
        {page === 'animation' && <Animation participants={EXAMPLES} result={example} tariff={tariff} leg={leg} />}
        {page === 'rechner' && (
          <Calculator
            server={server} net={net} own={own} draft={draft} setDraft={setDraft}
            ownData={ownData} setOwnData={setOwnData} save={save} clear={clear} logout={logout} go={go}
            includeOpen={includeOpen} setIncludeOpen={setIncludeOpen}
            tariff={tariff} setTariff={setTariff}
            leg={leg} setLeg={setLeg}
            result={result} reset={reset}
          />
        )}
        {page === 'datenschutz' && <Privacy go={go} />}
      </main>

      <footer className="foot">
        Alle Angaben ohne Gewähr. Tarife: IBB Preisblatt «Strompreise Basis 2026» (exkl. MWST). Die Berechnung ist eine
        Abschätzung und ersetzt keine Offerte der IBB. Andere sehen von deinen Angaben nur Summen über mehrere Häuser.{' '}
        <button className="link" onClick={() => go('datenschutz')}>Datenschutz</button>
      </footer>
    </div>
  );
}
