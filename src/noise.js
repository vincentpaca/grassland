// Procedural rolling-grassland heightfield + helpers. Gentle, walkable hills.
function hash2(ix, iz, seed = 0) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function smooth(t) { return t * t * (3 - 2 * t); }
function valueNoise(x, z, seed = 0) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  const ux = smooth(fx), uz = smooth(fz);
  return (a * (1 - ux) + b * ux) * (1 - uz) + (c * (1 - ux) + d * ux) * uz;
}
export const WIND = [1.0, 0.0];
// gentle rolling hills: broad swells + small bumps. Keep low so it reads as a grassy meadow.
export function height(x, z) {
  let h = (valueNoise(x * 0.012, z * 0.012, 11) - 0.5) * 5.0;     // broad swells (~5m)
  h += (valueNoise(x * 0.05 + 30, z * 0.05, 5) - 0.5) * 1.2;      // medium bumps
  h += (valueNoise(x * 0.2, z * 0.2, 23) - 0.5) * 0.25;           // fine tufts
  return h;
}
export function normal(x, z, eps = 0.6) {
  const hL = height(x - eps, z), hR = height(x + eps, z);
  const hD = height(x, z - eps), hU = height(x, z + eps);
  const nx = (hL - hR), nz = (hD - hU), ny = 2 * eps;
  const l = Math.hypot(nx, ny, nz) || 1;
  return [nx / l, ny / l, nz / l];
}
export { hash2, valueNoise };
