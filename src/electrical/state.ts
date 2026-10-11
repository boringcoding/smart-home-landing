import type { DeviceState, ElectricalState, ScenarioId } from '../types';
import { ELECTRICAL_POINTS, LIGHT_GROUPS } from './plan';

type LegacyLighting = DeviceState['lighting'];
export type ElectricalSource = 'ui' | 'physical' | 'wb';
export interface ElectricalButtonBinding {
  key: number;
  press: 'short' | 'long';
  kind: 'light' | 'scenario' | 'reserve';
  lightId?: string;
  lightIds?: string[];
  scenario?: 'away' | 'night';
  note: string;
}

// Source mappings live in plan.ts; this adapter does not duplicate the schedule.
export const ELECTRICAL_BUTTON_BINDINGS: Record<string, ElectricalButtonBinding[]> = Object.fromEntries(
  ELECTRICAL_POINTS.filter(point => point.kind === 'switch').map(point => [point.id, (point.keys ?? []).flatMap(key => {
    const primary: ElectricalButtonBinding = {
      key: key.key, press: 'short',
      kind: key.action === 'toggle' ? 'light' : key.action === 'away' || key.action === 'night' ? 'scenario' : 'reserve',
      lightId: key.targets[0], lightIds: [...key.targets],
      scenario: key.action === 'away' || key.action === 'night' ? key.action : undefined,
      note: key.label,
    };
    return key.longPress ? [primary, {
      key: key.key, press: 'long' as const, kind: 'light' as const,
      lightId: key.longPress.targets[0], lightIds: [...key.longPress.targets], note: key.longPress.label,
    }] : [primary];
  })]),
);

export const LEGACY_LIGHT_CHANNELS = {
  main: ['L06'], local: ['L08'], accent: ['L14'], exterior: ['L12', 'L13'],
} as const;

const level = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;

export function createElectricalState(legacy?: LegacyLighting): ElectricalState {
  const lights = Object.fromEntries(LIGHT_GROUPS.map(group => [group.id, 0]));
  const source = legacy ?? { main: 0.65, local: 0.4, accent: 0.3, exterior: 0.2, kelvin: 3000 };
  for (const [group, ids] of Object.entries(LEGACY_LIGHT_CHANNELS)) {
    for (const id of ids) lights[id] = level(source[group as keyof typeof LEGACY_LIGHT_CHANNELS], 0);
  }
  return { lights, faults: { internet: false, ha: false, wb: false } };
}

export function copyElectricalState(snapshot: ElectricalState | undefined, legacy: LegacyLighting): ElectricalState {
  const state = createElectricalState(legacy);
  for (const group of LIGHT_GROUPS) state.lights[group.id] = level(snapshot?.lights?.[group.id], state.lights[group.id]);
  for (const target of ['internet', 'ha', 'wb'] as const) state.faults[target] = snapshot?.faults?.[target] === true;
  return state;
}

export function projectLegacyLighting(electrical: ElectricalState, previous: LegacyLighting): LegacyLighting {
  const result = { ...previous };
  for (const [group, ids] of Object.entries(LEGACY_LIGHT_CHANNELS)) {
    result[group as keyof typeof LEGACY_LIGHT_CHANNELS] = ids.reduce((sum, id) => sum + electrical.lights[id], 0) / ids.length;
  }
  return result;
}

export function electricalGroupRooms(id: string): string[] {
  const group = LIGHT_GROUPS.find(candidate => candidate.id === id);
  return group ? id === 'L14' ? ['living', 'entry'] : [group.room] : [];
}

export function electricalPathReason(electrical: ElectricalState, source: ElectricalSource): string {
  if (source === 'physical') return '';
  if (source === 'ui' && electrical.faults.ha) return 'Home Assistant недоступен; местные кнопки продолжают работать';
  if (electrical.faults.wb) return 'Wiren Board недоступен; прямое управление местными кнопками сохраняется';
  // Internet is not part of the local HA → WB → module path.
  return '';
}

/** Demo level presets; the electrical schedule does not specify lamp dimming curves. */
export function electricalScenarioLevels(scenario: ScenarioId): Record<string, number> {
  const allOff = Object.fromEntries(LIGHT_GROUPS.map(group => [group.id, 0]));
  switch (scenario) {
    case 'away': return allOff;
    case 'night': return { ...allOff, L14: 0.08 };
    case 'cinema': return { L06: 0.05, L07: 0.1, L08: 0, L14: 0.3 };
    case 'morning': return { L01: 0.65, L02: 0.1, L03: 0.65, L04: 0.15, L05: 0.15, L06: 0.65, L07: 0.6, L08: 0.2, L09: 0.6, L10: 0.65, L11: 0.5, L12: 0, L13: 0, L14: 0.1 };
    case 'home': return { L01: 0.65, L02: 0.4, L03: 0.65, L04: 0.25, L05: 0.25, L06: 0.8, L07: 0.6, L08: 0.7, L09: 0.8, L10: 0.7, L11: 0.6, L12: 0.6, L13: 0.6, L14: 0.45 };
  }
}
