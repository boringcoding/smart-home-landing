import assert from 'node:assert/strict';
import test from 'node:test';
import { createInitialState, curtainAvailable, curtainUnavailableReason, exportSummary, LEAK_SENSOR_AMOUNT, MAX_EVENTS, MAX_STEP_SECONDS, reduceCommand, systemAvailable, systemRooms, tick } from '../src/state';
import type { Command, HomeState, ScenarioId, SystemId } from '../src/types';

const command = (state: HomeState, ...commands: Command[]) => commands.reduce(reduceCommand, state);
const advance = (state: HomeState, seconds: number): HomeState => {
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

test('reducer and clock preserve their frozen input snapshots', () => {
  const original = freeze(createInitialState());
  const moved = reduceCommand(original, { type: 'curtain', value: 1 });
  const later = tick(freeze(moved), 0.1);
  assert.equal(original.devices.curtains.target, 0.15);
  assert.equal(moved.devices.curtains.current, 0.15);
  assert.ok(later.devices.curtains.current > 0.15);
  assert.equal(original.demo.events.length, 1);
});

test('curtain reversal and stop start at the actual position with no jump', () => {
  let state = advance(command(createInitialState(), { type: 'curtain', value: 1 }), 1);
  const intermediate = state.devices.curtains.current;
  assert.ok(intermediate > 0.15 && intermediate < 1);
  state = command(state, { type: 'curtain', value: 0 });
  assert.equal(state.devices.curtains.current, intermediate);
  state = advance(state, 0.25);
  assert.ok(state.devices.curtains.current < intermediate);
  state = command(state, { type: 'curtain-stop' });
  const stopped = state.devices.curtains.current;
  assert.equal(advance(state, 8).devices.curtains.current, stopped);
  for (const target of [0, 0.25, 0.5, 1]) {
    state = advance(command(state, { type: 'curtain', value: target }), 5);
    assert.equal(state.devices.curtains.current, target);
  }
});

test('changing scenario while curtains move does not reset the mechanism', () => {
  let state = advance(command(createInitialState(), { type: 'scenario', scenario: 'cinema' }), 1);
  const position = state.devices.curtains.current;
  state = command(state, { type: 'scenario', scenario: 'morning' });
  assert.equal(state.devices.curtains.current, position);
  assert.equal(state.devices.curtains.target, 0);
  assert.equal(advance(state, 5).devices.curtains.current, 0);
});

test('room curtains move, reverse and stop independently without moving other rooms', () => {
  const original = freeze(createInitialState());
  let state = advance(command(original,
    { type: 'curtain', room: 'bedroom_west', value: 1 },
    { type: 'curtain', room: 'bedroom_east', value: 1 },
  ), 1);
  const westPosition = state.devices.curtainsByRoom.bedroom_west.current;
  const eastPosition = state.devices.curtainsByRoom.bedroom_east.current;
  assert.ok(westPosition > 0.15 && westPosition < 1);
  assert.deepEqual(state.devices.curtainsByRoom.living, original.devices.curtainsByRoom.living);
  assert.deepEqual(Object.keys(state.devices.curtainsByRoom).sort(), ['bedroom_east', 'bedroom_west', 'living']);
  state = command(state,
    { type: 'curtain', room: 'bedroom_west', value: 0 },
    { type: 'curtain-stop', room: 'bedroom_east' },
  );
  assert.equal(state.devices.curtainsByRoom.bedroom_west.current, westPosition);
  assert.equal(state.devices.curtainsByRoom.bedroom_east.current, eastPosition);
  state = advance(state, 0.5);
  assert.ok(state.devices.curtainsByRoom.bedroom_west.current < westPosition);
  assert.equal(state.devices.curtainsByRoom.bedroom_east.current, eastPosition);
  assert.equal(state.devices.curtainsByRoom.bedroom_east.target, eastPosition);
  assert.equal(original.devices.curtainsByRoom.bedroom_west.target, 0.15);
});

test('all-room curtain commands target only actual included rooms and stop each at its own position', () => {
  let state = command(createInitialState(),
    { type: 'room', room: 'bedroom_east', value: false },
    { type: 'curtain', room: 'bedroom_west', value: 1 },
  );
  state = advance(state, 1);
  state = advance(command(state, { type: 'curtain', room: 'all', value: 1 }), 0.5);
  assert.ok(state.devices.curtainsByRoom.bedroom_west.current > state.devices.curtainsByRoom.living.current);
  state = command(state, { type: 'curtain-stop', room: 'all' });
  const positions = structuredClone(state.devices.curtainsByRoom);
  for (const room of systemRooms.curtains) assert.equal(positions[room].current, positions[room].target);
  assert.deepEqual(advance(state, 5).devices.curtainsByRoom, positions);
  state = advance(command(state, { type: 'curtain', room: 'all', value: 1 }), 5);
  for (const room of ['living', 'bedroom_west']) assert.equal(state.devices.curtainsByRoom[room].current, 1);
  assert.deepEqual(state.devices.curtainsByRoom.bedroom_east, { current: 0.15, target: 0.15 });
  for (const room of ['bathroom', 'entry', 'missing-room', '__proto__']) {
    state = command(state, { type: 'curtain', room, value: 0 }, { type: 'curtain-stop', room });
    assert.equal(Object.hasOwn(state.devices.curtainsByRoom, room), false);
    assert.equal(curtainAvailable(state, room), false);
    assert.ok(curtainUnavailableReason(state, room));
  }
  assert.equal(curtainAvailable(state, 'bathroom'), false);
  assert.equal(curtainAvailable(state, 'bedroom_west'), true);
});

test('legacy bathroom selection and curtain state cannot restore removed bathroom curtains', () => {
  const legacy = createInitialState();
  legacy.config.rooms = ['bathroom'];
  legacy.devices.curtainsByRoom.bathroom = { current: 0.4, target: 1 };
  freeze(legacy);
  assert.equal(systemAvailable(legacy, 'curtains'), false);
  assert.equal(curtainAvailable(legacy, 'bathroom'), false);
  assert.match(curtainUnavailableReason(legacy, 'bathroom'), /матовое стекло/);

  let state = command(legacy,
    { type: 'curtain', room: 'bathroom', value: 0 },
    { type: 'curtain-stop', room: 'bathroom' },
    { type: 'curtain', room: 'all', value: 1 },
    { type: 'curtain-stop', room: 'all' },
  );
  assert.equal(state.demo.actions.length, 0);
  for (const scenario of ['morning', 'away', 'home', 'cinema', 'night'] as const) {
    state = command(state, { type: 'scenario', scenario });
    assert.equal(Object.hasOwn(state.devices.curtainsByRoom, 'bathroom'), false);
    for (const mechanism of Object.values(state.devices.curtainsByRoom)) assert.deepEqual(mechanism, { current: 0.15, target: 0.15 });
  }
  assert.equal(Object.hasOwn(tick(legacy, 0.1).devices.curtainsByRoom, 'bathroom'), false);
  state = command(state, { type: 'reset' });
  assert.equal(state.devices.curtains, state.devices.curtainsByRoom.living);
  assert.deepEqual(state.config.rooms, ['bathroom'], 'bathroom remains a valid architectural room');
  assert.equal(Object.hasOwn(state.devices.curtainsByRoom, 'bathroom'), false);
  assert.deepEqual(exportSummary(state).systems.find(system => system.id === 'curtains')?.activeRooms, []);
  assert.deepEqual(legacy.devices.curtainsByRoom.bathroom, { current: 0.4, target: 1 }, 'legacy snapshot is not mutated');
});

test('excluding one moving room stops only that room and restoring it never resumes a stale target', () => {
  let state = advance(command(createInitialState(), { type: 'curtain', room: 'all', value: 1 }), 1);
  state = command(state, { type: 'room', room: 'bedroom_west', value: false });
  const stopped = { ...state.devices.curtainsByRoom.bedroom_west };
  assert.equal(stopped.current, stopped.target);
  state = advance(state, 5);
  assert.deepEqual(state.devices.curtainsByRoom.bedroom_west, stopped);
  assert.equal(state.devices.curtainsByRoom.bedroom_east.current, 1);
  state = command(state, { type: 'room', room: 'bedroom_west', value: true });
  assert.deepEqual(advance(state, 5).devices.curtainsByRoom.bedroom_west, stopped);
  state = command(state, { type: 'curtain', room: 'bedroom_west', value: 1 });
  assert.equal(advance(state, 5).devices.curtainsByRoom.bedroom_west.current, 1);
});

test('domestic curtain scenarios respect room scope while cinema changes only living curtains', () => {
  const start = command(createInitialState(), { type: 'room', room: 'bedroom_east', value: false });
  for (const [scenario, target] of [['morning', 0], ['away', 1], ['home', 0.15], ['night', 1]] as const) {
    const state = command(start, { type: 'scenario', scenario });
    for (const room of ['living', 'bedroom_west']) {
      assert.equal(state.devices.curtainsByRoom[room].target, target, `${scenario}: ${room}`);
      assert.equal(state.devices.curtainsByRoom[room].current, 0.15, 'a scenario does not teleport a mechanism');
    }
    assert.deepEqual(state.devices.curtainsByRoom.bedroom_east, start.devices.curtainsByRoom.bedroom_east);
  }
  let state = command(start, { type: 'scenario', scenario: 'cinema' });
  assert.equal(state.devices.curtainsByRoom.living.target, 1);
  for (const room of ['bedroom_west', 'bedroom_east']) assert.equal(state.devices.curtainsByRoom[room].target, 0.15);
  state = command(state, { type: 'room', room: 'living', value: false });
  const before = structuredClone(state.devices.curtainsByRoom);
  state = command(state, { type: 'scenario', scenario: 'cinema' }, { type: 'curtain', value: 1 });
  assert.deepEqual(state.devices.curtainsByRoom, before, 'default room stays living even when other room curtains are available');
  assert.equal(systemAvailable(state, 'curtains'), true);
});

test('excluding the curtain system stops every room and scenarios cannot restart it', () => {
  let state = advance(command(createInitialState(), { type: 'curtain', room: 'all', value: 1 }), 1);
  state = command(state, { type: 'system', system: 'curtains', value: false });
  const stopped = structuredClone(state.devices.curtainsByRoom);
  for (const mechanism of Object.values(stopped)) assert.equal(mechanism.current, mechanism.target);
  state = advance(command(state,
    { type: 'scenario', scenario: 'morning' },
    { type: 'curtain', room: 'all', value: 0 },
    { type: 'curtain', room: 'bedroom_west', value: 0 },
  ), 5);
  assert.deepEqual(state.devices.curtainsByRoom, stopped);
  state = command(state, { type: 'system', system: 'curtains', value: true });
  assert.deepEqual(advance(state, 5).devices.curtainsByRoom, stopped);
});

test('living compatibility alias remains synchronized through commands, ticks and reset', () => {
  let state = createInitialState();
  const assertAlias = () => {
    assert.equal(state.devices.curtains, state.devices.curtainsByRoom.living);
    assert.notEqual(state.devices.curtains, state.devices.curtainsByRoom.bedroom_west);
  };
  assertAlias();
  for (const update of [
    (current: HomeState) => command(current, { type: 'curtain', value: 1 }),
    (current: HomeState) => tick(current, 0.1),
    (current: HomeState) => command(current, { type: 'curtain', room: 'all', value: 0 }),
    (current: HomeState) => command(current, { type: 'reset' }),
  ]) { state = update(state); assertAlias(); }
  assert.deepEqual(state.devices.curtainsByRoom.bedroom_west, { current: 0.15, target: 0.15 });
});

test('all four lighting groups can be changed independently', () => {
  let state = createInitialState();
  for (const group of ['main', 'local', 'accent', 'exterior'] as const) {
    for (const value of [0, 0.5, 1]) {
      const before = { ...state.devices.lighting };
      state = command(state, { type: 'light', group, value });
      assert.equal(state.devices.lighting[group], value);
      for (const other of ['main', 'local', 'accent', 'exterior'] as const) {
        if (other !== group) assert.equal(state.devices.lighting[other], before[other]);
      }
    }
  }
});

test('water reaches a sensor before detection; actual closure stops inflow and retains the puddle', () => {
  let state = command(createInitialState(), { type: 'leak' });
  state = advance(state, 2);
  assert.ok(state.devices.water.amount < LEAK_SENSOR_AMOUNT);
  assert.equal(state.devices.water.phase, 'flowing');
  assert.equal(state.devices.water.latched, false);
  state = advance(state, 0.5);
  assert.ok(state.devices.water.amount >= LEAK_SENSOR_AMOUNT);
  assert.equal(state.devices.water.phase, 'flowing', 'detector has a confirmation delay');
  const phases = new Set<HomeState['devices']['water']['phase']>([state.devices.water.phase]);
  for (let index = 0; index < 160; index++) { state = tick(state, 0.05); phases.add(state.devices.water.phase); }
  assert.ok(phases.has('detected'));
  assert.ok(phases.has('closing'));
  assert.ok(phases.has('closed'));
  assert.equal(state.devices.water.valve.current, 0);
  assert.equal(state.devices.water.inflow, false);
  assert.equal(state.devices.water.leakActive, true, 'closure stops flow without repairing its source');
  assert.equal(state.devices.water.latched, true);
  const puddle = state.devices.water.amount;
  assert.ok(puddle > LEAK_SENSOR_AMOUNT);
  assert.equal(advance(state, 20).devices.water.amount, puddle);
});

test('all domestic scenarios and manual opening preserve an emergency latch', () => {
  const flooded = advance(command(createInitialState(), { type: 'leak' }), 10);
  assert.equal(flooded.devices.water.phase, 'closed');
  for (const scenario of ['morning', 'away', 'home', 'cinema', 'night'] as ScenarioId[]) {
    let state = advance(command(flooded, { type: 'scenario', scenario }), 5);
    state = command(state, { type: 'valve', value: 1 }, { type: 'leak' });
    assert.equal(state.devices.water.latched, true, scenario);
    assert.equal(state.devices.water.valve.current, 0, scenario);
    assert.equal(state.devices.water.valve.target, 0, scenario);
    assert.equal(state.devices.water.amount, flooded.devices.water.amount, scenario);
  }
  const reset = command(flooded, { type: 'system', system: 'media', value: false }, { type: 'reset' });
  assert.equal(reset.devices.water.latched, false);
  assert.equal(reset.devices.water.leakActive, false);
  assert.equal(reset.devices.water.amount, 0);
  assert.equal(reset.devices.water.valve.current, 1);
  assert.equal(reset.config.systems.media, false);
});

test('manual closure before sensor contact preserves the leak source and reopening resumes flow', () => {
  let state = advance(command(createInitialState(), { type: 'leak' }, { type: 'valve', value: 0 }), 4);
  const puddle = state.devices.water.amount;
  assert.ok(puddle > 0 && puddle < LEAK_SENSOR_AMOUNT);
  assert.equal(state.devices.water.latched, false);
  assert.equal(state.devices.water.valve.current, 0);
  assert.equal(state.devices.water.inflow, false);
  assert.equal(state.devices.water.leakActive, true);
  assert.equal(advance(state, 2).devices.water.amount, puddle, 'water does not grow behind a shut valve');

  const stopped = structuredClone(state.devices.water);
  state = command(state, { type: 'leak' });
  assert.deepEqual(state.devices.water, stopped, 'a second start does not replace the existing source');
  state = command(state, { type: 'valve', value: 1 });
  assert.equal(state.devices.water.valve.current, 0, 'opening remains a continuous mechanism');
  state = advance(state, 0.2);
  assert.equal(state.devices.water.inflow, true);
  assert.equal(state.devices.water.phase, 'flowing');
  assert.ok(state.devices.water.amount > puddle);
  state = advance(state, 10);
  assert.equal(state.devices.water.latched, true);
  assert.equal(state.devices.water.valve.current, 0);
  assert.equal(state.devices.water.inflow, false);
});

test('repeated leak starts cannot postpone a wet sensor confirmation', () => {
  let state = advance(command(createInitialState(), { type: 'leak' }), 2.5);
  assert.ok(state.devices.water.amount >= LEAK_SENSOR_AMOUNT);
  assert.equal(state.devices.water.latched, false);
  const wet = structuredClone(state.devices.water);
  state = command(state, ...Array.from({ length: 5 }, (): Command => ({ type: 'leak' })));
  assert.deepEqual(state.devices.water, wet);
  state = advance(state, 0.6);
  assert.equal(state.devices.water.latched, true, 'repeated button presses do not reset detection delay');
});

test('water-only demo reset preserves other devices, configuration and scenario and permits another leak', () => {
  let state = command(createInitialState(),
    { type: 'scenario', scenario: 'cinema' },
    { type: 'light', group: 'local', value: 0.77 },
    { type: 'curtain', room: 'bedroom_west', value: 0.8 },
    { type: 'setpoint', value: 25 },
    { type: 'room', room: 'bedroom_east', value: false },
    { type: 'close-water-away', value: true },
    { type: 'valve-fault', value: true }, { type: 'leak' },
  );
  state = freeze(advance(state, 7));
  assert.equal(state.devices.water.phase, 'fault');
  const { water: previousWater, ...otherDevices } = state.devices;
  const reset = command(state, { type: 'water-reset' });
  const { water: resetWater, ...resetOthers } = reset.devices;
  assert.deepEqual(resetWater, createInitialState().devices.water);
  assert.deepEqual(resetOthers, otherDevices);
  assert.deepEqual(reset.config, state.config);
  assert.equal(reset.demo.scenario, 'cinema');
  assert.equal(reset.demo.time, state.demo.time);
  assert.equal(previousWater.fault, true, 'reset preserves its frozen input');
  const repeated = advance(command(reset, { type: 'leak' }), 10);
  assert.equal(repeated.devices.water.latched, true);
  assert.equal(repeated.devices.water.phase, 'closed');
  assert.equal(repeated.devices.water.valve.current, 0);
  assert.ok(repeated.devices.water.amount > LEAK_SENSOR_AMOUNT);
});

test('acknowledging a security event cannot clear an active water emergency or reopen its valve', () => {
  let state = advance(command(createInitialState(),
    { type: 'security', value: 'armed' }, { type: 'door', value: true },
    { type: 'valve-fault', value: true }, { type: 'leak' },
  ), 5);
  const water = structuredClone(state.devices.water);
  assert.equal(water.latched, true);
  state = command(state, { type: 'acknowledge' }, { type: 'valve', value: 1 });
  assert.equal(state.devices.security.acknowledged, true);
  assert.deepEqual(state.devices.water, water);
  assert.equal(state.devices.water.valve.target, 0);
  assert.equal(state.devices.water.inflow, true, 'a failed open valve still leaks after acknowledgement');
});

test('legacy water snapshots recover unresolved wet sources without inventing a dry leak', () => {
  const dry = createInitialState();
  delete (dry.devices.water as Partial<typeof dry.devices.water>).leakActive;
  assert.equal(tick(freeze(dry), 0.1).devices.water.leakActive, false);
  const wet = advance(command(createInitialState(), { type: 'leak' }, { type: 'valve', value: 0 }), 4);
  delete (wet.devices.water as Partial<typeof wet.devices.water>).leakActive;
  const resumed = advance(command(freeze(wet), { type: 'valve', value: 1 }), 0.2);
  assert.equal(resumed.devices.water.leakActive, true);
  assert.equal(resumed.devices.water.inflow, true);
  assert.ok(resumed.devices.water.amount > wet.devices.water.amount);
});

test('a faulty valve never reports successful emergency closure or stops an open leak', () => {
  let state = advance(command(createInitialState(), { type: 'valve-fault', value: true }, { type: 'leak' }), 12);
  assert.equal(state.devices.water.phase, 'fault');
  assert.equal(state.devices.water.valve.target, 0);
  assert.equal(state.devices.water.valve.current, 1);
  assert.equal(state.devices.water.inflow, true);
  assert.equal(state.devices.water.latched, true);
  assert.ok(!state.demo.events.some(event => event.text.includes('Клапан фактически закрыт')));
  state = advance(command(state, { type: 'valve-fault', value: false }), 4);
  assert.equal(state.devices.water.phase, 'closed');
  assert.equal(state.devices.water.latched, true, 'repair does not release the safety latch');
});

test('valve reversal is continuous; water closure on away is opt-in', () => {
  let state = command(createInitialState(), { type: 'scenario', scenario: 'away' });
  assert.equal(state.devices.water.valve.target, 1);
  state = advance(command(state, { type: 'close-water-away', value: true }, { type: 'scenario', scenario: 'away' }), 1);
  const position = state.devices.water.valve.current;
  assert.ok(position > 0 && position < 1);
  state = command(state, { type: 'valve', value: 1 });
  assert.equal(state.devices.water.valve.current, position);
  assert.equal(advance(state, 4).devices.water.valve.current, 1);
  state = advance(command(createInitialState(), { type: 'leak' }, { type: 'valve', value: 0 }), 0.25);
  state = command(state, { type: 'valve', value: 0.5 });
  assert.equal(state.devices.water.phase, 'flowing', 'a revised partial target cannot retain a stale closing status');
});

test('sensor detection survives a manual close command that fails', () => {
  let state = advance(command(createInitialState(), { type: 'leak' }), 2.5);
  state = command(state, { type: 'valve-fault', value: true }, { type: 'valve', value: 0 });
  assert.equal(state.devices.water.phase, 'fault');
  state = advance(state, 3);
  assert.equal(state.devices.water.latched, true);
  assert.equal(state.devices.water.phase, 'fault');
  assert.equal(state.devices.water.inflow, true);
});

test('repairing a valve during an opening command does not leave a closing status', () => {
  let state = advance(command(createInitialState(), { type: 'valve', value: 0 }), 4);
  state = command(state, { type: 'valve-fault', value: true }, { type: 'valve', value: 1 }, { type: 'valve-fault', value: false });
  state = advance(state, 4);
  assert.equal(state.devices.water.valve.current, 1);
  assert.equal(state.devices.water.phase, 'dry');
});

test('excluded systems receive neither direct nor scenario commands', () => {
  let state = createInitialState();
  for (const system of Object.keys(state.config.systems) as SystemId[]) state = command(state, { type: 'system', system, value: false });
  const devices = structuredClone(state.devices);
  state = command(state,
    { type: 'scenario', scenario: 'cinema' }, { type: 'curtain', value: 1 },
    { type: 'light', group: 'main', value: 1 }, { type: 'heating', value: true },
    { type: 'valve', value: 0 }, { type: 'security', value: 'armed' }, { type: 'media', value: true },
  );
  assert.deepEqual(state.devices, devices);
  assert.equal(state.demo.actions.length, 0);
  assert.ok(state.demo.events.some(event => event.text.includes('Действие пропущено')));
});

test('room scope limits living systems while the office has its own electrical lighting', () => {
  let state = command(createInitialState(), { type: 'room', room: 'living', value: false }, { type: 'room', room: 'entry', value: false });
  const devices = structuredClone(state.devices);
  state = command(state, { type: 'scenario', scenario: 'cinema' });
  assert.deepEqual(state.devices, devices);
  assert.equal(systemAvailable(state, 'water'), false);
  assert.equal(state.demo.actions.length, 0);
  assert.ok(state.config.rooms.includes('bedroom_west'));
  state = command(state, { type: 'room', room: 'entry', value: true }, { type: 'scenario', scenario: 'away' });
  assert.equal(state.devices.security.mode, 'armed');
  assert.equal(state.devices.lighting.exterior, 0, 'the electrical plan switches all selected lighting off on away');
  assert.equal(state.devices.lighting.main, devices.lighting.main);
  assert.equal(state.devices.curtains.target, devices.curtains.target);
  assert.equal(state.devices.climate.setpoint, devices.climate.setpoint);
});

test('disabling a moving curtain stops it; removing water configuration cannot cancel a latched closure', () => {
  let state = advance(command(createInitialState(), { type: 'curtain', value: 1 }), 1);
  state = command(state, { type: 'system', system: 'curtains', value: false });
  assert.equal(state.devices.curtains.current, state.devices.curtains.target);
  assert.equal(advance(state, 5).devices.curtains.current, state.devices.curtains.current);
  state = advance(command(createInitialState(), { type: 'leak' }), 3.5);
  assert.equal(state.devices.water.latched, true);
  state = advance(command(state, { type: 'system', system: 'water', value: false }), 6);
  assert.equal(state.devices.water.valve.current, 0);
  assert.equal(state.devices.water.latched, true);
});

test('temperature is separate from its setpoint and pause depends on an included window sensor', () => {
  let state = command(createInitialState(), { type: 'setpoint', value: 26 });
  const temperature = state.devices.climate.temperature;
  assert.equal(temperature, 21.2);
  state = advance(state, 5);
  assert.ok(state.devices.climate.temperature > temperature);
  assert.ok(state.devices.climate.temperature < 26);
  state = command(state, { type: 'window', value: true });
  assert.equal(state.devices.climate.mode, 'window-pause');
  const beforePause = state.devices.climate.temperature;
  assert.ok(advance(state, 5).devices.climate.temperature < beforePause);
  state = command(state, { type: 'system', system: 'security', value: false });
  assert.equal(state.devices.climate.mode, 'heating', 'no sensor means no promised automatic window pause');
  state = command(state, { type: 'heating', value: false });
  assert.equal(state.devices.climate.mode, 'off');
});

test('door position is independent of security; night allows interior motion and detects the perimeter', () => {
  let state = command(createInitialState(), { type: 'door', value: true }, { type: 'security', value: 'armed' });
  assert.equal(state.devices.security.doorOpen, true);
  assert.equal(state.devices.security.event, 'door');
  state = command(state, { type: 'acknowledge' });
  assert.equal(state.devices.security.acknowledged, true);
  state = command(state, { type: 'door', value: false }, { type: 'security', value: 'disarmed' }, { type: 'security', value: 'night' }, { type: 'motion' });
  assert.equal(state.devices.security.event, 'none');
  state = command(state, { type: 'window', value: true });
  assert.equal(state.devices.security.event, 'window');
  assert.equal(state.devices.security.acknowledged, false);
  state = command(state, { type: 'system', system: 'security', value: false }, { type: 'door', value: true });
  assert.equal(state.devices.security.doorOpen, true, 'manual architectural action remains available without automation');
});

test('simulation dt, input ranges and event history remain bounded', () => {
  let state = createInitialState();
  for (const dt of [NaN, Infinity, -1, 0]) assert.equal(tick(state, dt), state);
  state = tick(state, 1_000_000);
  assert.equal(state.demo.time, MAX_STEP_SECONDS);
  state = command(state, { type: 'light', group: 'main', value: 5 }, { type: 'curtain', value: -2 }, { type: 'setpoint', value: 99 }, { type: 'volume', value: -9 });
  assert.equal(state.devices.lighting.main, 1);
  assert.equal(state.devices.curtains.target, 0);
  assert.equal(state.devices.climate.setpoint, 28);
  assert.equal(state.devices.media.volume, 0);
  state = command(state, { type: 'light', group: 'main', value: NaN });
  assert.equal(state.devices.lighting.main, 1);
  for (let index = 0; index < MAX_EVENTS * 3; index++) state = command(state, { type: 'daylight', value: index % 2 });
  assert.equal(state.demo.events.length, MAX_EVENTS);
  assert.equal(new Set(state.demo.events.map(event => event.id)).size, MAX_EVENTS);
  assert.ok(state.demo.events[0].id > 1);
});

test('summary snapshots selections without claiming submission, real equipment or an invented price', () => {
  const state = command(createInitialState(), { type: 'system', system: 'curtains', value: false }, { type: 'scenario', scenario: 'cinema' });
  const summary = exportSummary(state);
  assert.ok(!summary.systems.some(system => system.id === 'curtains'));
  assert.equal(summary.lastScenario?.id, 'cinema');
  assert.match(summary.delivery, /не отправлена/);
  assert.match(summary.commercialTerms, /уточняются/);
  summary.lastActions.push('mutate export');
  assert.ok(!state.demo.actions.includes('mutate export'));
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(summary)));
});
