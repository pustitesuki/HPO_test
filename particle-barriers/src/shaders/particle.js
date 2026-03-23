export const particleVert = `
attribute float size;
attribute vec3 customColor;
attribute float opacity;
attribute float glowOpacity;

varying vec3 vColor;
varying float vOpacity;
varying float vGlowOpacity;
varying float vCoreRatio;

void main() {
  vColor = customColor;
  vOpacity = opacity;
  vGlowOpacity = glowOpacity;
  
  // size is the actual particle size (2-4). We set point size to size * 3 for glow area
  vCoreRatio = 1.0 / 3.0; 
  
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * 3.0 * (800.0 / -mvPosition.z); // Scale by distance
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const particleFrag = `
varying vec3 vColor;
varying float vOpacity;
varying float vGlowOpacity;
varying float vCoreRatio;

void main() {
  vec2 cxy = 2.0 * gl_PointCoord - 1.0;
  float dist = length(cxy);
  if (dist > 1.0) discard;
  
  float coreAlpha = smoothstep(vCoreRatio, vCoreRatio - 0.1, dist);
  float glowAlpha = smoothstep(1.0, vCoreRatio, dist) * vGlowOpacity;
  
  float finalAlpha = max(coreAlpha, glowAlpha) * vOpacity;
  if (finalAlpha < 0.01) discard;
  
  gl_FragColor = vec4(vColor, finalAlpha);
}
`;
