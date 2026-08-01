// Shared procedural heightfield + helpers (layered wind-sheared noise).
// All pure JS, deterministic, used by terrain + patch + rocks.

// hash -> [0,1]
function hash2(ix, iz, seed = 0) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function smooth(t) { return t * t * (3 - 2 * t); }
// 2D value noise
function valueNoise(x, z, seed = 0) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  const ux = smooth(fx), uz = smooth(fz);
  return (a * (1 - ux) + b * ux) * (1 - uz) + (c * (1 - ux) + d * ux) * uz;
}
// wind direction (normalised)
export const WIND = (() => { const v = [1.0, 0.28]; const l = Math.hypot(v[0], v[1]); return [v[0] / l, v[1] / l]; })();
// shear coordinates along wind: stretches features along the wind axis
function shear(x, z, stretch) {
  // u along wind, v perpendicular; stretch u
  const u = x * WIND[0] + z * WIND[1];
  const v = -x * WIND[1] + z * WIND[0];
  return [u / stretch, v * 0.55];
}
// world height in metres. Three scales + wind direction.
export function height(x, z) {
  // broad dunes (tens of metres)
  let [du, dv] = shear(x, z, 5.2);
  let h = valueNoise(du * 0.018, dv * 0.018, 11) * 6.4;
  h += (valueNoise(du * 0.018 + 100, dv * 0.018 - 50, 5) - 0.5) * 4.0;
  // medium drifts / wind lobes (metres), strongly stretched
  let [mu, mv] = shear(x, z, 2.6);
  h += (valueNoise(mu * 0.11, mv * 0.11, 23) - 0.5) * 1.7;
  h += (valueNoise(mu * 0.23 + 7, mv * 0.23, 9) - 0.5) * 0.8;
  // sastrugi ridges / ripples (decimetres), sheared hard
  let [ru, rv] = shear(x, z, 1.15);
  h += (valueNoise(ru * 1.7, rv * 1.7, 31) - 0.5) * 0.18;
  return h;
}
// analytic-ish normal from height finite diff (used for baked terrain + static patch cache)
export function normal(x, z, eps = 0.35) {
  const hL = height(x - eps, z), hR = height(x + eps, z);
  const hD = height(x, z - eps), hU = height(x, z + eps);
  const nx = (hL - hR), nz = (hD - hU);
  const ny = 2 * eps;
  const l = Math.hypot(nx, ny, nz) || 1;
  return [nx / l, ny / l, nz / l];
}
export { hash2, valueNoise };
