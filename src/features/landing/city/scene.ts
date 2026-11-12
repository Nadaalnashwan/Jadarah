/**
 * JADARAH city — procedural Three.js scene (no external models), composed after the approved Brand Identity Board:
 * a monumental glass portal built from the JADARAH symbol stands on a glossy plaza; a luminous ivory path flows out
 * of its doorway and travels across the water to a hazy Saudi skyline. Light mode = the light board (pale lavender
 * dawn), dark mode = the dark board (navy twilight with luminous edges).
 *
 * Art direction: a coherent contemporary Saudi metropolis at golden hour, read through the three brand concepts:
 *   1. interconnected architectural layers  → translucent layered portals (from the logo) mark every district;
 *   2. a continuous luminous path          → the candidate journey the camera travels along;
 *   3. a convergence point                  → the path ends inside the JADARAH gateway.
 *
 * Landmarks (illustrations, proportions simplified but faithful to their silhouettes):
 *   - Kingdom Centre, Riyadh: tapering elliptical tower, inverted parabolic opening, sky bridge across the top;
 *   - KAFD skyline (stylised): crystalline tallest tower, twisted and faceted towers, the elevated monorail loop;
 *   - Jeddah Tower: three tapering wings ending at different heights around a core and spire (no status implied);
 *   - Al Khobar Water Tower: slender shaft carrying a flared bowl, glazed ring and dome, on the waterfront.
 * Everything in the innovation district is fictional JADARAH architecture.
 */
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

export type Mode = "light" | "dark";

/**
 * The journey (no places, no directory): a single path from the plaza, through the JADARAH portal, across the city
 * to the convergence gateway. Each chapter is a camera station along that path.
 */
import type { Chapter } from "./scene-chapters";
export type { Chapter } from "./scene-chapters";

const VIEWS: Record<Chapter, { pos: [number, number, number]; target: [number, number, number]; u: number }> =
  {
    enter: { pos: [-110, 40, 400], target: [-80, 90, -300], u: 0 },
    discover: { pos: [150, 80, -120], target: [-110, 160, -660], u: 0.24 },
    develop: { pos: [150, 55, -620], target: [-60, 45, -830], u: 0.5 },
    demonstrate: { pos: [500, 60, -820], target: [330, 35, -1010], u: 0.74 },
    converge: { pos: [300, 70, -790], target: [650, 115, -1270], u: 1 },
  };

export const C = {
  navy: 0x101e31,
  blue: 0x3b66f6,
  skyBlue: 0xa9cbe5,
  skyDeep: 0x91b9d8,
  sky: 0xd4e4ef,
  ivory: 0xfff7e8,
};

export type CityOptions = { quality: "high" | "low"; reducedMotion: boolean; mode: Mode };

/* ---------------------------------------------------------------- textures (generated, tiny) */
function facadeTexture(opts: {
  cols: number;
  rows: number;
  base: string;
  line: string;
  lit?: number;
  warm?: boolean;
}) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 512;
  const g = c.getContext("2d")!;
  g.fillStyle = opts.base;
  g.fillRect(0, 0, 256, 512);
  const cw = 256 / opts.cols;
  const rh = 512 / opts.rows;
  for (let r = 0; r < opts.rows; r++)
    for (let k = 0; k < opts.cols; k++) {
      const lit = Math.random() < (opts.lit ?? 0);
      g.fillStyle = lit
        ? opts.warm
          ? "rgba(255,214,160,.9)"
          : "rgba(255,240,220,.75)"
        : "rgba(255,255,255,0)";
      if (lit) g.fillRect(k * cw + 2, r * rh + 2, cw - 4, rh - 4);
    }
  g.strokeStyle = opts.line;
  g.lineWidth = 2;
  for (let r = 0; r <= opts.rows; r++) {
    g.beginPath();
    g.moveTo(0, r * rh);
    g.lineTo(256, r * rh);
    g.stroke();
  }
  g.lineWidth = 1;
  for (let k = 0; k <= opts.cols; k++) {
    g.beginPath();
    g.moveTo(k * cw, 0);
    g.lineTo(k * cw, 512);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/* ---------------------------------------------------------------- landmark geometry */
function kingdomCentre(glass: THREE.Material, bridgeMat: THREE.Material) {
  const H = 300;
  const s = new THREE.Shape();
  s.moveTo(-55, 0);
  s.quadraticCurveTo(-46, 150, -33, H);
  s.lineTo(-25, H);
  s.lineTo(-25, 289);
  s.lineTo(25, 289);
  s.lineTo(25, H);
  s.lineTo(33, H);
  s.quadraticCurveTo(46, 150, 55, 0);
  s.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-25.2, 280);
  hole.bezierCurveTo(-25.2, 232, -11, 194, 0, 191);
  hole.bezierCurveTo(11, 194, 25.2, 232, 25.2, 280);
  hole.closePath();
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 72,
    bevelEnabled: true,
    bevelSize: 1.2,
    bevelThickness: 1.2,
    bevelSegments: 2,
    curveSegments: 40,
    steps: 1,
  });
  g.translate(0, 0, -36);
  // Elliptical plan narrowing with height: taper the depth as the tower rises.
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    p.setZ(i, p.getZ(i) * (1 - 0.62 * Math.min(1, y / H)));
  }
  g.computeVertexNormals();
  const group = new THREE.Group();
  const tower = new THREE.Mesh(g, glass);
  tower.castShadow = tower.receiveShadow = true;
  group.add(tower);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(51, 9, 18), bridgeMat);
  bridge.position.set(0, 284.5, 0);
  group.add(bridge);
  return group;
}

function taperedWing(width: number, length: number, height: number, mat: THREE.Material) {
  const g = new THREE.BoxGeometry(width, height, length, 1, 48, 1);
  g.translate(0, height / 2, length / 2);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const t = Math.min(1, Math.max(0, p.getY(i) / height));
    p.setX(i, p.getX(i) * (1 - 0.8 * t));
    p.setZ(i, p.getZ(i) * Math.pow(1 - t, 0.85));
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

function jeddahTower(glass: THREE.Material, steel: THREE.Material) {
  const H = 720;
  const group = new THREE.Group();
  const core = new THREE.Mesh(new THREE.CylinderGeometry(4, 24, H * 0.96, 3, 48), glass);
  core.position.y = (H * 0.96) / 2;
  core.castShadow = true;
  group.add(core);
  [
    [0, 0.82],
    [(2 * Math.PI) / 3, 0.9],
    [(4 * Math.PI) / 3, 0.97],
  ].forEach(([a, h]) => {
    const w = taperedWing(30, 58, H * h, glass);
    w.rotation.y = a;
    group.add(w);
  });
  const spire = new THREE.Mesh(new THREE.ConeGeometry(2.2, 70, 8), steel);
  spire.position.y = H * 0.96 + 30;
  group.add(spire);
  const terrace = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 3, 24), steel);
  terrace.position.y = H * 0.66;
  group.add(terrace);
  return group;
}

function khobarWaterTower(concrete: THREE.Material, glass: THREE.Material) {
  const pts = [
    [5.5, 0],
    [4.6, 30],
    [3.8, 58],
    [4.2, 62],
    [8, 66],
    [14, 71],
    [18.5, 76],
    [19, 79],
    [18.5, 81],
    [13, 84],
    [9, 86],
    [8, 88],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 64), concrete);
  body.castShadow = body.receiveShadow = true;
  group.add(body);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(8.2, 8.2, 5, 48, 1, true), glass);
  ring.position.y = 90;
  group.add(ring);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(8.4, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2),
    concrete,
  );
  dome.position.y = 92.5;
  group.add(dome);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(2.6, 24, 16), glass);
  ball.position.y = 103;
  group.add(ball);
  const spire = new THREE.Mesh(new THREE.ConeGeometry(0.7, 22, 8), concrete);
  spire.position.y = 115;
  group.add(spire);
  return group;
}

function twisted(w: number, h: number, turns: number, mat: THREE.Material) {
  const g = new THREE.BoxGeometry(w, h, w, 1, 60, 1);
  g.translate(0, h / 2, 0);
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const a = (v.y / h) * turns;
    const k = 1 - 0.25 * (v.y / h);
    p.setXYZ(
      i,
      (v.x * Math.cos(a) - v.z * Math.sin(a)) * k,
      v.y,
      (v.x * Math.sin(a) + v.z * Math.cos(a)) * k,
    );
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

/* ---------------------------------------------------------------- brand geometry */
/** A panel outline with an opening that reaches the floor (∩ / door frame), as one contour. */
function framedPanel(
  w: number,
  h: number,
  r: number,
  open?: { x0: number; x1: number; top: number; r: number },
) {
  const s = new THREE.Shape();
  const x0 = -w / 2;
  const x1 = w / 2;
  s.moveTo(x0, 0);
  s.lineTo(x0, h - r);
  s.quadraticCurveTo(x0, h, x0 + r, h);
  s.lineTo(x1 - r, h);
  s.quadraticCurveTo(x1, h, x1, h - r);
  s.lineTo(x1, 0);
  if (open) {
    const a = x0 + open.x1;
    const b = x0 + open.x0;
    s.lineTo(a, 0);
    s.lineTo(a, open.top - open.r);
    s.quadraticCurveTo(a, open.top, a - open.r, open.top);
    s.lineTo(b + open.r * 0.4, open.top);
    s.quadraticCurveTo(b, open.top, b, open.top - open.r * 0.4);
    s.lineTo(b, 0);
  }
  s.closePath();
  return s;
}

/**
 * The approved symbol, built in 3D: back layer (blue), middle frame (lavender), front frame with the doorway
 * (deep blue) — staggered so that, seen from the plaza, they read exactly as the logo; the doorway glows ivory.
 */
function symbolPortal(mode: Mode) {
  const dark = mode === "dark";
  const glassy = (color: number, opacity: number, emissive: number) =>
    new THREE.MeshPhysicalMaterial({
      color,
      transparent: true,
      opacity,
      roughness: 0.08,
      metalness: 0.05,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      emissive: color,
      emissiveIntensity: emissive,
      side: THREE.DoubleSide,
      depthWrite: false,
      fog: false, // the portal stays vivid in front of the haze, as on the board
    });
  const ext = {
    depth: 2.4,
    bevelEnabled: true,
    bevelSize: 0.9,
    bevelThickness: 0.9,
    bevelSegments: 3,
    curveSegments: 24,
  };
  const g = new THREE.Group();
  const back = new THREE.Mesh(
    new THREE.ExtrudeGeometry(framedPanel(64, 100, 7), ext),
    glassy(0x6a7cff, dark ? 0.88 : 0.9, dark ? 0.24 : 0.24),
  );
  back.position.set(-40, 9, -34);
  const mid = new THREE.Mesh(
    new THREE.ExtrudeGeometry(framedPanel(64, 100, 7, { x0: 14, x1: 48, top: 80, r: 4 }), ext),
    glassy(0xa78bfa, dark ? 0.75 : 0.82, dark ? 0.27 : 0.22),
  );
  mid.position.set(-19, 3, -16);
  const front = new THREE.Mesh(
    new THREE.ExtrudeGeometry(framedPanel(64, 100, 7, { x0: 12, x1: 34, top: 86, r: 3 }), ext),
    glassy(0x5b5bf0, dark ? 0.92 : 0.94, dark ? 0.23 : 0.24),
  );
  front.position.set(2, -4, 2);
  // tunnel interior + ivory light at the end of the doorway
  const door = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 84),
    // Soft lilac-ivory doorway (was white at 170% — the main source of glare and bloom blow-out).
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0xf1eaff).multiplyScalar(1.08), toneMapped: false }),
  );
  door.position.set(2 - 32 + 23, 38, -6);
  const jamb = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 84, 16),
    new THREE.MeshStandardMaterial({
      color: 0xd4e4ef,
      emissive: 0xd4e4ef,
      emissiveIntensity: dark ? 0.32 : 0.18,
    }),
  );
  jamb.position.set(2 - 32 + 12, 38, -6);
  g.add(back, mid, front, door, jamb);
  g.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  const light = new THREE.PointLight(0xeee4da, dark ? 2300 : 1700, 190, 2);
  light.position.set(-7, 30, 14);
  g.add(light);
  return g;
}

/** Sky dome painted in the board's palette (not a generic physical sky). */
function skyDome(mode: Mode) {
  const dark = mode === "dark";
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      // dark: Deep Midnight → Petrol Surface → petrol/soft-sky horizon, a soft Blue Accent glow (never a tan sky)
      top: { value: new THREE.Color(dark ? 0x1e2250 : 0x9aa6e0) },
      mid: { value: new THREE.Color(dark ? 0x352f72 : 0xd8d1ec) },
      horizon: { value: new THREE.Color(dark ? 0x6b5fb3 : 0xf1e4cc) },
      glow: { value: new THREE.Color(dark ? 0x7a9bff : 0xf5dcb0) },
      // violet signature: a muted lavender twilight belt on the side of the sky facing away from the sun
      dusk: { value: new THREE.Color(dark ? 0x7a52d6 : 0xcdb6f2) },
      sunDir: { value: new THREE.Vector3(0.12, 0.14, -0.98).normalize() },
    },
    vertexShader:
      "varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
    fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; uniform vec3 glow; uniform vec3 dusk; uniform vec3 sunDir; varying vec3 vDir;
      void main(){ float h = clamp(vDir.y, 0.0, 1.0);
        vec3 c = mix(horizon, mid, smoothstep(0.0, 0.18, h));
        c = mix(c, top, smoothstep(0.18, 0.75, h));
        float s = max(dot(normalize(vDir), sunDir), 0.0);
        c += glow * (pow(s, 16.0) * 0.9 + pow(s, 3.0) * 0.3) * (1.0 - h * 0.6);
        float away = max(dot(normalize(vDir), -sunDir), 0.0);
        float belt = smoothstep(0.02, 0.16, h) * (1.0 - smoothstep(0.22, 0.55, h));
        c = mix(c, dusk, belt * (0.25 + 0.35 * away));
        gl_FragColor = vec4(c, 1.0); }`,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(8000, 32, 16), mat);
}

/* ---------------------------------------------------------------- scene */
export function createCityScene(canvas: HTMLCanvasElement, opts: CityOptions) {
  const high = opts.quality === "high";
  const dark = opts.mode === "dark";
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: high, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, high ? 1.75 : 1.25));
  renderer.toneMapping = THREE.NeutralToneMapping; // keeps the board's blues saturated
  renderer.toneMappingExposure = dark ? 0.92 : 0.8;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = high;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  // Board haze: the far skyline dissolves into lavender (light) or violet-navy (dark).
  scene.fog = new THREE.FogExp2(dark ? 0x2c2a5e : 0xe4dcef, dark ? 0.0004 : 0.0004);
  const camera = new THREE.PerspectiveCamera(36, 1, 2, 12000);

  // The journey path (defined first: the city keeps a clear corridor around it)
  const route = new THREE.CatmullRomCurve3(
    [
      [-170, 1.2, 250],
      [-70, 1.2, 230],
      [-22, 1.2, 120],
      [-8, 1.2, 40],
      [-6, 1.2, -10],
      [-12, 1.5, -120],
      [-30, 1.5, -330],
      [0, 1.5, -560],
      [-40, 1.5, -700],
      [-160, 1.5, -760],
      [-100, 1.5, -860],
      [80, 1.5, -900],
      [220, 1.5, -960],
      [300, 1.5, -1010],
      [400, 1.5, -1040],
      [520, 1.5, -1120],
      [600, 1.5, -1210],
      [626, 1.5, -1240],
    ].map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    false,
    "centripetal",
  );
  const corridor = route.getSpacedPoints(120).map((p) => [p.x, p.z, 75] as [number, number, number]);
  const stations: [number, number, number][] = [
    [-60, -820, 170],
    [330, -1010, 150],
    [640, -1250, 190],
    [0, 0, 140],
  ];
  const sky = skyDome(opts.mode);
  scene.add(sky);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(skyDome(opts.mode));
  const env = pmrem.fromScene(envScene, 0.03).texture;
  scene.environment = env;

  scene.add(
    new THREE.HemisphereLight(dark ? 0x8a8fe0 : 0xece6f6, dark ? 0x241f52 : 0xf3e6cf, dark ? 0.85 : 1.1),
  );
  const sun = new THREE.DirectionalLight(dark ? 0xcbb29c : 0xe9dcd2, dark ? 0.9 : 2.4);
  sun.position.set(-900, 520, -1500);
  sun.target.position.set(0, 0, -300);
  sun.castShadow = high;
  if (high) {
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -900,
      right: 900,
      top: 900,
      bottom: -900,
      near: 100,
      far: 5000,
    });
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.8;
  }
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(dark ? 0x6f9cc8 : 0xeef3f6, dark ? 0.8 : 1.4);
  fill.position.set(400, 300, 600);
  scene.add(fill);
  // Violet signature: a soft lavender rim light from behind the skyline gives the towers a cool second edge.
  const rim = new THREE.DirectionalLight(dark ? 0xa855f7 : 0xb6a8ca, dark ? 0.95 : 0.6);
  rim.position.set(700, 260, -1600);
  rim.target.position.set(0, 60, -500);
  scene.add(rim, rim.target);

  /* materials — board palette: glass in blue/lavender, warm ivory stone, navy accents */
  const litShare = dark ? 0.18 : 0.03;
  const glassTex = facadeTexture({
    cols: 14,
    rows: 60,
    base: dark ? "#2b2f6a" : "#d6d2ee",
    line: dark ? "rgba(169,184,255,.25)" : "rgba(13,27,63,.18)",
    lit: litShare,
    warm: true,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: dark ? 0xaeb4ea : 0xece8f6,
    map: glassTex,
    emissiveMap: dark ? glassTex : null,
    emissive: dark ? 0xffffff : 0x000000,
    emissiveIntensity: dark ? 0.35 : 0,
    metalness: 0.5,
    roughness: 0.16,
    envMapIntensity: 1.5,
    clearcoat: 0.6,
  });
  const warmTex = facadeTexture({
    cols: 6,
    rows: 22,
    base: dark ? "#2e537e" : "#efe3d4",
    line: "rgba(90,70,50,.22)",
    lit: litShare,
    warm: true,
  });
  const glassWarm = new THREE.MeshPhysicalMaterial({
    color: dark ? 0xc9c0b2 : 0xf6ebdd,
    map: warmTex,
    emissiveMap: dark ? warmTex : null,
    emissive: dark ? 0xffffff : 0x000000,
    emissiveIntensity: dark ? 0.45 : 0,
    metalness: 0.4,
    roughness: 0.3,
  });
  const steel = new THREE.MeshStandardMaterial({ color: 0xd4e4ef, metalness: 0.9, roughness: 0.25 });
  const stoneTex = facadeTexture({
    cols: 4,
    rows: 6,
    base: dark ? "#2b4a60" : "#efe2cf",
    line: "rgba(120,90,60,.16)",
    lit: litShare,
    warm: true,
  });
  const stone = new THREE.MeshStandardMaterial({
    color: dark ? 0xb7bfc8 : 0xf4e8d6,
    roughness: 0.9,
    map: stoneTex,
    emissiveMap: dark ? stoneTex : null,
    emissive: dark ? 0xffffff : 0x000000,
    emissiveIntensity: dark ? 0.4 : 0,
  });
  const ivoryMat = new THREE.MeshStandardMaterial({ color: dark ? 0xc8d3dc : 0xfbf4ea, roughness: 0.75 });
  const bridgeGlow = new THREE.MeshStandardMaterial({
    color: 0xfff7e8,
    emissive: 0xe5d6c8,
    emissiveIntensity: dark ? 1.4 : 0.6,
    metalness: 0.4,
    roughness: 0.3,
  });

  /* land, glossy plaza and water */
  const land = new THREE.MeshStandardMaterial({
    color: dark ? 0x15283b : 0xdcc8b5, // dark: navy · light: Warm Sand
    roughness: 0.95,
    emissive: dark ? 0x172c43 : 0xdcc8b5,
    emissiveIntensity: dark ? 0.8 : 0.35,
  });
  const flat = (w: number, d: number, x: number, z: number, mat: THREE.Material, y = 0) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    scene.add(m);
    return m;
  };
  flat(4000, 900, 0, 330, land, 0); // near shore
  flat(5000, 2600, 0, -1830, land, 0); // far shore (cities)
  // Glossy plaza that mirrors the portal (board): a true reflection on capable devices.
  const plazaGeo = new THREE.PlaneGeometry(900, 420);
  // Glossy plaza (clear-coated, picks up the environment). A planar mirror was dropped: it reflected the night sky as
  // near-black in dark mode.
  const plazaMesh = new THREE.Mesh(
    plazaGeo,
    new THREE.MeshPhysicalMaterial({
      color: dark ? 0x204355 : 0xe9dcd2, // Petrol Surface · Soft Beige
      roughness: 0.12,
      clearcoat: 1,
      envMapIntensity: dark ? 1.3 : 0.7,
      emissive: dark ? 0x172c43 : 0xe9dcd2,
      emissiveIntensity: dark ? 0.7 : 0.4,
    }),
  );
  plazaMesh.rotation.x = -Math.PI / 2;
  plazaMesh.position.set(-40, 0.15, 90);
  scene.add(plazaMesh);
  // promontory for the Eastern Province waterfront
  const prom = new THREE.Mesh(new THREE.CylinderGeometry(70, 76, 3, 48), land);
  prom.position.set(900, 1.5, -400);
  scene.add(prom);
  const waterGeo = new THREE.PlaneGeometry(5000, 650);
  const water = new THREE.Mesh(
    waterGeo,
    new THREE.MeshPhysicalMaterial({
      color: dark ? 0x1f4a5e : 0xa9cbe5, // dark: petrol · light: Sky Blue (approved palette)
      roughness: dark ? 0.04 : 0.2,
      metalness: dark ? 0.15 : 0.05,
      envMapIntensity: dark ? 1.2 : 0.6,
      clearcoat: dark ? 1 : 0.35,
      emissive: dark ? 0x3a2f80 : 0xc9bff0, // indigo-violet water glow, never black water
      emissiveIntensity: dark ? 0.9 : 0.45,
    }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.5, -205);
  scene.add(water);

  /* convergence: the JADARAH symbol portal on the plaza */
  const portal = symbolPortal(opts.mode);
  const portalLights: THREE.PointLight[] = [];
  portal.traverse((o) => (o as THREE.PointLight).isPointLight && portalLights.push(o as THREE.PointLight));
  portal.scale.setScalar(1.15);
  // Violet doorway light: the portal glows blue → violet onto the plaza and the path.
  const portalViolet = new THREE.PointLight(0xa855f7, dark ? 1500 : 850, 180, 2);
  portalViolet.position.set(8, 42, 28);
  portal.add(portalViolet);
  portalLights.push(portalViolet);
  portal.rotation.y = -0.3;
  scene.add(portal);

  /* Riyadh across the water: Kingdom Centre + KAFD */
  const kc = kingdomCentre(glass, bridgeGlow);
  kc.position.set(-100, 0, -640);
  kc.rotation.y = 0.15;
  scene.add(kc);
  const kafd = new THREE.Group();
  kafd.position.set(-300, 0, -900);
  const pif = new THREE.Mesh(new THREE.CylinderGeometry(7, 27, 360, 6, 24), glass);
  pif.position.y = 180;
  const crown = new THREE.Mesh(new THREE.ConeGeometry(7, 46, 6), steel);
  crown.position.y = 383;
  const tw = twisted(30, 250, Math.PI / 2.4, glass);
  tw.position.set(-95, 0, 70);
  const facet = new THREE.Mesh(new THREE.CylinderGeometry(9, 24, 230, 4, 12), glassWarm);
  facet.position.set(85, 115, 40);
  facet.rotation.y = Math.PI / 4;
  const slim = new THREE.Mesh(new THREE.CapsuleGeometry(15, 190, 8, 24), glass);
  slim.position.set(150, 110, -60);
  const tw2 = twisted(26, 180, -Math.PI / 3, glassWarm);
  tw2.position.set(-40, 0, -110);
  kafd.add(pif, crown, tw, facet, slim, tw2);
  const loop = new THREE.Mesh(new THREE.TorusGeometry(175, 1.6, 8, 160), steel);
  loop.rotation.x = Math.PI / 2;
  loop.position.y = 24;
  loop.scale.set(1, 0.72, 1);
  kafd.add(loop);
  kafd.traverse((o) => ((o as THREE.Mesh).castShadow = true));
  scene.add(kafd);

  /* Jeddah: the tower and Hijazi corniche fabric */
  const jt = jeddahTower(glass, steel);
  jt.position.set(700, 0, -1400);
  scene.add(jt);
  const roshan = new THREE.MeshStandardMaterial({
    color: dark ? 0xb08a62 : 0x9a7048,
    roughness: 0.8,
    emissive: dark ? 0x4a3a2c : 0x000000,
  });
  for (let i = 0; i < 10; i++) {
    const h = 16 + (i % 3) * 9;
    const b = new THREE.Mesh(new THREE.BoxGeometry(26, h, 22), ivoryMat);
    b.position.set(380 + i * 36, h / 2, -560 - (i % 2) * 34);
    const r = new THREE.Mesh(new THREE.BoxGeometry(8, h * 0.55, 2), roshan);
    r.position.set(b.position.x - 4, h * 0.55, b.position.z + 11.5);
    scene.add(b, r);
  }

  /* Eastern Province: Al Khobar Water Tower on its promontory */
  const kwt = khobarWaterTower(ivoryMat, glass);
  kwt.position.set(900, 3, -400);
  kwt.scale.setScalar(1.1);
  scene.add(kwt);
  const eTowers = [
    [1060, -660, 26, 210],
    [1120, -720, 22, 160],
    [990, -700, 18, 130],
  ];
  eTowers.forEach(([x, z, w, h]) => {
    const t = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), glass);
    t.position.set(x, h / 2, z);
    scene.add(t);
  });

  /* far-shore skyline fabric (hazy, like the board) */
  let seed = 11;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const block = new THREE.BoxGeometry(1, 1, 1);
  block.translate(0, 0.5, 0);
  const fabric = (
    mat: THREE.Material,
    n: number,
    x0: number,
    x1: number,
    z0: number,
    z1: number,
    hMin: number,
    hMax: number,
    avoid: [number, number, number][],
  ) => {
    const inst = new THREE.InstancedMesh(block, mat, n);
    const m = new THREE.Matrix4();
    let k = 0;
    for (let i = 0; i < n * 5 && k < n; i++) {
      const x = x0 + rand() * (x1 - x0);
      const z = z0 + rand() * (z1 - z0);
      if ([...avoid, ...corridor, ...stations].some(([ax, az, r]) => Math.hypot(x - ax, z - az) < r))
        continue;
      const w = 16 + rand() * 26;
      const h = hMin + Math.pow(rand(), 2.2) * (hMax - hMin);
      m.compose(
        new THREE.Vector3(x, 0, z),
        new THREE.Quaternion(),
        new THREE.Vector3(w, h, w * (0.7 + rand() * 0.6)),
      );
      inst.setMatrixAt(k++, m);
    }
    inst.count = k;
    scene.add(inst);
  };
  const q = high ? 1 : 0.5;
  fabric(stone, Math.round(120 * q), -1400, 300, -1500, -560, 14, 70, [
    [-100, -640, 90],
    [-300, -900, 210],
  ]);
  fabric(glass, Math.round(40 * q), -900, 0, -1600, -1100, 70, 180, [[-300, -900, 210]]);
  fabric(ivoryMat, Math.round(60 * q), 320, 900, -1500, -620, 14, 80, [[700, -1400, 90]]);
  fabric(glassWarm, Math.round(50 * q), 900, 1800, -1500, -620, 20, 140, []);

  const brandGlass = (color: number, opacity: number, emissive: number) =>
    new THREE.MeshPhysicalMaterial({
      color,
      transparent: true,
      opacity,
      roughness: 0.08,
      clearcoat: 1,
      emissive: color,
      emissiveIntensity: emissive,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  const layerColors = [0x4b83c5, 0xa9cbe5, 0x3b66f6];

  /* DEVELOP — layered forms rising in steps along the path (skills built layer on layer); fictional sculpture */
  const develop = new THREE.Group();
  develop.position.set(-60, 0, -820);
  for (let i = 0; i < 6; i++) {
    const h = 26 + i * 12;
    const panel = new THREE.Mesh(
      new THREE.ExtrudeGeometry(framedPanel(30, h, 5, { x0: 9, x1: 21, top: h * 0.72, r: 2 }), {
        depth: 1.6,
        bevelEnabled: false,
      }),
      brandGlass(layerColors[i % 3], 0.82, dark ? 0.4 : 0.2),
    );
    panel.position.set(-70 + i * 26, 0, 20 - i * 9);
    panel.rotation.y = 0.45;
    develop.add(panel);
  }
  scene.add(develop);

  /* DEMONSTRATE — a ring of luminous panels around a bright floor: practical work made visible; fictional */
  const demo = new THREE.Group();
  demo.position.set(330, 0, -1010);
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(48, 64),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xfff7e8).multiplyScalar(dark ? 1.3 : 1.05),
      toneMapped: false,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.6;
  demo.add(floor);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const panel = new THREE.Mesh(
      new THREE.ExtrudeGeometry(framedPanel(16, 34 + (i % 3) * 8, 4), { depth: 1.2, bevelEnabled: false }),
      brandGlass(layerColors[i % 3], 0.85, dark ? 0.45 : 0.25),
    );
    panel.position.set(Math.cos(a) * 62, 0, Math.sin(a) * 62);
    panel.lookAt(0, 0, 0);
    demo.add(panel);
  }
  const demoLight = new THREE.PointLight(0xeee4da, dark ? 2100 : 1300, 180, 2);
  demoLight.position.set(0, 30, 0);
  demo.add(demoLight);
  scene.add(demo);

  /* CONVERGE — the monumental JADARAH gateway where the path ends: talent meets opportunity */
  const gateway = symbolPortal(opts.mode);
  gateway.scale.setScalar(2.1);
  gateway.position.set(640, 0, -1250);
  gateway.rotation.y = -0.55;
  scene.add(gateway);

  /* the luminous path — from the plaza through the portal, across the city to the convergence gateway */
  const seg = high ? 900 : 500;
  const tube = new THREE.TubeGeometry(route, seg, 1.5, 8, false);
  const cols: number[] = [];
  const c0 = new THREE.Color(0xfff7e8);
  const c1 = new THREE.Color(dark ? 0x91b9d8 : 0x6f9fd1);
  const c2 = new THREE.Color(0x3b66f6);
  const tmp = new THREE.Color();
  const pos = tube.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const t = Math.floor(i / 9) / seg;
    const k = Math.sin(t * Math.PI * 6) * 0.5 + 0.5;
    const near = t < 0.14 || t > 0.93; // ivory at the entrance and the convergence (board), blue/lavender across the city
    tmp
      .copy(c0)
      .lerp(k > 0.5 ? c1 : c2, near ? 0 : 0.6)
      .multiplyScalar(dark ? 2.4 : 1.8);
    cols.push(tmp.r, tmp.g, tmp.b);
  }
  tube.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  scene.add(new THREE.Mesh(tube, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })));
  // the walkway beneath the light (ivory deck), wide like the board's path
  const deck = new THREE.Mesh(
    new THREE.TubeGeometry(route, seg, 9, 8, false),
    new THREE.MeshStandardMaterial({
      color: dark ? 0x2c4c66 : 0xfdf8f1,
      roughness: 0.4,
      emissive: dark ? 0x1f3d52 : 0xf4eee9,
      emissiveIntensity: dark ? 0.4 : 0.25,
    }),
  );
  deck.scale.y = 0.06;
  deck.receiveShadow = true;
  scene.add(deck);
  // the board's broad ivory light flowing out of the doorway toward the viewer
  const flowShape = new THREE.Shape();
  flowShape.moveTo(-8, 0);
  flowShape.bezierCurveTo(-8, 50, -50, 70, -60, 130);
  flowShape.lineTo(-20, 135);
  flowShape.bezierCurveTo(-14, 80, 12, 50, 10, 0);
  flowShape.closePath();
  const flow = new THREE.Mesh(
    new THREE.ShapeGeometry(flowShape, 32),
    new THREE.MeshBasicMaterial({
      color: 0xf1ebe5,
      transparent: true,
      opacity: dark ? 0.7 : 0.6,
      toneMapped: false,
      depthWrite: false,
    }),
  );
  flow.rotation.x = -Math.PI / 2;
  flow.rotation.z = 0.15;
  flow.position.set(0, 0.6, -2);
  scene.add(flow);

  // particles of light travelling along the path (removed for reduced motion)
  const count = opts.reducedMotion ? 0 : high ? 120 : 50;
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3));
  const particles = new THREE.Points(
    pGeo,
    new THREE.PointsMaterial({
      vertexColors: true,
      color: 0xffffff,
      size: 3.2,
      transparent: true,
      opacity: 0.95,
      toneMapped: false,
    }),
  );
  scene.add(particles);
  const offsets = Array.from({ length: count }, () => Math.random());
  // Light trails: each particle carries a tint between portal blue and lilac.
  const tint = new Float32Array(count * 3);
  const cBlue = new THREE.Color(0x9fb4ff);
  const cLilac = new THREE.Color(0xe2c8ff);
  const trailTint = new THREE.Color();
  for (let i = 0; i < count; i++) {
    trailTint.copy(cBlue).lerp(cLilac, i / Math.max(1, count - 1));
    tint.set([trailTint.r, trailTint.g, trailTint.b], i * 3);
  }
  pGeo.setAttribute("color", new THREE.Float32BufferAttribute(tint, 3));

  /* post: bloom only on the light (path, doorway, sky bridge) */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(
    new UnrealBloomPass(new THREE.Vector2(256, 256), dark ? 0.42 : 0.22, 0.38, dark ? 0.92 : 0.95),
  );
  composer.addPass(new OutputPass());

  /* camera rig: stations per chapter; flights follow the luminous path (cinematic), instant for reduced motion */
  const camPos = new THREE.Vector3(...VIEWS.enter.pos);
  const camTarget = new THREE.Vector3(...VIEWS.enter.target);
  const from = { pos: camPos.clone(), target: camTarget.clone(), u: 0 };
  const to = { pos: camPos.clone(), target: camTarget.clone(), u: 0 };
  let t0 = 0;
  let dur = 0;
  let direct = false; // straight dolly (opening shot) instead of riding the path
  const pointer = new THREE.Vector2();
  let width = 1;
  let height = 1;
  let shift = 0;
  function applyShift() {
    if (shift && width > 0) camera.setViewOffset(width, height, -shift * width, 0, width, height);
    else camera.clearViewOffset();
  }
  function resize(w: number, h: number) {
    width = w;
    height = h;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = w / h < 0.9 ? 54 : w / h < 1.3 ? 44 : 36;
    camera.updateProjectionMatrix();
    applyShift();
  }
  function setShift(v: number) {
    shift = v;
    applyShift();
  }
  function focus(ch: Chapter) {
    const v = VIEWS[ch];
    from.pos.copy(camPos);
    from.target.copy(camTarget);
    to.pos.set(...v.pos);
    to.target.set(...v.target);
    to.u = v.u;
    if (width / height < 0.9) to.pos.sub(to.target).multiplyScalar(1.3).add(to.target);
    t0 = performance.now();
    // Same station (e.g. the opening): a straight dolly; otherwise ride the luminous path between stations.
    direct = from.pos.distanceTo(to.pos) < 1 || Math.abs(from.u - to.u) < 1e-3;
    dur = opts.reducedMotion || from.pos.distanceTo(to.pos) < 1 ? 0 : direct ? 7000 : 5200;
    if (!dur) {
      camPos.copy(to.pos);
      camTarget.copy(to.target);
      from.u = to.u;
    }
  }
  function setPointer(x: number, y: number) {
    if (!opts.reducedMotion) pointer.set(x, y);
  }
  const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const smooth = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const UP = new THREE.Vector3(0, 1, 0);
  const orbit = new THREE.Vector3();
  const sunBase = sun.position.clone();
  const base = {
    glass: glass.emissiveIntensity,
    warm: glassWarm.emissiveIntensity,
    bridge: bridgeGlow.emissiveIntensity,
    water: (water.material as THREE.MeshStandardMaterial).emissiveIntensity,
    portal: portalLights.map((l) => l.intensity),
    rim: rim.intensity,
  };
  /** Environmental motion: breathing window light, a pulse in the portal and sky bridge, shimmering water and a
   * slowly travelling sun. Uniform changes only — no new geometry, no extra draw calls. */
  function ambient(now: number) {
    const w = Math.sin(now / 2600);
    glass.emissiveIntensity = base.glass * (1 + 0.14 * w);
    glassWarm.emissiveIntensity = base.warm * (1 + 0.12 * Math.sin(now / 3100 + 1.3));
    bridgeGlow.emissiveIntensity = base.bridge * (1 + 0.18 * Math.sin(now / 1900));
    (water.material as THREE.MeshStandardMaterial).emissiveIntensity = base.water * (1 + 0.1 * Math.sin(now / 1500));
    portalLights.forEach((l, i) => (l.intensity = base.portal[i] * (1 + 0.12 * Math.sin(now / 1700 + i))));
    rim.intensity = base.rim * (1 + 0.25 * Math.sin(now / 6200));
    const a = Math.sin(now / 24000) * 0.12;
    sun.position.copy(sunBase).applyAxisAngle(UP, a);
  }
  const rideP = new THREE.Vector3();
  const rideL = new THREE.Vector3();
  function render(now: number) {
    if (dur) {
      const k = Math.min(1, (now - t0) / dur);
      const e = ease(k);
      if (direct) {
        camPos.lerpVectors(from.pos, to.pos, 1 - Math.pow(1 - k, 3));
        camTarget.lerpVectors(from.target, to.target, 1 - Math.pow(1 - k, 3));
        if (k >= 1) dur = 0;
      } else {
        // ride along the path between the two stations, a few metres above it, looking ahead
        const u = THREE.MathUtils.lerp(from.u, to.u, e);
        const ahead = Math.sign(to.u - from.u || 1) * 0.035;
        rideP.copy(route.getPointAt(THREE.MathUtils.clamp(u, 0, 1))).add(new THREE.Vector3(0, 26, 0));
        rideL.copy(route.getPointAt(THREE.MathUtils.clamp(u + ahead, 0, 1))).add(new THREE.Vector3(0, 22, 0));
        const inn = smooth(0, 0.22, k);
        const out = smooth(0.72, 1, k);
        camPos.lerpVectors(from.pos, rideP, inn).lerp(to.pos, out);
        camTarget.lerpVectors(from.target, rideL, inn).lerp(to.target, out);
        if (k >= 1) {
          dur = 0;
          from.u = to.u;
        }
      }
    }
    if (opts.reducedMotion) {
      camera.position.copy(camPos);
    } else {
      // Idle life: a slow orbit around the subject plus a gentle rise and fall, layered under pointer parallax.
      const yaw = Math.sin(now / 16000) * 0.045 + Math.sin(now / 5300) * 0.008;
      orbit.subVectors(camPos, camTarget).applyAxisAngle(UP, yaw);
      camera.position.copy(camTarget).add(orbit);
      camera.position.x += pointer.x * 10;
      camera.position.y += Math.sin(now / 9000) * 2.5 - pointer.y * 5;
      ambient(now);
    }
    camera.lookAt(camTarget);
    if (count) {
      const p = pGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < count; i++) {
        const uu = (offsets[i] + now / 90000) % 1;
        const pt = route.getPointAt(uu);
        p.setXYZ(i, pt.x, pt.y + 2.2, pt.z);
      }
      p.needsUpdate = true;
    }
    composer.render();
  }
  function dispose() {
    renderer.setAnimationLoop(null);
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
    });
    env.dispose();
    pmrem.dispose();
    composer.dispose();
    renderer.dispose();
  }
  /* Opening shot: start higher and further back, then dolly in to the plaza station (skipped with reduced motion). */
  if (!opts.reducedMotion) {
    const back = new THREE.Vector3().subVectors(camPos, camTarget).multiplyScalar(0.55);
    camPos.add(back).add(new THREE.Vector3(0, 70, 0));
  }
  focus("enter");
  /** Adaptive resolution: the stage lowers the pixel ratio when frames take too long. */
  function setPixelRatio(r: number) {
    renderer.setPixelRatio(r);
    composer.setPixelRatio(r);
    composer.setSize(width, height);
  }
  return { renderer, render, resize, focus, setPointer, setShift, setPixelRatio, dispose };
}
