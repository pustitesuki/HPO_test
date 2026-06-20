import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// ---------------------------------------------------------------------------
// Renderer / Scene / Camera
// ---------------------------------------------------------------------------
const canvas = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);

// Painterly anime sky (teal -> pale gradient with a few soft clouds)
function makeSky() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 512;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0.0, '#5fc4c8');
  g.addColorStop(0.5, '#9fe0dd');
  g.addColorStop(1.0, '#dff3ee');
  x.fillStyle = g; x.fillRect(0, 0, 64, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
scene.background = makeSky();
scene.fog = new THREE.Fog(0xcfeee8, 90, 280);

// ---------------------------------------------------------------------------
// Toon gradient (hard cel bands)
// ---------------------------------------------------------------------------
const toonGradient = (() => {
  const tones = new Uint8Array([70, 150, 220, 255]);
  const tex = new THREE.DataTexture(tones, tones.length, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
})();

// ---------------------------------------------------------------------------
// Lights (flat, high-key cartoon)
// ---------------------------------------------------------------------------
scene.add(new THREE.HemisphereLight(0xffffff, 0xc8a36a, 0.75));
const sun = new THREE.DirectionalLight(0xfff2d6, 2.3);
sun.position.set(20, 40, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const sh = 40;
sun.shadow.camera.left = -sh; sun.shadow.camera.right = sh;
sun.shadow.camera.top = sh; sun.shadow.camera.bottom = -sh;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 150;
sun.shadow.bias = -0.0004;
scene.add(sun);
scene.add(sun.target);

// ---------------------------------------------------------------------------
// Planet — a sphere the cat runs on. Radius is set on load in "cheetah" units
// (one cheetah = the model's body length); R = 500 cheetahs.
// ---------------------------------------------------------------------------
function makeSandTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#e7d2a0'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5000; i++) {
    x.fillStyle = `rgba(150,110,60,${Math.random() * 0.05})`;
    const s = 1 + Math.random() * 2;
    x.fillRect(Math.random() * 256, Math.random() * 256, s, s);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(60, 30);
  t.colorSpace = THREE.SRGBColorSpace; return t;
}
const PLANET_RADIUS_CHEETAHS = 500;
let R = 1000;                                   // world radius, set on model load
const planet = new THREE.Mesh(
  new THREE.SphereGeometry(1, 160, 100),
  new THREE.MeshToonMaterial({ color: 0xe7d2a0, map: makeSandTexture(), gradientMap: toonGradient })
);
planet.receiveShadow = true;
scene.add(planet);

// Surface frame for sphere-walking: up = radial normal, fwd = tangent heading.
const sphereUp = new THREE.Vector3(0, 1, 0);
const sphereFwd = new THREE.Vector3(0, 0, 1);

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
const keys = Object.create(null);
addEventListener('keydown', (e) => { keys[e.code] = true; if (e.code === 'Space') e.preventDefault(); });
addEventListener('keyup',   (e) => { keys[e.code] = false; });

const orbit = { yaw: 0, pitch: 0.32, dist: 8, dragging: false, minDist: 3, maxDist: 30 };
canvas.addEventListener('mousedown', () => { orbit.dragging = true; });
addEventListener('mouseup',   () => { orbit.dragging = false; });
addEventListener('mousemove', (e) => {
  if (!orbit.dragging) return;
  orbit.yaw   -= e.movementX * 0.0035;
  orbit.pitch -= e.movementY * 0.0035;
  orbit.pitch = Math.max(-0.1, Math.min(1.0, orbit.pitch));
});
addEventListener('wheel', (e) => {
  orbit.dist = Math.max(orbit.minDist, Math.min(orbit.maxDist, orbit.dist + e.deltaY * 0.01));
}, { passive: true });

// ---------------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------------
const player = new THREE.Group();
scene.add(player);

let mixer = null;
const clips = {};
let current = null;
let modelHeight = 2;

function play(name, fade = 0.2) {
  const next = clips[name];
  if (!next || next === current) return;
  next.reset().fadeIn(fade).play();
  if (current) current.fadeOut(fade);
  current = next;
}

function findClip(animations, keyword) {
  const re = new RegExp(keyword, 'i');
  return animations.find((c) => re.test(c.name));
}

new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(
  '/cat.min.glb',
  (gltf) => {
    const model = gltf.scene;
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      // Convert PBR -> toon (cel) shading; also fixes see-through tongue/claws.
      const srcMats = Array.isArray(o.material) ? o.material : [o.material];
      const toon = srcMats.map((m) => {
        const needClip = m && (m.transparent || m.alphaTest > 0);
        const tm = new THREE.MeshToonMaterial({
          map: m ? m.map : null,
          color: m && m.color ? m.color.clone() : new THREE.Color(0xffffff),
          gradientMap: toonGradient,
          side: THREE.FrontSide,
          transparent: false,
          depthWrite: true,
          alphaTest: needClip ? 0.5 : 0,
        });
        if (tm.map) tm.map.colorSpace = THREE.SRGBColorSpace;
        return tm;
      });
      o.material = Array.isArray(o.material) ? toon : toon[0];
    });

    // Optional hand-painted texture override: if /cat_texture.webp exists, use it
    // instead of the embedded diffuse. Edit cat-game/public/cat_texture.webp and
    // reload — no need to repack the GLB.
    new THREE.TextureLoader().load('/cat_texture.webp', (tex) => {
      tex.flipY = false;                       // glTF UV convention
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      tex.needsUpdate = true;
      model.traverse((o) => {
        if (!o.isMesh) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => { if (m.map) { m.map = tex; m.needsUpdate = true; } });
      });
      console.log('Applied custom texture: /cat_texture.webp');
    }, undefined, () => { /* no override file — keep embedded texture */ });

    // Recenter: feet at pivot origin
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    modelHeight = size.y;
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= box.min.y;
    player.add(model);

    orbit.dist = modelHeight * 4;
    orbit.minDist = modelHeight * 1.5;
    orbit.maxDist = modelHeight * 10;

    player.userData.size = size.clone();
    player.userData.walkSpeed = size.z > 0 ? Math.max(size.x, size.z) * 1.6 : 3;
    player.userData.runSpeed = player.userData.walkSpeed * 2.4;

    // Size the planet in cheetahs and put the cat on top.
    const cheetah = Math.max(size.x, size.z);
    R = PLANET_RADIUS_CHEETAHS * cheetah;
    planet.scale.setScalar(R);
    planet.position.set(0, 0, 0);
    sphereUp.set(0, 1, 0); sphereFwd.set(0, 0, 1);
    player.position.copy(sphereUp).multiplyScalar(R);
    camera.near = 0.5; camera.far = R * 5; camera.updateProjectionMatrix();
    scene.fog.near = R * 0.2; scene.fog.far = R * 1.15;
    console.log(`Planet: R=${R.toFixed(0)} units = ${PLANET_RADIUS_CHEETAHS} cheetahs; equator ≈ ${(2 * Math.PI * PLANET_RADIUS_CHEETAHS).toFixed(0)} cheetahs (1 cheetah = ${cheetah.toFixed(2)} units)`);

    mixer = new THREE.AnimationMixer(model);
    const anims = gltf.animations;
    // Strip root-motion position tracks: these nodes carry huge constant offsets
    // and (in Jump) a big vertical arc that flings the model off-screen. Position
    // is driven by our own code, so keep only the bone rotations.
    // Note: GLTFLoader may rename nodes on collision (e.g. Armature -> Armature_1),
    // so match name variants with an optional suffix.
    const ROOT_POS = /^(Armature\w*|CC_Base_Pivot\w*|RL_BoneRoot\w*|Snow_leopard\w*|bip01)\.position$/;
    for (const clip of anims) clip.tracks = clip.tracks.filter((t) => !ROOT_POS.test(t.name));
    const map = {
      idle: findClip(anims, 'idle'),
      walk: findClip(anims, 'walk(?!back)') || findClip(anims, 'walk'),
      walkback: findClip(anims, 'walkback') || findClip(anims, 'back'),
      run: findClip(anims, 'run'),
      jump: findClip(anims, 'jump'),
      attack: findClip(anims, 'atk') || findClip(anims, 'attack'),
    };
    for (const [key, clip] of Object.entries(map)) if (clip) clips[key] = mixer.clipAction(clip);
    if (clips.jump)   { clips.jump.loop = THREE.LoopOnce;   clips.jump.clampWhenFinished = true; }
    if (clips.attack) { clips.attack.loop = THREE.LoopOnce; clips.attack.clampWhenFinished = true; }

    // Dedicated, paused pose actions for the phase-driven jump. They use CLONED
    // clips so the real locomotion actions (run/walk/jump) are never scrubbed.
    const spreadSrc = clips.run || clips.walk;
    if (spreadSrc) { poseSpread = mixer.clipAction(spreadSrc.getClip().clone()); poseSpread.play(); poseSpread.paused = true; poseSpread.setEffectiveWeight(0); }
    if (clips.jump) { poseTuck = mixer.clipAction(clips.jump.getClip().clone()); poseTuck.play(); poseTuck.paused = true; poseTuck.setEffectiveWeight(0); }

    play('idle', 0);
    const el = document.getElementById('loading'); if (el) el.remove();
    console.log('Loaded animations:', anims.map((a) => a.name));
  },
  (e) => {
    const el = document.getElementById('loading');
    if (el && e.total) el.textContent = `Loading model… ${Math.round((e.loaded / e.total) * 100)}%`;
  },
  (err) => {
    console.error(err);
    const el = document.getElementById('loading'); if (el) el.textContent = 'Failed to load cat.glb';
  }
);

// ---------------------------------------------------------------------------
// Cartoon outline post-process (depth-based edge detection)
// ---------------------------------------------------------------------------
const sceneRT = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
  depthTexture: new THREE.DepthTexture(window.innerWidth, window.innerHeight),
  depthBuffer: true, stencilBuffer: false,
});
sceneRT.texture.colorSpace = THREE.NoColorSpace;

const outlineMat = new THREE.ShaderMaterial({
  uniforms: {
    tDiffuse: { value: sceneRT.texture },
    tDepth: { value: sceneRT.depthTexture },
    uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    uNear: { value: camera.near },
    uFar: { value: camera.far },
    uThickness: { value: 1.6 },
    uStrength: { value: 1.0 },
    uDither: { value: 1.0 },     // 0 = off, 1 = on (colour preserved)
    uGrid: { value: 2.0 },       // dither cell size in pixels
    uDarkness: { value: 0.66 },  // colour of dithered pixels (0 = black, 1 = unchanged)
    uLevels: { value: 24.0 },    // posterize steps
    uGray: { value: 0.0 },       // 1 = grayscale dithering
  },
  vertexShader: `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform sampler2D tDepth;
    uniform vec2 uResolution; uniform float uNear; uniform float uFar;
    uniform float uThickness; uniform float uStrength;
    uniform float uDither; uniform float uGrid;
    uniform float uDarkness; uniform float uLevels; uniform float uGray;
    varying vec2 vUv;
    float linDepth(vec2 uv){
      float d = texture2D(tDepth, uv).x;
      float ndc = d * 2.0 - 1.0;
      return (2.0 * uNear * uFar) / (uFar + uNear - ndc * (uFar - uNear));
    }
    // Ordered 4x4 Bayer dithering — ported from niccolofanton/dithering-shader
    // (MIT). Returns true if the pixel should be knocked to black.
    bool ditherOn(float brightness, vec2 pos) {
      if (brightness > 16.0 / 17.0) return false;
      if (brightness < 1.0 / 17.0) return true;
      vec2 pixel = floor(mod(pos / uGrid, 4.0));
      int x = int(pixel.x); int y = int(pixel.y);
      if (x == 0) {
        if (y == 0) return brightness < 16.0/17.0; if (y == 1) return brightness < 5.0/17.0;
        if (y == 2) return brightness < 13.0/17.0; return brightness < 1.0/17.0;
      } else if (x == 1) {
        if (y == 0) return brightness < 8.0/17.0;  if (y == 1) return brightness < 12.0/17.0;
        if (y == 2) return brightness < 4.0/17.0;  return brightness < 9.0/17.0;
      } else if (x == 2) {
        if (y == 0) return brightness < 14.0/17.0; if (y == 1) return brightness < 2.0/17.0;
        if (y == 2) return brightness < 15.0/17.0; return brightness < 3.0/17.0;
      } else {
        if (y == 0) return brightness < 6.0/17.0;  if (y == 1) return brightness < 10.0/17.0;
        if (y == 2) return brightness < 7.0/17.0;  return brightness < 11.0/17.0;
      }
    }
    void main(){
      vec2 fragCoord = vUv * uResolution;

      // Pixelate the fill (not the outline) into dither cells, keep colour
      vec2 sampleUv = vUv;
      if (uDither > 0.5) {
        float pixelSize = max(uGrid, 1.0);
        sampleUv = (floor(fragCoord / pixelSize) * pixelSize + pixelSize * 0.5) / uResolution;
      }
      vec3 col = texture2D(tDiffuse, sampleUv).rgb;
      col = floor(col * uLevels + 0.5) / uLevels;                 // posterize

      // Ordered dithering — colour is preserved, sub-threshold pixels darken
      if (uDither > 0.5) {
        float lum = dot(col, vec3(0.299, 0.587, 0.114));
        if (uGray > 0.5) col = vec3(lum);
        if (ditherOn(lum, fragCoord)) col *= uDarkness;
      }

      // Depth-based ink outline (full resolution, on top of the dither)
      vec2 px = uThickness / uResolution;
      float c = linDepth(vUv);
      float u = linDepth(vUv + vec2(0.0, px.y));
      float dn = linDepth(vUv - vec2(0.0, px.y));
      float l = linDepth(vUv - vec2(px.x, 0.0));
      float r = linDepth(vUv + vec2(px.x, 0.0));
      float lap = abs((u + dn + l + r) - 4.0 * c);
      float edge = smoothstep(0.35, 1.4, lap / (c * 0.03 + 0.015));
      col = mix(col, vec3(0.10, 0.045, 0.02), clamp(edge * uStrength, 0.0, 1.0)); // brown ink

      gl_FragColor = vec4(pow(col, vec3(1.0/2.2)), 1.0);          // sRGB encode
    }
  `,
});
const fsScene = new THREE.Scene();
const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
fsScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), outlineMat));

// Phase-driven jump pose config: blend a "spread" pose (legs fore/aft, from Run)
// and a "tuck" pose (from Jump) by vertical velocity — spread on the way up & at
// apex, tuck on the way down.
const jumpAnim = {
  enabled: true,
  spreadInPlace: 0.29,   // spread frame for a standing jump
  spreadRun: 0.73,       // spread frame for a running jump
  tuckFrame: 0.07,       // tuck (gather) frame
  descend: 0.92,         // how late on descent the tuck kicks in
};

// ---------------------------------------------------------------------------
// Game loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
const tmpForward = new THREE.Vector3();
const tmpRight = new THREE.Vector3();
const tmpCam = new THREE.Vector3();
const tmpFocus = new THREE.Vector3();
const rotMat = new THREE.Matrix4();
const surfaceRay = new THREE.Raycaster();   // snaps the cat onto the faceted planet
let jumping = false, jumpY = 0, jumpVel = 0, jumpV0 = 1;
let poseSpread = null, poseTuck = null, poseJump = false, jumpSpreadFrame = 0;
let stepDist = 0, stepSide = 1;
const GRAVITY = 25;

// ---------------------------------------------------------------------------
// Footprints on the planet — paw decals laid tangent to the sphere surface.
// ---------------------------------------------------------------------------
function makePawTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'); x.clearRect(0, 0, 64, 64); x.fillStyle = '#fff';
  const ell = (cx, cy, rx, ry) => { x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); x.fill(); };
  ell(32, 42, 13, 11);                                   // main pad
  ell(20, 22, 5.5, 7); ell(30, 17, 5.5, 7.5);            // toes
  ell(42, 18, 5.5, 7.5); ell(50, 27, 5, 6.5);
  return new THREE.CanvasTexture(c);
}
const FP_TEX = makePawTex();
const FP_GEO = new THREE.PlaneGeometry(1, 1); FP_GEO.rotateX(-Math.PI / 2);
const FP_FLIP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
const footprints = [];
const FP_MAX = 120, FP_LIFE = 30;          // pool size, lifetime (seconds)
const fpRight = new THREE.Vector3();

function dropFootprint(now) {
  if (!player.userData.size) return;
  const w = Math.max(player.userData.size.x, 0.3);
  fpRight.crossVectors(sphereUp, sphereFwd).normalize();
  const base = 0.4 + Math.random() * 0.35;             // varied opacity per print
  const mat = new THREE.MeshBasicMaterial({
    map: FP_TEX, transparent: true, opacity: base, color: 0x4a2f18,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4,
  });
  const m = new THREE.Mesh(FP_GEO, mat);
  const sc = w * 0.7; m.scale.set(sc, 1, sc);
  m.position.copy(player.position)
    .addScaledVector(fpRight, stepSide * w * 0.25)
    .addScaledVector(sphereUp, 0.05);                    // tiny lift to avoid z-fight
  m.quaternion.copy(player.quaternion).multiply(FP_FLIP); // tangent, flipped to face travel
  m.renderOrder = 1;
  scene.add(m);
  footprints.push({ m, born: now, base });
  if (footprints.length > FP_MAX) { const o = footprints.shift(); scene.remove(o.m); o.m.material.dispose(); }
}

function updateFootprints(now) {
  for (let i = footprints.length - 1; i >= 0; i--) {
    const fp = footprints[i], age = now - fp.born;
    if (age > FP_LIFE) { scene.remove(fp.m); fp.m.material.dispose(); footprints.splice(i, 1); }
    else fp.m.material.opacity = fp.base * (1 - age / FP_LIFE);
  }
}

function update(dt) {
  const fwdKey   = (keys.KeyW || keys.ArrowUp) ? 1 : 0;
  const backKey  = (keys.KeyS || keys.ArrowDown) ? 1 : 0;
  const leftKey  = (keys.KeyA || keys.ArrowLeft) ? 1 : 0;
  const rightKey = (keys.KeyD || keys.ArrowRight) ? 1 : 0;
  const running = keys.ShiftLeft || keys.ShiftRight;

  const TURN_SPEED = 2.2; // rad/s
  const drive = fwdKey - backKey;
  const turning = (leftKey - rightKey) !== 0;
  const moving = drive !== 0;
  const speed = running ? player.userData.runSpeed : player.userData.walkSpeed;

  // A/D steer: rotate heading around the local up (surface normal).
  if (turning) sphereFwd.applyAxisAngle(sphereUp, (leftKey - rightKey) * TURN_SPEED * dt);

  // W/S move: roll the up/forward frame over the sphere along the heading.
  if (moving && player.userData.walkSpeed) {
    const ang = (speed * dt * drive) / R;
    const axis = tmpRight.crossVectors(sphereUp, sphereFwd).normalize();
    sphereUp.applyAxisAngle(axis, ang).normalize();
    sphereFwd.applyAxisAngle(axis, ang).normalize();
  }
  // Keep forward tangent to the surface (guard against numeric drift).
  sphereFwd.addScaledVector(sphereUp, -sphereFwd.dot(sphereUp)).normalize();

  // Jump (radial)
  if (keys.Space && !jumping && clips.jump) {
    jumping = true; jumpY = 0;
    jumpVel = Math.sqrt(2 * GRAVITY * modelHeight * 0.6);
    jumpV0 = jumpVel;
    if (jumpAnim.enabled && poseTuck) {
      poseJump = true;
      // running jump (moving forward) reaches further than a standing jump
      jumpSpreadFrame = (drive > 0) ? jumpAnim.spreadRun : jumpAnim.spreadInPlace;
      if (current) current.fadeOut(0.12);   // fade out locomotion; poses take over
      current = null;
    } else {
      poseJump = false;
      play('jump', 0.05); clips.jump.reset().play();
    }
  }
  if (jumping) {
    jumpVel -= GRAVITY * dt; jumpY += jumpVel * dt;
    if (poseJump) {
      // spread while ascending / at apex, tuck while descending
      const s = THREE.MathUtils.smoothstep(jumpVel, -jumpV0 * jumpAnim.descend, 0.0);
      poseTuck.time = jumpAnim.tuckFrame * poseTuck.getClip().duration;
      poseTuck.setEffectiveWeight(1 - s);
      if (poseSpread) {
        poseSpread.time = jumpSpreadFrame * poseSpread.getClip().duration;
        poseSpread.setEffectiveWeight(s);
      }
    }
    if (jumpY <= 0) {
      jumpY = 0; jumping = false;
      if (poseJump) {
        poseTuck.setEffectiveWeight(0);
        if (poseSpread) poseSpread.setEffectiveWeight(0);
        poseJump = false;
        current = null;                     // state machine resumes run/idle
      }
    }
  }
  // Place on the planet: raycast down the radial onto the actual (faceted) mesh
  // so the cat never floats over a facet, then add the radial jump offset.
  surfaceRay.set(tmpCam.copy(sphereUp).multiplyScalar(R * 1.3), tmpFocus.copy(sphereUp).negate());
  const hit = surfaceRay.intersectObject(planet, false)[0];
  if (hit) player.position.copy(hit.point).addScaledVector(sphereUp, jumpY);
  else player.position.copy(sphereUp).multiplyScalar(R + jumpY);
  const right = tmpForward.crossVectors(sphereUp, sphereFwd).normalize();
  rotMat.makeBasis(right, sphereUp, sphereFwd);   // model: +X=right, +Y=up, +Z=forward
  player.quaternion.setFromRotationMatrix(rotMat);

  // Lay paw prints at a stride interval while grounded
  const nowSec = performance.now() / 1000;
  if (moving && !jumping && player.userData.size) {
    stepDist += speed * dt;
    const stride = Math.max(player.userData.size.x * 1.9, 1.0);
    if (stepDist >= stride) { stepDist = 0; stepSide *= -1; dropFootprint(nowSec); }
  }
  updateFootprints(nowSec);

  if (!jumping) {
    if (drive > 0) play(running && clips.run ? 'run' : 'walk');
    else if (drive < 0) play(clips.walkback ? 'walkback' : 'walk');
    else if (turning) play('walk');
    else play('idle');
  }

  if (mixer) mixer.update(dt);

  // Third-person camera in the local surface frame (mouse orbits around up).
  const behind = tmpCam.copy(sphereFwd).applyAxisAngle(sphereUp, orbit.yaw).multiplyScalar(-Math.cos(orbit.pitch));
  behind.addScaledVector(sphereUp, Math.sin(orbit.pitch));
  const focus = tmpFocus.copy(player.position).addScaledVector(sphereUp, modelHeight * 0.6);
  camera.position.copy(focus).addScaledVector(behind.normalize(), orbit.dist);
  camera.up.copy(sphereUp);
  camera.lookAt(focus);

  // Keep the sun above the cat so it stays lit anywhere on the planet.
  sun.position.copy(player.position).addScaledVector(sphereUp, 60).addScaledVector(sphereFwd, 20);
  sun.target.position.copy(player.position);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  update(dt);

  renderer.setRenderTarget(sceneRT);      // 1) render scene (+ real depth)
  renderer.clear();
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);

  renderer.render(fsScene, fsCam);        // 2) outline + posterize to screen
}
animate();

addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h; camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  sceneRT.setSize(w, h);
  outlineMat.uniforms.uResolution.value.set(w, h);
});
