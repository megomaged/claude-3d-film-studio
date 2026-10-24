// Camera: one C1 Hermite spline over [azimuth°, elevation°, distance, target x, y, z, lens shift].
// Interpolating in spherical coordinates makes orbits arc around the subject instead of cutting through it.
// Lens shift (film offset) frames the subject off-centre for titles without changing the perspective.
// Depth-of-field focus = camera→target distance, so the hero is always sharp unless you rack on purpose.
import * as THREE from 'three';
import { makeTrack } from './timeline.js';

const DEG = Math.PI / 180;
// [az, el, dist, tx, ty, tz, shift]
export const CAM_KEYS = [
  { t: 0.0, v: [62, 12, 15.5, 0.0, 0.0, 0.0, -0.12] },
  { t: 1.6, v: [44, 15, 13.5, 0.0, 0.0, 0.0, -0.06] },
  { t: 2.8, v: [28, 20, 16.5, 0.0, 0.2, 0.0, 0.0] },
  { t: 3.8, v: [40, 16, 14.0, 0.0, 0.0, 0.0, 0.0] },
  { t: 5.0, v: [60, 12, 14.5, 0.0, -0.3, 0.0, 0.0] },
];
const track = makeTrack(CAM_KEYS);

export function applyCamera(camera, t) {
  const [az, el, d, tx, ty, tz, shift] = track(t);
  const a = az * DEG, e = el * DEG;
  const target = new THREE.Vector3(tx, ty, tz);
  camera.position.set(tx + d * Math.cos(e) * Math.sin(a), ty + d * Math.sin(e), tz + d * Math.cos(e) * Math.cos(a));
  camera.up.set(0, 1, 0);
  camera.lookAt(target);
  camera.filmOffset = shift * camera.getFilmWidth();
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return { target, dist: d };
}

/** QC helper: largest per-frame view-direction change in degrees (a spike = a visible jump). */
export function maxTurnPerFrame(frames, fps) {
  const cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 100);
  let prev = null, worst = { deg: 0, frame: 0 };
  for (let n = 0; n < frames; n++) {
    applyCamera(cam, n / fps);
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    if (prev) { const d = (dir.angleTo(prev) * 180) / Math.PI; if (d > worst.deg) worst = { deg: d, frame: n }; }
    prev = dir;
  }
  return worst;
}
