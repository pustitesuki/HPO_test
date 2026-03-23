import * as THREE from 'three';

export class ParallaxController {
  constructor(config, scene) {
    this.config = config;
    this.scene = scene;

    this.targetRotX = 0;
    this.targetRotY = 0;

    this.onMouseMove = this.onMouseMove.bind(this);
    this.onDeviceOrientation = this.onDeviceOrientation.bind(this);

    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('deviceorientation', this.onDeviceOrientation);
  }

  onMouseMove(event) {
    // Normalize cursor position: -1..1
    const mouseNormX = (event.clientX / window.innerWidth) * 2 - 1;
    const mouseNormY = (event.clientY / window.innerHeight) * 2 - 1;

    // Target angles (radians)
    this.targetRotY = mouseNormX * THREE.MathUtils.degToRad(this.config.parallaxMaxAngle);
    this.targetRotX = mouseNormY * THREE.MathUtils.degToRad(this.config.parallaxMaxAngle);
  }

  onDeviceOrientation(event) {
    // Basic fallback using gyro
    if (event.gamma !== null && event.beta !== null) {
      const limitedGamma = Math.max(-45, Math.min(45, event.gamma));
      const limitedBeta = Math.max(-45, Math.min(45, event.beta));
      
      const normX = limitedGamma / 45;
      const normY = (limitedBeta - 45) / 45;
      
      this.targetRotY = normX * THREE.MathUtils.degToRad(this.config.parallaxMaxAngle);
      this.targetRotX = normY * THREE.MathUtils.degToRad(this.config.parallaxMaxAngle);
    }
  }

  update() {
    this.scene.rotation.y += (this.targetRotY - this.scene.rotation.y) * this.config.parallaxLerp;
    this.scene.rotation.x += (this.targetRotX - this.scene.rotation.x) * this.config.parallaxLerp;
  }

  destroy() {
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('deviceorientation', this.onDeviceOrientation);
  }
}
