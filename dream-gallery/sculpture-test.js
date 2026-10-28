import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Free public test model. Later this becomes the GLB link from Replicate.
const SCULPTURE_URL = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Duck/glTF-Binary/Duck.glb';

// --- Three.js Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0a09);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.6, 4);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// --- Room: floor + plinth ---
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(20, 20),
  new THREE.MeshStandardMaterial({ color: 0x1a1816, roughness: 1 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const plinthHeight = 1;
const plinth = new THREE.Mesh(
  new THREE.BoxGeometry(0.8, plinthHeight, 0.8),
  new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.9 })
);
plinth.position.y = plinthHeight / 2;
plinth.castShadow = true;
plinth.receiveShadow = true;
scene.add(plinth);

// --- Lights: dim fill + one gallery spotlight ---
scene.add(new THREE.AmbientLight(0xffffff, 0.15));

const spot = new THREE.SpotLight(0xfff1dc, 40, 10, Math.PI / 8, 0.5);
spot.position.set(0, 5, 1);
spot.target = plinth;
spot.castShadow = true;
scene.add(spot);

// --- Load sculpture, scale it to fit the plinth ---
new GLTFLoader().load(
  SCULPTURE_URL,
  (gltf) => {
    const model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    model.scale.setScalar(0.6 / Math.max(size.x, size.y, size.z));

    // Re-measure, then sit it centred on top of the plinth
    box.setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y += plinthHeight - box.min.y;

    model.traverse((child) => { if (child.isMesh) child.castShadow = true; });
    scene.add(model);
  },
  undefined,
  (err) => console.error('Failed to load sculpture:', err)
);

// --- Controls: drag to walk around the sculpture ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, plinthHeight + 0.3, 0);
controls.enableDamping = true;
controls.minDistance = 1.5;
controls.maxDistance = 8;
controls.maxPolarAngle = Math.PI / 2.1; // Don't go below the floor

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
