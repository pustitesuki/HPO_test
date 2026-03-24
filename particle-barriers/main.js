import { CONFIG } from './src/config.js';
import { ParticleBarriers } from './src/ParticleBarriers.js';

const containerSelector = '#particle-container';
const viz = new ParticleBarriers(containerSelector, CONFIG);

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      viz.start();
    } else {
      viz.pause();
    }
  });
});

const el = document.querySelector(containerSelector);
if (el) {
  observer.observe(el);
} else {
  viz.start(); // Fallback
}

// Expose to window for debugging
window.viz = viz;
