import * as THREE from 'https://unpkg.com/three@0.165.0/build/three.module.js';

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
      leftQuestion: 'Who was standing beside you on the shore?',
      rightQuestion: 'Did the infinite horizon feel peaceful or lonely?',
      paintingUrl: null, // Procedurally drawn initially
      connections: 2
    }
  ],
  cameraAngle: { x: 0, y: 0 },
  targetAngle: { x: 0, y: 0 },
  isDragging: false,
  previousMousePosition: { x: 0, y: 0 },
  isTransitioning: false
};

// --- DOM References ---
const container = document.getElementById('canvas-container');
const roomBadge = document.getElementById('roomBadge');
const roomSubtitle = document.getElementById('roomSubtitle');
const labelStyle = document.getElementById('labelStyle');
const labelDate = document.getElementById('labelDate');
const labelQuote = document.getElementById('labelQuote');
const labelAuthor = document.getElementById('labelAuthor');
const labelConnections = document.getElementById('labelConnections');

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
      const pHeight = 0.745;
      const pArc = 0.496; // Center frame width in image
      const pGeometry = new THREE.CylinderGeometry(pRadius, pRadius, pHeight, 32, 1, true, -pArc / 2, pArc);

      paintingTexture = createInitialDreamTexture();
      const pMaterial = new THREE.MeshBasicMaterial({
        map: paintingTexture,
        side: THREE.FrontSide
      });

      paintingMesh = new THREE.Mesh(pGeometry, pMaterial);
      paintingMesh.position.set(0, 0.30, 0); // Aligns precisely with central gilded frame
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
  roomBadge.textContent = `Room ${room.id.replace('room-', '')}`;
  roomSubtitle.textContent = room.subtitle;
  labelStyle.textContent = room.style;
  labelDate.textContent = `${room.title} · Dream Fragment`;
  labelQuote.textContent = `“${room.fragment}”`;
  labelAuthor.textContent = room.author;
  labelConnections.textContent = `${room.connections} paths forward`;

  leftDoorQuestion.textContent = room.leftQuestion;
  rightDoorQuestion.textContent = room.rightQuestion;
}

// --- Interactive Camera Controls (Smooth Clamped Orbit & Parallax) ---
function setupControls() {
  const maxPanX = 0.35; // Maximum left/right pan in radians (~20 deg)
  const maxPanY = 0.15; // Maximum up/down tilt in radians (~8 deg)

  window.addEventListener('mousedown', (e) => {
    if (e.target.closest('.gallery-header') || e.target.closest('.door-portal') || e.target.closest('.museum-label') || e.target.closest('.modal-scrim')) return;
    state.isDragging = true;
    state.previousMousePosition = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener('mousemove', (e) => {
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

// --- Modal & Door Event Handlers ---
let activeDoorChoice = null; // 'left' | 'right' | null

function openDreamModal(doorType = null) {
  activeDoorChoice = doorType;
  dreamModal.hidden = false;
  dreamInput.value = '';
  charCount.textContent = '0';

  if (doorType === 'left') {
    modalKicker.textContent = 'Left Door · Walk Through';
    modalTitle.textContent = state.rooms[state.currentRoomIndex].leftQuestion;
    modalDesc.textContent = 'Answer this fragment to step through into the adjoining chamber.';
    styleIndicator.querySelector('.text').textContent = 'Projected Painting: Realist Study';
    styleIndicator.querySelector('.dot').style.background = '#6ee7b7';
    dreamInput.placeholder = 'e.g. It was an autumn afternoon in an old observatory; iron gears were ticking softly...';
  } else if (doorType === 'right') {
    modalKicker.textContent = 'Right Door · Walk Through';
    modalTitle.textContent = state.rooms[state.currentRoomIndex].rightQuestion;
    modalDesc.textContent = 'Answer this feeling to step through into the adjoining chamber.';
    styleIndicator.querySelector('.text').textContent = 'Projected Painting: Abstract Echo';
    styleIndicator.querySelector('.dot').style.background = '#f472b6';
    dreamInput.placeholder = 'e.g. A heavy ache of longing, yet underneath was an electric rush of sudden wonder...';
  } else {
    modalKicker.textContent = 'A New Chamber';
    modalTitle.textContent = 'Describe your dream fragment';
    modalDesc.textContent = 'Every fragment creates a panoramic painting inside the gallery rotunda.';
    styleIndicator.querySelector('.text').textContent = 'Projected Painting: Impressionist Memory';
    styleIndicator.querySelector('.dot').style.background = '#c6a052';
    dreamInput.placeholder = 'e.g. A city underwater where clocks float like golden jellyfish...';
  }

  setTimeout(() => dreamInput.focus(), 150);
}

function closeDreamModal() {
  dreamModal.hidden = true;
}

doorLeft.addEventListener('click', () => openDreamModal('left'));
doorRight.addEventListener('click', () => openDreamModal('right'));
newDreamBtn.addEventListener('click', () => openDreamModal(null));
closeModalBtn.addEventListener('click', closeDreamModal);
cancelModalBtn.addEventListener('click', closeDreamModal);

dreamInput.addEventListener('input', () => {
  charCount.textContent = dreamInput.value.length;
});

submitDreamBtn.addEventListener('click', () => {
  const text = dreamInput.value.trim();
  if (!text) return;
  // Step 2 will wire this directly to Replicate AI painting generation!
  alert(`Fragment captured for Step 2:\n"${text}"\nStyle: ${activeDoorChoice || 'impressionist'}`);
  closeDreamModal();
});

// --- Render Loop ---
function animate() {
  requestAnimationFrame(animate);

  // Smooth camera spring interpolation (lerp)
  state.cameraAngle.x += (state.targetAngle.x - state.cameraAngle.x) * 0.08;
  state.cameraAngle.y += (state.targetAngle.y - state.cameraAngle.y) * 0.08;

  camera.rotation.x = state.cameraAngle.x;
  camera.rotation.y = state.cameraAngle.y;

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
initGalleryScene();
setupControls();
animate();
