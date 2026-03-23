export const trailVert = `
attribute float vertexAlpha;
attribute vec3 customColor;
varying float vAlpha;
varying vec3 vColor;

void main() {
  vAlpha = vertexAlpha;
  vColor = customColor;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const trailFrag = `
varying float vAlpha;
varying vec3 vColor;

void main() {
  if (vAlpha < 0.01) discard;
  gl_FragColor = vec4(vColor, vAlpha);
}
`;
