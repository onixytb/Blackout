
import * as THREE from 'three';

// BLACKOUT - NEWSTONE ENGINE V1

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8796a5);
scene.fog = new THREE.FogExp2(0x8796a5, 0.009);

const camera = new THREE.PerspectiveCamera(
  65,
  window.innerWidth / window.innerHeight,
  0.1,
  250
);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance"
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

document.body.appendChild(renderer.domElement);

// LIGHTING

const ambient = new THREE.HemisphereLight(
  0xc6d8ef, 0x34302b, 2
);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xffe0b5, 2.5);
sun.position.set(-30, 55, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -65;
sun.shadow.camera.right = 65;
sun.shadow.camera.top = 65;
sun.shadow.camera.bottom = -65;
scene.add(sun);

// MATERIALS

function material(color, roughness = 0.85) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness
  });
}

const roadMat = material(0x24272a);
const sidewalkMat = material(0x85827a);
const wallColors = [
  0x8b8177,
  0xa59b8c,
  0x777b7e,
  0xb1a594,
  0x716e69
];

// GROUND

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 200),
  material(0x464b49)
);

ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// ROAD

function createBox(x, y, z, w, h, d, mat, parent = scene) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    mat
  );

  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

createBox(0, 0.02, 0, 200, 0.04, 13, roadMat);

for (let i = -90; i <= 90; i += 8) {
  createBox(i, 0.045, 0, 3.5, 0.015, 0.13,
    material(0xd1c9a7));
}

// SIDEWALKS

createBox(0, 0.08, -8, 200, 0.16, 3, sidewalkMat);
createBox(0, 0.08, 8, 200, 0.16, 3, sidewalkMat);

// BUILDINGS

function createBuilding(x, z, w, d, h, color) {
  const group = new THREE.Group();

  const building = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    material(color)
  );

  building.position.y = h / 2;
  building.castShadow = true;
  building.receiveShadow = true;
  group.add(building);

  // Roof details
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.3, 0.5, d * 0.3),
    material(0x55514c)
  );

  roof.position.set(0, h + 0.25, 0);
  group.add(roof);

  // Windows
  const windowMat = new THREE.MeshStandardMaterial({
    color: 0x344b59,
    metalness: 0.25,
    roughness: 0.25
  });

  const rows = Math.floor(h / 3);
  const cols = Math.max(2, Math.floor(w / 2.5));

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const wx = -w / 2 + (col + 0.5) * (w / cols);
      const wy = 1.8 + row * 2.7;

      if (wy > h - 1) continue;

      const windowMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, 1.35, 0.07),
        windowMat
      );

      windowMesh.position.set(wx, wy, d / 2 + 0.045);
      group.add(windowMesh);
    }
  }

  group.position.set(x, 0, z);
  scene.add(group);
}

for (let i = -5; i <= 5; i++) {
  if (i === 0) continue;

  const height = 12 + Math.random() * 20;

  createBuilding(
    i * 18,
    -20 - Math.random() * 8,
    13,
    12,
    height,
    wallColors[Math.floor(Math.random() * wallColors.length)]
  );

  createBuilding(
    i * 18,
    20 + Math.random() * 8,
    13,
    12,
    height,
    wallColors[Math.floor(Math.random() * wallColors.length)]
  );
}

// STREET LAMPS

function createLamp(x, z) {
  const group = new THREE.Group();

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.1, 5, 8),
    material(0x34383a)
  );

  pole.position.y = 2.5;
  group.add(pole);

  const arm = createBox(0.6, 4.85, 0, 1.2, 0.08, 0.08,
    material(0x34383a), group);

  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xffdca0 })
  );

  bulb.position.set(1.1, 4.7, 0);
  group.add(bulb);

  const light = new THREE.PointLight(0xffd09a, 2, 13);
  light.position.copy(bulb.position);
  group.add(light);

  group.position.set(x, 0, z);
  scene.add(group);
}

for (let x = -85; x <= 85; x += 20) {
  createLamp(x, -8);
  createLamp(x + 10, 8);
}

// PLAYER

const player = new THREE.Group();

const skin = material(0xb98d6c);
const clothes = material(0x20252d);
const trousers = material(0x171b20);
const shoes = material(0x111315);

const body = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.42, 0.85, 5, 10),
  clothes
);
body.position.y = 1.35;
body.castShadow = true;
player.add(body);

const head = new THREE.Mesh(
  new THREE.SphereGeometry(0.28, 20, 20),
  skin
);
head.position.y = 2.17;
head.castShadow = true;
player.add(head);

const legs = [];

for (const x of [-0.19, 0.19]) {
  const leg = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.75, 0.27),
    trousers
  );

  leg.position.set(x, 0.52, 0);
  leg.castShadow = true;
  player.add(leg);
  legs.push(leg);

  const shoe = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.14, 0.4),
    shoes
  );

  shoe.position.set(x, 0.13, -0.06);
  player.add(shoe);
}

// Jacket details
const jacketLine = createBox(
  0, 1.42, -0.425,
  0.04, 0.65, 0.02,
  material(0x52565c), player
);

player.position.set(0, 0, 0);
scene.add(player);

// MISSION OBJECT

const objective = new THREE.Group();

const caseMesh = new THREE.Mesh(
  new THREE.BoxGeometry(0.8, 0.5, 0.6),
  material(0x252a31, 0.4)
);
caseMesh.position.y = 0.5;
caseMesh.castShadow = true;
objective.add(caseMesh);

const handle = new THREE.Mesh(
  new THREE.TorusGeometry(0.16, 0.035, 8, 16, Math.PI),
  material(0xb69a5d, 0.4)
);

handle.position.set(0, 0.82, 0);
objective.add(handle);

const glow = new THREE.PointLight(0xd7a94b, 3, 6);
glow.position.y = 1.3;
objective.add(glow);

objective.position.set(0, 0, -24);
scene.add(objective);

// MARKER

const marker = new THREE.Mesh(
  new THREE.CylinderGeometry(0.45, 0.45, 0.06, 32),
  new THREE.MeshBasicMaterial({
    color: 0xd7a94b,
    transparent: true,
    opacity: 0.45
  })
);

marker.position.set(0, 0.1, -24);
scene.add(marker);

// INPUT

const keys = {};
let yaw = 0;
let started = false;
let completed = false;
let running = false;
let joystickX = 0;
let joystickY = 0;
let moving = false;

window.addEventListener("keydown", e => {
  keys[e.key.toLowerCase()] = true;

  if (e.key.toLowerCase() === "e") interact();
});

window.addEventListener("keyup", e => {
  keys[e.key.toLowerCase()] = false;
});

window.addEventListener("mousedown", () => {
  if (started && !isMobile()) {
    document.body.requestPointerLock?.();
  }
});

window.addEventListener("mousemove", e => {
  if (document.pointerLockElement === document.body) {
    yaw -= e.movementX * 0.0025;
  }
});

function isMobile() {
  return window.innerWidth < 700;
}

// TOUCH CONTROLS

const joystick = document.getElementById("joystick");
const stick = document.getElementById("stick");

let joystickPointer = null;

joystick.addEventListener("pointerdown", e => {
  joystickPointer = e.pointerId;
  joystick.setPointerCapture(e.pointerId);
  updateJoystick(e);
});

joystick.addEventListener("pointermove", e => {
  if (e.pointerId === joystickPointer) updateJoystick(e);
});

function updateJoystick(e) {
  const rect = joystick.getBoundingClientRect();

  const dx = e.clientX - (rect.left + rect.width / 2);
  const dy = e.clientY - (rect.top + rect.height / 2);

  const max = 38;
  const length = Math.hypot(dx, dy);
  const scale = Math.min(1, max / Math.max(length, 1));

  joystickX = dx * scale / max;
  joystickY = dy * scale / max;

  stick.style.left = `${38 + joystickX * max}px`;
  stick.style.top = `${38 + joystickY * max}px`;
}

function resetJoystick(e) {
  if (e.pointerId !== joystickPointer) return;

  joystickPointer = null;
  joystickX = 0;
  joystickY = 0;
  stick.style.left = "38px";
  stick.style.top = "38px";
}

joystick.addEventListener("pointerup", resetJoystick);
joystick.addEventListener("pointercancel", resetJoystick);

// MOBILE CAMERA

let lastTouch = null;

renderer.domElement.addEventListener("pointerdown", e => {
  if (e.pointerType === "touch" && e.clientX > window.innerWidth * 0.45) {
    lastTouch = { id: e.pointerId, x: e.clientX };
    renderer.domElement.setPointerCapture(e.pointerId);
  }
});

renderer.domElement.addEventListener("pointermove", e => {
  if (lastTouch && e.pointerId === lastTouch.id) {
    yaw -= (e.clientX - lastTouch.x) * 0.009;
    lastTouch.x = e.clientX;
  }
});

renderer.domElement.addEventListener("pointerup", e => {
  if (lastTouch && e.pointerId === lastTouch.id) {
    lastTouch = null;
  }
});

document.getElementById("runButton").addEventListener("pointerdown", () => {
  running = true;
});

document.getElementById("runButton").addEventListener("pointerup", () => {
  running = false;
});

document.getElementById("runButton").addEventListener("pointercancel", () => {
  running = false;
});

document.getElementById("interactButton").addEventListener("click", interact);

// MISSION

function notify(message) {
  const el = document.getElementById("notification");
  el.textContent = message;
  el.style.opacity = 1;

  setTimeout(() => {
    el.style.opacity = 0;
  }, 2500);
}

function interact() {
  if (!started || completed) return;

  const distance = player.position.distanceTo(objective.position);

  if (distance < 2.5) {
    completed = true;
    objective.visible = false;
    marker.visible = false;

    document.getElementById("objective").textContent =
      "MISSION TERMINÉE · Bien joué.";

    document.getElementById("progress").style.width = "100%";
    document.getElementById("money").textContent = "3 000";

    notify("MISSION ACCOMPLIE · +500 €");
  }
}

// START

document.getElementById("startButton").addEventListener("click", () => {
  started = true;

  const screen = document.getElementById("start-screen");
  screen.style.opacity = 0;

  setTimeout(() => screen.style.display = "none", 700);

  if (!isMobile()) {
    document.body.requestPointerLock?.();
  }
});

// CAMERA

const cameraTarget = new THREE.Vector3();

function updateCamera(delta) {
  const distance = 6.5;
  const height = 3.5;

  const desired = new THREE.Vector3(
    player.position.x + Math.sin(yaw) * distance,
    player.position.y + height,
    player.position.z + Math.cos(yaw) * distance
  );

  camera.position.lerp(desired, 1 - Math.exp(-5 * delta));

  cameraTarget.set(
    player.position.x,
    player.position.y + 1.5,
    player.position.z
  );

  camera.lookAt(cameraTarget);
}

// GAME LOOP

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  // Object animation
  if (!completed) {
    objective.position.y = Math.sin(time * 2) * 0.12;
    marker.material.opacity = 0.3 + Math.sin(time * 3) * 0.15;
  }

  if (started) {
    let forward =
      (keys["w"] || keys["z"] ? 1 : 0) -
      (keys["s"] ? 1 : 0) - joystickY;

    let side =
      (keys["d"] ? 1 : 0) -
      (keys["a"] || keys["q"] ? 1 : 0) + joystickX;

    const direction = new THREE.Vector3(
      -Math.sin(yaw) * forward + Math.cos(yaw) * side,
      0,
      -Math.cos(yaw) * forward - Math.sin(yaw) * side
    );

    moving = direction.lengthSq() > 0.01;

    if (moving) {
      direction.normalize();

      const speed = running || keys["shift"] ? 7 : 3.5;

      player.position.addScaledVector(
        direction,
        speed * delta
      );

      player.rotation.y = Math.atan2(
        -direction.x,
        -direction.z
      );

      legs.forEach((leg, i) => {
        leg.rotation.x = Math.sin(time * 10 + i * Math.PI) * 0.45;
      });
    } else {
      legs.forEach(leg => leg.rotation.x = 0);
    }

    // Limit the playable area
    player.position.x = THREE.MathUtils.clamp(
      player.position.x, -92, 92
    );

    player.position.z = THREE.MathUtils.clamp(
      player.position.z, -55, 55
    );

    updateCamera(delta);

    const distance = player.position.distanceTo(objective.position);

    document.getElementById("interaction").classList.toggle(
      "hidden",
      distance > 2.5 || completed
    );
  }

  renderer.render(scene, camera);
}

// RESIZE

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
});

// INIT

camera.position.set(0, 4, 8);
camera.lookAt(0, 1, 0);

animate();

window.addEventListener("load", () => {
  setTimeout(() => {
    document.getElementById("loading").style.display = "none";
  }, 1600);
});
