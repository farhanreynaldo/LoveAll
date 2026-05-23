// Mulberry32 — small, fast, well-distributed seeded RNG.
// Returns a function that yields a float in [0, 1) each call.
export function createRng(seed) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickOne(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}
