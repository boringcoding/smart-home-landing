import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialState, electricalButtonUnavailableReason, electricalControlUnavailableReason, electricalLightUnavailableReason, exportSummary, reduceCommand, tick } from '../src/state';
import type { Command, HomeState } from '../src/types';

const command = (state: HomeState, ...commands: Command[]) => commands.reduce(reduceCommand, state);
const advance = (state: HomeState, seconds: number) => {
  for (let elapsed = 0; elapsed < seconds - 1e-8; elapsed += 0.05) state = tick(state, Math.min(0.05, seconds - elapsed));
  return state;
};
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}
const ids = Array.from({ length: 14 }, (_, i) => `L${String(i + 1).padStart(2, '0')}`);
const allFaults: Command[] = ['internet', 'ha', 'wb'].map(target => ({ type: 'electrical-fault', target: target as 'internet' | 'ha' | 'wb', value: true }));

test('fourteen independent channels preserve frozen inputs and project compatible legacy groups', () => {
  const original = freeze(createInitialState());
  let state = original;
  assert.deepEqual(Object.keys(state.electrical.lights), ids);
  for (let index = 0; index < ids.length; index++) state = command(state, { type: 'electrical-light', id: ids[index], value: (index + 1) / 15 });
  ids.forEach((id, index) => assert.equal(state.electrical.lights[id], (index + 1) / 15, id));
  assert.equal(original.electrical.lights.L01, 0);
  assert.equal(state.devices.lighting.main, state.electrical.lights.L06);
  assert.equal(state.devices.lighting.local, state.electrical.lights.L08);
  assert.equal(state.devices.lighting.accent, state.electrical.lights.L14);
  assert.equal(state.devices.lighting.exterior, (state.electrical.lights.L12 + state.electrical.lights.L13) / 2);
  state = command(state, { type: 'light', group: 'exterior', value: 0.36 }, { type: 'light', group: 'local', value: 0.72 });
  assert.equal(state.electrical.lights.L12, 0.36);
  assert.equal(state.electrical.lights.L13, 0.36);
  assert.equal(state.electrical.lights.L08, 0.72);
  assert.equal(state.electrical.lights.L01, 1 / 15, 'unrelated channels remain independent');
});

test('every direct button binding works without internet, HA or WB and changes only its channel', () => {
  const bindings: [string, number, string, ('short' | 'long')?][] = [
    ['S01', 1, 'L09'], ['S01', 2, 'L12'], ['S01', 1, 'L14', 'long'],
    ['S02', 1, 'L06'], ['S02', 2, 'L07'], ['S02', 3, 'L08'],
    ['S03', 1, 'L01'], ['S03', 2, 'L02'], ['S04', 1, 'L01'], ['S04', 2, 'L02'],
    ['S05', 1, 'L03'], ['S06', 1, 'L03'], ['S06', 2, 'L04'],
    ['S07', 1, 'L03'], ['S07', 2, 'L05'], ['S08', 1, 'L10'], ['S08', 2, 'L11'],
    ['S09', 1, 'L08'], ['S10', 1, 'L12'], ['S10', 2, 'L13'],
  ];
  for (const [id, key, light, press] of bindings) {
    const before = freeze(command(createInitialState(), ...allFaults));
    assert.equal(electricalButtonUnavailableReason(before, id, key, press), '', `${id}.${key}`);
    const after = command(before, { type: 'electrical-button', id, key, press });
    for (const channel of ids) assert.equal(after.electrical.lights[channel], channel === light ? before.electrical.lights[channel] > 0 ? 0 : 1 : before.electrical.lights[channel], `${id}.${key}/${press ?? 'short'} → ${channel}`);
    assert.deepEqual(after.electrical.faults, before.electrical.faults);
  }
});

test('local UI survives internet loss; HA and WB failures reject commands without replay on recovery', () => {
  for (const target of ['internet', 'ha', 'wb'] as const) {
    let state = command(createInitialState(), { type: 'electrical-light', id: 'L01', value: 0.4 });
    const before = structuredClone(state.electrical.lights);
    state = command(state, { type: 'electrical-fault', target, value: true });
    assert.deepEqual(state.electrical.lights, before, 'a control-path outage does not cut lamp power');
    assert.equal(Boolean(electricalControlUnavailableReason(state)), target !== 'internet');
    state = command(state, { type: 'electrical-light', id: 'L01', value: 0.8 });
    assert.equal(state.electrical.lights.L01, target === 'internet' ? 0.8 : 0.4);
    state = command(state, { type: 'electrical-fault', target, value: false });
    assert.equal(state.electrical.lights.L01, target === 'internet' ? 0.8 : 0.4, 'rejected commands are not queued');
    state = command(state, { type: 'electrical-light', id: 'L01', value: 0.8 });
    assert.equal(state.electrical.lights.L01, 0.8);
  }
});

test('physical WB scenarios survive HA failure but cannot bypass a stopped WB', () => {
  let state = command(createInitialState(), { type: 'electrical-fault', target: 'ha', value: true });
  const before = structuredClone(state.devices);
  state = command(state, { type: 'scenario', scenario: 'away' });
  assert.deepEqual(state.devices, before, 'HA cannot start a whole-house scenario while offline');
  assert.equal(state.demo.scenario, null);
  state = command(state, { type: 'electrical-button', id: 'S01', key: 3 });
  assert.equal(state.demo.scenario, 'away');
  assert.ok(Object.values(state.electrical.lights).every(value => value === 0));
  assert.equal(state.devices.climate.enabled, true, 'away lowers the setpoint, not power to heating');
  assert.equal(state.devices.climate.setpoint, 18);
  state = command(state, { type: 'electrical-fault', target: 'wb', value: true });
  const awayDevices = structuredClone(state.devices);
  state = command(state, { type: 'electrical-button', id: 'S06', key: 3 }, { type: 'scenario', scenario: 'home' });
  assert.equal(state.demo.scenario, 'away');
  assert.deepEqual(state.devices, awayDevices);
  state = command(state, { type: 'electrical-fault', target: 'wb', value: false }, { type: 'electrical-button', id: 'S06', key: 3 });
  assert.equal(state.demo.scenario, 'night');
  assert.equal(state.electrical.lights.L14, 0.08);
  assert.equal(state.electrical.faults.ha, true);
});

test('configuration exclusions apply to direct buttons and scenarios without inventing a seventh system', () => {
  let state = command(createInitialState(), { type: 'electrical-light', id: 'L01', value: 0.41 }, { type: 'room', room: 'bedroom_west', value: false });
  assert.ok(electricalLightUnavailableReason(state, 'L01'));
  assert.ok(electricalButtonUnavailableReason(state, 'S03', 1));
  state = command(state, { type: 'electrical-button', id: 'S03', key: 1 }, { type: 'electrical-light', id: 'L01', value: 1 }, { type: 'scenario', scenario: 'home' });
  assert.equal(state.electrical.lights.L01, 0.41);
  assert.equal(state.electrical.lights.L03, 0.65);
  state = command(state, { type: 'system', system: 'lighting', value: false });
  const lights = structuredClone(state.electrical.lights);
  state = command(state, { type: 'electrical-button', id: 'S02', key: 1 }, { type: 'electrical-light', id: 'L06', value: 1 }, { type: 'scenario', scenario: 'away' });
  assert.deepEqual(state.electrical.lights, lights);
  assert.equal(Object.keys(state.config.systems).length, 6);
  state = command(state, { type: 'system', system: 'lighting', value: true }, { type: 'room', room: 'entry', value: false });
  assert.equal(electricalLightUnavailableReason(state, 'L14'), '', 'shared route is still present in living');
  assert.ok(electricalButtonUnavailableReason(state, 'S01', 1, 'long'), 'the entry button itself was excluded');
});

test('reserve functions and unknown button or channel IDs never invent actions', () => {
  const initial = freeze(createInitialState());
  for (const [id, key, press] of [['S05', 2, 'short'], ['S07', 3, 'short'], ['S08', 3, 'short'], ['S03', 1, 'long'], ['constructor', 1, 'short']] as const) {
    const state = command(initial, { type: 'electrical-button', id, key, press });
    assert.ok(electricalButtonUnavailableReason(state, id, key, press));
    assert.deepEqual(state.electrical, initial.electrical);
    assert.deepEqual(state.devices, initial.devices);
  }
  const state = command(initial, { type: 'electrical-light', id: '__proto__', value: 1 });
  assert.deepEqual(state.electrical, initial.electrical);
});

test('old snapshots migrate legacy lighting and new snapshots normalize only the fourteen known channels', () => {
  const legacy = createInitialState();
  legacy.devices.lighting.main = 0.27;
  legacy.devices.lighting.local = 0.48;
  delete (legacy as Partial<HomeState>).electrical;
  const migrated = tick(freeze(legacy), 0.01);
  assert.deepEqual(Object.keys(migrated.electrical.lights), ids);
  assert.equal(migrated.electrical.lights.L06, 0.27);
  assert.equal(migrated.electrical.lights.L08, 0.48);
  assert.deepEqual(migrated.electrical.faults, { internet: false, ha: false, wb: false });
  const snapshot = createInitialState();
  snapshot.electrical.lights = { L01: 0.7, L06: Number.NaN, L12: -1, L13: 7, L99: 1 };
  const restored = tick(freeze(snapshot), 0.01);
  assert.equal(restored.electrical.lights.L01, 0.7);
  assert.equal(restored.electrical.lights.L06, 0.65);
  assert.equal(restored.electrical.lights.L12, 0);
  assert.equal(restored.electrical.lights.L13, 1);
  assert.equal(restored.electrical.lights.L99, undefined);
  assert.equal(restored.devices.lighting.exterior, 0.5);
});

test('autonomous leak protection and its reset remain independent from all three control-path failures', () => {
  let state = command(createInitialState(), { type: 'leak' }, ...allFaults);
  state = advance(state, 10);
  assert.equal(state.devices.water.latched, true);
  assert.equal(state.devices.water.valve.current, 0);
  assert.equal(state.devices.water.inflow, false);
  const electrical = structuredClone(state.electrical);
  state = command(state, { type: 'water-reset' });
  assert.deepEqual(state.electrical, electrical);
  assert.equal(state.devices.water.latched, false);
  state = advance(command(state, { type: 'valve-fault', value: true }, { type: 'leak' }), 10);
  assert.equal(state.devices.water.latched, true);
  assert.equal(state.devices.water.valve.current, 1);
  assert.equal(state.devices.water.inflow, true);
});

test('summary copies the simulated electrical status and global reset clears faults without changing configuration', () => {
  let state = command(createInitialState(), { type: 'room', room: 'bathroom', value: false }, { type: 'electrical-light', id: 'L01', value: 0.5 }, ...allFaults);
  const summary = exportSummary(state);
  assert.equal(summary.demonstration.electrical.localSimulationOnly, true);
  summary.demonstration.electrical.lights.L01 = 0;
  assert.equal(state.electrical.lights.L01, 0.5);
  const config = structuredClone(state.config);
  state = command(state, { type: 'reset' });
  assert.deepEqual(state.config, config);
  assert.deepEqual(state.electrical.faults, { internet: false, ha: false, wb: false });
});
