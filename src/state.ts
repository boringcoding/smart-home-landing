import type { Command, HomeState, ScenarioId, SystemId } from './types';
import { ELECTRICAL_POINTS, LIGHT_GROUPS } from './electrical/plan';
import { copyElectricalState, createElectricalState, ELECTRICAL_BUTTON_BINDINGS, electricalGroupRooms, electricalPathReason, electricalScenarioLevels, LEGACY_LIGHT_CHANNELS, projectLegacyLighting } from './electrical/state';
import type { ElectricalSource } from './electrical/state';

// All positions, brightness levels, volume and daylight are normalized to 0…1.
// Curtains: 0 = open, 1 = closed. Water valve: 0 = closed, 1 = open.
export const MAX_STEP_SECONDS = 0.25;
export const MAX_EVENTS = 80;
export const LEAK_SENSOR_AMOUNT = 0.28;
export const LEAK_DETECTION_DELAY = 0.6;

export const systemNames: Record<SystemId, string> = {
  lighting: 'Освещение', curtains: 'Шторы', climate: 'Отопление',
  water: 'Защита от протечки', security: 'Охрана', media: 'Мультимедиа',
};
export const scenarioNames: Record<ScenarioId, string> = {
  morning: 'Утро', away: 'Ушёл из дома', home: 'Вернулся', cinema: 'Кино', night: 'Ночь',
};
export const roomNames: Record<string, string> = {
  living: 'Гостиная и кухня', entry: 'Прихожая', bathroom: 'Санузел',
  bedroom_west: 'Кабинет / гостевая', bedroom_east: 'Спальня',
};

// Device scope follows the actual proposed nodes in the scene. Selecting an
// architectural room does not silently invent equipment in that room.
export const systemRooms: Record<SystemId, readonly string[]> = {
  lighting: ['living', 'entry', 'bedroom_west', 'bedroom_east', 'bathroom'], curtains: ['living', 'bedroom_west', 'bedroom_east'], climate: ['living'],
  water: ['living'], security: ['living', 'entry'], media: ['living'],
};

const selected = (state: HomeState, room: string) => state.config.rooms.includes(room);
export const systemAvailable = (state: HomeState, system: SystemId) =>
  state.config.systems[system] && systemRooms[system].some(room => selected(state, room));
export const systemUnavailableReason = (state: HomeState, system: SystemId) => {
  if (!state.config.systems[system]) return `Система «${systemNames[system]}» исключена из комплектации`;
  if (!systemRooms[system].some(room => selected(state, room))) {
    return `Не выбрана зона оборудования: ${systemRooms[system].map(room => roomNames[room]).join(', ')}`;
  }
  return '';
};
export const curtainAvailable = (state: HomeState, room: string) =>
  state.config.systems.curtains && systemRooms.curtains.includes(room) && selected(state, room);
export const curtainUnavailableReason = (state: HomeState, room: string) => {
  if (!state.config.systems.curtains) return 'Система «Шторы» исключена из комплектации';
  if (room === 'bathroom') return 'Санузел: матовое стекло, шторы не предусмотрены';
  if (!systemRooms.curtains.includes(room)) return `${roomNames[room] ?? room}: проектных штор нет`;
  if (!selected(state, room)) return `${roomNames[room]}: помещение не включено в выбранные зоны`;
  return '';
};

export const electricalControlUnavailableReason = (state: HomeState) =>
  electricalPathReason(state.electrical ?? createElectricalState(state.devices.lighting), 'ui');

export function electricalLightUnavailableReason(state: HomeState, id: string, source: ElectricalSource = 'ui'): string {
  const rooms = electricalGroupRooms(id);
  if (rooms.length === 0) return `Неизвестная группа света: ${id}`;
  if (!state.config.systems.lighting) return 'Освещение исключено из комплектации';
  if (!rooms.some(room => selected(state, room))) return `Не выбрана зона света: ${rooms.map(room => roomNames[room]).join(', ')}`;
  return electricalPathReason(state.electrical ?? createElectricalState(state.devices.lighting), source);
}

export function electricalButtonUnavailableReason(state: HomeState, id: string, key: number, press: 'short' | 'long' = 'short'): string {
  const bindings = Object.hasOwn(ELECTRICAL_BUTTON_BINDINGS, id) ? ELECTRICAL_BUTTON_BINDINGS[id] : undefined;
  const binding = bindings?.find(candidate => candidate.key === key && candidate.press === press);
  if (!binding) return 'Такое действие клавиши не предусмотрено электрическим планом';
  if (binding.kind === 'reserve') return `Резерв: ${binding.note}. Оборудование и назначение ещё не согласованы`;
  if (!state.config.systems.lighting) return 'Кнопочный пост исключён вместе с освещением';
  const point = ELECTRICAL_POINTS.find(candidate => candidate.id === id);
  if (!point || !selected(state, point.room)) return 'Комната кнопочного поста исключена из комплектации';
  if (binding.kind === 'light') {
    if (!binding.lightIds?.length) return 'У клавиши не назначена группа света';
    return binding.lightIds.map(target => electricalLightUnavailableReason(state, target, 'physical')).find(Boolean) ?? '';
  }
  return electricalPathReason(state.electrical ?? createElectricalState(state.devices.lighting), 'wb');
}

const clamp = (value: number, min: number, max: number, fallback: number) =>
  Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
const stepToward = (current: number, target: number, amount: number) =>
  Math.abs(target - current) <= amount ? target : current + Math.sign(target - current) * amount;

function copy(state: HomeState): HomeState {
  // Persisted room selections describe architecture, not installed mechanisms.
  // Drop retired room mechanisms when reading an older in-memory/state snapshot.
  const curtainsByRoom = Object.fromEntries(systemRooms.curtains.map(room => [room, {
    ...(state.devices.curtainsByRoom?.[room] ?? (room === 'living' ? state.devices.curtains : { current: 0.15, target: 0.15 })),
  }]));
  const electrical = copyElectricalState(state.electrical, state.devices.lighting);
  return {
    config: { ...state.config, systems: { ...state.config.systems }, rooms: [...state.config.rooms] },
    devices: {
      lighting: projectLegacyLighting(electrical, state.devices.lighting), curtains: curtainsByRoom.living, curtainsByRoom,
      climate: { ...state.devices.climate },
      water: {
        ...state.devices.water, valve: { ...state.devices.water.valve },
        // Older snapshots only stored flow. Wet/latched snapshots still have an
        // unresolved simulated source, even when their valve is already closed.
        leakActive: state.devices.water.leakActive ?? (state.devices.water.inflow || state.devices.water.latched || state.devices.water.amount > 0),
      },
      security: { ...state.devices.security }, media: { ...state.devices.media },
    },
    demo: { ...state.demo, actions: [...state.demo.actions], events: [...state.demo.events] },
    electrical,
  };
}

function log(state: HomeState, text: string) {
  const id = (state.demo.events.at(-1)?.id ?? 0) + 1;
  state.demo.events = [...state.demo.events, { id, time: state.demo.time, text }].slice(-MAX_EVENTS);
}

function action(state: HomeState, text: string) {
  state.demo.actions.push(text);
  log(state, text);
}

function setElectricalLight(state: HomeState, id: string, value: number, source: ElectricalSource = 'ui') {
  const reason = electricalLightUnavailableReason(state, id, source);
  if (reason) { log(state, `Действие пропущено: ${reason}.`); return; }
  state.electrical.lights[id] = clamp(value, 0, 1, state.electrical.lights[id]);
  action(state, `${id} · ${LIGHT_GROUPS.find(group => group.id === id)!.label}: ${Math.round(state.electrical.lights[id] * 100)}%${source === 'physical' ? ', прямая местная кнопка' : ''}.`);
}

function pressElectricalButton(state: HomeState, id: string, key: number, press: 'short' | 'long') {
  const reason = electricalButtonUnavailableReason(state, id, key, press);
  if (reason) { log(state, `Кнопка ${id}.${key}: ${reason}.`); return; }
  const binding = ELECTRICAL_BUTTON_BINDINGS[id].find(candidate => candidate.key === key && candidate.press === press)!;
  if (binding.kind === 'scenario' && binding.scenario) runScenario(state, binding.scenario);
  else for (const target of binding.lightIds ?? []) setElectricalLight(state, target, state.electrical.lights[target] > 0 ? 0 : 1, 'physical');
}

function requireSystem(state: HomeState, system: SystemId, room?: string) {
  const reason = systemUnavailableReason(state, system);
  if (reason) { log(state, `Действие пропущено: ${reason}.`); return false; }
  if (room && !selected(state, room)) {
    log(state, `Действие пропущено: ${roomNames[room]} не включена в выбранные зоны.`);
    return false;
  }
  return true;
}

function commandCurtains(state: HomeState, room: string, value: number | 'stop') {
  if (room === 'all' && !requireSystem(state, 'curtains')) return;
  if (room !== 'all') {
    const reason = curtainUnavailableReason(state, room);
    if (reason) { log(state, `Действие пропущено: ${reason}.`); return; }
  }
  const rooms = room === 'all' ? systemRooms.curtains.filter(id => curtainAvailable(state, id)) : [room];
  for (const id of rooms) {
    const mechanism = state.devices.curtainsByRoom[id];
    mechanism.target = value === 'stop' ? mechanism.current : clamp(value, 0, 1, mechanism.target);
    action(state, `Шторы · ${roomNames[id]}: ${value === 'stop' ? 'остановлены на' : 'задано'} ${Math.round(mechanism.target * 100)}% закрытия.`);
  }
}

function stopExcludedCurtains(state: HomeState) {
  for (const room of systemRooms.curtains) {
    if (!curtainAvailable(state, room)) {
      const mechanism = state.devices.curtainsByRoom[room];
      mechanism.target = mechanism.current;
    }
  }
}

function climateMode(state: HomeState) {
  const climate = state.devices.climate;
  if (!systemAvailable(state, 'climate') || !climate.enabled) {
    climate.mode = 'off';
  } else if (state.config.systems.security && selected(state, 'living') && state.devices.security.windowOpen) {
    // The proposed opening sensor is part of the selected perimeter system.
    climate.mode = 'window-pause';
  } else {
    climate.mode = climate.temperature < climate.setpoint - 0.12 ? 'heating' : 'holding';
  }
}

function securityEvent(state: HomeState, event: 'door' | 'window' | 'motion') {
  const security = state.devices.security;
  const room = event === 'door' ? 'entry' : 'living';
  if (!state.config.systems.security || !selected(state, room) || security.mode === 'disarmed') return;
  if (event === 'motion' && security.mode === 'night') {
    log(state, 'Ночной режим: движение жильца в гостиной разрешено, тревоги нет.');
    return;
  }
  security.event = event;
  security.acknowledged = false;
  const source = { door: 'открыта входная дверь', window: 'открыто окно гостиной', motion: 'движение в гостиной' }[event];
  log(state, `Событие охраны: ${source}. Только локальная демонстрация.`);
}

function setSecurity(state: HomeState, value: 'disarmed' | 'armed' | 'night') {
  state.devices.security.mode = value;
  if (value === 'disarmed') {
    state.devices.security.event = 'none';
    state.devices.security.acknowledged = false;
  }
  action(state, `Охрана: ${{ disarmed: 'снята', armed: 'включена', night: 'ночной периметр' }[value]}.`);
  if (value !== 'disarmed') {
    if (state.devices.security.doorOpen) securityEvent(state, 'door');
    if (state.devices.security.windowOpen) securityEvent(state, 'window');
  }
}

function commandValve(state: HomeState, value: number) {
  const water = state.devices.water;
  const target = clamp(value, 0, 1, water.valve.target);
  if (water.latched && target > 0) {
    log(state, 'Открытие воды заблокировано аварией. Используйте «Сбросить протечку» в демонстрации.');
    return false;
  }
  water.valve.target = target;
  if (water.fault && water.valve.current !== target) {
    water.phase = 'fault';
    log(state, 'Команда клапану отправлена. Неисправность: подтверждения положения нет.');
  } else if (target === 0 && water.valve.current > 0) {
    water.phase = 'closing';
  } else if (target === 0) {
    water.phase = 'closed';
    water.inflow = false;
  } else if (!water.latched) {
    water.phase = water.inflow ? 'flowing' : 'dry';
  }
  action(state, `Клапан: задано ${Math.round(target * 100)}% открытия${water.fault ? ', без подтверждения' : ''}.`);
  return true;
}

export function createInitialState(): HomeState {
  const curtainsByRoom = Object.fromEntries(systemRooms.curtains.map(room => [room, { current: 0.15, target: 0.15 }]));
  const lighting = { main: 0.65, local: 0.4, accent: 0.3, exterior: 0.2, kelvin: 3000 };
  return {
    config: {
      systems: { lighting: true, curtains: true, climate: true, water: true, security: true, media: true },
      rooms: Object.keys(roomNames), closeWaterOnAway: false,
    },
    devices: {
      lighting,
      curtains: curtainsByRoom.living, curtainsByRoom,
      climate: { setpoint: 22, temperature: 21.2, enabled: true, mode: 'heating' },
      water: { valve: { current: 1, target: 1 }, fault: false, phase: 'dry', amount: 0, elapsed: 0, latched: false, leakActive: false, inflow: false },
      security: { mode: 'disarmed', doorOpen: false, windowOpen: false, event: 'none', acknowledged: false },
      media: { playing: false, volume: 0.3, muted: true },
    },
    demo: {
      time: 0, daylight: 0.72, scenario: null, actions: [],
      events: [{ id: 1, time: 0, text: 'Демонстрация запущена. Оборудование — проектное предложение; подключения к дому нет.' }],
    },
    electrical: createElectricalState(lighting),
  };
}

function runScenario(state: HomeState, scenario: ScenarioId) {
  state.demo.scenario = scenario;
  log(state, `Сценарий «${scenarioNames[scenario]}»: команды только выбранным системам и зонам.`);
  const settings = {
    morning: { kelvin: 3500, curtains: 0, setpoint: 22, security: 'disarmed', media: false },
    away: { curtains: 1, setpoint: 18, security: 'armed', media: false },
    home: { kelvin: 3000, curtains: 0.15, setpoint: 22, security: 'disarmed' },
    cinema: { kelvin: 2700, curtains: 1, media: true },
    night: { kelvin: 2700, curtains: 1, setpoint: 20, security: 'night', media: false },
  }[scenario] as { kelvin?: number; curtains: number; setpoint?: number; security?: 'disarmed' | 'armed' | 'night'; media?: boolean };

  if (requireSystem(state, 'lighting')) {
    for (const [id, value] of Object.entries(electricalScenarioLevels(scenario))) {
      // Cinema belongs to the living room; L14 is also a shared entry route.
      if (scenario === 'cinema' && !selected(state, 'living')) continue;
      setElectricalLight(state, id, value, 'wb');
    }
    if (selected(state, 'living') && settings.kelvin !== undefined) {
      state.devices.lighting.kelvin = settings.kelvin;
      action(state, `Температура света: ${settings.kelvin} K.`);
    }
  }
  commandCurtains(state, scenario === 'cinema' ? 'living' : 'all', settings.curtains);
  if (settings.setpoint !== undefined && requireSystem(state, 'climate')) {
    state.devices.climate.setpoint = settings.setpoint;
    state.devices.climate.enabled = true;
    action(state, `Отопление: уставка ${settings.setpoint} °C, температура изменяется постепенно.`);
  }
  if (settings.security !== undefined && requireSystem(state, 'security')) setSecurity(state, settings.security);
  if (settings.media !== undefined && requireSystem(state, 'media')) {
    state.devices.media.playing = settings.media;
    action(state, `Экран: ${settings.media ? 'воспроизведение' : 'выключен'}.`);
  }
  if (scenario === 'away' && state.config.closeWaterOnAway && requireSystem(state, 'water')) commandValve(state, 0);
  if (state.devices.water.latched) log(state, 'Аварийная блокировка воды сохранена; бытовой сценарий её не снимает.');
  if (state.demo.actions.length === 0) log(state, 'Нет доступных действий для выбранных систем и помещений.');
}

export function reduceCommand(previous: HomeState, command: Command): HomeState {
  if (command.type === 'reset') {
    const next = createInitialState();
    next.config = { ...previous.config, systems: { ...previous.config.systems }, rooms: [...previous.config.rooms] };
    climateMode(next);
    log(next, 'Демонстрация явно сброшена: авария снята, вода удалена, механизмы возвращены в исходное состояние. Комплектация сохранена.');
    return next;
  }
  const state = copy(previous);
  state.demo.actions = [];
  switch (command.type) {
    case 'light':
      if (requireSystem(state, 'lighting', command.group === 'exterior' ? 'entry' : 'living')) {
        for (const id of LEGACY_LIGHT_CHANNELS[command.group]) setElectricalLight(state, id, command.value);
      }
      break;
    case 'kelvin':
      if (requireSystem(state, 'lighting', 'living')) {
        const reason = electricalControlUnavailableReason(state);
        if (reason) { log(state, `Действие пропущено: ${reason}.`); break; }
        state.devices.lighting.kelvin = clamp(command.value, 2200, 6500, state.devices.lighting.kelvin);
        action(state, `Температура света: ${Math.round(state.devices.lighting.kelvin)} K.`);
      }
      break;
    case 'electrical-light':
      setElectricalLight(state, command.id, command.value);
      break;
    case 'electrical-button':
      pressElectricalButton(state, command.id, command.key, command.press ?? 'short');
      break;
    case 'electrical-fault':
      state.electrical.faults[command.target] = command.value;
      action(state, `${{ internet: 'Интернет', ha: 'Home Assistant', wb: 'Wiren Board' }[command.target]}: ${command.value ? 'моделируется отказ' : 'работа восстановлена'}. Прямые кнопки и автономная защита от протечки не зависят от этого состояния.`);
      break;
    case 'curtain':
      commandCurtains(state, command.room ?? 'living', command.value);
      break;
    case 'curtain-stop':
      commandCurtains(state, command.room ?? 'living', 'stop');
      break;
    case 'setpoint':
      if (requireSystem(state, 'climate')) {
        state.devices.climate.setpoint = clamp(command.value, 16, 28, state.devices.climate.setpoint);
        action(state, `Уставка отопления: ${state.devices.climate.setpoint} °C. Это не измеренная температура.`);
      }
      break;
    case 'heating':
      if (requireSystem(state, 'climate')) {
        state.devices.climate.enabled = command.value;
        action(state, `Отопление ${command.value ? 'включено' : 'выключено'}.`);
      }
      break;
    case 'leak':
      if (requireSystem(state, 'water')) {
        const water = state.devices.water;
        if (water.latched) log(state, 'Авария уже активна. Для нового опыта используйте «Сбросить протечку».');
        else if (water.leakActive) log(state, 'Источник протечки уже активен; повторная команда не перезапускает опыт. Для нового опыта используйте «Сбросить протечку».');
        else if (water.valve.current <= 0) log(state, 'Притока нет: клапан уже закрыт. Откройте его или сбросьте демонстрацию.');
        else {
          water.phase = water.fault && water.valve.current !== water.valve.target ? 'fault' : water.valve.target === 0 ? 'closing' : 'flowing';
          water.elapsed = 0; water.leakActive = true; water.inflow = true;
          action(state, 'Протечка у мойки: вода движется к напольному датчику.');
        }
      }
      break;
    case 'water-reset':
      state.devices.water = createInitialState().devices.water;
      action(state, 'Только демонстрация протечки сброшена: источник и вода удалены, авария и отказ сняты, клапан возвращён в открытое положение. Это не команда реальному оборудованию.');
      break;
    case 'valve-fault': {
      if (!requireSystem(state, 'water')) break;
      const water = state.devices.water;
      water.fault = command.value;
      if (command.value && water.valve.current !== water.valve.target) water.phase = 'fault';
      if (!command.value && water.phase === 'fault') {
        water.phase = water.valve.target < water.valve.current ? 'closing' : water.valve.current === 0 && water.valve.target === 0 ? 'closed' : water.inflow ? 'flowing' : 'dry';
        if (water.latched) { water.valve.target = 0; water.phase = water.valve.current === 0 ? 'closed' : 'closing'; }
      }
      action(state, command.value ? 'Моделируется отказ привода клапана. Подтверждение закрытия невозможно.' : 'Отказ клапана снят в демонстрации; фактическое положение ещё учитывается.');
      break;
    }
    case 'valve':
      if (requireSystem(state, 'water')) commandValve(state, command.value);
      break;
    case 'security':
      if (requireSystem(state, 'security')) setSecurity(state, command.value);
      break;
    case 'door':
      state.devices.security.doorOpen = command.value;
      action(state, `Дверь ${command.value ? 'открыта вручную' : 'закрыта вручную'}; состояние охраны независимо.`);
      if (command.value && !previous.devices.security.doorOpen) securityEvent(state, 'door');
      break;
    case 'window':
      state.devices.security.windowOpen = command.value;
      action(state, `Окно гостиной ${command.value ? 'открыто вручную' : 'закрыто вручную'}.`);
      if (command.value && !previous.devices.security.windowOpen) securityEvent(state, 'window');
      break;
    case 'motion':
      if (requireSystem(state, 'security', 'living')) {
        securityEvent(state, 'motion');
        if (state.devices.security.mode === 'disarmed') log(state, 'Движение в гостиной: охрана снята, тревоги нет.');
      }
      break;
    case 'acknowledge':
      if (state.devices.security.event !== 'none') {
        state.devices.security.acknowledged = true;
        action(state, 'Событие подтверждено посетителем локально. Уведомления владельцу не отправлялись.');
      }
      break;
    case 'media':
      if (requireSystem(state, 'media')) {
        state.devices.media.playing = command.value;
        action(state, `Экран ${command.value ? 'воспроизводит демонстрацию' : 'выключен'}.`);
      }
      break;
    case 'volume':
      if (requireSystem(state, 'media')) {
        state.devices.media.volume = clamp(command.value, 0, 1, state.devices.media.volume);
        action(state, `Громкость: ${Math.round(state.devices.media.volume * 100)}%.`);
      }
      break;
    case 'mute':
      if (requireSystem(state, 'media')) {
        state.devices.media.muted = command.value;
        action(state, command.value ? 'Звук выключен.' : 'Звук разрешён действием посетителя.');
      }
      break;
    case 'system':
      state.config.systems[command.system] = command.value;
      action(state, `Система «${systemNames[command.system]}» ${command.value ? 'включена в комплектацию' : 'исключена из комплектации'}. Архитектура сохраняется.`);
      break;
    case 'room':
      if (Object.hasOwn(roomNames, command.room)) {
        const rooms = new Set(state.config.rooms);
        command.value ? rooms.add(command.room) : rooms.delete(command.room);
        state.config.rooms = Object.keys(roomNames).filter(room => rooms.has(room));
        action(state, `${roomNames[command.room]}: ${command.value ? 'включена в' : 'исключена из'} области сценариев. Геометрия комнаты сохраняется.`);
      }
      break;
    case 'close-water-away':
      state.config.closeWaterOnAway = command.value;
      action(state, `Перекрытие воды при уходе ${command.value ? 'включено отдельной настройкой' : 'выключено'}.`);
      break;
    case 'daylight':
      state.demo.daylight = clamp(command.value, 0, 1, state.demo.daylight);
      action(state, `Дневной свет: ${Math.round(state.demo.daylight * 100)}%.`);
      break;
    case 'scenario': {
      const reason = electricalControlUnavailableReason(state);
      if (reason) log(state, `Сценарий не запущен: ${reason}.`);
      else runScenario(state, command.scenario);
      break;
    }
  }
  state.devices.lighting = projectLegacyLighting(state.electrical, state.devices.lighting);
  stopExcludedCurtains(state);
  // Changing configuration cannot cancel an already issued emergency closure.
  if (!systemAvailable(state, 'water') && !state.devices.water.latched) state.devices.water.valve.target = state.devices.water.valve.current;
  climateMode(state);
  return state;
}

export function tick(previous: HomeState, dtSeconds: number): HomeState {
  if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) return previous;
  const dt = Math.min(dtSeconds, MAX_STEP_SECONDS);
  const state = copy(previous);
  state.demo.time += dt;
  stopExcludedCurtains(state);
  for (const room of systemRooms.curtains) {
    if (!curtainAvailable(state, room)) continue;
    const mechanism = state.devices.curtainsByRoom[room];
    mechanism.current = stepToward(mechanism.current, mechanism.target, dt * 0.22);
  }

  const water = state.devices.water;
  const waterActive = systemAvailable(state, 'water');
  const previousPhase = water.phase;
  if ((waterActive || water.latched) && !water.fault) {
    water.valve.current = stepToward(water.valve.current, water.valve.target, dt * 0.3);
  }
  // Closing the valve stops flow, but does not repair its downstream leak.
  // Reopening before detection must resume the same unresolved source.
  water.inflow = water.leakActive && water.valve.current > 0;
  if (water.inflow && !water.latched && (water.phase === 'dry' || water.phase === 'closed')) water.phase = 'flowing';
  // A simulated leak is physical and keeps flowing after removing the automation.
  // A disabled detector does not issue a new automatic closing command.
  const priorAmount = water.amount;
  if (water.inflow && water.valve.current > 0) {
    water.amount = Math.min(1, water.amount + dt * 0.12 * water.valve.current);
  }
  // Water already touching the sensor can still be detected after manual valve
  // closure or a drive failure. The sensor is independent from the actuator.
  if (!water.latched && water.amount >= LEAK_SENSOR_AMOUNT && waterActive) {
    water.elapsed = priorAmount >= LEAK_SENSOR_AMOUNT ? water.elapsed + dt : 0;
    if (priorAmount < LEAK_SENSOR_AMOUNT) log(state, 'Вода достигла напольного датчика у мойки. Ожидание подтверждения обнаружения.');
    if (water.elapsed >= LEAK_DETECTION_DELAY) {
      water.phase = 'detected'; water.elapsed = 0; water.latched = true;
      log(state, 'Датчик подтвердил протечку. Аварийная блокировка активна.');
    }
  }
  if (previousPhase === 'detected' && water.phase === 'detected') {
    water.elapsed += dt;
    if (water.elapsed >= 0.45) {
      water.valve.target = 0; water.elapsed = 0;
      water.phase = water.fault ? 'fault' : 'closing';
      log(state, water.fault ? 'Команда на перекрытие отправлена. Отказ клапана: закрытие не подтверждено, приток продолжается.' : 'Команда на перекрытие отправлена. Клапан закрывается.');
    }
  }
  if (water.valve.current === 0) {
    water.inflow = false;
    if (water.phase === 'closing' || water.phase === 'flowing' || (water.latched && !water.fault)) {
      water.phase = 'closed';
      if (previousPhase !== 'closed') log(state, 'Клапан фактически закрыт. Приток остановлен; уже появившаяся вода остаётся на полу.');
    }
  }

  climateMode(state);
  const climate = state.devices.climate;
  if (climate.mode === 'heating') {
    climate.temperature = Math.min(climate.setpoint, climate.temperature + (climate.setpoint - climate.temperature + 0.3) * (1 - Math.exp(-dt / 32)));
  } else if (climate.mode !== 'holding' || climate.temperature > climate.setpoint + 0.12) {
    const ambient = 16 + state.demo.daylight * 3;
    const inertia = climate.mode === 'window-pause' ? 65 : 200;
    climate.temperature += (ambient - climate.temperature) * (1 - Math.exp(-dt / inertia));
  }
  climateMode(state);
  return state;
}

export function exportSummary(state: HomeState) {
  return {
    schemaVersion: 1,
    project: 'Smart House · first.ifc',
    status: 'Локальная демонстрация. Оборудование и расстановка — проектное предложение.',
    sourceModel: 'first.ifc',
    selectedRooms: state.config.rooms.map(id => ({ id, name: roomNames[id] ?? id })),
    systems: (Object.keys(systemNames) as SystemId[]).filter(id => state.config.systems[id]).map(id => ({
      id, name: systemNames[id], status: 'Проектное предложение',
      activeRooms: systemRooms[id].filter(room => selected(state, room)).map(room => ({ id: room, name: roomNames[room] })),
    })),
    closeWaterOnAway: state.config.closeWaterOnAway,
    lastScenario: state.demo.scenario ? { id: state.demo.scenario, name: scenarioNames[state.demo.scenario] } : null,
    lastActions: [...state.demo.actions],
    demonstration: {
      waterEmergencyLatched: state.devices.water.latched,
      waterValveFault: state.devices.water.fault,
      waterValveCurrent: state.devices.water.valve.current,
      temperatureC: Math.round(state.devices.climate.temperature * 10) / 10,
      heatingSetpointC: state.devices.climate.setpoint,
      electrical: {
        lights: { ...(state.electrical ?? createElectricalState(state.devices.lighting)).lights },
        faults: { ...(state.electrical ?? createElectricalState(state.devices.lighting)).faults },
        localSimulationOnly: true,
      },
    },
    commercialTerms: 'Состав оборудования и стоимость уточняются после обследования. Телевизор, акустика и подписки не включены автоматически.',
    delivery: 'Сводка сохранена локально. Заявка не отправлена; сервер и реальные устройства не подключены.',
  };
}
