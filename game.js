import * as THREE from "three";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const $ = (id) => document.getElementById(id);
const landing = $("landing");
const gameScreen = $("gameScreen");
const authModal = $("authModal");
const authMessage = $("authMessage");

let supabase = null;
let currentUser = null;
let username = "INVITÉ";
let balance = 2500;
let missionCompleted = false;
let authMode = "login";

if (SUPABASE_URL.startsWith("https://") && SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes("COLLE_ICI")) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data } = await supabase.auth.getSession();
    if (data.session) await loadPlayer(data.session.user);
    supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) loadPlayer(session.user);
      else currentUser = null;
    });
  } catch (error) {
    console.warn("Supabase non configuré :", error.message);
  }
}

async function loadPlayer(user) {
  currentUser = user;
  const { data, error } = await supabase.from("player_saves").select("*").eq("user_id", user.id).maybeSingle();
  if (error) {
    console.warn(error.message);
    username = user.email?.split("@")[0] || "JOUEUR";
    return;
  }
  if (data) {
    username = data.username;
    balance = data.balance;
    missionCompleted = data.mission_completed;
  } else {
    username = user.user_metadata?.username || user.email?.split("@")[0] || "JOUEUR";
    await savePlayer();
  }
}

async function savePlayer() {
  if (currentUser && supabase) {
    const { error } = await supabase.from("player_saves").upsert({
      user_id: currentUser.id,
      username,
      balance,
      mission_completed: missionCompleted,
      updated_at: new Date().toISOString()
    });
    if (error) showNotice("SAUVEGARDE IMPOSSIBLE : vérifie Supabase.");
  } else {
    localStorage.setItem("blackout_guest_save", JSON.stringify({ balance, missionCompleted }));
  }
}

const guestSave = JSON.parse(localStorage.getItem("blackout_guest_save") || "null");
if (!currentUser && guestSave) {
  balance = Number(guestSave.balance) || 2500;
  missionCompleted = Boolean(guestSave.missionCompleted);
}

function setAuthMode(mode) {
  authMode = mode;
  $("loginTab").classList.toggle("active", mode === "login");
  $("signupTab").classList.toggle("active", mode === "signup");
  $("username").classList.toggle("hidden", mode === "login");
  $("authSubmit").textContent = mode === "login" ? "SE CONNECTER" : "CRÉER MON COMPTE";
  authMessage.textContent = "";
}
setAuthMode("login");

$("openAuth").onclick = () => authModal.classList.remove("hidden");
$("createAccount").onclick = () => { authModal.classList.remove("hidden"); setAuthMode("signup"); };
$("closeAuth").onclick = () => authModal.classList.add("hidden");
$("loginTab").onclick = () => setAuthMode("login");
$("signupTab").onclick = () => setAuthMode("signup");

$("authForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabase) {
    authMessage.textContent = "Configure Supabase dans public/config.js avant de créer un compte.";
    return;
  }
  const email = $("email").value.trim();
  const password = $("password").value;
  const chosenName = $("username").value.trim().replace(/[<>]/g, "").slice(0, 18);
  $("authSubmit").disabled = true;
  authMessage.textContent = "Connexion en cours…";
  try {
    if (authMode === "signup") {
      if (!chosenName) throw new Error("Choisis un pseudo.");
      const { data, error } = await supabase.auth.signUp({
        email, password, options: { data: { username: chosenName } }
      });
      if (error) throw error;
      if (data.session) {
        username = chosenName;
        currentUser = data.user;
        await savePlayer();
        authMessage.textContent = "Compte créé !";
        authModal.classList.add("hidden");
      } else {
        authMessage.textContent = "Compte créé. Vérifie tes e-mails pour confirmer l'inscription.";
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await loadPlayer(data.user);
      authMessage.textContent = "Connecté !";
      authModal.classList.add("hidden");
    }
  } catch (error) {
    authMessage.textContent = error.message || "Une erreur est survenue.";
  } finally {
    $("authSubmit").disabled = false;
  }
});

$("playGuest").onclick = () => startGame();
$("backHome").onclick = (event) => {
  event.preventDefault();
  document.exitPointerLock?.();
  gameScreen.classList.add("hidden");
  landing.classList.remove("hidden");
};

function startGame() {
  landing.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  $("playerName").textContent = username.toUpperCase();
  $("balance").textContent = balance.toLocaleString("fr-FR");
  $("objectiveText").textContent = missionCompleted ? "Mission terminée. Tu peux explorer la ville." : "Rejoins le marqueur doré et récupère le dossier.";
  $("missionProgress").style.width = missionCompleted ? "100%" : "0%";
  if (!renderer) initGame();
  else onResize();
}

let scene, camera, renderer, player, target, marker;
let yaw = 0, started = false, running = false, moveX = 0, moveY = 0;
let lastTouchX = null;
const keys = {};
const clock = new THREE.Clock();
let noticeTimer;

function showNotice(message) {
  const el = $("gameNotice");
  el.textContent = message;
  el.style.opacity = "1";
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => el.style.opacity = "0", 2600);
}

function mat(color, roughness = 0.85, metalness = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function box(parent, x, y, z, w, h, d, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function initGame() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8795a0);
  scene.fog = new THREE.Fog(0x8795a0, 38, 145);

  camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 220);
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  $("gameMount").appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xc8d7e5, 0x45403a, 2));
  const sun = new THREE.DirectionalLight(0xffdfb5, 2.4);
  sun.position.set(-25, 45, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536);
  sun.shadow.camera.left = -55; sun.shadow.camera.right = 55;
  sun.shadow.camera.top = 55; sun.shadow.camera.bottom = -55;
  scene.add(sun);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), mat(0x555954));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  box(scene, 0, 0.025, 0, 200, 0.05, 13, mat(0x292d30));
  box(scene, 0, 0.09, -8, 200, 0.18, 3.2, mat(0x88847b));
  box(scene, 0, 0.09, 8, 200, 0.18, 3.2, mat(0x88847b));

  const dashMat = mat(0xd0c6a9);
  for (let x = -95; x < 100; x += 11) box(scene, x, 0.06, 0, 4.2, 0.025, 0.13, dashMat);

  const facadeColors = [0x93877a, 0xb0a18d, 0x777b7b, 0x887d73, 0xaaa18f];
  for (let i = -5; i <= 5; i++) {
    if (i === 0) continue;
    addBuilding(i * 17, -19, 12, 14, 13 + Math.random() * 18, facadeColors[Math.floor(Math.random() * facadeColors.length)]);
    addBuilding(i * 17, 19, 12, 14, 12 + Math.random() * 17, facadeColors[Math.floor(Math.random() * facadeColors.length)]);
  }

  for (let x = -85; x <= 85; x += 20) {
    addLamp(x, -8);
    addLamp(x + 10, 8);
  }

  addCar(-9, -1.5, 0x273b4b);
  addCar(13, 2, 0x5b2525);

  player = new THREE.Group();
  const jacket = mat(0x222832), pants = mat(0x171b20), skin = mat(0xb98d6c);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.39, 0.72, 5, 10), jacket);
  torso.position.y = 1.3; torso.castShadow = true; player.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 18, 18), skin);
  head.position.y = 2.03; head.castShadow = true; player.add(head);
  const legs = [];
  for (const x of [-0.16, 0.16]) {
    const leg = box(player, x, 0.48, 0, 0.2, 0.72, 0.24, pants);
    legs.push(leg);
  }
  player.userData.legs = legs;
  scene.add(player);

  target = new THREE.Group();
  box(target, 0, 0.42, 0, 0.72, 0.45, 0.55, mat(0x222a31, 0.45, 0.25));
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.03, 8, 16, Math.PI), mat(0xb99a5c, 0.4, 0.5));
  handle.position.y = 0.7; target.add(handle);
  const glow = new THREE.PointLight(0xd5ad62, 2.5, 7); glow.position.y = 1.1; target.add(glow);
  target.position.set(0, 0, -23);
  scene.add(target);

  marker = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.06, 32),
    new THREE.MeshBasicMaterial({ color: 0xd5ad62, transparent: true, opacity: 0.55 }));
  marker.position.set(0, 0.12, -23); scene.add(marker);

  camera.position.set(0, 4, 8);
  camera.lookAt(0, 1, 0);
  bindControls();
  started = true;
  animate();
}

function addBuilding(x, z, w, d, h, color) {
  const group = new THREE.Group();
  box(group, 0, h / 2, 0, w, h, d, mat(color));
  box(group, 0, h + 0.22, 0, w * 0.3, 0.44, d * 0.3, mat(0x55534f));
  const glass = new THREE.MeshStandardMaterial({ color: 0x344c5b, roughness: 0.28, metalness: 0.25 });
  const rows = Math.floor((h - 2) / 3);
  const cols = Math.max(2, Math.floor(w / 2.4));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const wx = -w / 2 + (c + 0.5) * w / cols;
    const wy = 1.7 + r * 2.8;
    box(group, wx, wy, d / 2 + 0.035, 0.78, 1.25, 0.06, glass);
  }
  group.position.set(x, 0, z);
  scene.add(group);
}

function addLamp(x, z) {
  const group = new THREE.Group();
  const dark = mat(0x33383a, 0.55, 0.5);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.08, 4.7, 8), dark);
  pole.position.y = 2.35; group.add(pole);
  box(group, 0.42, 4.55, 0, 0.9, 0.07, 0.07, dark);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffdba0 }));
  bulb.position.set(0.85, 4.48, 0); group.add(bulb);
  const light = new THREE.PointLight(0xffd29b, 1.1, 10); light.position.copy(bulb.position); group.add(light);
  group.position.set(x, 0, z); scene.add(group);
}

function addCar(x, z, color) {
  const group = new THREE.Group();
  box(group, 0, 0.55, 0, 3.4, 0.8, 1.65, mat(color, 0.35, 0.45));
  box(group, -0.1, 1.08, 0, 1.8, 0.55, 1.35, mat(0x293a45, 0.25, 0.3));
  const wheelMat = mat(0x111315);
  for (const wx of [-1.05, 1.05]) for (const wz of [-0.83, 0.83]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.2, 16), wheelMat);
    wheel.rotation.x = Math.PI / 2; wheel.position.set(wx, 0.36, wz); group.add(wheel);
  }
  group.position.set(x, 0, z); scene.add(group);
}

function bindControls() {
  window.addEventListener("keydown", (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.key.toLowerCase() === "e") interact();
  });
  window.addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });
  renderer.domElement.addEventListener("click", () => {
    if (innerWidth > 700) renderer.domElement.requestPointerLock?.();
  });
  window.addEventListener("mousemove", (e) => {
    if (document.pointerLockElement === renderer.domElement) yaw -= e.movementX * 0.0025;
  });

  const joy = $("joystick"), stick = $("stick");
  let pointerId = null;
  joy.addEventListener("pointerdown", (e) => { pointerId = e.pointerId; joy.setPointerCapture(pointerId); moveJoy(e); });
  joy.addEventListener("pointermove", (e) => { if (e.pointerId === pointerId) moveJoy(e); });
  function resetJoy(e) {
    if (e.pointerId !== pointerId) return;
    pointerId = null; moveX = 0; moveY = 0; stick.style.left = "35px"; stick.style.top = "35px";
  }
  function moveJoy(e) {
    const rect = joy.getBoundingClientRect();
    const dx = e.clientX - rect.left - rect.width / 2;
    const dy = e.clientY - rect.top - rect.height / 2;
    const length = Math.hypot(dx, dy), scale = Math.min(1, 38 / Math.max(length, 1));
    moveX = dx * scale / 38; moveY = dy * scale / 38;
    stick.style.left = `${35 + moveX * 38}px`; stick.style.top = `${35 + moveY * 38}px`;
  }
  joy.addEventListener("pointerup", resetJoy);
  joy.addEventListener("pointercancel", resetJoy);

  renderer.domElement.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch" && e.clientX > innerWidth * 0.42) lastTouchX = e.clientX;
  });
  renderer.domElement.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch" && lastTouchX !== null && e.clientX > innerWidth * 0.42) {
      yaw -= (e.clientX - lastTouchX) * 0.008;
      lastTouchX = e.clientX;
    }
  });
  renderer.domElement.addEventListener("pointerup", () => { lastTouchX = null; });
  $("runButton").addEventListener("pointerdown", () => running = true);
  ["pointerup", "pointercancel", "pointerleave"].forEach(type => $("runButton").addEventListener(type, () => running = false));
  $("interactButton").addEventListener("click", interact);
}

function interact() {
  if (!player || missionCompleted) return;
  if (player.position.distanceTo(target.position) < 2.8) {
    missionCompleted = true;
    balance += 500;
    target.visible = false;
    marker.visible = false;
    $("balance").textContent = balance.toLocaleString("fr-FR");
    $("objectiveText").textContent = "MISSION TERMINÉE · Tu peux explorer Newstone.";
    $("missionProgress").style.width = "100%";
    $("interactHint").classList.add("hidden");
    showNotice("MISSION ACCOMPLIE · +500 €");
    savePlayer();
  }
}

function updateCamera(dt) {
  const desired = new THREE.Vector3(
    player.position.x + Math.sin(yaw) * 6.2,
    player.position.y + 3.1,
    player.position.z + Math.cos(yaw) * 6.2
  );
  camera.position.lerp(desired, 1 - Math.exp(-5 * dt));
  camera.lookAt(player.position.x, 1.45, player.position.z);
}

function animate() {
  if (gameScreen.classList.contains("hidden")) return;
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  if (target && !missionCompleted) {
    target.position.y = Math.sin(t * 2) * 0.12;
    marker.material.opacity = 0.35 + Math.sin(t * 3) * 0.15;
  }

  let forward = (keys.w || keys.z ? 1 : 0) - (keys.s ? 1 : 0) - moveY;
  let side = (keys.d ? 1 : 0) - (keys.a || keys.q ? 1 : 0) + moveX;
  const dir = new THREE.Vector3(-Math.sin(yaw) * forward + Math.cos(yaw) * side, 0,
    -Math.cos(yaw) * forward - Math.sin(yaw) * side);
  const moving = dir.lengthSq() > 0.01;
  if (moving) {
    dir.normalize();
    player.position.addScaledVector(dir, (running || keys.shift ? 6.5 : 3.4) * dt);
    player.rotation.y = Math.atan2(-dir.x, -dir.z);
    player.userData.legs.forEach((leg, i) => { leg.rotation.x = Math.sin(t * 10 + i * Math.PI) * 0.4; });
  } else {
    player.userData.legs.forEach(leg => leg.rotation.x = 0);
  }
  player.position.x = THREE.MathUtils.clamp(player.position.x, -92, 92);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -55, 55);
  updateCamera(dt);

  const near = !missionCompleted && player.position.distanceTo(target.position) < 2.8;
  $("interactHint").classList.toggle("hidden", !near || innerWidth <= 700);
  renderer.render(scene, camera);
}

function onResize() {
  if (!renderer) return;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
}
window.addEventListener("resize", onResize);

$("loading").style.opacity = "0";
setTimeout(() => $("loading").remove(), 550);
