// Petites fonctions statistiques, sans dépendance.

export function clamp(v, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, v));
}

export function sorted(values) {
  return values.filter((v) => typeof v === "number" && Number.isFinite(v)).sort((a, b) => a - b);
}

// Quantile par interpolation linéaire sur un tableau déjà trié.
export function quantile(sortedValues, q) {
  const n = sortedValues.length;
  if (n === 0) return null;
  if (n === 1) return sortedValues[0];
  const pos = (n - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sortedValues[lo] + (sortedValues[hi] - sortedValues[lo]) * (pos - lo);
}

export function describe(values) {
  const s = sorted(values);
  return {
    n: s.length,
    q1: quantile(s, 0.25),
    median: quantile(s, 0.5),
    q3: quantile(s, 0.75),
  };
}

// Coefficient de variation en % (écart-type / moyenne).
export function coefficientOfVariation(values) {
  const s = sorted(values);
  if (s.length < 2) return null;
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  if (mean === 0) return null;
  const variance = s.reduce((a, b) => a + (b - mean) ** 2, 0) / (s.length - 1);
  return (Math.sqrt(variance) / mean) * 100;
}

export function round(v, step = 1) {
  if (v == null || !Number.isFinite(v)) return null;
  return Math.round(v / step) * step;
}

export function daysBetween(a, b) {
  return (new Date(b).getTime() - new Date(a).getTime()) / 86400000;
}
