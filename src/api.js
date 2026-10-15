// Gemeinsame Daten der Nachbarschaft (Supabase). Der Schlüssel ist öffentlich; die Datenbank
// gibt nur Adressen, Status und anonymisierte Werte heraus. Schreiben geht nur mit dem persönlichen Link.
const URL_BASE = 'https://rdrtyknlrihvyvsitkig.supabase.co/rest/v1/rpc/';
const KEY = 'sb_publishable_NpILcijR9NQv2Pel96WZDg_GoIvq1F7';

async function rpc(name, body) {
  const res = await fetch(URL_BASE + name, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.message || `Server antwortet mit ${res.status}`);
  return json;
}

// { households: [{id, address, status}], values: [{verbrauch, pv, wp, ev}] }
export const fetchPublic = (token) => rpc('get_public', { p_token: token || null });

// Eigener Haushalt oder null, wenn der Link ungültig ist
export const fetchOwn = (token) => rpc('get_household', { p_token: token });

export const saveOwn = (token, h) => rpc('save_household', {
  p_token: token, p_status: h.status, p_verbrauch: h.verbrauch, p_pv: h.pv, p_wp: h.wp, p_ev: h.ev,
});

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
