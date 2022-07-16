import { ChunkMaterial, Volume, World, Worldgen } from 'cubitos';
import {
  Clock,
  Color,
  DataArrayTexture,
  PerspectiveCamera,
  Raycaster,
  Scene,
  sRGBEncoding,
  Vector2,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import Raymarcher from 'three-raymarcher';
import PostProcessing from './core/postprocessing.js';
import Blobby from './renderables/blobby.js';
import Indicator from './renderables/indicator.js';
import Ocean from './renderables/ocean.js';

const camera = new PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new WebGLRenderer({ alpha: true, antialias: true });
const postprocessing = new PostProcessing({ samples: 4 });
renderer.outputEncoding = sRGBEncoding;
renderer.setSize(window.innerWidth, window.innerHeight);
document.getElementById('renderer').appendChild(renderer.domElement);
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  postprocessing.onResize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}, false);

const scene = new Scene();
scene.background = (new Color(0x1a2a3a)).convertSRGBToLinear();

camera.position.set(128, 64, 128);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(96, 16, 96);
{
  const rotate = controls.mouseButtons.LEFT;
  const pan = controls.mouseButtons.RIGHT;
  controls.mouseButtons.LEFT = null;
  controls.mouseButtons.MIDDLE = pan;
  controls.mouseButtons.RIGHT = rotate;
}

const clock = new Clock();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    clock.start();
  }
}, false);

const raycaster = new Raycaster();
const pointer = new Vector2();
window.addEventListener('mousedown', ({ button }) => {
  if (button === 0) {
    pointer.isDown = true;
  }
}, false);
window.addEventListener('mousemove', ({ clientX, clientY }) => (
  pointer.set(
    (clientX / window.innerWidth) * 2 - 1,
    -(clientY / window.innerHeight) * 2 + 1
  )
), false);

const indicator = new Indicator();
indicator.position.set(96, -1, 96);
scene.add(indicator);

let blobby;
let cubitos;
let ocean;
let raymarcher;

const volume = new Volume({
  width: 192,
  height: 64,
  depth: 192,
  onLoad: () => (
    Worldgen({ grass: false, lights: false, frequency: 0.005, volume })
      .then(() => {
        volume.propagate();

        blobby = new Blobby(Raymarcher, volume);
        raymarcher = new Raymarcher({
          resolution: 0.5,
          layers: [blobby.entities],
        });

        const atlas = new DataArrayTexture(new Uint8Array([
          Math.floor(Math.random() * 0xAA), Math.floor(Math.random() * 0xAA), Math.floor(Math.random() * 0xAA), 0xFF,
          Math.floor(Math.random() * 0xAA), Math.floor(Math.random() * 0xAA), Math.floor(Math.random() * 0xAA), 0xFF
        ]), 1, 1, 2);
        atlas.needsUpdate = true;

        cubitos = new World({
          material: new ChunkMaterial({ atlas }),
          volume,
        });
        scene.add(cubitos);

        ocean = new Ocean();
        ocean.position.set(volume.width * 0.5, 0, volume.depth * 0.5);
        ocean.updateMatrixWorld();

        clock.start();
        document.getElementById('loading').classList.remove('enabled');
      })
  ),
  onError: (e) => console.error(e),
});

renderer.setAnimationLoop(() => {
  const delta = Math.min(clock.getDelta(), 1);
  const time = clock.oldTime / 1000;
  if (!cubitos) {
    return;
  }
  if (pointer.isDown) {
    pointer.isDown = false;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(cubitos)[0];
    if (hit) {
      const target = blobby.moveTo(
        hit.point.addScaledVector(hit.face.normal, 0.5)
      );
      if (target) {
        indicator.position.copy(target);
      }
    }
  }
  blobby.onAnimationTick(delta, time);
  controls.update();
  postprocessing.render(renderer, scene, camera);
  renderer.autoClear = false;
  renderer.render(raymarcher, camera);
  renderer.render(ocean, camera);
  renderer.autoClear = true;
});
