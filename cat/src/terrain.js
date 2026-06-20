import * as THREE from 'three';

// Terrain extent and tessellation. SEG controls how finely footprints can
// dent the surface (higher = crisper dents, more vertices).
const AREA = 200;
const SEG = 420;
const MAX_DEPTH = 0.32;         // how deep a fully-pressed footprint sinks (units)
const DEFORM_SIZE = 2048;       // resolution of the deformation height map
const EPS = 0.6;                // finite-difference step for normal recompute

// Dune height field — shared between GPU (vertex shader) and CPU (this fn) so
// the cat can walk *on* the dunes. Keep the two formulas identical.
export function duneHeight(x, z) {
  let h = 0;
  h += 0.9 * Math.sin(x * 0.06 + 1.3) * Math.cos(z * 0.045);
  h += 0.45 * Math.sin(x * 0.11 + z * 0.08 + 2.0);
  h += 0.25 * Math.sin(z * 0.17 - x * 0.04);
  return h;
}

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
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(70, 70);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Soft paw-shaped brush (white on transparent) stamped into the height map.
function makeBrushTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 128, 128);
  const blob = (cx, cy, rx, ry) => {
    const r = Math.max(rx, ry);
    x.save();
    x.translate(cx, cy); x.scale(rx / r, ry / r);
    const g = x.createRadialGradient(0, 0, 0, 0, 0, r);   // gradient in translated space
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.fill();
    x.restore();
  };
  blob(64, 82, 30, 26);                       // main pad
  blob(40, 44, 12, 15); blob(60, 36, 12, 16); // toes
  blob(80, 38, 12, 16); blob(98, 52, 11, 14);
  return new THREE.CanvasTexture(c);
}

export function createTerrain(renderer, toonGradient) {
  const geo = new THREE.PlaneGeometry(AREA, AREA, SEG, SEG);
  geo.rotateX(-Math.PI / 2);                  // lay into XZ plane (normal +Y)

  const mat = new THREE.MeshToonMaterial({
    color: 0xe7d2a0, map: makeSandTexture(), gradientMap: toonGradient,
  });

  // Persistent deformation height map (footprints accumulate here, never cleared)
  const deformRT = new THREE.WebGLRenderTarget(DEFORM_SIZE, DEFORM_SIZE, { depthBuffer: false });
  const prevColor = new THREE.Color(); renderer.getClearColor(prevColor);
  const prevAlpha = renderer.getClearAlpha();
  renderer.setRenderTarget(deformRT);
  renderer.setClearColor(0x000000, 1); renderer.clear(true, false, false);
  renderer.setRenderTarget(null);
  renderer.setClearColor(prevColor, prevAlpha);

  // Inject dune displacement + deformation + normal recompute into the toon shader
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uDeform = { value: deformRT.texture };
    sh.uniforms.uArea = { value: AREA };
    sh.uniforms.uMaxDepth = { value: MAX_DEPTH };
    const head = `
      uniform sampler2D uDeform; uniform float uArea; uniform float uMaxDepth;
      varying vec2 vWorldXZ;
      float deformAt(vec2 p){
        vec2 uv = p/uArea + 0.5;
        if(uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0) return 0.0;
        return texture2D(uDeform, uv).r;
      }
      float duneH(vec2 p){
        float h = 0.0;
        h += 0.9*sin(p.x*0.06+1.3)*cos(p.y*0.045);
        h += 0.45*sin(p.x*0.11 + p.y*0.08 + 2.0);
        h += 0.25*sin(p.y*0.17 - p.x*0.04);
        return h;
      }
      float terrainH(vec2 p){ return duneH(p) - deformAt(p)*uMaxDepth; }
    `;
    sh.vertexShader = head + sh.vertexShader;
    sh.vertexShader = sh.vertexShader.replace('#include <beginnormal_vertex>', `
      vec2 wxz = position.xz;
      float e = ${EPS.toFixed(2)};
      float hx = terrainH(wxz+vec2(e,0.0)) - terrainH(wxz-vec2(e,0.0));
      float hz = terrainH(wxz+vec2(0.0,e)) - terrainH(wxz-vec2(0.0,e));
      vec3 objectNormal = normalize(vec3(-hx, 2.0*e, -hz));
      #ifdef USE_TANGENT
        vec3 objectTangent = vec3( tangent.xyz );
      #endif
    `);
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `
      vec3 transformed = vec3( position );
      transformed.y += terrainH(position.xz);
      vWorldXZ = position.xz;
    `);
    // Per-pixel footprint shading (independent of mesh tessellation):
    // darken the pressed area and light/shade its walls by the sun direction.
    sh.fragmentShader = `
      uniform sampler2D uDeform; uniform float uArea;
      varying vec2 vWorldXZ;
      float deformAt(vec2 p){
        vec2 uv = p/uArea + 0.5;
        if(uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0) return 0.0;
        return texture2D(uDeform, uv).r;
      }
    ` + sh.fragmentShader;
    sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', `
      #include <dithering_fragment>
      {
        float d = clamp(deformAt(vWorldXZ), 0.0, 1.0);
        float t = uArea / ${DEFORM_SIZE.toFixed(1)};
        float gx = deformAt(vWorldXZ + vec2(t,0.0)) - deformAt(vWorldXZ - vec2(t,0.0));
        float gz = deformAt(vWorldXZ + vec2(0.0,t)) - deformAt(vWorldXZ - vec2(0.0,t));
        vec2 lightXZ = normalize(vec2(1.0, 1.0));            // sun comes from +x,+z
        float rim = (gx * lightXZ.x + gz * lightXZ.y) * 14.0; // wall lighting
        gl_FragColor.rgb *= (1.0 - 0.7 * d);                // ambient-occlusion dip
        gl_FragColor.rgb *= clamp(1.0 + rim, 0.4, 1.6);     // lit / shadowed walls
      }
    `);
  };
  mat.customProgramCacheKey = () => 'terrain-deform-v2';

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;

  // ---- Footprint painter: stamps the paw brush into the deform map ----
  const brushGeo = new THREE.PlaneGeometry(1, 1); brushGeo.rotateX(-Math.PI / 2);
  const brushMat = new THREE.MeshBasicMaterial({
    map: makeBrushTex(), transparent: true, blending: THREE.AdditiveBlending,
    depthTest: false, depthWrite: false,
  });
  const brush = new THREE.Mesh(brushGeo, brushMat);
  const paintScene = new THREE.Scene(); paintScene.add(brush);
  const paintCam = new THREE.OrthographicCamera(-AREA / 2, AREA / 2, AREA / 2, -AREA / 2, 0.1, 100);
  paintCam.position.set(0, 10, 0);
  paintCam.up.set(0, 0, 1);
  paintCam.lookAt(0, 0, 0);

  const pending = [];
  function stamp(x, z, size, strength, angle = 0) {
    pending.push({ x, z, size, strength, angle });
  }

  function update() {
    if (!pending.length) return;
    const prevAuto = renderer.autoClear; renderer.autoClear = false;
    renderer.setRenderTarget(deformRT);
    for (const p of pending) {
      // The top-down paint camera mirrors world +X, while the terrain shader
      // samples deform with uv = xz/AREA + 0.5. Negate X here so paint and
      // sample agree (otherwise footprints mirror across the Z axis).
      brush.position.set(-p.x, 0, p.z);
      brush.scale.set(p.size, 1, p.size);
      brush.rotation.y = p.angle;
      brushMat.opacity = p.strength;
      renderer.render(paintScene, paintCam);
    }
    renderer.setRenderTarget(null);
    renderer.autoClear = prevAuto;
    pending.length = 0;
  }

  return { mesh, stamp, update, heightAt: duneHeight, AREA, deformRT };
}
