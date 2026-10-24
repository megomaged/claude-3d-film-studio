// Post chain: MSAA ×4 HalfFloat → GTAO → Bokeh DOF → subtle bloom → ACES + sRGB (OutputPass) → SMAA → grade.
// The grade pass adds a vignette and deterministic film grain (seeded by the frame index, never by time).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

export function buildPost(renderer, scene, camera, W, H) {
  const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(1);
  composer.setSize(W, H);
  composer.renderToScreen = false;
  composer.addPass(new RenderPass(scene, camera));

  const gtao = new GTAOPass(scene, camera, W, H);
  gtao.updateGtaoMaterial({ radius: 0.25, distanceExponent: 1.6, thickness: 1.0, scale: 1.0, samples: 16, distanceFallOff: 1.0 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 16 });
  gtao.blendIntensity = 0.85;
  composer.addPass(gtao);

  const bokeh = new BokehPass(scene, camera, { focus: 7, aperture: 0.0005, maxblur: 0.005 });
  composer.addPass(bokeh);
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.24, 0.55, 0.92)); // strength, radius, threshold: keep it subtle
  composer.addPass(new OutputPass());
  composer.addPass(new SMAAPass(W, H));

  // AO and DOF render depth/normals with scene.overrideMaterial. Keep the backdrop and FX (glows, ghosts,
  // sprites) out of those passes, or you get dark halos and NaN seams. Tag such objects userData.noDepth = true.
  const origRender = renderer.render.bind(renderer);
  renderer.render = (sc, cam) => {
    if (sc !== scene || !sc.overrideMaterial) return origRender(sc, cam);
    const bg = sc.background; sc.background = null;
    const hidden = [];
    sc.traverse((o) => { if (o.visible && o.userData.noDepth) { o.visible = false; hidden.push(o); } });
    origRender(sc, cam);
    hidden.forEach((o) => { o.visible = true; });
    sc.background = bg;
  };

  const grade = new FullScreenQuad(new THREE.ShaderMaterial({
    uniforms: { tSrc: { value: null }, uSeed: { value: 0 }, uVig: { value: 0.55 }, uFade: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `uniform sampler2D tSrc; uniform float uSeed, uVig, uFade; varying vec2 vUv;
float hash(vec2 p){ p = fract(p * vec2(443.897, 441.423) + uSeed * 0.1031); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
void main(){
  vec3 c = texture2D(tSrc, vUv).rgb;
  vec2 d = vUv - 0.5; d.x *= ${(W / H).toFixed(4)};
  c *= mix(1.0, smoothstep(1.25, 0.18, length(d)), uVig);
  c += (hash(floor(vUv * vec2(${W}.0, ${H}.0))) - 0.5) * 0.014;
  gl_FragColor = vec4(c * uFade, 1.0);
}`,
    depthTest: false, depthWrite: false,
  }));

  return {
    bokeh,
    render({ seed = 0, focus = 7, fade = 1 }) {
      bokeh.uniforms.focus.value = focus;
      composer.render();
      grade.material.uniforms.tSrc.value = composer.readBuffer.texture;
      grade.material.uniforms.uSeed.value = seed % 97;
      grade.material.uniforms.uFade.value = fade;
      renderer.setRenderTarget(null);
      grade.render(renderer);
    },
  };
}
