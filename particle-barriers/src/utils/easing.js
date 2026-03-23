// easeOutCubic — attraction phase
export function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

// easeInOutQuad — color transition
export function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// easeInOutSine — pulse animation
export function easeInOutSine(t) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}
