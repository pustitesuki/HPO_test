import * as THREE from 'three';

export class ConnectionSystem {
  constructor(config, scene) {
    this.config = config;
    this.scene = scene;
    
    this.links = [];
    this.maxLinks = config.particleCount; // Generous ceiling
    this.segments = 15; 
    
    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(this.maxLinks * this.segments * 3);
    this.alphas = new Float32Array(this.maxLinks * this.segments);
    
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('alpha', new THREE.BufferAttribute(this.alphas, 1));
    
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(0xffffff) }
      },
      vertexShader: `
        attribute float alpha;
        varying float vAlpha;
        void main() {
          vAlpha = alpha;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        varying float vAlpha;
        void main() {
          if (vAlpha < 0.01) discard;
          gl_FragColor = vec4(color, vAlpha * 0.15); // soft subtle lines
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false
    });
    
    const indices = [];
    for (let i = 0; i < this.maxLinks; i++) {
        const base = i * this.segments;
        for (let j = 0; j < this.segments - 1; j++) {
            indices.push(base + j, base + j + 1);
        }
    }
    this.geometry.setIndex(indices);
    
    this.lines = new THREE.LineSegments(this.geometry, this.material);
    this.lines.frustumCulled = false;
    this.scene.add(this.lines);
  }

  addLink(pA, pB) {
    if (this.links.length >= this.maxLinks) return;
    
    const dx = pB.x - pA.x;
    const dy = pB.y - pA.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    
    // Perpendicular vector for the curve control point offset
    const perpX = -dy / dist;
    const perpY = dx / dist;
    
    const midX = (pA.x + pB.x) / 2;
    const midY = (pA.y + pB.y) / 2;
    
    // Randomize curve arc steepness and direction
    const offset = dist * (0.15 + Math.random() * 0.2) * (Math.random() < 0.5 ? 1 : -1);
    
    const ctrl = {
      x: midX + perpX * offset,
      y: midY + perpY * offset,
      z: 0 
    };
    
    this.links.push({ pA, pB, ctrl });
    this.updateGeometry(this.links.length - 1);
  }

  updateGeometry(index) {
    const link = this.links[index];
    const baseIdx = index * this.segments;
    
    const pStart = new THREE.Vector3(link.pA.x, link.pA.y, link.pA.z);
    const pEnd = new THREE.Vector3(link.pB.x, link.pB.y, link.pB.z);
    const pCtrl = new THREE.Vector3(link.ctrl.x, link.ctrl.y, link.ctrl.z);
    
    const curve = new THREE.QuadraticBezierCurve3(pStart, pCtrl, pEnd);
    const points = curve.getPoints(this.segments - 1);
    
    for (let j = 0; j < this.segments; j++) {
        const pt = points[j];
        const idx3 = (baseIdx + j) * 3;
        this.positions[idx3] = pt.x;
        this.positions[idx3 + 1] = pt.y;
        this.positions[idx3 + 2] = pt.z;
        
        // Parabola alpha mapping (fade edges, bright center)
        const t = j / (this.segments - 1);
        const alpha = Math.sin(t * Math.PI); 
        this.alphas[baseIdx + j] = alpha;
    }
    
    // We update the full array but it's very cheap. Partial updates require BufferAttribute specific ranges, but this is fine.
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.alpha.needsUpdate = true;
  }
}
