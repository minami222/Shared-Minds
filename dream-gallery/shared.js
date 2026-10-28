import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { loadDreams } from './firebase.js';

// Shared room: everyone's picked painting floats in a ring around you.
// Later: place them by visual similarity (CLIP + UMAP) instead of a ring.

const RING_RADIUS = 6;
const PAINTING_W = 2.6;
const PAINTING_H = PAINTING_W * 9 / 21;
const myId = new URLSearchParams(location.search).get('me');

const statusEl = document.getElementById('sharedStatus');
const detail = document.getElementById('dreamDetail');
const detailVersions = document.getElementById('detailVersions');
const detailAnswers = document.getElementById('detailAnswers');

// --- Three.js Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4f1ec);
scene.fog = new THREE.Fog(0xf4f1ec, 4, 16); // Far dreams fade into haze

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById('shared-canvas').appendChild(renderer.domElement);

// Paintings are plain <img> elements placed in 3D (CSS3D), so they load online without CORS
const cssRenderer = new CSS3DRenderer();
cssRenderer.setSize(window.innerWidth, window.innerHeight);
Object.assign(cssRenderer.domElement.style, { position: 'absolute', top: '0', left: '0' });
document.getElementById('shared-canvas').appendChild(cssRenderer.domElement);
const PX_W = 520; // Image width in CSS pixels, scaled to PAINTING_W

const view = { yaw: 0, targetYaw: 0, fov: 60, targetFov: 60 };
const paintings = []; // CSS3D objects, each with userData.dream

// Temporary sample dreams so the room isn't empty (remove once real dreams exist)
const SAMPLE_DREAMS = [
  { id: 'sample-1', versions: ['assets/realism.png'], picked: 0, answers: [{ q: '', answer: 'A woman rests beside a quiet stream, deep in a green, flowering forest.' }] },
  { id: 'sample-2', versions: ['assets/Middle.png'], picked: 0, answers: [{ q: '', answer: 'A rider on a brown horse gallops along the shore as soft waves roll in.' }] },
  { id: 'sample-3', versions: ['assets/dancing.png'], picked: 0, answers: [{ q: '', answer: 'Figures dance hand in hand under bright pink trees, in bold, flat colour.' }] }
];

function addPainting(dream, angle) {
  const url = dream.versions?.[dream.picked ?? dream.versions.length - 1];
  if (!url) return;
  const img = document.createElement('img');
  Object.assign(img.style, {
    width: `${PX_W}px`,
    height: `${Math.round(PX_W * PAINTING_H / PAINTING_W)}px`,
    objectFit: 'cover',
    cursor: 'pointer',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.12)'
  });
  img.alt = 'A dream painting';
  const obj = new CSS3DObject(img);
  // Place on the ring, facing the centre
  obj.position.set(Math.sin(angle) * RING_RADIUS, 0, -Math.cos(angle) * RING_RADIUS);
  obj.lookAt(0, 0, 0);
  obj.scale.setScalar(PAINTING_W / PX_W);
  obj.userData = { dream, angle };
  img.addEventListener('click', () => { if (moved < 5) openDream(obj); });
  // Replicate links expire after about an hour; drop those quietly
  img.onerror = () => { scene.remove(obj); paintings.splice(paintings.indexOf(obj), 1); };
  img.src = url;
  scene.add(obj);
  paintings.push(obj);
}

async function init() {
  let dreams = [];
  try {
    dreams = await loadDreams();
  } catch (err) {
    console.error('Loading dreams failed:', err);
  }
  dreams = [...dreams, ...SAMPLE_DREAMS];
  statusEl.hidden = true;

  // Your dream goes straight ahead; everyone else spreads around the ring
  const mine = dreams.find((d) => d.id === myId);
  const others = dreams.filter((d) => d !== mine);
  const ordered = mine ? [mine, ...others] : others;
  // Close together when there are few, full ring when there are many
  const spacing = Math.min((Math.PI * 2) / ordered.length, 0.55);
  ordered.forEach((dream, i) => {
    const side = i % 2 === 0 ? -1 : 1; // 0, +1, -1, +2, -2 … so yours stays in the middle
    addPainting(dream, side * Math.ceil(i / 2) * spacing);
  });
}

// --- Detail card ---
function showDetail(dream) {
  detailVersions.innerHTML = '';
  dream.versions.forEach((url, i) => {
    const img = document.createElement('img');
    img.src = url;
    img.alt = `Version ${i + 1}`;
    if (i === dream.picked) img.classList.add('is-picked');
    detailVersions.appendChild(img);
  });
  detailAnswers.innerHTML = '';
  (dream.answers || []).forEach((a) => {
    const li = document.createElement('li');
    const q = document.createElement('span');
    q.className = 'q';
    q.textContent = a.q; // textContent: other people's words are never treated as code
    if (a.q) li.append(q);
    li.append(document.createTextNode(a.answer));
    detailAnswers.appendChild(li);
  });
  detail.hidden = false;
}

function closeDetail() {
  detail.hidden = true;
  view.targetFov = 60;
}
document.getElementById('detailClose').addEventListener('click', closeDetail);

// --- Controls: drag to turn, click a painting to step closer ---
let dragging = false;
let moved = 0;
let lastX = 0;

window.addEventListener('pointerdown', (e) => {
  if (e.target.closest('.dream-detail, .shared-top, .return-link')) return;
  dragging = true;
  moved = 0;
  lastX = e.clientX;
});
window.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX;
  moved += Math.abs(dx);
  view.targetYaw += dx * 0.004;
  lastX = e.clientX;
});
window.addEventListener('pointerup', (e) => {
  dragging = false;
  // Tap on empty space closes the card
  if (moved < 5 && e.target.tagName !== 'IMG' && !e.target.closest('.dream-detail, .shared-top, .return-link')) closeDetail();
});

function openDream(obj) {
  const { dream, angle } = obj.userData;
  view.targetYaw = -angle; // Turn to face it
  view.targetFov = 32;     // Step closer
  showDetail(dream);
}

function animate() {
  requestAnimationFrame(animate);
  view.yaw += (view.targetYaw - view.yaw) * 0.06;
  view.fov += (view.targetFov - view.fov) * 0.06;
  camera.rotation.y = view.yaw;
  camera.fov = view.fov;
  camera.updateProjectionMatrix();
  // Gentle float, like the paintings are drifting
  const t = performance.now() * 0.0005;
  paintings.forEach((m, i) => { m.position.y = Math.sin(t + i) * 0.08; });
  renderer.render(scene, camera);
  cssRenderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  cssRenderer.setSize(window.innerWidth, window.innerHeight);
});

init();
animate();
