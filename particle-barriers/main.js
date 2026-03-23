import { CONFIG } from './src/config.js';
import { ParticleBarriers } from './src/ParticleBarriers.js';

// Initialization
const viz = new ParticleBarriers('#particle-container', CONFIG);
viz.start();

// Expose to window for debugging
window.viz = viz;
