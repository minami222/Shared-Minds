import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';
import { QUESTIONS, pickQuestion } from './questions.js';
import { saveDream } from './firebase.js';

// --- Room & Navigation State ---
export const state = {
  currentRoomIndex: 0,
  rooms: [
    {
      id: 'room-1',
      title: 'Room I · The Opening Threshold',
      subtitle: 'The Threshold of Awakening',
      fragment: 'I was standing on an endless shore of blue glass, watching quiet waves that never broke...',
      author: 'Dreamer #1',
      style: 'Impressionist Memory',
      styleCategory: 'mixed', // factual (realist), mixed (impressionist), emotional (abstract)
      leftQuestion: 'Scene',
      rightQuestion: 'Feeling',
      paintingUrl: null, // Procedurally drawn initially
      connections: 2
    }
  ],
  cameraAngle: { x: 0, y: 0 },
  targetAngle: { x: 0, y: 0 },
  isDragging: false,
  previousMousePosition: { x: 0, y: 0 },
  isTransitioning: false,
  doorsVisible: false,
  dollyTarget: 0.1 // camera z: 0.1 = room view, PUSH_Z = close to the frame
};

// --- DOM References ---
const container = document.getElementById('canvas-container');
const roomBadge = document.getElementById('roomBadge');
const roomSubtitle = document.getElementById('roomSubtitle');

const doorLeft = document.getElementById('door-left');
const doorRight = document.getElementById('door-right');
const leftDoorQuestion = document.getElementById('leftDoorQuestion');
const rightDoorQuestion = document.getElementById('rightDoorQuestion');

const dreamModal = document.getElementById('dreamModal');
const newDreamBtn = document.getElementById('newDreamBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');
const submitDreamBtn = document.getElementById('submitDreamBtn');
const dreamInput = document.getElementById('dreamInput');
const charCount = document.getElementById('charCount');
const modalTitle = document.getElementById('modalTitle');
const modalKicker = document.getElementById('modalKicker');
const modalDesc = document.getElementById('modalDesc');
const styleIndicator = document.getElementById('styleIndicator');

// --- Three.js Setup ---
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(54, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 0.1);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

// --- 3D Scene Elements ---
let panoramaMesh = null;
let paintingMesh = null;
let paintingTexture = null;

// Door anchor positions in 3D world space (precisely mapped to the base of the two visible arches)
const leftDoorAnchor = new THREE.Vector3(-1.58, -0.95, -4.74);
const rightDoorAnchor = new THREE.Vector3(1.54, -0.95, -4.76);
const paintingCenterAnchor = new THREE.Vector3(0, 0.30, -4.95);

// Create an artistic initial dream painting using Canvas API
function createInitialDreamTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 480; // Widescreen panoramic canvas matching center frame
  const ctx = canvas.getContext('2d');

  // Gradient background: deep twilight blue to soft luminous dawn
  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  grad.addColorStop(0, '#0d1b2a');
  grad.addColorStop(0.35, '#1b263b');
  grad.addColorStop(0.65, '#415a77');
  grad.addColorStop(0.85, '#e0a96d');
  grad.addColorStop(1, '#f7d6b8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Soft impressionist water ripples / glass shore
  for (let i = 0; i < 240; i++) {
    const y = 220 + Math.random() * 260;
    const x = Math.random() * canvas.width;
    const len = 40 + Math.random() * 180;
    const h = 2 + Math.random() * 6;
    ctx.fillStyle = `rgba(224, 238, 255, ${0.12 + Math.random() * 0.28})`;
    ctx.beginPath();
    ctx.ellipse(x, y, len / 2, h / 2, (Math.random() - 0.5) * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }

  // Soft distant ethereal horizon glow & floating silhouettes
  ctx.fillStyle = 'rgba(255, 235, 205, 0.35)';
  ctx.filter = 'blur(18px)';
  ctx.beginPath();
  ctx.arc(800, 200, 140, 0, Math.PI * 2);
  ctx.fill();
  ctx.filter = 'none';

  // Luminous strokes
  for (let j = 0; j < 80; j++) {
    ctx.strokeStyle = `rgba(255, 240, 220, ${0.15 + Math.random() * 0.3})`;
    ctx.lineWidth = 1 + Math.random() * 3;
    ctx.beginPath();
    const sx = Math.random() * canvas.width;
    const sy = 180 + Math.random() * 100;
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(sx + (Math.random() - 0.5) * 60, sy + 15, sx + 50, sy + 4);
    ctx.stroke();
  }

  // Subtle linen canvas texture overlay
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  for (let x = 0; x < canvas.width; x += 4) {
    ctx.fillRect(x, 0, 1.5, canvas.height);
  }
  for (let y = 0; y < canvas.height; y += 4) {
    ctx.fillRect(0, y, canvas.width, 1.5);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Build the Rotunda Room & Main Painting
function initGalleryScene() {
  const textureLoader = new THREE.TextureLoader();

  // 1. Panoramic Rotunda Background Mesh
  textureLoader.load(
    'assets/room-monet.jpg',
    (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      // High-clarity texture filtering to avoid blur
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;

      // Exact 1:1 aspect ratio matching the 1024x571 photo (aspect = 1.7933)
      // Radius = 5.0, Height = 5.6 -> Arc = (5.6 * 1.7933) / 5.0 = 2.0085 rad (~115.1 deg)
      const radius = 5.0;
      const height = 5.6;
      const arc = 2.0085;
      const geometry = new THREE.CylinderGeometry(radius, radius, height, 64, 1, true, -arc / 2, arc);
      
      // Inside view of cylinder
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.BackSide,
        depthTest: true
      });

      panoramaMesh = new THREE.Mesh(geometry, material);
      panoramaMesh.position.set(0, 0, 0);
      panoramaMesh.rotation.y = Math.PI; // Face towards camera
      scene.add(panoramaMesh);

      // 2. Central Wall Painting Mesh
      // Curved along the central wall to fit seamlessly inside the center gilded frame
      const pRadius = 4.96;
      const pHeight = 0.547;
      const pArc = 0.447; // Center frame inner width in image
      const pGeometry = new THREE.CylinderGeometry(pRadius, pRadius, pHeight, 32, 1, true, -pArc / 2, pArc);

      paintingTexture = createInitialDreamTexture();
      const pMaterial = new THREE.MeshBasicMaterial({
        map: paintingTexture,
        side: THREE.BackSide // Seen from inside the cylinder, like the room
      });

      paintingMesh = new THREE.Mesh(pGeometry, pMaterial);
      paintingMesh.position.set(0, 0.103, 0); // Aligns precisely with central gilded frame
      paintingMesh.rotation.y = Math.PI; // Same direction as the room
      paintingMesh.visible = false; // Empty frame until the first painting
      scene.add(paintingMesh);

      updateRoomUI(state.rooms[0]);
    },
    undefined,
    (err) => {
      console.error('Failed to load gallery panorama:', err);
    }
  );
}

// --- Project 3D Anchors to Screen Space ---
const tempVec = new THREE.Vector3();
function updateDoorPortals() {
  if (!state.doorsVisible) return;
  const widthHalf = window.innerWidth / 2;
  const heightHalf = window.innerHeight / 2;

  // Left Door
  tempVec.copy(leftDoorAnchor);
  tempVec.project(camera);
  if (tempVec.z < 1) {
    const x = (tempVec.x * widthHalf) + widthHalf;
    const y = -(tempVec.y * heightHalf) + heightHalf;
    doorLeft.style.left = `${x}px`;
    doorLeft.style.top = `${y}px`;
    doorLeft.style.display = 'block';
  } else {
    doorLeft.style.display = 'none';
  }

  // Right Door
  tempVec.copy(rightDoorAnchor);
  tempVec.project(camera);
  if (tempVec.z < 1) {
    const x = (tempVec.x * widthHalf) + widthHalf;
    const y = -(tempVec.y * heightHalf) + heightHalf;
    doorRight.style.left = `${x}px`;
    doorRight.style.top = `${y}px`;
    doorRight.style.display = 'block';
  } else {
    doorRight.style.display = 'none';
  }
}

// --- UI Updates ---
export function updateRoomUI(room) {
  setRoom(0);

  leftDoorQuestion.textContent = room.leftQuestion;
  rightDoorQuestion.textContent = room.rightQuestion;
}

// --- Interactive Camera Controls (Smooth Clamped Orbit & Parallax) ---
function setupControls() {
  const maxPanX = 0.35; // Maximum left/right pan in radians (~20 deg)
  const maxPanY = 0.15; // Maximum up/down tilt in radians (~8 deg)

  window.addEventListener('mousedown', (e) => {
    if (e.target.closest('.gallery-header') || e.target.closest('.door-portal') || e.target.closest('.dream-start') || e.target.closest('.modal-scrim')) return;
    state.isDragging = true;
    state.previousMousePosition = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener('mousemove', (e) => {
    if (state.isTransitioning) return; // Camera is busy with the cinema cut
    if (state.isDragging) {
      const deltaX = e.clientX - state.previousMousePosition.x;
      const deltaY = e.clientY - state.previousMousePosition.y;

      state.targetAngle.y -= deltaX * 0.0018;
      state.targetAngle.x -= deltaY * 0.0014;

      // Clamp target angles
      state.targetAngle.y = Math.max(-maxPanX, Math.min(maxPanX, state.targetAngle.y));
      state.targetAngle.x = Math.max(-maxPanY, Math.min(maxPanY, state.targetAngle.x));

      state.previousMousePosition = { x: e.clientX, y: e.clientY };
    } else {
      // Subtle mouse parallax when hovering
      const normX = (e.clientX / window.innerWidth) * 2 - 1;
      const normY = (e.clientY / window.innerHeight) * 2 - 1;
      const subtleX = -normX * 0.06;
      const subtleY = -normY * 0.04;
      state.targetAngle.y = Math.max(-maxPanX, Math.min(maxPanX, subtleX));
      state.targetAngle.x = Math.max(-maxPanY, Math.min(maxPanY, subtleY));
    }
  });

  window.addEventListener('mouseup', () => {
    state.isDragging = false;
  });

  // Touch Support
  window.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      state.isDragging = true;
      state.previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (state.isDragging && e.touches.length === 1) {
      const deltaX = e.touches[0].clientX - state.previousMousePosition.x;
      const deltaY = e.touches[0].clientY - state.previousMousePosition.y;

      state.targetAngle.y -= deltaX * 0.0022;
      state.targetAngle.x -= deltaY * 0.0018;

      state.targetAngle.y = Math.max(-maxPanX, Math.min(maxPanX, state.targetAngle.y));
      state.targetAngle.x = Math.max(-maxPanY, Math.min(maxPanY, state.targetAngle.x));

      state.previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, { passive: true });

  window.addEventListener('touchend', () => {
    state.isDragging = false;
  });
}

// --- Painting (class Replicate proxy, same as Constellation) ---
const PROXY = 'https://itp-ima-replicate-proxy.web.app/api/create_n_get';
const BASE_STYLE = 'oil painting on canvas in the style of Claude Monet, impressionist, visible thick brushstrokes, soft dappled light, no text';

// How each step changes the previous painting (editing model keeps what came before)
const EDIT_PROMPTS = {
  scene: (a) => `Add this remembered detail to the painting: ${a}. Keep the composition and Monet impressionist brushwork, slightly more detailed and realistic.`,
  feeling: (a) => `Change the mood of this painting to express: ${a}. Keep the scene, looser expressive brushwork, colours that carry the feeling, Monet style.`,
  element: (a) => `Make this painting more abstract, expressing: ${a}. Keep its colours, dissolve the forms into loose impressionist brushstrokes and shapes.`
};
let lastPaintingUrl = null;

// --- Rooms: each step feels like a new room (swap happens inside the haze) ---
// To change the side paintings per room, point `image` at a new background
const ROOMS = [
  { name: 'Room 1', subtitle: 'The Threshold of Awakening', image: 'assets/room-monet.jpg' },
  { name: 'Room 2', subtitle: 'The Room of Reflection', image: 'assets/room-renoir.jpg' },
  { name: 'Room 3', subtitle: 'The Room of Dissolving', image: 'assets/room-cassatt.jpg' }
];
let currentRoomImage = ROOMS[0].image;

function setRoom(index) {
  const room = ROOMS[index];
  roomBadge.textContent = room.name;
  roomSubtitle.textContent = room.subtitle;
  if (room.image === currentRoomImage || !panoramaMesh) return Promise.resolve();
  currentRoomImage = room.image;
  return new Promise((resolve) => {
    new THREE.TextureLoader().load(room.image, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      panoramaMesh.material.map = texture;
      panoramaMesh.material.needsUpdate = true;
      resolve();
    }, undefined, () => resolve());
  });
}

// --- Cinema Cut: push in while painting, cut to dark, reveal, ease back ---
const PUSH_Z = -2.2;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const cutOverlay = document.getElementById('cut');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function pushIn() {
  state.isTransitioning = true;
  state.targetAngle.x = 0;
  state.targetAngle.y = 0;
  if (!reduceMotion) state.dollyTarget = PUSH_Z;
}

function pullBack() {
  state.dollyTarget = 0.1;
  state.isTransitioning = false;
}

function setHaze(on) {
  cutOverlay.classList.toggle('is-on', on);
}
const hintBar = document.getElementById('hintBar');

async function replicate(body) {
  const r = await fetch(PROXY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error || j.output == null) throw new Error(j.details || j.error || `Proxy error ${r.status}`);
  return j.output;
}

async function generateImage(prompt) {
  const out = await replicate({ model: 'black-forest-labs/flux-schnell', input: { prompt, aspect_ratio: '21:9', output_format: 'jpg', num_outputs: 1 } });
  return Array.isArray(out) ? out[0] : out;
}

function setStatus(text, loading = false) {
  hintBar.querySelector('span').textContent = text;
  hintBar.classList.toggle('is-loading', loading);
}

// Show an image in the centre frame, cropped to fill it (like CSS object-fit: cover)
function showPainting(url) {
  return new Promise((resolve, reject) => {
    // Load through the local server (server.py) so WebGL is allowed to use it
    new THREE.TextureLoader().load(`/img?url=${encodeURIComponent(url)}`, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      const frameAspect = (4.96 * 0.447) / 0.547; // arc length / height of the centre frame
      const imageAspect = texture.image.width / texture.image.height;
      if (imageAspect > frameAspect) {
        texture.repeat.set(frameAspect / imageAspect, 1);
      } else {
        texture.repeat.set(1, imageAspect / frameAspect);
      }
      texture.offset.set((1 - texture.repeat.x) / 2, (1 - texture.repeat.y) / 2);
      // Inside a cylinder images read mirrored, so flip horizontally
      texture.wrapS = THREE.RepeatWrapping;
      texture.offset.x += texture.repeat.x;
      texture.repeat.x *= -1;
      paintingMesh.material.map = texture;
      paintingMesh.material.needsUpdate = true;
      paintingMesh.visible = true;
      resolve();
    }, undefined, reject);
  });
}

// Edit the previous painting instead of starting over, so the dream evolves
async function editImage(prompt, imageUrl) {
  const out = await replicate({ model: 'black-forest-labs/flux-kontext-pro', input: { prompt, input_image: imageUrl, aspect_ratio: 'match_input_image', output_format: 'jpg' } });
  return Array.isArray(out) ? out[0] : out;
}

// type: 'opening' makes the first painting; other types edit the last one
async function paintVersion(type, answer, step) {
  setStatus('Imagining your dream', true);
  pushIn();
  setHaze(true); // Dream haze while it paints
  try {
    const url = type === 'opening'
      ? await generateImage(`${answer}, ${BASE_STYLE}`)
      : await editImage(EDIT_PROMPTS[step === 3 ? 'element' : type](answer), lastPaintingUrl);
    await Promise.all([showPainting(url), setRoom(step - 1)]);
    lastPaintingUrl = url;
    flow.versions.push(url);
    setStatus('');
    setHaze(false); // Haze clears to reveal the new version
    await wait(800);
    await wait(1500); // Hold close on the new version before easing back
    pullBack();
    return true;
  } catch (err) {
    pullBack();
    setHaze(false);
    console.error('Painting failed:', err);
    setStatus('The painting didn\'t come through. Try again.');
    return false;
  }
}

// --- Question Flow (3 steps, one painting version per step) ---
// Step 1: opening → version 1. Steps 2 and 3: doors (scene/feeling) → version 2, then final (more abstract).
const flow = {
  step: 1,
  type: null,       // current question bank: 'opening' | 'gap' | 'scene' | 'feeling' | 'element'
  current: null,    // current { q, hint }
  answers: [],      // { step, type, q, answer }
  versions: []      // painting url per step
};

function askQuestion(type) {
  flow.type = type;
  flow.current = pickQuestion(type);
  renderQuestion();
  dreamModal.hidden = false;
  setTimeout(() => dreamInput.focus(), 150);
}

function renderQuestion() {
  modalTitle.textContent = flow.current.q;
  dreamInput.value = '';
  dreamInput.placeholder = flow.current.hint;
  charCount.textContent = '0';
  // Opening has only one question, so nothing to swap
  cancelModalBtn.style.display = QUESTIONS[flow.type].length < 2 ? 'none' : '';
}

function closeDreamModal() {
  dreamModal.hidden = true;
}

// Doors only appear at step 2
function setDoorsVisible(visible) {
  state.doorsVisible = visible;
  if (!visible) {
    doorLeft.style.display = 'none';
    doorRight.style.display = 'none';
  }
}

// Each door shows its own question; clicking opens that same question
const doorQuestions = { scene: null, feeling: null };

function setDoorQuestions() {
  doorQuestions.scene = pickQuestion('scene', doorQuestions.scene);
  doorQuestions.feeling = pickQuestion('feeling', doorQuestions.feeling);
  leftDoorQuestion.textContent = doorQuestions.scene.q;
  rightDoorQuestion.textContent = doorQuestions.feeling.q;
}

function openDoor(type) {
  flow.type = type;
  flow.current = doorQuestions[type];
  renderQuestion();
  dreamModal.hidden = false;
  setTimeout(() => dreamInput.focus(), 150);
}

doorLeft.addEventListener('click', () => openDoor('scene'));
doorRight.addEventListener('click', () => openDoor('feeling'));

// --- Ending: pick a version, save it, then the door to other dreams glows ---
const picker = document.getElementById('picker');
const pickerDots = document.getElementById('pickerDots');
const pickBtn = document.getElementById('pickBtn');
let pickedIndex = 2;
let savedDreamId = null;

function showPicker() {
  pickedIndex = flow.versions.length - 1; // Final version selected by default
  pickerDots.innerHTML = '';
  flow.versions.forEach((url, i) => {
    const dot = document.createElement('button');
    dot.setAttribute('aria-label', `Version ${i + 1}`);
    dot.addEventListener('click', () => previewVersion(i));
    pickerDots.appendChild(dot);
  });
  updateDots();
  picker.style.display = '';
}

function updateDots() {
  [...pickerDots.children].forEach((dot, i) => dot.classList.toggle('is-active', i === pickedIndex));
}

async function previewVersion(i) {
  if (i === pickedIndex) return;
  pickedIndex = i;
  updateDots();
  setHaze(true);
  await wait(500);
  await Promise.all([showPainting(flow.versions[i]), setRoom(i)]);
  setHaze(false);
}

pickBtn.addEventListener('click', async () => {
  picker.style.display = 'none';
  setStatus('Keeping your dream', true);
  try {
    savedDreamId = await saveDream({
      versions: flow.versions,
      answers: flow.answers,
      picked: pickedIndex,
      createdAt: Date.now()
    });
  } catch (err) {
    console.error('Saving failed:', err); // Still let them explore
  }
  setStatus('');
  flow.step = 'explore';
  explorePrompt.style.display = '';
});

const explorePrompt = document.getElementById('explorePrompt');

// Dream Web button: visit the Room of Many Dreams any time
document.getElementById('dreamMapBtn').addEventListener('click', exploreOthers);
document.getElementById('exploreBtn').addEventListener('click', () => {
  explorePrompt.style.display = 'none';
  exploreOthers();
});

// Walk through the glowing door: haze in, push, then arrive in the shared room
async function exploreOthers() {
  state.isTransitioning = true;
  setHaze(true);
  if (!reduceMotion) state.dollyTarget = PUSH_Z;
  await wait(1600);
  location.href = savedDreamId ? `shared.html?me=${savedDreamId}` : 'shared.html';
}
newDreamBtn.addEventListener('click', () => {
  flow.step = 1;
  flow.answers = [];
  flow.versions = [];
  setRoom(0);
  lastPaintingUrl = null;
  doorQuestions.scene = doorQuestions.feeling = null;
  newDreamBtn.style.display = 'none';
  setDoorsVisible(false);
  askQuestion('opening');
});
closeModalBtn.addEventListener('click', closeDreamModal);

// "Ask another": swap for a different question of the same type
cancelModalBtn.addEventListener('click', () => {
  flow.current = pickQuestion(flow.type, flow.current);
  renderQuestion();
  dreamInput.focus();
});

dreamInput.addEventListener('input', () => {
  charCount.textContent = dreamInput.value.length;
});

submitDreamBtn.addEventListener('click', async () => {
  const text = dreamInput.value.trim();
  if (!text) return;
  flow.answers.push({ step: flow.step, type: flow.type, q: flow.current.q, answer: text });
  console.log('[Dream] answers so far:', flow.answers);

  closeDreamModal();
  setDoorsVisible(false);

  // Wait for this version to appear before moving on; on failure, re-ask the same step
  const painted = await paintVersion(flow.type, text, flow.step);
  if (!painted) {
    flow.answers.pop();
    if (flow.step === 1) askQuestion(flow.type);
    else setDoorsVisible(true);
    return;
  }

  if (flow.step === 1) {
    flow.step = 2;
    setDoorQuestions();
    setDoorsVisible(true);
  } else if (flow.step === 2) {
    flow.step = 3;
    setDoorQuestions();
    setDoorsVisible(true);
  } else {
    flow.step = 'pick';
    showPicker();
  }
});

// --- Render Loop ---
function animate() {
  requestAnimationFrame(animate);

  // Smooth camera spring interpolation (lerp)
  state.cameraAngle.x += (state.targetAngle.x - state.cameraAngle.x) * 0.08;
  state.cameraAngle.y += (state.targetAngle.y - state.cameraAngle.y) * 0.08;

  camera.rotation.x = state.cameraAngle.x;
  camera.rotation.y = state.cameraAngle.y;

  // Slow dolly towards / away from the frame
  camera.position.z += (state.dollyTarget - camera.position.z) * 0.02;

  // Keep door hotspots aligned to rotunda doorways
  updateDoorPortals();

  renderer.render(scene, camera);
}

// --- Window Resize ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  updateDoorPortals();
});

// --- Boot ---
setDoorsVisible(false);
modalDesc.style.display = 'none';
modalKicker.style.display = 'none';
setStatus('');
styleIndicator.style.display = 'none';
initGalleryScene();
setupControls();
animate();
