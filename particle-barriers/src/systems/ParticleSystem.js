import * as THREE from 'three';
import { ObjectPool } from '../utils/pool.js';
import { particleVert, particleFrag } from '../shaders/particle.js';
import { easeOutCubic, easeInOutQuad, easeInOutSine } from '../utils/easing.js';

export class ParticleSystem {
  constructor(config, scene, barrierSystem, trailSystem, connectionSystem) {
    this.config = config;
    this.scene = scene;
    this.barrierSystem = barrierSystem;
    this.trailSystem = trailSystem;
    this.connectionSystem = connectionSystem;
    
    this.capturedParticles = [];
    
    this.viewportWidth = window.innerWidth;
    this.viewportHeight = window.innerHeight;

    this.colorFlying = new THREE.Color(this.config.colorFlying);
    this.colorCaptured = new THREE.Color(this.config.colorCaptured);
    this.colorTrail = new THREE.Color(this.config.colorTrail);

    this.initPool();
    this.initGeometry();
    
    // Distribute initially
    this.particles.forEach(p => this.resetParticle(p, true));
  }
  
  initPool() {
    this.particles = [];
    const factory = () => ({
      id: Math.random(),
      state: 'DEAD',
      x: 0, y: 0, z: 0,
      size: 0, speed: 0,
      trailLength: 0,
      vy: 0, mode: 'drift', modeTimer: 0, 
      targetY: 0, noiseOffset: 0,
      targetX: 0,
      magnetizeTimer: 0, magnetizeDuration: 0,
      colorAnimTimer: 0,
      pulsePhase: 0, pulsePeriod: 0,
      fadeOpacity: 0,
      r: 0, g: 0, b: 0,
      trailR: 0, trailG: 0, trailB: 0,
      glowOpacity: 0,
      trailHistory: [], // will store last N positions
      barrierIndex: -1 // Highest barrier passed
    });
    
    this.pool = new ObjectPool(factory, this.config.particleCount);
    
    // Grab all particles immediately so they are active
    for (let i = 0; i < this.config.particleCount; i++) {
      this.particles.push(this.pool.get());
    }
  }

  initGeometry() {
    const count = this.config.particleCount;
    this.geometry = new THREE.BufferGeometry();
    
    this.positions = new Float32Array(count * 3);
    this.colors = new Float32Array(count * 3);
    this.sizes = new Float32Array(count);
    this.opacities = new Float32Array(count);
    this.glowOpacities = new Float32Array(count);

    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('customColor', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));
    this.geometry.setAttribute('opacity', new THREE.BufferAttribute(this.opacities, 1));
    this.geometry.setAttribute('glowOpacity', new THREE.BufferAttribute(this.glowOpacities, 1));

    this.material = new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: particleVert,
      fragmentShader: particleFrag,
      transparent: true,
      blending: THREE.NormalBlending,
      depthTest: false,
      depthWrite: false
    });

    this.points = new THREE.Points(this.geometry, this.material);
    // Disable frustum culling to avoid missing particles since bounds might differ
    this.points.frustumCulled = false;
    this.scene.add(this.points);
  }

  resetParticle(p, initial = false) {
    p.state = 'FLYING';
    
    // Spawn behind the left edge. 
    // Initial spawns spread far back so they enter as a continuous stream over time.
    const leftEdge = -this.viewportWidth / 2;
    p.x = initial ? leftEdge - Math.random() * 6000 : leftEdge - Math.random() * 300;
    p.y = 0;
    p.z = 0;
    
    p.size = this.config.particleSize.min + Math.random() * (this.config.particleSize.max - this.config.particleSize.min);
    
    // Speed spread +/- 15%
    p.speed = this.config.baseSpeed * (0.85 + Math.random() * 0.30);
    
    // Trail length spread 50% to 175%
    p.trailLength = this.config.trailLength * (0.50 + Math.random() * 1.25);
    
    // Chaotic Physics initialization
    p.vy = 0;
    p.noiseOffset = Math.random();
    this.pickMode(p);
    
    p.r = this.colorFlying.r;
    p.g = this.colorFlying.g;
    p.b = this.colorFlying.b;
    p.trailR = this.colorTrail.r;
    p.trailG = this.colorTrail.g;
    p.trailB = this.colorTrail.b;
    p.fadeOpacity = 1.0;
    p.glowOpacity = 0.0;
    
    p.barrierIndex = -1;
    p.magnetizeTimer = 0;
    p.colorAnimTimer = 0;
    p.pulsePhase = Math.random(); 
    p.pulsePeriod = this.config.pulsePeriod.min + Math.random() * (this.config.pulsePeriod.max - this.config.pulsePeriod.min);
    
    p.trailHistory = [];
  }

  pickMode(p) {
    const r = Math.random();
    if (r < 0.25) {
      p.mode = 'linear';
      p.modeTimer = 400 + Math.random() * 800;
    } else if (r < 0.55) {
      p.mode = 'drift';
      p.modeTimer = 500 + Math.random() * 1000;
    } else if (r < 0.75) {
      p.mode = 'seek';
      p.targetY = (Math.random() - 0.5) * 400; // random point in corridor
      p.modeTimer = 300 + Math.random() * 500;
    } else if (r < 0.90) {
      p.mode = 'jitter';
      p.modeTimer = 200 + Math.random() * 400;
    } else {
      p.mode = 'coast';
      p.modeTimer = 600 + Math.random() * 1400;
    }
  }

  updatePhysics(p, dt, time) {
    p.modeTimer -= dt;
    if (p.modeTimer <= 0) {
      this.pickMode(p);
    }

    const timeScale = dt / 16.666;

    if (p.mode === 'linear') {
      // keep vy unchanged
    } else if (p.mode === 'drift') {
      const noiseVal = Math.sin(time * 0.002 + p.noiseOffset * 1000) + Math.cos(time * 0.0031 + p.noiseOffset * 2000);
      p.vy += noiseVal * 10 * timeScale;
    } else if (p.mode === 'seek') {
      p.vy += (p.targetY - p.y) * 0.08 * timeScale;
    } else if (p.mode === 'jitter') {
      if (Math.random() < 0.33) {
        p.vy += (Math.random() * 120 - 60);
      }
    } else if (p.mode === 'coast') {
      p.vy *= Math.pow(0.95, timeScale);
    }

    // Global limits and constraints
    p.vy *= Math.pow(0.99, timeScale);

    const edgeThreshold = 200;
    const corridorHalf = 250;
    if (Math.abs(p.y) > edgeThreshold) {
      const overshoot = (Math.abs(p.y) - edgeThreshold) / (corridorHalf - edgeThreshold);
      p.vy -= Math.sign(p.y) * overshoot * overshoot * 2.5 * timeScale;
    }

    p.vy = Math.max(-150, Math.min(150, p.vy));
    p.y += p.vy * (dt / 1000);
  }

  updateBounds(width, height) {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }
  
  update(dt, time) {
    // Update logic for all particles
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      if (p.state === 'DEAD') {
        this.resetParticle(p);
      } else if (p.state === 'FLYING') {
        const oldX = p.x;
        p.x += p.speed; // assuming 60fps frame delta implicit in speed tuning, or scale by dt: p.x += p.speed * (dt/16.6)
        // Let's keep it simple: speed is units per frame
        // Spec: "baseSpeed: 3 // units/frame" 
        // We'll scale by dt so it's frame-independent. 16.6 ms is 1 norm frame.
        const timeScale = dt / 16.666;
        
        // Let's actually use dt for smooth movement instead of assuming 60 FPS
        p.x = oldX + p.speed * timeScale;
        
        const leftEdge = -this.viewportWidth / 2;
        if (p.x <= leftEdge) {
            // Freeze Y and VY exactly at the origin point until it enters
            p.y = 0;
            p.vy = 0;
        } else {
            // Update physics and Y position using new segment-based steering
            this.updatePhysics(p, dt, time);
        }

        // Check barrier capture
        const captureResult = this.barrierSystem.checkCapture(p.x, oldX, p.barrierIndex);
        if (captureResult.passed) {
          p.barrierIndex = captureResult.barrierIndex;
          
          // BARRIER DEFLECTION
          p.vy += (Math.random() * 160 - 80);
          this.pickMode(p);
          
        } else if (captureResult.captured) {
          p.state = 'MAGNETIZING';
          p.targetX = captureResult.barrierX;
          p.targetY = p.y; // keep current Y or nearest on barrier
          p.magnetizeDuration = this.config.magnetizeDuration.min + Math.random() * (this.config.magnetizeDuration.max - this.config.magnetizeDuration.min);
          p.magnetizeTimer = 0;
          p.startX = p.x;
        }
        
        // Check if passed all barriers
        if (p.barrierIndex >= this.config.barrierCount - 1) {
          p.state = 'FADING_OUT';
        }

      } else if (p.state === 'MAGNETIZING') {
        p.magnetizeTimer += dt;
        let t = p.magnetizeTimer / p.magnetizeDuration;
        if (t >= 1) {
          t = 1;
          p.state = 'CAPTURED';
          p.colorAnimTimer = 0;
          
          this.capturedParticles.push(p);
          
          // 20% chance to link to another random (but localized) captured particle
          if (Math.random() < 0.20 && this.capturedParticles.length > 1) {
             let bestOther = null;
             let bestDist = Infinity;
             for(let k = 0; k < 8; k++) {
                 const cand = this.capturedParticles[Math.floor(Math.random() * this.capturedParticles.length)];
                 if (cand !== p) {
                     // L1 distance
                     const dist = Math.abs(cand.x - p.x) + Math.abs(cand.y - p.y);
                     if (dist < bestDist) {
                         bestDist = dist;
                         bestOther = cand;
                     }
                 }
             }
             if (bestOther && this.connectionSystem) {
                 this.connectionSystem.addLink(p, bestOther);
             }
          }
        }
        const easedT = easeOutCubic(t);
        p.x = p.startX + (p.targetX - p.startX) * easedT;
        // Calculate dynamic Y or just stay on last Y? Spec: "velocity → 0" "trajectory curves toward nearest point" (so Y stays same basically)
        
      } else if (p.state === 'CAPTURED') {
        p.colorAnimTimer += dt;
        let ct = p.colorAnimTimer / this.config.colorTransitionDuration;
        if (ct > 1) ct = 1;
        
        const easedCt = easeInOutQuad(ct);
        p.r = this.colorFlying.r + (this.colorCaptured.r - this.colorFlying.r) * easedCt;
        p.g = this.colorFlying.g + (this.colorCaptured.g - this.colorFlying.g) * easedCt;
        p.b = this.colorFlying.b + (this.colorCaptured.b - this.colorFlying.b) * easedCt;
        
        p.trailR = this.colorTrail.r + (this.colorCaptured.r - this.colorTrail.r) * easedCt;
        p.trailG = this.colorTrail.g + (this.colorCaptured.g - this.colorTrail.g) * easedCt;
        p.trailB = this.colorTrail.b + (this.colorCaptured.b - this.colorTrail.b) * easedCt;

        // Pulse
        const pt = (time % p.pulsePeriod) / p.pulsePeriod;
        const pulseNorm = easeInOutSine(pt * 2); // 0 to 1 back to 0
        const currentScale = this.config.pulseScale.min + (this.config.pulseScale.max - this.config.pulseScale.min) * pulseNorm;
        p.currentSize = p.size * currentScale;
        
        p.glowOpacity = this.config.glowOpacity.min + (this.config.glowOpacity.max - this.config.glowOpacity.min) * pulseNorm;

      } else if (p.state === 'FADING_OUT') {
        const timeScale = dt / 16.666;
        p.speed *= Math.pow(this.config.fadeDecay, timeScale); // Decay
        p.x += p.speed * timeScale;
        
        this.updatePhysics(p, dt, time);

        p.fadeOpacity -= dt / this.config.fadeDuration;
        if (p.fadeOpacity <= 0) {
          p.state = 'DEAD';
          p.fadeOpacity = 0;
        }
      }

      // Record trail history if moving
      if (p.state === 'FLYING' || p.state === 'MAGNETIZING' || p.state === 'FADING_OUT') {
        p.trailHistory.push({ x: p.x, y: p.y });
        if (p.trailHistory.length > 50) {
          p.trailHistory.shift();
        }
      }
      
      // Always update trail rendering for active particles so their color transitions
      if (p.state !== 'DEAD' && this.trailSystem) {
        this.trailSystem.updateTrail(i, p);
      }

      // Update Buffers
      const idx3 = i * 3;
      this.positions[idx3] = p.x;
      this.positions[idx3 + 1] = p.y;
      this.positions[idx3 + 2] = p.z;
      
      this.colors[idx3] = p.r;
      this.colors[idx3 + 1] = p.g;
      this.colors[idx3 + 2] = p.b;
      
      this.sizes[i] = p.currentSize || p.size;
      this.opacities[i] = p.state === 'DEAD' ? 0 : p.fadeOpacity;
      this.glowOpacities[i] = p.glowOpacity;
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.customColor.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;
    this.geometry.attributes.opacity.needsUpdate = true;
    this.geometry.attributes.glowOpacity.needsUpdate = true;
  }
}
