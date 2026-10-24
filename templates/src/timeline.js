// Master timeline. Every animated value in the film is a pure function of t = frame / FPS.
// Nothing reads a clock, nothing integrates delta-time, nothing carries state between frames.
export const FPS = 30;
export const FRAMES = 150;            // 5.000 s demo. A full film: 1200 frames = 40.000 s.
export const DURATION = FRAMES / FPS;
export const W = 1920, H = 1080;

// The brief's beats, at exact second boundaries. Keep this table in sync with the brief's timeline table.
export const SECTIONS = [
  { id: 'hero',    t0: 0.0, t1: 1.6, title: 'Hero orbit' },
  { id: 'explode', t0: 1.6, t1: 3.6, title: 'Exploded view' },
  { id: 'final',   t0: 3.6, t1: 5.0, title: 'Reassembly + end card' },
];

// Locked on-screen copy. Scenes read strings from here only, so a QC script can grep them.
export const COPY = {
  kicker: '01 · PROCEDURAL DEMO',
  title: 'Turbine rotor',
  labels: { blades: 'Blades × 14', hub: 'Machined hub', shroud: 'Outer shroud' },
  end: 'One brief → one frame-exact film',
};

// ---------- easing + scheduling helpers ----------
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** eased 0..1 between a and b */
export const ramp = (t, a, b, e = smoother) => e(clamp((t - a) / (b - a)));
/** fade in a..b, hold, fade out c..d */
export const win = (t, a, b, c, d, e = smoother) => ramp(t, a, b, e) * (1 - ramp(t, c, d, e));
/** piecewise eased keyed scalar: keys [[t, v], ...], flat outside */
export function keyed(t, keys, e = smoother) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i], [t1, v1] = keys[i + 1];
    if (t <= t1) return lerp(v0, v1, e(clamp((t - t0) / (t1 - t0))));
  }
  return keys[keys.length - 1][1];
}

/**
 * C1 cubic Hermite track over vector keys with monotone-limited tangents:
 * continuous velocity (no camera jerks) and no overshoot. keys: [{ t, v: [...], hold? }]
 */
export function makeTrack(keys) {
  const n = keys.length, dim = keys[0].v.length;
  const tang = keys.map((k, i) => {
    const out = new Array(dim).fill(0);
    if (i === 0 || i === n - 1 || k.hold) return out;
    const a = keys[i - 1], b = keys[i + 1];
    for (let j = 0; j < dim; j++) {
      const d0 = (k.v[j] - a.v[j]) / (k.t - a.t), d1 = (b.v[j] - k.v[j]) / (b.t - k.t);
      if (d0 * d1 <= 0) continue;                       // local extremum → flat tangent, no overshoot
      const m = (b.v[j] - a.v[j]) / (b.t - a.t);
      out[j] = Math.sign(m) * Math.min(Math.abs(m), 3 * Math.min(Math.abs(d0), Math.abs(d1)));
    }
    return out;
  });
  return (t) => {
    if (t <= keys[0].t) return keys[0].v.slice();
    if (t >= keys[n - 1].t) return keys[n - 1].v.slice();
    let i = 0;
    while (t > keys[i + 1].t) i++;
    const a = keys[i], b = keys[i + 1], h = b.t - a.t, s = (t - a.t) / h, s2 = s * s, s3 = s2 * s;
    const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
    return a.v.map((_, j) => h00 * a.v[j] + h10 * h * tang[i][j] + h01 * b.v[j] + h11 * h * tang[i + 1][j]);
  };
}

// ---------- seeded randomness ----------
/** mulberry32: a small seeded PRNG. Use for build-time layout, never per frame with shared state. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
/** stateless hash → [0,1): per-instance constants (particle i, bolt k) that never depend on render order */
export function hash01(i, seed = 0) {
  let x = (Math.imul(i ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(seed + 0x27d4eb2f, 0xc2b2ae35)) >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x7feb352d) >>> 0; x ^= x >>> 15; x = Math.imul(x, 0x846ca68b) >>> 0; x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

// ---------- closed-form motion ----------
// Rotor speed in rev/s. Its angle is the exact integral, so any frame can be rendered alone, in any order.
// omega(t) = W0 + (W1 - W0) * smoothstep over [A, B]; ∫ smoothstep has a closed form.
const W0 = 0.12, W1 = 0.55, A = 3.4, B = 4.6;
function intSmooth(t) {             // ∫0^t smoothstep((x-A)/(B-A)) dx
  if (t <= A) return 0;
  const L = B - A;
  if (t >= B) return L / 2 + (t - B);
  const u = (t - A) / L;
  return L * (u * u * u - 0.5 * u * u * u * u);
}
export const rotorAngle = (t) => 2 * Math.PI * (W0 * t + (W1 - W0) * intSmooth(t));
