// Ported from Horn.os (owner's project): js/scene/city.js
/*
 * GLSL of the outdoor: the sky dome (gradient, sun, stars), the facades drawn in the shader (four styles, windows
 * that light up at night each on its own clock, shopfronts, fog) and the additive tower beacons. The dome and the
 * facades include three's tone mapping and colour space chunks, so they follow the exposure of the phase like the
 * room does.
 */

export const SKY_VERTEX = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`

export const SKY_FRAGMENT = /* glsl */ `
  uniform vec3 uTop, uHorizon, uSunDir, uSunColor;
  uniform float uSunSize, uStars, uTime;
  varying vec3 vDir;
  float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = mix(uHorizon, uTop, smoothstep(-0.02, 0.55, h));
    float s = max(dot(d, normalize(uSunDir)), 0.0);
    col += uSunColor * (pow(s, 1400.0 / uSunSize) * 6.0 + pow(s, 12.0) * 0.35 + pow(s, 3.0) * 0.12);
    vec3 cell = floor(d * 380.0);
    float st = step(0.9975, hash(cell));
    float tw = 0.6 + 0.4 * sin(uTime * 2.0 + hash(cell + 1.0) * 40.0);
    col += vec3(st * tw * uStars * smoothstep(0.04, 0.3, h));
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`

export const FACADE_VERTEX = /* glsl */ `
  attribute vec3 aTone;
  attribute float aStyle;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec3 vTone;
  varying float vId;
  varying float vHeight;
  varying float vStyle;
  void main() {
    vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vTone = aTone;
    vStyle = aStyle;
    vId = float(gl_InstanceID);
    vHeight = instanceMatrix[1][1];
    gl_Position = projectionMatrix * viewMatrix * w;
  }`

export const FACADE_FRAGMENT = /* glsl */ `
  uniform vec3 uSunDir, uSunColor, uAmbient, uSky, uSkyTop, uFogColor;
  uniform float uNight, uTime, uFogNear, uFogFar;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying vec3 vTone;
  varying float vId;
  varying float vHeight;
  varying float vStyle;
  float hash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  float box(vec2 f, vec4 r) { return step(r.x, f.x) * step(f.x, r.y) * step(r.z, f.y) * step(f.y, r.w); }
  void main() {
    vec3 n = normalize(vNormal);
    vec3 V = normalize(vWorld - cameraPosition);
    float dist = length(vWorld - cameraPosition);
    float diff = max(dot(n, normalize(uSunDir)), 0.0);
    vec3 light = uAmbient + uSunColor * diff;
    float st = floor(vStyle + 0.5);
    bool isBrick = st < 0.5;
    bool isGlass = abs(st - 1.0) < 0.5;
    bool isConcrete = abs(st - 2.0) < 0.5;
    vec3 col;
    if (abs(n.y) > 0.5) {
      col = vTone * 0.5 * light; // roofs: membrane and gravel
    } else {
      float u = abs(n.x) > 0.5 ? vWorld.z : vWorld.x;
      float y = vWorld.y - GROUND_Y;
      float face = abs(n.x) > 0.5 ? sign(n.x) : 2.0 + sign(n.z);
      vec2 cs = isGlass ? vec2(1.6, 3.6) : isConcrete ? vec2(4.2, 3.4) : vec2(3.0, 3.4);
      float gy = y - 4.6; // the ground floor is taller
      vec2 cell = floor(vec2(u, gy) / cs);
      vec2 f = fract(vec2(u, gy) / cs);
      vec3 seed = vec3(cell, vId * 7.0 + face);
      vec4 win = isGlass ? vec4(0.03, 0.97, 0.1, 0.98) : isConcrete ? vec4(0.0, 1.0, 0.36, 0.86) : vec4(0.25, 0.75, 0.3, 0.82);
      float upper = step(0.0, gy) * step(y, vHeight - 1.2);
      float inWin = box(f, win) * upper;
      float inFrame = box(f, win + vec4(-0.035, 0.035, -0.03, 0.02)) * (1.0 - box(f, win)) * upper * (isGlass ? 0.0 : 1.0);
      float sill = box(f, vec4(win.x - 0.05, win.y + 0.05, win.z - 0.06, win.z - 0.03)) * upper * (isGlass || isConcrete ? 0.0 : 1.0);

      vec3 wall = vTone;
      if (isBrick) {
        float row = floor(y / 0.075);
        vec2 b = vec2(u / 0.25 + mod(row, 2.0) * 0.5, y / 0.075);
        float fade = 1.0 - smoothstep(18.0, 70.0, dist);
        float mortar = max(step(0.88, fract(b.x)), step(0.8, fract(b.y)));
        wall *= (1.0 - mortar * 0.22 * fade) * (0.9 + 0.2 * hash(vec3(floor(b), vId)) * fade);
      } else if (isConcrete) {
        wall *= 0.93 + 0.07 * step(0.5, fract(gy / cs.y + 0.25));
      } else {
        wall *= 0.97 + 0.03 * hash(vec3(floor(vec2(u, y) * 0.5), vId));
      }
      vec3 lit = wall * light;

      // glass: interior, blinds, and a Fresnel reflection of the sky
      vec3 R = reflect(V, n);
      vec3 skyRefl = mix(uSky, uSkyTop, smoothstep(0.0, 0.5, R.y));
      skyRefl += uSunColor * pow(max(dot(R, normalize(uSunDir)), 0.0), 250.0) * 1.5;
      float fres = 0.3 + 0.7 * pow(1.0 - max(dot(-V, n), 0.0), 3.0);
      vec3 interior = vec3(0.05, 0.055, 0.065) * (0.6 + 0.8 * hash(seed + 5.0));
      float wy = (f.y - win.z) / (win.w - win.z);
      float blind = step(0.55, hash(seed + 13.0)) * step(1.0 - hash(seed + 21.0) * 0.7, wy);
      interior = mix(interior, vec3(0.78, 0.74, 0.66) * (uAmbient * 0.7), blind);
      vec3 glassDay = mix(interior, skyRefl * (isGlass ? 0.8 : 0.55), fres);
      // at night every window keeps its own clock: it switches on and off at its own period
      float period = 6.0 + hash(seed) * 30.0;
      float epoch = floor((uTime + hash(seed + 3.0) * period) / period);
      float floorLit = isGlass ? step(0.4, hash(vec3(cell.y, vId, floor((uTime + vId) / 40.0)))) : 1.0;
      float on = step(0.55 - 0.25 * uNight, hash(seed + epoch)) * floorLit;
      vec3 warm = mix(vec3(1.0, 0.72, 0.4), vec3(0.8, 0.88, 1.0), step(0.75, hash(seed + 9.0)));
      vec3 glassNight = mix(skyRefl * 0.2 + 0.01, warm * (0.7 + 0.6 * hash(seed + 11.0)) * mix(1.0, 0.5, blind), on);
      vec3 glass = mix(glassDay, glassNight, uNight);

      vec3 frame = (abs(st - 3.0) < 0.5 ? vec3(0.92) : vec3(0.16, 0.16, 0.17)) * light;
      col = lit;
      col = mix(col, wall * 1.15 * light, sill);
      col = mix(col, frame, inFrame);
      col = mix(col, glass, inWin);

      // shopfronts along the street, lit warm at night
      float bay = fract(u / 6.0);
      float shop = step(0.6, y) * step(y, 3.9) * step(0.08, bay) * step(bay, 0.92);
      vec3 shopDay = mix(vec3(0.07), skyRefl * 0.5, fres);
      vec3 shopNight = vec3(1.0, 0.8, 0.55) * (0.7 + 0.5 * hash(vec3(floor(u / 6.0), vId, 2.0)));
      col = mix(col, mix(shopDay, shopNight, uNight), shop);
      col *= mix(1.0, 0.8, step(y, 0.4)); // plinth
    }
    col = mix(col, uFogColor, smoothstep(uFogNear, uFogFar, dist));
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`

export const BEACON_VERTEX = /* glsl */ `
  attribute float aPhase;
  varying float vA;
  uniform float uTime, uNight;
  void main() {
    vA = step(0.55, fract(uTime * 0.5 + aPhase)) * (0.25 + 0.75 * uNight);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = 900.0 / -mv.z;
    gl_Position = projectionMatrix * mv;
  }`

export const BEACON_FRAGMENT = /* glsl */ `
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    gl_FragColor = vec4(1.0, 0.15, 0.1, vA * smoothstep(0.5, 0.0, d));
  }`
