// Black Sheep — Arena de ventas 3D.
// Datos: Google Sheet (pestaña de ventas) o modo demo. Escena: three.js con ovejas guerreras.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

const C = Object.assign({ PESTANA: "Ventas", META_MES: 100000, REFRESCO_SEG: 30, FORMATO_FECHA: "mdy" }, window.TABLERO || {});
const $ = (id) => document.getElementById(id);
const dinero = (n) => "$" + Math.round(n).toLocaleString("en-US");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const movil = matchMedia("(max-width: 640px)").matches;
const sinMovimiento = matchMedia("(prefers-reduced-motion: reduce)").matches;
// Dentro del portal (Ranking): las ventas llegan del portal por postMessage, ya con la sesión del agente
const PORTAL = new URLSearchParams(location.search).has("portal");
// Revisión de cerca (no se usa en el portal): ?foco=1|2|3 acerca la cámara a esa oveja, &ang= la rodea
const FOCO = Number(new URLSearchParams(location.search).get("foco")) || 0;
const FOCO_ANG = Number(new URLSearchParams(location.search).get("ang")) || 0;
// DEMO / Full HD activado por defecto (texturas con anisotropía máxima, sombras 4096 en las 3 ovejas y TOP 1 corregido)
const DEMO = !new URLSearchParams(location.search).has("low");

// Catálogo de los 10 Guerreros HD del proyecto leaderboard-black-sheeps + Trofeos 3D
const GUERREROS_HD = [
  { slug: "01_sheep_alex", titulo: "Comandante Dorado" },
  { slug: "02_sheep_sofia", titulo: "Hechicera Arcana" },
  { slug: "03_sheep_diego", titulo: "Francotirador Cyber" },
  { slug: "04_sheep_valeria", titulo: "Valquiria de Neón" },
  { slug: "05_sheep_marcos", titulo: "Paladín Imperial" },
  { slug: "06_sheep_elena", titulo: "Asesina de Sombras" },
  { slug: "07_sheep_javier", titulo: "Berserker de Fuego" },
  { slug: "08_sheep_mateo", titulo: "Centinela de Acero" },
  { slug: "09_sheep_camila", titulo: "Arquera Astral" },
  { slug: "10_sheep_lucas", titulo: "Señor de la Tormenta" },
];
const TROFEOS_HD = {
  1: "assets/trophies/trophy_gold.png",
  2: "assets/trophies/trophy_silver.png",
  3: "assets/trophies/trophy_bronze.png",
};
function guerreroPorIndice(idx) {
  return GUERREROS_HD[idx % GUERREROS_HD.length];
}
let modoVista = new URLSearchParams(location.search).get("vista") === "hd" ? "hd" : "3d";

if (C.TITULO) $("titulo").textContent = C.TITULO;

/* =====================================================================
   1. ESCENA 3D
   ===================================================================== */
const canvas = $("escena");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, movil ? 1.75 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.16;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0b0c);
scene.fog = new THREE.Fog(0x0b0b0c, 16, 38);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
scene.environmentIntensity = 0.72;

const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
const MIRA = new THREE.Vector3(0, 1.25, 0), MIRA_ANGOSTO = new THREE.Vector3(0, 0.55, 0);

// Con postproceso el antialias del canvas se pierde: el render target lleva su propio MSAA para bordes lisos en Full HD
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
composer.setPixelRatio(Math.min(devicePixelRatio, movil ? 1.75 : 2));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.14, 0.3, 0.92);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// Luces de estudio calibradas para máximo detalle sin quemar texturas
scene.add(new THREE.HemisphereLight(0xfff0d8, 0x09090c, 0.65));
const rim = new THREE.DirectionalLight(0x90a0ff, 1.35);
rim.position.set(-4, 6, -8);
scene.add(rim);
const frente = new THREE.DirectionalLight(0xfff2dc, 0.95);
frente.position.set(2.5, 5.5, 10);
scene.add(frente);

function foco(x, z, color, intensidad, sombra) {
  const s = new THREE.SpotLight(color, intensidad, 22, 0.42, 0.55, 1.2);
  s.position.set(x, 9.5, z + 2.5);
  s.target.position.set(x, 0, z);
  if (sombra) {
    s.castShadow = true;
    const lado = movil ? 1024 : DEMO ? 4096 : 2048;
    s.shadow.mapSize.set(lado, lado);
    s.shadow.bias = -0.0004;
  }
  scene.add(s, s.target);
  return s;
}

// Materiales de metal por tier
const METAL = {
  oro: { color: 0xc99640, metalness: 1, roughness: 0.26 },
  plata: { color: 0xa9b0bc, metalness: 1, roughness: 0.24 },
  bronce: { color: 0xa65a2c, metalness: 1, roughness: 0.3 },
  hierro: { color: 0x2c2c32, metalness: 0.95, roughness: 0.32 },
};
const std = (o) => new THREE.MeshStandardMaterial(o);
const brillante = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), toneMapped: false });
const LANA = std({ color: 0x1a1a1d, roughness: 1 });
const CARA = std({ color: 0x0d0d0e, roughness: 0.55 });
const ACERO = std({ color: 0xf2f4ff, metalness: 1, roughness: 0.08 });

function malla(geo, mat, padre, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  padre.add(m);
  return m;
}

// Texturas pintadas en canvas: emblema de la oveja, números del podio, estandartes
const logoImg = new Image();
const logoListo = new Promise((ok) => { logoImg.onload = ok; logoImg.onerror = ok; });
logoImg.src = "assets/favicon.svg";

function texCanvas(w, h, pinta) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  pinta(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
}
const texEmblema = () => texCanvas(512, 512, (x) => { if (logoImg.width) x.drawImage(logoImg, 56, 40, 400, 400); });
const texNumero = (n, color) => texCanvas(256, 256, (x) => {
  x.fillStyle = color; x.font = "900 210px Archivo, sans-serif";
  x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(n, 128, 140);
});
const texEstandarte = () => texCanvas(512, 1400, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#141416"); g.addColorStop(1, "#070708");
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.strokeStyle = "#b08d57"; x.lineWidth = 14; x.strokeRect(30, -20, w - 60, h - 160);
  x.beginPath(); x.moveTo(30, h - 180); x.lineTo(w / 2, h - 20); x.lineTo(w - 30, h - 180); x.stroke();
  if (logoImg.width) {
    x.globalCompositeOperation = "source-over";
    const tmp = document.createElement("canvas"); tmp.width = tmp.height = 360;
    const tx = tmp.getContext("2d"); tx.drawImage(logoImg, 0, 0, 360, 360);
    tx.globalCompositeOperation = "source-in"; tx.fillStyle = "#e2c48d"; tx.fillRect(0, 0, 360, 360);
    x.drawImage(tmp, 76, 330);
  }
  x.fillStyle = "#e2c48d"; x.textAlign = "center";
  x.font = "900 74px Archivo, sans-serif"; x.fillText("BLACK", w / 2, 860);
  x.fillText("SHEEP", w / 2, 950);
});
const texChispa = texCanvas(64, 64, (x) => {
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,240,200,1)"); g.addColorStop(0.3, "rgba(255,200,110,.7)"); g.addColorStop(1, "rgba(255,180,80,0)");
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
});

// Ruido determinista para que cada oveja tenga la lana igual en cada carga
function semilla(s) { return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

/* ---------- Podio, piso, estandartes, chispas ---------- */
const MARMOL = std({ color: 0x151517, roughness: 0.32, metalness: 0.25 });
function podio(x, z, h, radio, metal, numero, colorNum) {
  const p = new THREE.Group();
  p.position.set(x, 0, z);
  scene.add(p);
  malla(new THREE.CylinderGeometry(radio, radio * 1.08, h, 72), MARMOL, p, 0, h / 2, 0);
  malla(new THREE.TorusGeometry(radio, 0.04, 14, 96), std(METAL[metal]), p, 0, h, 0).rotation.x = Math.PI / 2;
  malla(new THREE.TorusGeometry(radio * 1.08, 0.03, 14, 96), std(METAL[metal]), p, 0, 0.03, 0).rotation.x = Math.PI / 2;
  if (numero) {
    const n = new THREE.Mesh(new THREE.PlaneGeometry(h * 0.9, h * 0.9), new THREE.MeshBasicMaterial({ map: texNumero(numero, colorNum), transparent: true, toneMapped: false, depthWrite: false }));
    n.position.set(0, h / 2, radio + 0.01);
    p.add(n);
  }
  return h;
}

// Piso pulido con anillos de luz
const piso = new THREE.Mesh(new THREE.CircleGeometry(30, 96), std({ color: 0x0a0a0b, metalness: 0.7, roughness: 0.38 }));
piso.rotation.x = -Math.PI / 2;
piso.receiveShadow = true;
scene.add(piso);
for (const [r, a] of [[2.0, 0.55], [4.6, 0.3], [7.4, 0.16]]) {
  const anillo = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.03, 128), new THREE.MeshBasicMaterial({ color: 0xb08d57, transparent: true, opacity: a, toneMapped: false }));
  anillo.rotation.x = -Math.PI / 2;
  anillo.position.y = 0.005;
  scene.add(anillo);
}

// Aura del campeón: anillos nítidos y rayos que giran detrás de él, y un aro de luz a sus pies
const texAnillos = texCanvas(1024, 1024, (x) => {
  const c = 512;
  const halo = x.createRadialGradient(c, c, 250, c, c, 470);
  halo.addColorStop(0, "rgba(255,214,140,0)"); halo.addColorStop(0.55, "rgba(255,206,120,.16)"); halo.addColorStop(1, "rgba(255,190,90,0)");
  x.fillStyle = halo; x.fillRect(0, 0, 1024, 1024);
  x.shadowColor = "rgba(255,200,110,.9)";
  for (const [r, w, a] of [[400, 7, 0.95], [428, 2.5, 0.7], [372, 2, 0.55]]) {
    x.shadowBlur = 18; x.lineWidth = w; x.strokeStyle = `rgba(255,224,160,${a})`;
    x.beginPath(); x.arc(c, c, r, 0, Math.PI * 2); x.stroke();
  }
  // Puntitos sobre el aro grande
  x.shadowBlur = 10; x.fillStyle = "rgba(255,236,190,.95)";
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; x.beginPath(); x.arc(c + Math.cos(a) * 428, c + Math.sin(a) * 428, 5, 0, Math.PI * 2); x.fill(); }
});
const texRayos = texCanvas(1024, 1024, (x) => {
  const c = 512;
  x.translate(c, c);
  for (let i = 0; i < 36; i++) {
    const largo = i % 2 ? 300 : 470, ancho = i % 2 ? 0.018 : 0.03;
    const g = x.createLinearGradient(0, 0, 0, -largo);
    g.addColorStop(0, "rgba(255,210,130,0)"); g.addColorStop(0.45, "rgba(255,214,140,.32)"); g.addColorStop(1, "rgba(255,214,140,0)");
    x.fillStyle = g;
    x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.tan(ancho) * -largo, -largo); x.lineTo(Math.tan(ancho) * largo, -largo); x.closePath(); x.fill();
    x.rotate((Math.PI * 2) / 36);
  }
});
const auraMat = (map) => new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
const aura = new THREE.Group();
const auraRayos = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), auraMat(texRayos));
const auraAnillos = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.6), auraMat(texAnillos));
auraRayos.renderOrder = auraAnillos.renderOrder = -1;
aura.add(auraRayos, auraAnillos);
const aroPiso = new THREE.Mesh(new THREE.RingGeometry(1.12, 1.16, 128), new THREE.MeshBasicMaterial({ color: 0xffd99a, transparent: true, opacity: 0.9, toneMapped: false }));
aroPiso.rotation.x = -Math.PI / 2;

// Chispas doradas que suben
const NCH = movil ? 160 : 420;
const chispasGeo = new THREE.BufferGeometry();
const chPos = new Float32Array(NCH * 3), chVel = new Float32Array(NCH);
for (let i = 0; i < NCH; i++) {
  chPos[i * 3] = (Math.random() - 0.5) * 16;
  chPos[i * 3 + 1] = Math.random() * 8;
  chPos[i * 3 + 2] = (Math.random() - 0.5) * 10 - 1;
  chVel[i] = 0.2 + Math.random() * 0.6;
}
chispasGeo.setAttribute("position", new THREE.BufferAttribute(chPos, 3));
const chispas = new THREE.Points(chispasGeo, new THREE.PointsMaterial({
  size: 0.09, map: texChispa, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffd08a,
}));
scene.add(chispas);

/* ---------- Tus ovejas guerreras: modelos 3D hechos con Hunyuan3D ---------- */
const ALTURA = { 1: 3.0, 2: 2.45, 3: 2.4, r: 1.65 };
// Hacia dónde mira cada modelo al salir de Hunyuan3D (se corrige aquí si alguno sale de lado)
const GIRO = { 1: 0, 2: 0, 3: 0, r: 0 };
// Ajuste fino a mano de la altura de cada corona (0 = donde la sienta asientoCorona)
const AJUSTE_CORONA = { 2: 0, 3: 0 };
const texSombra = texCanvas(128, 128, (x) => {
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(0,0,0,.75)"); g.addColorStop(1, "rgba(0,0,0,0)");
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
});
// Corona para identificar el puesto: la corona del TOP 1 generada sola como modelo 3D completo y pasada a
// plata y bronce (ovejas/recortar_corona.py, generar.py, corona_metales.py). Se carga en montarEscena.
const CORONA = { 2: "corona-plata", 3: "corona-bronce" };
const CORONA_MOD = {};
// Metal de cada corona: el color multiplica la textura (el bronce salía amarillo con las luces cálidas)
const METAL_CORONA = {
  2: { color: 0xdce2ec, metalness: 0.92, roughness: 0.18, envMapIntensity: 1.35 },   // plata pulida Full HD
  3: { color: 0xc88d55, metalness: 0.88, roughness: 0.24, envMapIntensity: 1.25 },   // bronce cálido Full HD
};
// Ancho de la corona respecto a la altura de la oveja
const ANCHO_CORONA = { 2: 0.34, 3: 0.36 };
function corona(tierKey, ancho) {
  const c = CORONA_MOD[tierKey].clone(true);
  c.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.material = o.material.clone();
    Object.assign(o.material, METAL_CORONA[tierKey], { side: THREE.DoubleSide });
    o.material.color = new THREE.Color(METAL_CORONA[tierKey].color);
  });
  const caja = new THREE.Box3().setFromObject(c), tam = caja.getSize(new THREE.Vector3());
  c.scale.setScalar(ancho / tam.x);
  return { c, alto: tam.y * (ancho / tam.x) };
}

// Punto más alto de la cabeza del modelo ya escalado (para sentar la corona)
function coronilla(m, altura) {
  m.updateMatrixWorld(true);
  const pts = [], v = new THREE.Vector3();
  m.traverse((o) => {
    if (!o.isMesh) return;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i += 7) pts.push(v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld).clone());
  });
  let alto = -Infinity;
  for (const p of pts) alto = Math.max(alto, p.y);
  const tope = pts.filter((p) => p.y > alto - altura * 0.06);
  const x = tope.reduce((s, p) => s + p.x, 0) / tope.length, z = tope.reduce((s, p) => s + p.z, 0) / tope.length;
  return new THREE.Vector3(x, alto, z);
}

// Altura donde la cabeza ya es tan ancha como el aro de la corona: ahí se apoya
// (en la punta de la capucha flotaba). Solo cuenta lo que está bajo la corona, no los cuernos.
function asientoCorona(m, top, aro, altura) {
  const pts = [], v = new THREE.Vector3();
  m.traverse((o) => {
    if (!o.isMesh) return;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i += 3) {
      v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
      if (v.y > top.y - altura * 0.3 && Math.hypot(v.x - top.x, v.z - top.z) < aro * 0.62) pts.push(v.clone());
    }
  });
  const paso = altura * 0.004;
  for (let y = top.y - paso; y > top.y - altura * 0.3; y -= paso) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, n = 0;
    for (const p of pts) {
      if (Math.abs(p.y - y) > paso) continue;
      n++;
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z);
    }
    if (n > 8 && Math.max(x1 - x0, z1 - z0) >= aro) return y;
  }
  return top.y - altura * 0.08;
}

const texLoader = new THREE.TextureLoader();

function crearLaminaHD(tierKey, slug) {
  const alto = ALTURA[tierKey] * 1.05;
  const ancho = alto * (896 / 1200);
  const tex = texLoader.load(`assets/characters/${slug}/fullbody.png`);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    alphaTest: 0.02,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), mat);
  mesh.position.y = alto * 0.5;
  return mesh;
}

function figura(tierKey, modelo, seed, idxGuerrero = 0) {
  const g = new THREE.Group();
  const fig = new THREE.Group();
  const malla3D = new THREE.Group();
  // Modelos con esqueleto: SkeletonUtils clona también los huesos (un clone normal los comparte)
  const m = SkeletonUtils.clone(modelo.scene);
  m.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    // Evita auto-sombreado sucio sobre la cara/armadura que ya trae oclusión horneada en su textura 4K
    o.receiveShadow = false;
    o.material = o.material.clone();
    // Malla todavía sin pintar: gris mate para que se vea la forma
    if (!o.material.map) { o.material.color = new THREE.Color(0x4a4744); o.material.roughness = 0.6; o.material.metalness = 0.1; }
    // HD: textura con espacio de color sRGB y filtro anisotrópico al máximo de la tarjeta gráfica
    if (o.material.map) {
      o.material.map.colorSpace = THREE.SRGBColorSpace;
      o.material.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
      o.material.map.minFilter = THREE.LinearMipmapLinearFilter;
      o.material.map.magFilter = THREE.LinearFilter;
      o.material.map.needsUpdate = true;
    }
    if (tierKey !== "r" && o.material.map) {
      // Acabado satinado Full HD con nitidez de estudio
      Object.assign(o.material, { roughness: 0.36, metalness: 0.08, envMapIntensity: 1.15 });
    }
    // La tropa: misma oveja en tono hierro oscuro para que todas se vean iguales
    if (tierKey === "r") o.material.color = new THREE.Color(0x6a6660);
  });
  // Escala a la altura del puesto, centrada y parada sobre el podio
  // (la malla con esqueleto se mide con los huesos ya calculados; si no, la caja sale casi nula)
  m.updateMatrixWorld(true);
  m.traverse((o) => { if (o.isSkinnedMesh) { o.skeleton.update(); o.computeBoundingBox(); } });
  const caja = new THREE.Box3().setFromObject(m), tam = caja.getSize(new THREE.Vector3());
  const k = ALTURA[tierKey] / tam.y;
  m.scale.setScalar(k);
  const centro = caja.getCenter(new THREE.Vector3());
  m.position.set(-centro.x * k, -caja.min.y * k, -centro.z * k);
  m.rotation.y = GIRO[tierKey];
  malla3D.add(m);
  if (CORONA[tierKey]) {
    const top = coronilla(m, ALTURA[tierKey]);
    const ancho = ALTURA[tierKey] * ANCHO_CORONA[tierKey];
    const { c, alto } = corona(tierKey, ancho);
    // El aro se apoya donde la cabeza ya es casi tan ancha como la corona, y se hunde un poco (como puesta de verdad)
    const y = asientoCorona(m, top, ancho * 0.95, ALTURA[tierKey]);
    c.position.set(top.x, y - alto * 0.22 + (AJUSTE_CORONA[tierKey] || 0), top.z);
    c.rotation.x = -0.08;
    malla3D.add(c);
    // Pegada al hueso de la cabeza para que se mueva con ella
    const cabeza = m.getObjectByName("cabeza");
    if (cabeza) { malla3D.updateMatrixWorld(true); cabeza.attach(c); }
  }
  fig.add(malla3D);

  // Lámina Full HD (896x1200 RGBA) de los personajes de leaderboard-black-sheeps sobre el podio 3D
  const infoGuerrero = guerreroPorIndice(idxGuerrero);
  const laminaHD = crearLaminaHD(tierKey, infoGuerrero.slug);
  fig.add(laminaHD);
  malla3D.visible = modoVista === "3d";
  laminaHD.visible = modoVista === "hd";

  g.add(fig);
  // Animaciones (reposo en bucle; saludo, festejo y aplauso de vez en cuando)
  const mixer = new THREE.AnimationMixer(m);
  const acciones = {};
  for (const clip of modelo.animations) {
    const a = mixer.clipAction(clip);
    if (clip.name !== "reposo") { a.setLoop(THREE.LoopOnce); a.clampWhenFinished = false; }
    acciones[clip.name] = a;
  }
  if (acciones.reposo) { acciones.reposo.play(); acciones.reposo.time = semilla(seed + 1)() * 4; }
  // La malla está en pose T: la sombra se mide por la altura, no por los brazos abiertos
  const ancho = Math.min(tam.x, tam.z * 1.6) * k;
  const sombra = new THREE.Mesh(new THREE.CircleGeometry(ancho * 0.5, 40), new THREE.MeshBasicMaterial({ map: texSombra, transparent: true, depthWrite: false }));
  sombra.rotation.x = -Math.PI / 2;
  sombra.position.y = 0.012;
  g.add(sombra);
  const ancla = new THREE.Object3D();
  ancla.position.y = ALTURA[tierKey] + 0.15;
  g.add(ancla);
  Object.assign(g.userData, { fig, malla3D, laminaHD, figY: 0, ancla, fase: semilla(seed)() * 10, salto: -99, tierKey, mixer, acciones,
    proximoGesto: 4 + semilla(seed + 2)() * 8, idxGuerrero });
  return g;
}

function aplicarModoVista() {
  for (const g of SLOTS) {
    if (!g.userData) continue;
    if (g.userData.malla3D) g.userData.malla3D.visible = modoVista === "3d";
    if (g.userData.laminaHD) g.userData.laminaHD.visible = modoVista === "hd";
  }
  const btn = $("btn-vista");
  if (btn) {
    btn.textContent = modoVista === "hd" ? "🖼️ Arte HD" : "✨ 3D 360°";
    btn.classList.toggle("modo-hd", modoVista === "hd");
  }
}

// Un gesto (saludo, festejo, aplauso) que entra suave sobre el reposo y regresa a él al terminar
function gesto(g, nombre) {
  const { acciones, mixer } = g.userData;
  const a = acciones?.[nombre], reposo = acciones?.reposo;
  if (!a || a.isRunning()) return;
  a.reset().setEffectiveWeight(1).fadeIn(0.25).play();
  reposo?.fadeOut(0.25);
  const fin = (e) => {
    if (e.action !== a) return;
    mixer.removeEventListener("finished", fin);
    reposo?.reset().fadeIn(0.35).play();
    a.fadeOut(0.35);
  };
  mixer.addEventListener("finished", fin);
}

/* ---------- Posiciones ---------- */
// Del 4º en adelante: misma armadura negra, en semicírculo detrás del podio
const SLOTS = [];
const MAX_TROPA = 0; // la tropa ya sale en las tarjetas de abajo
const estandartes = [];

async function montarEscena() {
  await Promise.all([logoListo, document.fonts ? document.fonts.ready : 0]);

  const carga = new GLTFLoader();
  const mods = await Promise.all(["oveja-1", "oveja-2", "oveja-3"].map((n) => carga.loadAsync(`assets/${DEMO && n === "oveja-1" ? "demo/oveja-1" : n}.glb`)));
  for (const [tier, n] of Object.entries(CORONA)) CORONA_MOD[tier] = (await carga.loadAsync(`assets/${n}.glb`)).scene;
  // Cada oveja trae su esqueleto y animaciones (ovejas/esqueleto.py en Blender)
  const MOD = { 1: mods[0], 2: mods[1], 3: mods[2] };

  const h1 = podio(0, 0, 1.25, 1.05, "oro");
  const h2 = podio(-2.35, 0.45, 0.85, 0.92, "plata");
  const h3 = podio(2.35, 0.45, 0.6, 0.92, "bronce");
  const base = [
    { tier: 1, x: 0, z: 0, y: h1, r: 1.05 },
    { tier: 2, x: -2.35, z: 0.45, y: h2, r: 0.92 },
    { tier: 3, x: 2.35, z: 0.45, y: h3, r: 0.92 },
  ];
  for (let i = 0; i < MAX_TROPA; i++) {
    const t = MAX_TROPA === 1 ? 0.5 : i / (MAX_TROPA - 1);
    const a = Math.PI * (0.18 + t * 0.64);
    const x = -Math.cos(a) * 6.4, z = -Math.sin(a) * 3.6 - 0.6;
    base.push({ tier: "r", x, z, y: podio(x, z, 0.28, 0.55, "hierro") });
  }
  base.forEach((b, i) => {
    const g = figura(b.tier, MOD[b.tier], 1000 + i * 37, i);
    g.position.set(b.x, b.y, b.z);
    g.visible = false;
    scene.add(g);
    g.userData.baseY = b.y;
    // El TOP 3 lleva su placa al pie del podio; la tropa, encima de la cabeza
    if (b.r) g.userData.placa = new THREE.Vector3(b.x, 0, b.z + b.r * 1.1);
    // Zona para agarrarlo y girarlo
    const tam = new THREE.Box3().setFromObject(g.userData.fig).getSize(new THREE.Vector3());
    const toque = new THREE.Mesh(new THREE.BoxGeometry(tam.x * 0.65, tam.y, tam.z), cajaToque);
    toque.position.y = tam.y / 2;
    toque.userData.guerrero = g;
    g.add(toque);
    Object.assign(g.userData, { toque, giro: 0, vel: 0, tocado: -99 });
    SLOTS.push(g);
  });

  // El aura va detrás del TOP 1, a la altura de su pecho
  aura.position.set(0, h1 + ALTURA[1] * 0.55, -0.55);
  aroPiso.position.set(0, h1 + 0.012, 0);
  scene.add(aura, aroPiso);

  foco(0, 0, 0xfff0d6, 9.5, true);
  foco(-2.35, 0.45, 0xf0e6ff, 14, DEMO);
  foco(2.35, 0.45, 0xffd2ad, 14, DEMO);
  // Contraluz del color de cada puesto para que brille el borde de la figura
  for (const [color, x, z, fuerza] of [[0xa66bff, -3.6, -0.6, 4.5], [0xffc457, 0, -1.4, 4.5], [0xff9248, 3.6, -0.6, 4.5]]) {
    const l = new THREE.PointLight(color, fuerza, 6, 1.5);
    l.position.set(x, 3.6, z);
    scene.add(l);
  }

  // Estandartes al fondo
  const tex = texEstandarte();
  for (const x of [-7.5, -3.8, 0, 3.8, 7.5]) {
    const e = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 4.1, 1, 10), std({ map: tex, roughness: 0.8, side: THREE.DoubleSide }));
    // Bajas para que la cabeza del logo no quede cortada por el borde de arriba de la arena
    e.position.set(x, 3.75, -7.5 - Math.abs(x) * 0.15);
    e.userData.base = Float32Array.from(e.geometry.attributes.position.array);
    scene.add(e);
    estandartes.push(e);
    malla(new THREE.CylinderGeometry(0.03, 0.03, 1.8, 10), std(METAL.oro), scene, x, e.position.y + 2.1, e.position.z).rotation.z = Math.PI / 2;
  }

  ajustar();
  $("cargando").classList.add("listo");
}

function ajustar() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const pr = Math.min(devicePixelRatio, movil ? 1.75 : 2);
  renderer.setPixelRatio(pr);
  renderer.setSize(w, h, false);
  composer.setPixelRatio(pr);
  composer.setSize(w, h);
  bloom.resolution.set(w * pr, h * pr);
  camera.aspect = w / h;
  const angosto = w / h < 1.1;
  camera.fov = angosto ? 50 : 35;
  camera.updateProjectionMatrix();
}
addEventListener("resize", ajustar);

/* ---------- Girar cada oveja sobre su propio eje: arrástrala con el mouse o el dedo ---------- */
const rayo = new THREE.Raycaster(), puntero = new THREE.Vector2();
let arrastre = null;
// Caja invisible por guerrero para atinarle rápido sin revisar los 150 mil triángulos del modelo
const cajaToque = new THREE.MeshBasicMaterial({ visible: false });
function guerreroBajo(e) {
  const r = canvas.getBoundingClientRect();
  puntero.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  rayo.setFromCamera(puntero, camera);
  const toques = SLOTS.filter((g) => g.visible).map((g) => g.userData.toque);
  const hit = rayo.intersectObjects(toques, false)[0];
  return hit ? hit.object.userData.guerrero : null;
}
canvas.addEventListener("pointerdown", (e) => {
  const g = guerreroBajo(e);
  if (!g) return;
  arrastre = { g, x: e.clientX, t: performance.now() };
  g.userData.vel = 0;
  canvas.setPointerCapture(e.pointerId);
  canvas.style.cursor = "grabbing";
});
canvas.addEventListener("pointermove", (e) => {
  if (!arrastre) { canvas.style.cursor = guerreroBajo(e) ? "grab" : ""; return; }
  const u = arrastre.g.userData, ahora = performance.now();
  const giro = (e.clientX - arrastre.x) * 0.012;
  u.giro += giro;
  u.vel = giro / Math.max((ahora - arrastre.t) / 1000, 0.008);
  u.tocado = reloj.getElapsedTime();
  arrastre.x = e.clientX; arrastre.t = ahora;
});
const soltar = () => { if (arrastre) { arrastre = null; canvas.style.cursor = ""; } };
canvas.addEventListener("pointerup", soltar);
canvas.addEventListener("pointercancel", soltar);

/* ---------- Etiquetas flotantes ---------- */
const capaEtq = $("etiquetas");
const etiquetas = [];
const vTmp = new THREE.Vector3();
function ponerEtiquetas(ranking, subidas) {
  SLOTS.forEach((g, i) => {
    const a = ranking[i];
    g.visible = !!a;
    if (!etiquetas[i]) {
      const d = document.createElement("div");
      d.className = "tag " + (i < 3 ? "t" + (i + 1) : "tr");
      capaEtq.appendChild(d);
      etiquetas[i] = d;
    }
    const d = etiquetas[i];
    d.hidden = !a;
    if (!a) return;
    const sube = subidas[a.clave] ? `<span class="sube">▲${subidas[a.clave]}</span>` : "";
    const gw = guerreroPorIndice(i);
    const trofeo = TROFEOS_HD[i + 1];
    d.innerHTML = i < 3
      ? `<div class="tier"><img class="trofeo-tag" src="${trofeo}" alt="">TOP ${i + 1}</div>
         <div class="fila-guerrero">
           <img class="avatar-tag" src="assets/characters/${gw.slug}/avatar.png" alt="">
           <div class="n">${esc(a.nombre)}${sube}</div>
         </div>
         <div class="arq">${esc(gw.titulo)}</div>
         <div class="ap">${dinero(a.ap)}</div>
         <div class="pol">${a.pol} póliza${a.pol === 1 ? "" : "s"}</div>`
      : `<div class="tier">#${i + 1}</div><div class="n">${esc(a.nombre)}${sube}</div><div class="ap">${dinero(a.ap)}</div>`;
  });
}

/* ---------- Bucle de animación ---------- */
const reloj = new THREE.Clock();
let tPrevio = 0;
function anima() {
  const t = reloj.getElapsedTime();
  const dt = Math.min(t - tPrevio, 0.05);
  tPrevio = t;
  const m = sinMovimiento ? 0 : 1;

  // Cámara que respira despacio alrededor de la arena (más cerca para lucir el Full HD)
  const angosto = camera.aspect < 1.1, lejos = angosto ? 11.8 : 8.5;
  const enfocada = FOCO && SLOTS[FOCO - 1];
  if (enfocada) {
    // Solo para revisar (?foco=1|2|3&ang=grados): cámara cerca de la cabeza de esa oveja
    const p = enfocada.position, a = (FOCO_ANG * Math.PI) / 180, alto = p.y + ALTURA[FOCO] * 0.78;
    camera.position.set(p.x + Math.sin(a) * 3.6, alto + 0.35, p.z + Math.cos(a) * 3.6);
    camera.lookAt(p.x, alto, p.z);
  } else {
    camera.position.set(Math.sin(t * 0.12) * 0.75 * m, 3.25 + Math.sin(t * 0.2) * 0.12 * m, lejos);
    camera.lookAt(angosto ? MIRA_ANGOSTO : MIRA);
  }

  for (const g of SLOTS) {
    if (!g.visible) continue;
    const u = g.userData, f = t + u.fase;
    // De frente a la cámara, con un vaivén lento para que se luzca el volumen
    const oscilacion = modoVista === "hd" ? 0.14 : 0.35;
    g.rotation.y = Math.atan2(camera.position.x - g.position.x, camera.position.z - g.position.z) * 0.75 + Math.sin(f * 0.45) * oscilacion * m;
    const s = t - u.salto;
    const brinco = s >= 0 && s < 2.4 ? Math.abs(Math.sin(s * Math.PI * 1.25)) * 0.7 * (1 - s / 2.4) : 0;
    u.fig.position.y = u.figY + Math.sin(f * 1.6) * 0.03 * m + brinco;
    if (modoVista === "hd" && u.laminaHD) {
      const resp = 1 + Math.sin(f * 1.8) * 0.018 * m;
      u.laminaHD.scale.set(resp, 1 + Math.cos(f * 1.8) * 0.018 * m, 1);
    }
    // Cada tanto cada guerrero da una vuelta sobre su eje para lucirse (uno a la vez);
    // si lo giraste tú, sigue con el impulso que le diste y a los 6 s vuelve de frente
    const vuelta = (t + SLOTS.indexOf(g) * 7) % 21;
    const manual = t - u.tocado < 6 || arrastre?.g === g;
    const luce = modoVista === "3d" && !manual && vuelta < 3.2 && m ? (1 - Math.cos((vuelta / 3.2) * Math.PI)) * Math.PI : 0;
    if (arrastre?.g !== g) {
      u.giro += u.vel * dt;
      u.vel *= Math.pow(0.12, dt);
      if (!manual) {
        // De regreso al frente por el camino corto
        const resto = Math.atan2(Math.sin(u.giro), Math.cos(u.giro));
        u.giro = resto * Math.pow(0.08, dt);
      }
    }
    u.fig.rotation.y = (s >= 0 && s < 1.2 ? (1 - Math.pow(1 - s / 1.2, 3)) * Math.PI * 2 : luce) + (modoVista === "3d" ? u.giro : Math.sin(u.giro) * 0.35);
    // Brazos: cada tanto un gesto propio del puesto (el campeón festeja, los demás saludan o aplauden)
    if (m && t > u.proximoGesto) {
      const i = SLOTS.indexOf(g);
      gesto(g, i === 0 ? (Math.random() < 0.6 ? "festejo" : "saludo") : (Math.random() < 0.5 ? "saludo" : "aplauso"));
      u.proximoGesto = t + 9 + Math.random() * 8;
    }
    u.mixer?.update(dt);
  }

  for (const e of estandartes) {
    const pos = e.geometry.attributes.position, b = e.userData.base;
    for (let k = 0; k < pos.count; k++) {
      const y = b[k * 3 + 1];
      pos.array[k * 3 + 2] = Math.sin(t * 1.1 + y * 1.4 + e.position.x) * 0.08 * (2.05 - y) / 4.1 * m;
    }
    pos.needsUpdate = true;
  }

  for (let i = 0; i < NCH; i++) {
    chPos[i * 3 + 1] += chVel[i] * dt * m;
    chPos[i * 3] += Math.sin(t + i) * 0.002 * m;
    if (chPos[i * 3 + 1] > 8) chPos[i * 3 + 1] = 0;
  }
  chispasGeo.attributes.position.needsUpdate = true;
  // Aura: de cara a la cámara, los rayos giran despacio y los anillos laten
  aura.quaternion.copy(camera.quaternion);
  auraRayos.rotation.z = t * 0.12 * m;
  auraAnillos.scale.setScalar(1 + Math.sin(t * 1.4) * 0.025 * m);
  auraRayos.material.opacity = 0.75 + Math.sin(t * 0.9) * 0.2 * m;
  aroPiso.material.opacity = 0.6 + Math.sin(t * 2) * 0.3 * m;

  composer.render();

  // Etiquetas encima de cada guerrero
  const w = canvas.clientWidth, h = canvas.clientHeight;
  SLOTS.forEach((g, i) => {
    const d = etiquetas[i];
    if (!d || !g.visible) return;
    const placa = g.userData.placa;
    (placa ? vTmp.copy(placa) : g.userData.ancla.getWorldPosition(vTmp)).project(camera);
    d.style.transform = `translate(${(vTmp.x * 0.5 + 0.5) * w}px, ${(-vTmp.y * 0.5 + 0.5) * h}px) translate(-50%, ${placa ? "10px" : "-100%"})`;
  });
  requestAnimationFrame(anima);
}

/* =====================================================================
   2. DATOS
   ===================================================================== */
function parseCSV(txt) {
  const filas = [];
  let fila = [], campo = "", comillas = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (comillas) {
      if (c === '"' && txt[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === ",") { fila.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && txt[i + 1] === "\n") i++;
      fila.push(campo); filas.push(fila); fila = []; campo = "";
    } else campo += c;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  return filas.filter((f) => f.some((x) => x.trim()));
}

function leerFecha(s) {
  if (!s) return null;
  s = s.trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    let [, a, b, y, h = 0, mi = 0, se = 0] = m;
    if (y.length === 2) y = "20" + y;
    const [mes, dia] = C.FORMATO_FECHA === "dmy" ? [b, a] : [a, b];
    return new Date(+y, mes - 1, +dia, +h, +mi, +se);
  }
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function columnas(enc) {
  const busca = (...claves) => enc.findIndex((h) => claves.some((k) => h.includes(k)));
  return {
    fecha: busca("marca temporal", "timestamp", "fecha", "date"),
    agente: busca("agente", "agent", "nombre", "vendedor"),
    prima: busca("prima", "ap", "monto", "premium", "anual"),
    carrier: busca("carrier", "compañ", "compan", "aseguradora"),
    producto: busca("producto", "product", "tipo", "plan"),
  };
}

function aVentas(filas) {
  const enc = filas[0].map((h) => h.trim().toLowerCase());
  const col = columnas(enc);
  if (col.agente < 0 || col.prima < 0) throw new Error("La hoja necesita columnas Agente y Prima");
  return filas.slice(1).map((f, i) => ({
    id: i + "|" + f.join("|"),
    fecha: leerFecha(f[col.fecha]) || new Date(),
    agente: (f[col.agente] || "").trim(),
    prima: parseFloat(String(f[col.prima] || "0").replace(/[^0-9.\-]/g, "")) || 0,
    carrier: col.carrier >= 0 ? (f[col.carrier] || "").trim() : "",
    producto: col.producto >= 0 ? (f[col.producto] || "").trim() : "",
  })).filter((v) => v.agente && v.prima > 0);
}

async function cargarHoja() {
  const url = `https://docs.google.com/spreadsheets/d/${C.SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(C.PESTANA)}&_=${Date.now()}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return aVentas(parseCSV(await r.text()));
}

// Modo demo: ventas inventadas del mes y una nueva cada rato
const DEMO_AGENTES = ["Ana Rivera", "Luis Martínez", "Karla Gómez", "Diego Torres", "Sofía Herrera", "Marco Díaz", "Valeria Cruz", "Iván Morales", "Paola Ríos", "Jorge Luna", "Elena Vargas"];
const DEMO_CARRIERS = ["Americo", "Mutual of Omaha", "Transamerica", "National Life Group", "Foresters"];
const DEMO_PRODUCTOS = ["IUL", "Final Expense", "Term Life", "Mortgage Protection"];
let demo = [];
function ventaDemo(fecha) {
  const peso = Math.floor(Math.pow(Math.random(), 1.7) * DEMO_AGENTES.length);
  const prod = DEMO_PRODUCTOS[Math.floor(Math.random() * DEMO_PRODUCTOS.length)];
  const base = prod === "IUL" ? 3200 : prod === "Final Expense" ? 900 : 1500;
  return {
    id: "demo" + Math.random(), fecha, agente: DEMO_AGENTES[peso],
    prima: Math.round((base + Math.random() * base * 1.4) / 10) * 10,
    carrier: DEMO_CARRIERS[Math.floor(Math.random() * DEMO_CARRIERS.length)], producto: prod,
  };
}
function sembrarDemo() {
  const hoy = new Date();
  for (let i = 0; i < 38; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), 1 + Math.floor(Math.random() * hoy.getDate()), 9 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60));
    if (d <= hoy) demo.push(ventaDemo(d));
  }
}

/* =====================================================================
   3. PINTAR
   ===================================================================== */
let ventas = [];
let periodo = "mes";
let rankPrevio = {};
let primeraCarga = true;
const vistos = new Set();

function inicioPeriodo(p) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (p === "semana") d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  if (p === "mes") d.setDate(1);
  return d;
}

function agrupar(lista) {
  const m = new Map();
  for (const v of lista) {
    const k = v.clave || v.agente;
    const a = m.get(k) || { clave: k, nombre: v.agente, ap: 0, pol: 0, ultima: 0 };
    a.ap += v.prima; a.pol++; a.ultima = Math.max(a.ultima, v.creada || v.fecha);
    m.set(k, a);
  }
  return [...m.values()].sort((a, b) => b.ap - a.ap || b.pol - a.pol);
}

function contar(el, hasta, fmt) {
  const desde = el._v || 0;
  el._v = hasta;
  if (sinMovimiento || desde === hasta) { el.textContent = fmt(hasta); return; }
  const t0 = performance.now(), dur = 1400;
  const paso = (ahora) => {
    const p = Math.min(1, (ahora - t0) / dur), e = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(desde + (hasta - desde) * e);
    if (p < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}
const entero = (n) => Math.round(n).toLocaleString("en-US");

function pintar() {
  const desde = inicioPeriodo(periodo);
  const delPeriodo = ventas.filter((v) => v.fecha >= desde);
  const ranking = agrupar(delPeriodo);
  const ap = delPeriodo.reduce((s, v) => s + v.prima, 0);

  // Quién subió de posición
  const subidas = {};
  ranking.forEach((a, i) => {
    const antes = rankPrevio[periodo + a.clave];
    if (!primeraCarga && antes !== undefined && antes > i) subidas[a.clave] = antes - i;
    rankPrevio[periodo + a.clave] = i;
  });

  contar($("k-ap"), ap, dinero);
  contar($("k-pol"), delPeriodo.length, entero);
  contar($("k-prom"), delPeriodo.length ? ap / delPeriodo.length : 0, dinero);
  contar($("k-ag"), ranking.length, entero);
  const etiqueta = { hoy: "hoy", semana: "esta semana", mes: "este mes" }[periodo];
  $("k-ap-foot").textContent = ranking[0] ? `👑 ${ranking[0].nombre} manda ${etiqueta}` : `sin ventas ${etiqueta}`;
  const hoyN = ventas.filter((v) => v.fecha >= inicioPeriodo("hoy")).length;
  $("k-pol-foot").textContent = `${hoyN} hoy`;
  $("k-ag-foot").textContent = etiqueta;

  // Meta del mes (siempre mensual)
  const apMes = ventas.filter((v) => v.fecha >= inicioPeriodo("mes")).reduce((s, v) => s + v.prima, 0);
  const pct = C.META_MES ? (apMes / C.META_MES) * 100 : 0;
  contar($("m-act"), apMes, dinero);
  $("m-meta").textContent = dinero(C.META_MES);
  contar($("m-pct"), pct, (n) => Math.floor(n) + "%");
  $("m-bar").style.width = Math.min(100, pct) + "%";
  $("m-oveja").style.left = Math.min(100, pct) + "%";
  const hoy = new Date(), finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  const diasRest = finMes - hoy.getDate() + 1;
  const falta = Math.max(0, C.META_MES - apMes);
  $("m-foot").textContent = falta
    ? `Faltan ${dinero(falta)} · ${diasRest} día${diasRest === 1 ? "" : "s"} · ${dinero(falta / diasRest)} por día para llegar 🎯`
    : `🏆 ¡META CONQUISTADA! ${dinero(apMes - C.META_MES)} arriba de la meta`;

  // Podio y tropa en 3D
  ponerEtiquetas(ranking, subidas);

  // Tarjetas del 4º en adelante
  const tropa = ranking.slice(3);
  const max = ranking[0] ? ranking[0].ap : 1;
  $("r-vacio").hidden = tropa.length > 0;
  $("r-sub").textContent = `${ranking.length} guerrero${ranking.length === 1 ? "" : "s"} · ${etiqueta}`;
  $("tropa").innerHTML = tropa.map((a, i) => {
    const gw = guerreroPorIndice(i + 3);
    return `
    <li class="soldado" data-n="${esc(a.clave)}">
      <div class="escudo"><img src="assets/characters/${gw.slug}/avatar.png" alt=""><b>#${i + 4}</b></div>
      <div>
        <div class="n">${esc(a.nombre)}${subidas[a.clave] ? `<span class="sube">▲${subidas[a.clave]}</span>` : ""}</div>
        <div class="arq-tropa">${esc(gw.titulo)}</div>
        <div class="ap">${dinero(a.ap)}</div>
        <div class="pol">${a.pol} póliza${a.pol === 1 ? "" : "s"} · le faltan ${dinero(ranking[2].ap - a.ap + 1)} para el podio</div>
      </div>
      <div class="riel"><i data-w="${(a.ap / max) * 100}"></i></div>
    </li>`;
  }).join("");
  requestAnimationFrame(() => document.querySelectorAll(".soldado .riel i").forEach((i) => (i.style.width = i.dataset.w + "%")));

  // Últimas ventas
  const cuando = (v) => v.creada || v.fecha;
  const recientes = [...ventas].sort((a, b) => cuando(b) - cuando(a)).slice(0, 7);
  $("feed").innerHTML = recientes.map((v) => `
    <li class="${vistos.has(v.id) || primeraCarga ? "" : "nueva"}">
      <div><b>${esc(v.agente)}</b><small>${esc([v.producto, v.carrier].filter(Boolean).join(" · "))} · ${hace(cuando(v))}</small></div>
      <span class="monto">${dinero(v.prima)}</span>
    </li>`).join("") || `<li><small>Sin ventas todavía</small></li>`;

  // Por compañía
  const porC = new Map();
  for (const v of delPeriodo) porC.set(v.carrier || "Otra", (porC.get(v.carrier || "Otra") || 0) + v.prima);
  const cs = [...porC].sort((a, b) => b[1] - a[1]);
  const cmax = cs[0] ? cs[0][1] : 1;
  $("carriers").innerHTML = cs.map(([n, s]) => `
    <li><div class="fila-c"><span>${esc(n)}</span><b>${dinero(s)}</b></div><div class="riel"><i data-w="${(s / cmax) * 100}"></i></div></li>`).join("") || `<li><small style="color:var(--muted)">Sin datos</small></li>`;
  requestAnimationFrame(() => document.querySelectorAll(".carriers .riel i").forEach((i) => (i.style.width = i.dataset.w + "%")));

  // Cinta
  const cinta = [...ventas].sort((a, b) => cuando(b) - cuando(a)).slice(0, 14).map((v) => `<span>${esc(v.agente)} cerró ${dinero(v.prima)}${v.carrier ? " con " + esc(v.carrier) : ""}</span>`);
  $("ticker").innerHTML = cinta.join("") || "<span>¡A vender, guerreros!</span>";
}

function hace(f) {
  const s = (Date.now() - f) / 1000;
  if (s < 60) return "ahora";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return f.toLocaleDateString("es", { day: "numeric", month: "short" });
}

/* ---------- Festejo ---------- */
const cola = [];
let festejando = false;
function festejar(v) { cola.push(v); if (!festejando) siguienteFestejo(); }
function siguienteFestejo() {
  const v = cola.shift();
  if (!v) { festejando = false; return; }
  festejando = true;
  $("f-nombre").textContent = v.agente;
  $("f-monto").textContent = dinero(v.prima);
  $("f-det").textContent = [v.producto, v.carrier].filter(Boolean).join(" · ");
  const f = $("festejo");
  f.classList.remove("sale");
  f.hidden = false;
  confeti();
  sonido();
  document.querySelectorAll(".kpi").forEach((k) => { k.classList.remove("pulso"); void k.offsetWidth; k.classList.add("pulso"); });

  const ranking = agrupar(ventas.filter((x) => x.fecha >= inicioPeriodo(periodo)));
  const i = ranking.findIndex((a) => a.clave === (v.clave || v.agente));
  if (SLOTS[i]) SLOTS[i].userData.salto = reloj.getElapsedTime();
  // El que vendió festeja con los brazos arriba y los demás del podio le aplauden
  SLOTS.forEach((g, j) => g.visible && gesto(g, j === i ? "festejo" : "aplauso"));
  const card = document.querySelector(`.soldado[data-n="${CSS.escape(v.clave || v.agente)}"]`);
  if (card) { card.classList.add("brilla"); setTimeout(() => card.classList.remove("brilla"), 4000); }

  setTimeout(() => {
    f.classList.add("sale");
    setTimeout(() => { f.hidden = true; siguienteFestejo(); }, 500);
  }, 4200);
}

const cv = $("confeti"), cx = cv.getContext("2d");
let piezas = [];
function confeti() {
  if (sinMovimiento) return;
  cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio;
  const colores = ["#e2c48d", "#b08d57", "#f6f5f2", "#6f5632", "#1a1a1d"];
  for (let i = 0; i < 220; i++) {
    piezas.push({
      x: innerWidth / 2 + (Math.random() - 0.5) * 200, y: innerHeight * 0.55,
      vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 18 - 6,
      r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
      w: 6 + Math.random() * 8, h: 4 + Math.random() * 6, c: colores[i % colores.length], vida: 1,
    });
  }
  if (piezas.length <= 220) requestAnimationFrame(caer);
}
function caer() {
  cx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  cx.clearRect(0, 0, innerWidth, innerHeight);
  for (const p of piezas) {
    p.vy += 0.45; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.vida -= 0.006;
    cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.globalAlpha = Math.max(0, p.vida);
    cx.fillStyle = p.c; cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.cos(p.r * 2)); cx.restore();
  }
  piezas = piezas.filter((p) => p.vida > 0 && p.y < innerHeight + 40);
  if (piezas.length) requestAnimationFrame(caer); else cx.clearRect(0, 0, innerWidth, innerHeight);
}

let audio = null, conSonido = false;
function sonido() {
  if (!conSonido) return;
  audio = audio || new (window.AudioContext || window.webkitAudioContext)();
  const t = audio.currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = "triangle"; o.frequency.value = f;
    g.gain.setValueAtTime(0, t + i * 0.11);
    g.gain.linearRampToValueAtTime(0.22, t + i * 0.11 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.11 + 0.6);
    o.connect(g).connect(audio.destination);
    o.start(t + i * 0.11); o.stop(t + i * 0.11 + 0.65);
  });
}

/* =====================================================================
   4. ARRANQUE
   ===================================================================== */
async function refrescar() {
  if (PORTAL && !ventasPortal) return; // todavía no llegan las del portal
  try {
    const nuevas = PORTAL ? ventasPortal : C.SHEET_ID ? await cargarHoja() : demo.slice();
    const llegadas = primeraCarga ? [] : nuevas.filter((v) => !vistos.has(v.id));
    ventas = nuevas;
    pintar();
    nuevas.forEach((v) => vistos.add(v.id));
    llegadas.sort((a, b) => (a.creada || a.fecha) - (b.creada || b.fecha)).forEach(festejar);
    primeraCarga = false;
    $("vivo").classList.remove("error");
    $("vivo-txt").textContent = PORTAL || C.SHEET_ID ? "EN VIVO" : "DEMO";
  } catch (e) {
    console.error(e);
    $("vivo").classList.add("error");
    $("vivo-txt").textContent = "SIN CONEXIÓN";
  }
}

document.querySelectorAll(".periodos button").forEach((b) => b.addEventListener("click", () => {
  document.querySelectorAll(".periodos button").forEach((x) => x.setAttribute("aria-selected", x === b));
  periodo = b.dataset.p;
  pintar();
}));
$("btn-vista")?.addEventListener("click", () => {
  modoVista = modoVista === "3d" ? "hd" : "3d";
  aplicarModoVista();
});
aplicarModoVista();
$("btn-sonido").addEventListener("click", (e) => {
  conSonido = !conSonido;
  e.currentTarget.textContent = conSonido ? "🔔" : "🔕";
  e.currentTarget.setAttribute("aria-pressed", conSonido);
  if (conSonido) sonido();
});
$("btn-full").addEventListener("click", () => {
  if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.();
});
const tic = () => { $("reloj").textContent = new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }); };
tic(); setInterval(tic, 15000);

/* ---------- Ventas del portal ---------- */
// El portal manda { tipo: "bs-ventas", ventas: [{ id, fecha: "AAAA-MM-DD", creada, agente, clave, ap, producto, carrier }], meta }
let ventasPortal = null, escenaLista = false;
function desdePortal(v) {
  const f = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v?.fecha || ""));
  const ap = Number(v?.ap);
  if (!f || !v.id || !v.agente || !(ap > 0)) return null;
  const creada = new Date(v.creada);
  return {
    id: String(v.id), clave: String(v.clave || v.agente), agente: String(v.agente), prima: ap,
    fecha: new Date(+f[1], +f[2] - 1, +f[3]), creada: isNaN(creada) ? null : creada,
    carrier: String(v.carrier || ""), producto: String(v.producto || ""),
  };
}
if (PORTAL) {
  addEventListener("message", (e) => {
    if (e.origin !== location.origin || e.source !== parent) return;
    const d = e.data || {};
    if (d.tipo === "bs-ventas" && Array.isArray(d.ventas)) {
      ventasPortal = d.ventas.map(desdePortal).filter(Boolean);
      if (Number(d.meta) > 0) C.META_MES = Number(d.meta);
      if (escenaLista) refrescar();
    } else if (d.tipo === "bs-error") {
      $("vivo").classList.add("error");
      $("vivo-txt").textContent = "SIN CONEXIÓN";
    }
  });
}

if (!PORTAL && !C.SHEET_ID) {
  $("demo").hidden = false;
  sembrarDemo();
  setInterval(() => { demo.push(ventaDemo(new Date())); refrescar(); }, 22000);
}

await montarEscena();
escenaLista = true;
await refrescar();
requestAnimationFrame(anima);
// Avisa al portal que ya puede mandar las ventas (y las vuelve a pedir cada vez que cambian allá)
if (PORTAL) parent.postMessage({ tipo: "bs-arena-lista" }, location.origin);
setInterval(() => { if (C.SHEET_ID && !PORTAL) refrescar(); }, Math.max(10, C.REFRESCO_SEG) * 1000);
