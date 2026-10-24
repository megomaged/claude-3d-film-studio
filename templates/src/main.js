// Demo film: a procedural turbine rotor. 5 s hero orbit → exploded view with labels → reassembly + end card.
// Contract with render.mjs: window.renderFrame(n) draws frame n and resolves with n; window.__ready = true once
// every shader is compiled; window.__error holds a message if start-up failed (the renderer aborts on it).
import * as THREE from 'three';
import { FPS, FRAMES, W, H, COPY, clamp, lerp, ramp, win, keyed, easeInOutCubic, rng, hash01, rotorAngle } from './timeline.js';
import { applyCamera } from './camera.js';
import { buildPost } from './post.js';

const CAPTURE = new URLSearchParams(location.search).has('capture');
if (CAPTURE) document.body.classList.add('capture');

try {
  // ------------------------------------------------------------------ renderer + scene
  const canvas = document.getElementById('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);                        // never devicePixelRatio: output size must not depend on the screen
  renderer.setSize(W, H, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 100);

  // Studio environment built from emissive panels → PMREM. No HDRI file to download or license.
  {
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.BoxGeometry(40, 40, 40), new THREE.MeshBasicMaterial({ color: 0x030405, side: THREE.BackSide })));
    const panel = (w, h, rgb, pos) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(...rgb), side: THREE.DoubleSide }));
      m.position.set(...pos); m.lookAt(0, 0, 0); env.add(m);
    };
    panel(12, 7, [5.0, 4.9, 4.7], [0, 12, 2]);      // overhead soft box
    panel(1.6, 14, [3.0, 3.8, 5.0], [-11, 2, 5]);   // cool strip, left
    panel(1.6, 14, [5.0, 4.3, 3.4], [11, 2, -4]);   // warm strip, right
    panel(10, 4, [1.0, 1.05, 1.1], [3, 1, 14]);     // frontal fill
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.025).texture;
  }
  // Backdrop: a radial gradient painted once on a canvas (deterministic).
  {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const gr = g.createRadialGradient(W * 0.5, H * 0.44, 30, W * 0.5, H * 0.5, W * 0.65);
    gr.addColorStop(0, '#1a2129'); gr.addColorStop(0.35, '#0d1217'); gr.addColorStop(1, '#020304');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    scene.background = tex;
  }

  // Light rig: key (shadows) + cool rim + warm rim + low fill. It follows the camera target (see applyState).
  const key = new THREE.DirectionalLight(0xfff0e0, 1.6);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0002; key.shadow.normalBias = 0.02;
  const rimCool = new THREE.DirectionalLight(0xa9ccff, 3.0);
  const rimWarm = new THREE.DirectionalLight(0xffd2a8, 1.3);
  const fill = new THREE.DirectionalLight(0xcfe0ff, 0.3);
  for (const l of [key, rimCool, rimWarm, fill]) scene.add(l, l.target);

  // ------------------------------------------------------------------ materials (seeded procedural textures)
  function brushedTexture(seed, base) {
    const r = rng(seed), c = document.createElement('canvas'); c.width = c.height = 512;
    const g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2600; i++) {                // fine circumferential brushing streaks
      const y = r() * 512, a = 0.02 + r() * 0.05, v = Math.floor(160 + r() * 95);
      g.fillStyle = `rgba(${v},${v},${v},${a})`; g.fillRect(0, y, 512, 0.6 + r() * 1.2);
    }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    return t;
  }
  const rough = brushedTexture(7, '#8a8a8a');
  const steel = new THREE.MeshPhysicalMaterial({ color: 0xc9ced4, metalness: 1, roughness: 0.32, roughnessMap: rough, clearcoat: 0.25, clearcoatRoughness: 0.3 });
  const darkSteel = new THREE.MeshPhysicalMaterial({ color: 0x5b636c, metalness: 1, roughness: 0.42, roughnessMap: rough });
  const bladeMat = new THREE.MeshPhysicalMaterial({ color: 0xc4cad1, metalness: 1, roughness: 0.3, clearcoat: 0.3, clearcoatRoughness: 0.25 });
  const copper = new THREE.MeshPhysicalMaterial({ color: 0xd07a45, metalness: 1, roughness: 0.28, clearcoat: 0.4 });
  const glow = new THREE.MeshBasicMaterial({ color: 0x6fd6ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });

  // ------------------------------------------------------------------ procedural geometry
  const root = new THREE.Group(); root.rotation.z = Math.PI / 2; scene.add(root);  // rotor axis along world X
  const spinner = new THREE.Group(); root.add(spinner);

  // hub: lathe profile (radius, height)
  const hubProfile = [[0.0, -0.7], [0.55, -0.7], [0.62, -0.55], [0.62, 0.35], [0.5, 0.55], [0.22, 0.75], [0.0, 0.8]].map(([x, y]) => new THREE.Vector2(x, y));
  const hub = new THREE.Mesh(new THREE.LatheGeometry(hubProfile, 96), steel);
  spinner.add(hub);

  // 14 twisted blades: extruded aerofoil-ish section, pitched per blade
  const NB = 14;
  const sec = new THREE.Shape();
  sec.moveTo(-0.22, 0); sec.bezierCurveTo(-0.1, 0.07, 0.12, 0.06, 0.24, 0); sec.bezierCurveTo(0.1, 0.02, -0.1, 0.02, -0.22, 0);
  const bladeGeo = new THREE.ExtrudeGeometry(sec, { depth: 1.55, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2, steps: 24 });
  { // twist along the span (z) for an engineered look
    const p = bladeGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const z = p.getZ(i), a = (z / 1.55) * 0.55, x = p.getX(i), y = p.getY(i);
      p.setXY(i, x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a));
    }
    bladeGeo.computeVertexNormals();
  }
  const blades = [];
  for (let k = 0; k < NB; k++) {
    const pivot = new THREE.Group();
    pivot.rotation.y = (k / NB) * Math.PI * 2;
    const b = new THREE.Mesh(bladeGeo, k % 7 === 0 ? copper : bladeMat);
    b.position.set(0, -0.05 + (hash01(k, 3) - 0.5) * 0.002, 0.55);   // tiny seeded variation, stable per blade
    b.rotation.z = 0.5;                                                 // pitch
    pivot.add(b); spinner.add(pivot); blades.push(pivot);
  }

  // shroud ring + bolts
  const shroud = new THREE.Group(); root.add(shroud);
  shroud.add(new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.25, 0.62, 128, 1, true), darkSteel));
  shroud.add(new THREE.Mesh(new THREE.TorusGeometry(2.25, 0.07, 24, 160).rotateX(Math.PI / 2).translate(0, 0.31, 0), steel));
  shroud.add(new THREE.Mesh(new THREE.TorusGeometry(2.25, 0.07, 24, 160).rotateX(Math.PI / 2).translate(0, -0.31, 0), steel));
  const boltGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.08, 12).rotateZ(Math.PI / 2);
  for (let k = 0; k < 36; k++) {
    const a = (k / 36) * Math.PI * 2, m = new THREE.Mesh(boltGeo, steel);
    m.position.set(Math.cos(a) * 2.3, 0.31, Math.sin(a) * 2.3); m.rotation.y = -a; shroud.add(m);
  }
  const shroudGlow = new THREE.Mesh(new THREE.TorusGeometry(2.25, 0.012, 8, 200).rotateX(Math.PI / 2), glow);
  shroudGlow.userData.noDepth = true; shroud.add(shroudGlow);

  // shaft
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 4.2, 48), steel);
  spinner.add(shaft);

  root.traverse((o) => { if (o.isMesh && !o.userData.noDepth) { o.castShadow = true; o.receiveShadow = true; } });

  // ------------------------------------------------------------------ HTML overlay (captured by page.screenshot)
  const overlay = document.getElementById('overlay');
  overlay.innerHTML = `
    <div class="title"><div class="k">${COPY.kicker}</div><div class="n">${COPY.title}</div><div class="bar"></div></div>
    <svg class="leaders" viewBox="0 0 ${W} ${H}"></svg>
    <div class="end">${COPY.end}</div>`;
  const svg = overlay.querySelector('svg');
  const titleEl = overlay.querySelector('.title'), endEl = overlay.querySelector('.end');
  const labels = [
    { text: COPY.labels.shroud, at: () => shroud.localToWorld(new THREE.Vector3(2.25, 0.3, 0)), dx: 220, dy: -170, tIn: 1.9, tOut: 3.5 },
    { text: COPY.labels.blades, at: () => blades[0].children[0].localToWorld(new THREE.Vector3(0, 0, 1.4)), dx: -240, dy: 40, tIn: 2.2, tOut: 3.5 },
    { text: COPY.labels.hub, at: () => hub.localToWorld(new THREE.Vector3(0, 0.75, 0)), dx: 160, dy: 150, tIn: 2.5, tOut: 3.5 },
  ].map((l) => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line'); svg.appendChild(line);
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); dot.setAttribute('r', 4); svg.appendChild(dot);
    const div = document.createElement('div'); div.className = 'label'; div.textContent = l.text; overlay.appendChild(div);
    return { ...l, line, dot, div };
  });
  const proj = new THREE.Vector3();
  function updateOverlay(t) {
    const tIn = win(t, 0.25, 0.9, 1.4, 1.8);
    titleEl.style.opacity = tIn.toFixed(3);
    titleEl.style.transform = `translateY(${((1 - tIn) * 14).toFixed(2)}px)`;
    for (const l of labels) {
      const o = win(t, l.tIn, l.tIn + 0.35, l.tOut - 0.3, l.tOut);
      proj.copy(l.at()).project(camera);
      const x = (proj.x * 0.5 + 0.5) * W, y = (-proj.y * 0.5 + 0.5) * H;
      const draw = ramp(t, l.tIn, l.tIn + 0.4);                // leader line draws on
      const ex = x + l.dx * draw, ey = y + l.dy * draw;
      for (const [k, v] of [['x1', x], ['y1', y], ['x2', ex], ['y2', ey]]) l.line.setAttribute(k, v.toFixed(1));
      l.dot.setAttribute('cx', x.toFixed(1)); l.dot.setAttribute('cy', y.toFixed(1));
      l.line.style.opacity = l.dot.style.opacity = o.toFixed(3);
      l.div.style.opacity = o.toFixed(3);
      l.div.style.transform = `translate(${(ex + (l.dx > 0 ? 12 : -12)).toFixed(1)}px, ${(ey - 16).toFixed(1)}px) translateX(${l.dx > 0 ? 0 : -100}%)`;
    }
    const e = ramp(t, 4.0, 4.6);
    endEl.style.opacity = e.toFixed(3);
    endEl.style.letterSpacing = `${lerp(0.12, 0.02, e).toFixed(3)}em`;
  }

  // ------------------------------------------------------------------ state = f(t)
  const post = buildPost(renderer, scene, camera, W, H);
  function applyState(t) {
    const cam = applyCamera(camera, t);
    spinner.rotation.y = rotorAngle(t);
    // exploded view: pure translations along the rotor axis (local Y), staggered out, eased back together
    const ex = ramp(t, 1.7, 2.6, easeInOutCubic) * (1 - ramp(t, 3.3, 4.1, easeInOutCubic));
    const exLate = ramp(t, 1.9, 2.8, easeInOutCubic) * (1 - ramp(t, 3.2, 4.0, easeInOutCubic));
    shroud.position.y = 2.2 * ex;
    hub.position.y = -1.6 * exLate;
    blades.forEach((p, k) => { p.children[0].position.z = 0.55 + 0.18 * ex * (0.6 + 0.4 * hash01(k, 11)); });
    glow.opacity = 0.9 * win(t, 1.9, 2.3, 3.2, 3.6);
    // lights follow the framing so the rim always reads
    const tg = cam.target;
    key.position.set(tg.x + 4, tg.y + 7, tg.z + 6); key.target.position.copy(tg);
    rimCool.position.set(tg.x - 7, tg.y + 2.5, tg.z - 5); rimCool.target.position.copy(tg);
    rimWarm.position.set(tg.x + 6, tg.y - 1, tg.z - 6); rimWarm.target.position.copy(tg);
    fill.position.set(tg.x - 2, tg.y - 3, tg.z + 7); fill.target.position.copy(tg);
    scene.updateMatrixWorld(true);
    return cam;
  }

  function renderAt(n) {
    const t = n / FPS;
    const cam = applyState(t);
    const fade = keyed(t, [[0, 0], [0.4, 1], [4.75, 1], [5.0, 0.9]]);   // fade up from black; no hard cut at the end
    post.render({ seed: n, focus: cam.dist, fade });
    updateOverlay(t);
  }

  window.renderFrame = (n) => {
    n = clamp(Math.floor(n), 0, FRAMES - 1);
    renderAt(n);
    window.__frame = n;
    // two rAFs: the overlay DOM and the canvas are both committed before the screenshot
    return new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => res(n))));
  };

  (async () => {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    for (const n of [0, 60, 90, 149]) renderAt(n);   // warm-up: compile every shader variant before frame 0 is captured
    renderAt(0);
    window.__ready = true;
    if (!CAPTURE) live();
  })().catch((e) => { window.__error = String(e && e.stack || e); });

  function live() {
    const fit = () => { const s = Math.min(innerWidth / W, innerHeight / H); document.getElementById('stage').style.transform = `scale(${s})`; };
    fit(); addEventListener('resize', fit);
    const t0 = performance.now(); let last = -1;
    // live preview only: the wall clock picks WHICH frame to show; pixels are still f(frame)
    const loop = () => { const n = Math.floor(((performance.now() - t0) / 1000) * FPS) % FRAMES; if (n !== last) { renderAt(n); last = n; } requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
} catch (e) {
  window.__error = String(e && e.stack || e);
}
