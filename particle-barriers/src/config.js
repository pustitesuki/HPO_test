export const CONFIG = {
  // Particles
  particleCount: 1600,
  particleSize: { min: 2, max: 4 },
  corridorHeight: 500, // px
  baseSpeed: 3, // units/frame — tune to achieve 4-6s full traversal

  // Colors
  colorFlying: 0x063D57,
  colorCaptured: 0x1B3048,
  colorTrail: 0x01DDFF,

  // Barriers
  barrierCount: 7,
  barrierCaptureZone: 20, // px, ± from center
  captureRates: [0.25, 0.20, 0.18, 0.15, 0.12, 0.10, 0.08],

  // Animations
  magnetizeDuration: { min: 300, max: 500 }, // ms
  colorTransitionDuration: 200, // ms
  pulsePeriod: { min: 1500, max: 2500 }, // ms
  pulseScale: { min: 1.0, max: 1.4 },
  glowOpacity: { min: 0.3, max: 0.7 },

  // Fade out (after barrier 7)
  fadeDecay: 0.98, // speed multiplier per frame
  fadeDuration: 2000, // ms

  // Trails
  trailLength: 150, // px
  trailSegments: 10,
  trailOpacityHead: 0.6,
  trailOpacityTail: 0.0,
  trailWidth: 1.5, // px

  // Parallax
  parallaxMaxAngle: 10, // degrees
  parallaxLerp: 0.05,

  // Performance
  maxPixelRatio: 2,
};
