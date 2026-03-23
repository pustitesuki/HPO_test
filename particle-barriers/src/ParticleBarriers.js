import * as THREE from 'three';
import { ParallaxController } from './systems/ParallaxController.js';
import { ParticleSystem } from './systems/ParticleSystem.js';
import { TrailSystem } from './systems/TrailSystem.js';
import { BarrierSystem } from './systems/BarrierSystem.js';
import { ConnectionSystem } from './systems/ConnectionSystem.js';

export class ParticleBarriers {
  constructor(containerSelector, config) {
    this.container = document.querySelector(containerSelector);
    this.config = config;

    this.initCore();
    this.initSystems();
    this.bindEvents();
    
    this.isRunning = false;
    this.lastTime = 0;
  }

  initCore() {
    this.scene = new THREE.Scene();

    // Camera
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 2000);
    this.camera.position.z = 800; // Will be adjusted on resize

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    this.renderer.setClearColor(0x000000, 0); // Transparent background
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.config.maxPixelRatio));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.container.appendChild(this.renderer.domElement);
  }

  initSystems() {
    this.barrierSystem = new BarrierSystem(this.config, window.innerWidth);
    this.trailSystem = new TrailSystem(this.config, this.scene);
    this.connectionSystem = new ConnectionSystem(this.config, this.scene);
    this.particleSystem = new ParticleSystem(this.config, this.scene, this.barrierSystem, this.trailSystem, this.connectionSystem);
    this.parallaxController = new ParallaxController(this.config, this.scene);
  }

  bindEvents() {
    this.onResize = this.onResize.bind(this);
    window.addEventListener('resize', this.onResize);
  }

  onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    
    // Adjust Z-position so the working area fills the viewport approximately
    const vFovRaw = this.camera.fov * Math.PI / 180;
    const requiredZ = height / (2 * Math.tan(vFovRaw / 2));
    this.camera.position.z = requiredZ;

    this.camera.updateProjectionMatrix();

    if (this.barrierSystem) this.barrierSystem.updateWidth(width);
    if (this.particleSystem) this.particleSystem.updateBounds(width, height);
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    
    this.onResize();

    this.renderer.setAnimationLoop(this.animate.bind(this));
  }

  pause() {
    this.isRunning = false;
    this.renderer.setAnimationLoop(null);
  }

  resume() {
    this.start();
  }

  destroy() {
    this.pause();
    window.removeEventListener('resize', this.onResize);
    
    if (this.parallaxController) this.parallaxController.destroy();
    
    // Clean up Three.js resources
    this.scene.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(material => material.dispose());
        } else {
          child.material.dispose();
        }
      }
    });

    this.renderer.dispose();
    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }

  animate(time) {
    if (!this.isRunning) return;
    
    const dt = time - this.lastTime;
    this.lastTime = time;

    // Update systems
    this.parallaxController.update();
    this.particleSystem.update(dt, time);
    this.trailSystem.update();

    this.renderer.render(this.scene, this.camera);
  }
}
