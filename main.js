// ==========================
// GSAP & THREE INIT
// ==========================
gsap.registerPlugin(InertiaPlugin);
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160/build/three.module.js";

// ==========================
// DOM ELEMENTS
// ==========================
const overlay = document.getElementById("loading-overlay");
const notification = document.getElementById("notification");
const terminal = document.getElementById("terminal-content");
const headerItems = document.querySelectorAll(".header-item");
const canvas = document.getElementById("three");

const bassSlider = document.getElementById("bassSlider");
const midSlider = document.getElementById("midSlider");
const trebleSlider = document.getElementById("trebleSlider");
const resetBtn = document.getElementById("resetBtn");

// ==========================
// THREE.JS SETUP
// ==========================
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  40,
  window.innerWidth / window.innerHeight,
  0.3,
  1000,
);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

scene.add(new THREE.AmbientLight(0xffffff, 1.6));
const dirLight = new THREE.DirectionalLight(0xffffff, 3.5);
dirLight.position.set(0, 50, 50);
scene.add(dirLight);

// ==========================
// UI HELPERS
// ==========================
function hideLoader() {
  gsap.to(overlay, {
    opacity: 0,
    duration: 1.5,
    delay: 1,
    pointerEvents: "none",
  });
}

function showNotification(text, duration = 1.4) {
  notification.textContent = text;
  gsap.fromTo(
    notification,
    { y: -40, opacity: 0 },
    {
      y: 20,
      opacity: 1,
      duration: 0.6,
      ease: "back.out(1.6)",
      onComplete: () => {
        gsap.to(notification, {
          y: -40,
          opacity: 0,
          delay: duration,
          duration: 0.5,
        });
      },
    },
  );
}

function typeTerminal(lines) {
  let i = 0;
  function nextLine() {
    if (i >= lines.length) return;
    const el = document.createElement("div");
    terminal.appendChild(el);

    let c = 0;
    const text = lines[i];

    const interval = setInterval(() => {
      el.textContent += text[c++];
      terminal.scrollTop = terminal.scrollHeight;
      if (c >= text.length) {
        clearInterval(interval);
        i++;
        setTimeout(nextLine, 250);
      }
    }, 35);
  }
  nextLine();
}

gsap.to(headerItems, {
  opacity: 0.6,
  repeat: -1,
  yoyo: true,
  duration: 1.5,
  stagger: 0.2,
});

setInterval(() => {
  document.getElementById("timestamp").textContent =
    "TIME: " + new Date().toTimeString().split(" ")[0];
}, 1000);

// ==========================
// AUDIO SETUP
// ==========================
const audioCtx = new AudioContext();
const analyser = audioCtx.createAnalyser();
analyser.fftSize = 128;

const bufferLength = analyser.frequencyBinCount;
const dataArray = new Uint8Array(bufferLength);

let source = null;
let audioBuffer = null;
let isPlaying = false;
let startOffset = 0;
let startTime = 0;

// ==========================
// EQ FILTERS
// ==========================
const bass = audioCtx.createBiquadFilter();
bass.type = "lowshelf";
bass.frequency.value = 200;

const mid = audioCtx.createBiquadFilter();
mid.type = "peaking";
mid.frequency.value = 1000;
mid.Q.value = 1;

const treble = audioCtx.createBiquadFilter();
treble.type = "highshelf";
treble.frequency.value = 5000;

function connectAudio() {
  if (!source) return;
  source.disconnect();
  source.connect(bass);
  bass.connect(mid);
  mid.connect(treble);
  treble.connect(analyser);
  analyser.connect(audioCtx.destination);
}

// ==========================
// EQ SLIDERS
// ==========================
bassSlider.oninput = (e) => (bass.gain.value = +e.target.value);
midSlider.oninput = (e) => (mid.gain.value = +e.target.value);
trebleSlider.oninput = (e) => (treble.gain.value = +e.target.value);

resetBtn.onclick = () => {
  bassSlider.value = midSlider.value = trebleSlider.value = 0;
  bass.gain.value = mid.gain.value = treble.gain.value = 0;
  showNotification("EQ RESET");
};

// ==========================
// AUDIO CONTROL
// ==========================
function createSource(start = 0, autoPlay = true) {
  // ✅ Only stop if the source was started and is playing
  if (source && isPlaying) {
    source.stop();
  }

  source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  connectAudio();

  if (autoPlay) {
    source.start(0, start);
    startOffset = start;
    startTime = audioCtx.currentTime;
    isPlaying = true;
  } else {
    isPlaying = false;
  }

  source.onended = () => {
    isPlaying = false;
  };
}

document.getElementById("playBtn").onclick = async () => {
  if (!audioBuffer) return;
  if (audioCtx.state === "suspended") await audioCtx.resume();
  if (!isPlaying) {
    const elapsed = startOffset + (audioCtx.currentTime - startTime);
    createSource(elapsed);
  }
};

document.getElementById("pauseBtn").onclick = () => {
  if (!isPlaying) return;
  source.stop();
  startOffset += audioCtx.currentTime - startTime;
  isPlaying = false;
};

// ==========================
// AUDIO LOADERS
// ==========================
document.getElementById("audioFile").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  audioBuffer = await audioCtx.decodeAudioData(await file.arrayBuffer());
  showNotification("AUDIO LOADED");
  createSource(0, false);
};

// ==========================
// TEST SONGS (MULTIPLE)
// ==========================
const testSongs = [
  { name: "Rick Astley", file: "./audio/Rick-Astley.mp3" },
  { name: "Daft Punk", file: "./audio/Sandstorm.mp3" },
  { name: "Synthwave", file: "./audio/let-it-go.mp3" },
  { name: "Hans Zimmer", file: "./audio/Culture-Club.mp3" },
];

let currentTestSong = 0;

// ==========================
// LOAD TEST SONG
// ==========================
async function loadTestSong(index) {
  const song = testSongs[index];
  if (!song) return;

  if (audioCtx.state === "suspended") {
    await audioCtx.resume();
  }

  // Stop existing audio safely
  if (source && isPlaying) {
    source.stop();
    isPlaying = false;
  }

  const response = await fetch(song.file);
  const arrayBuffer = await response.arrayBuffer();
  audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

  showNotification(`LOADED: ${song.name}`);
  createSource(0, true);
}

// ==========================
// TEST BUTTON (CYCLE SONGS)
// ==========================
document.getElementById("testBtn").onclick = () => {
  loadTestSong(currentTestSong);
  currentTestSong = (currentTestSong + 1) % testSongs.length;
};

// ==========================
// 3D BARS (AUTO SCALE)
// ==========================
let bars = [];

function spacingScale() {
  return Math.min(Math.max(window.innerWidth / 1200, 0.6), 1.4);
}

function createBars() {
  bars.forEach((b) => scene.remove(b));
  bars = [];

  const spacing = spacingScale();

  for (let i = 0; i < bufferLength; i++) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 1, 2),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(`hsl(${(i / bufferLength) * 1800},100%,50%)`),
      }),
    );

    bar.position.x = (i - (bufferLength - 1) / 2) * spacing;
    scene.add(bar);
    bars.push(bar);
  }

  camera.position.set(0, 15, Math.max(45, bufferLength * spacing));
  camera.lookAt(0, 0, 0);
}

createBars();

// ==========================
// ANIMATION LOOP
// ==========================
function animate() {
  requestAnimationFrame(animate);
  analyser.getByteFrequencyData(dataArray);

  bars.forEach((bar, i) => {
    const h = Math.max(dataArray[i] / 20, 0.4);
    bar.scale.y = h;
    bar.position.y = h / 2;
  });

  renderer.render(scene, camera);
}
animate();

// ==========================
// RESIZE
// ==========================
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  createBars();
});

// ==========================
// INIT
// ==========================
window.addEventListener("load", () => {
  hideLoader();
  showNotification("ANOMALY DETECTED");
  typeTerminal([
    "Three.js Loaded.....",
    "3D BARS loaded......",
    "WELCOME TO CONNOR AND CHARLIES 3D AUDIO PLAYER",
    "-------------------",
    "SELECT/IMPORT MUSIC OR CLICK TEST MUSIC BUTTON",
    "USE THE BASS, MID, TREBLE SLIDERS TO ADJUST SOUND",
    "CLICK RESET TO RETURN EQ TO NEUTRAL",
  ]);
});
