const nf = (d) => new Intl.NumberFormat('de-CH', { minimumFractionDigits: d, maximumFractionDigits: d });
export const chf = (v, d = 0) => `CHF ${nf(d).format(v)}`;
export const kwh = (v) => `${nf(0).format(v)} kWh`;
export const kw = (v) => `${nf(1).format(v)} kW`;
export const rp = (v) => `${nf(2).format(v)} Rp.`;
export const pct = (v, d = 0) => `${nf(d).format(v * 100)} %`;
export const num = (v, d = 0) => nf(d).format(v);
