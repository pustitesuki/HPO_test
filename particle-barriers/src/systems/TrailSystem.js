import * as THREE from 'three';
import { trailVert, trailFrag } from '../shaders/trail.js';

export class TrailSystem {
  constructor(config, scene) {
    this.config = config;
    this.scene = scene;
    
    this.initGeometry();
  }

  initGeometry() {
    const count = this.config.particleCount;
    const segments = this.config.trailSegments;
    const totalVertices = count * segments;

    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(totalVertices * 3);
    this.alphas = new Float32Array(totalVertices);
    this.colors = new Float32Array(totalVertices * 3);

    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('vertexAlpha', new THREE.BufferAttribute(this.alphas, 1));
    this.geometry.setAttribute('customColor', new THREE.BufferAttribute(this.colors, 3));

    this.material = new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: trailVert,
      fragmentShader: trailFrag,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false
    });

    const indices = [];
    for (let i = 0; i < count; i++) {
        const base = i * segments;
        for (let j = 0; j < segments - 1; j++) {
            indices.push(base + j, base + j + 1);
        }
    }
    this.geometry.setIndex(indices);

    this.lines = new THREE.LineSegments(this.geometry, this.material);
    this.lines.frustumCulled = false;
    this.scene.add(this.lines);
  }

  updateTrail(particleIndex, particle) {
    const segments = this.config.trailSegments;
    const baseIdx = particleIndex * segments;

    if (particle.state === 'DEAD' || particle.trailHistory.length < 3) {
      for (let j = 0; j < segments; j++) {
        this.alphas[baseIdx + j] = 0;
      }
      return;
    }

    const history = particle.trailHistory;
    
    let oldestIdx = 0;
    while (oldestIdx < history.length - 1) {
        const dx = particle.x - history[oldestIdx].x;
        if (dx <= particle.trailLength) {
            break;
        }
        oldestIdx++;
    }
    
    const pEnd = new THREE.Vector3(particle.x, particle.y, particle.z);
    let pStart, pCtrl;
    
    if (history.length - oldestIdx >= 3) {
      const startHist = history[oldestIdx];
      pStart = new THREE.Vector3(startHist.x, startHist.y, particle.z);
      
      const midHist = history[Math.floor((oldestIdx + history.length - 1) / 2)];
      pCtrl = new THREE.Vector3(midHist.x, midHist.y, particle.z);
    } else {
      const oldest = history[oldestIdx];
      pStart = new THREE.Vector3(oldest.x, oldest.y, particle.z);
      pCtrl = new THREE.Vector3((pEnd.x + pStart.x) * 0.5, (pEnd.y + pStart.y) * 0.5, particle.z);
    }

    const curve = new THREE.QuadraticBezierCurve3(pStart, pCtrl, pEnd);
    const points = curve.getPoints(segments - 1);

    for (let j = 0; j < segments; j++) {
        const pt = points[j];
        const idx3 = (baseIdx + j) * 3;
        this.positions[idx3] = pt.x;
        this.positions[idx3 + 1] = pt.y;
        this.positions[idx3 + 2] = pt.z;

        const t = j / (segments - 1);
        const opacity = this.config.trailOpacityTail + t * (this.config.trailOpacityHead - this.config.trailOpacityTail); 
        this.alphas[baseIdx + j] = opacity * particle.fadeOpacity;
        
        this.colors[idx3] = particle.trailR;
        this.colors[idx3 + 1] = particle.trailG;
        this.colors[idx3 + 2] = particle.trailB;
    }
  }

  update() {
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.vertexAlpha.needsUpdate = true;
    this.geometry.attributes.customColor.needsUpdate = true;
  }
}
