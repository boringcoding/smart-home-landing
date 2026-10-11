export type SystemId = 'lighting' | 'curtains' | 'climate' | 'water' | 'security' | 'media';
export type ScenarioId = 'morning' | 'away' | 'home' | 'cinema' | 'night';
export type ViewMode = 'house' | 'floor' | 'engineering' | 'interior';
export type RoomId = string;
export interface Configuration { systems: Record<SystemId, boolean>; rooms: string[]; closeWaterOnAway: boolean }
/** Normalized 0…1. Curtains: 0 open, 1 closed. Valve: 0 closed, 1 open. */
export interface Mechanism { current: number; target: number }
export interface DeviceState {
  lighting: { main: number; local: number; accent: number; exterior: number; kelvin: number };
  /** Compatibility alias for curtainsByRoom.living; both reference the same mechanism. */
  curtains: Mechanism;
  /** One independent mechanism per room with actual IFC windows. All its panels move together. */
  curtainsByRoom: Record<RoomId, Mechanism>;
  climate: { setpoint: number; temperature: number; enabled: boolean; mode: 'off' | 'heating' | 'holding' | 'window-pause' };
  // leakActive is the simulated defect; inflow is actual flow through the valve.
  water: { valve: Mechanism; fault: boolean; phase: 'dry' | 'flowing' | 'detected' | 'closing' | 'closed' | 'fault'; amount: number; elapsed: number; latched: boolean; leakActive: boolean; inflow: boolean };
  security: { mode: 'disarmed' | 'armed' | 'night'; doorOpen: boolean; windowOpen: boolean; event: 'none' | 'door' | 'window' | 'motion'; acknowledged: boolean };
  media: { playing: boolean; volume: number; muted: boolean };
}
export interface DemoState { time: number; daylight: number; scenario: ScenarioId | null; actions: string[]; events: { id: number; time: number; text: string }[] }
export type ElectricalFaultTarget = 'internet' | 'ha' | 'wb';
export interface ElectricalState {
  /** Actual simulated levels, normalized 0…1; canonical channels L01–L14. */
  lights: Record<string, number>;
  /** true means that this part of the simulated control path has failed. */
  faults: Record<ElectricalFaultTarget, boolean>;
}
export interface ElectricalUIState { enabled: boolean; layer: 'all' | 'sockets' | 'lighting' | 'switches' | 'network' | 'sensors' | 'routes'; routes: boolean; labels: boolean; selectedId: string | null; circuit: string | null }
export interface HomeState { config: Configuration; devices: DeviceState; demo: DemoState; electrical: ElectricalState }
export interface UIState { view: ViewMode; room: RoomId; system: SystemId; quality: 'auto' | 'high' | 'low'; reducedMotion: boolean; hideUI: boolean; cameraRevision: number; electrical?: ElectricalUIState }
export type Command =
  | { type: 'light'; group: 'main' | 'local' | 'accent' | 'exterior'; value: number }
  | { type: 'kelvin'; value: number }
  | { type: 'electrical-light'; id: string; value: number }
  | { type: 'electrical-button'; id: string; key: number; press?: 'short' | 'long' }
  | { type: 'electrical-fault'; target: ElectricalFaultTarget; value: boolean }
  | { type: 'curtain'; room?: RoomId | 'all'; value: number }
  | { type: 'curtain-stop'; room?: RoomId | 'all' }
  | { type: 'setpoint'; value: number }
  | { type: 'heating'; value: boolean }
  | { type: 'leak' }
  | { type: 'water-reset' }
  | { type: 'valve-fault'; value: boolean }
  | { type: 'valve'; value: number }
  | { type: 'security'; value: 'disarmed' | 'armed' | 'night' }
  | { type: 'door'; value: boolean }
  | { type: 'window'; value: boolean }
  | { type: 'motion' }
  | { type: 'acknowledge' }
  | { type: 'media'; value: boolean }
  | { type: 'volume'; value: number }
  | { type: 'mute'; value: boolean }
  | { type: 'system'; system: SystemId; value: boolean }
  | { type: 'room'; room: string; value: boolean }
  | { type: 'close-water-away'; value: boolean }
  | { type: 'daylight'; value: number }
  | { type: 'scenario'; scenario: ScenarioId }
  | { type: 'reset' };
export interface SceneMetrics { fps: number; p95: number; triangles: number; calls: number; geometries: number; textures: number; profile: string; loadedBytes: number; loadMs: number }
export interface SceneProps { state: HomeState; ui: UIState; onMetrics?: (metrics: SceneMetrics) => void; onSelect?: (system: SystemId, room?: string) => void; onElectricalSelect?: (id: string) => void; onStatus?: (status: 'loading' | 'ready' | 'error' | 'context-lost', detail?: string) => void }
