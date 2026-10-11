import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import * as THREE from 'three';
import { createElectricalLayer } from '../src/scene/ElectricalLayer';
import { createInitialState } from '../src/state';
import type { UIState } from '../src/types';

function layerForTest(t: TestContext) {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  // Canvas pixels are uploaded only by a renderer. These tests inspect scene
  // resources and selection without opening a browser or creating a GPU context.
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    createElement: () => ({ width: 0, height: 0, getContext: () => ({ beginPath() {}, roundRect() {}, fill() {}, fillText() {} }) }),
  } });
  const layer = createElectricalLayer();
  t.after(() => {
    layer.dispose();
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  });
  return layer;
}

const ui: UIState = { view: 'floor', room: 'all', system: 'lighting', quality: 'low', reducedMotion: false, hideUI: false, cameraRevision: 0 };
const activeGroups = (root: THREE.Object3D) => root.children.filter((object): object is THREE.PointLight => object instanceof THREE.PointLight && object.visible).map(light => light.userData.lightGroup as string);

test('electrical GPU light pool prioritizes the selected room and fixture while preserving all group levels', t => {
  const layer = layerForTest(t), state = createInitialState();
  for (const id of Object.keys(state.electrical.lights)) state.electrical.lights[id] = 0.8;
  const before = structuredClone(state);
  layer.update(state, { ...ui, room: 'bedroom_east' }, 'house', 3);
  assert.deepEqual(activeGroups(layer.root).sort(), ['L03', 'L04', 'L05']);
  assert.equal(layer.activePointLights, 3);
  const office = layer.root.getObjectByName('electrical_L01')!;
  let officeGlows = false;
  office.traverse(object => {
    if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial && Math.abs(object.material.emissiveIntensity - 1.2) < 1e-8) officeGlows = true;
  });
  assert.ok(officeGlows, 'a fixture outside the GPU light budget still shows its active level');
  layer.update(state, { ...ui, electrical: { enabled: true, layer: 'lighting', routes: false, labels: false, selectedId: 'L14', circuit: null } }, 'house', 3);
  assert.ok(activeGroups(layer.root).includes('L14'), 'explicit focus outranks more powerful light groups');
  layer.update(state, ui, 'house', 6);
  assert.equal(layer.activePointLights, 6);
  assert.deepEqual(state, before, 'rendering budgets never alter the fourteen independent channel states');
});

test('electrical light slots are reused and exclude off, unavailable, or unloaded groups', t => {
  const layer = layerForTest(t), state = createInitialState();
  const pool = layer.root.children.filter(object => object instanceof THREE.PointLight);
  assert.equal(pool.length, 6);
  for (const id of Object.keys(state.electrical.lights)) state.electrical.lights[id] = 1;
  layer.update(state, ui, 'first-room', 99);
  assert.deepEqual(activeGroups(layer.root).sort(), ['L06', 'L07', 'L08', 'L14']);
  state.config.rooms = ['bedroom_east'];
  layer.update(state, ui, 'house', 6);
  assert.deepEqual(activeGroups(layer.root).sort(), ['L03', 'L04', 'L05']);
  state.electrical.lights.L03 = 0;
  layer.update(state, ui, 'house', 6);
  assert.deepEqual(activeGroups(layer.root).sort(), ['L04', 'L05']);
  state.config.systems.lighting = false;
  layer.update(state, ui, 'house', 6);
  assert.equal(layer.activePointLights, 0);
  state.config.systems.lighting = true;
  for (const budget of [0, -1, Number.NaN]) {
    layer.update(state, ui, 'house', budget);
    assert.equal(layer.activePointLights, 0);
  }
  assert.deepEqual(layer.root.children.filter(object => object instanceof THREE.PointLight), pool, 'changing budget does not allocate another light pool');
});
