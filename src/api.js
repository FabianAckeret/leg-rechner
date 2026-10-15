// Gemeinsame Daten der Nachbarschaft (Supabase). Der Schlüssel ist öffentlich. Die Berechnung läuft
// auf dem Server, der Browser erhält nur Summen und das eigene Ergebnis. Schreiben geht nur mit dem persönlichen Link.
const BASE = 'https://rdrtyknlrihvyvsitkig.supabase.co';
const KEY = 'sb_publishable_NpILcijR9NQv2Pel96WZDg_GoIvq1F7';

async function post(url, body, signal) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.message || `Server antwortet mit ${res.status}`);
  return json;
}

const rpc = (name, body) => post(`${BASE}/rest/v1/rpc/${name}`, body);

// { summary, monthly, own, counts: {ja, offen, nein}, participants, examples, usesReal, minOthers }
export function fetchResult({ token, draft, ownData, tariff, leg, includeOpen }, signal) {
  const data = ownData && { load: Array.from(ownData.load), pv: ownData.pv && Array.from(ownData.pv) };
  return post(`${BASE}/functions/v1/simulate`, { token, own: draft, ownData: data, tariff, leg, includeOpen }, signal);
}

// Eigener Haushalt oder null, wenn der Link ungültig ist
export const fetchOwn = (token) => rpc('get_household', { p_token: token });

export const saveOwn = (token, h, consent) => rpc('save_household', {
  p_token: token, p_status: h.status, p_verbrauch: h.verbrauch, p_pv: h.pv, p_wp: h.wp, p_ev: h.ev, p_consent: consent,
});

// Löscht alle gespeicherten Angaben des eigenen Hauses
export const clearOwn = (token) => rpc('clear_household', { p_token: token });

const TOKEN_STORE = 'leg-rechner-key';

// Persönlicher Link: ?key=… in der URL; einmal geöffnet, merkt sich der Browser den Schlüssel
export function readToken() {
  const fromUrl = new URLSearchParams(location.search).get('key');
  try {
    if (fromUrl) localStorage.setItem(TOKEN_STORE, fromUrl);
    return fromUrl || localStorage.getItem(TOKEN_STORE);
  } catch {
    return fromUrl;
  }
}

export function forgetToken() {
  try { localStorage.removeItem(TOKEN_STORE); } catch { /* ignorieren */ }
  const u = new URL(location.href);
  u.searchParams.delete('key');
  history.replaceState(null, '', u);
}
