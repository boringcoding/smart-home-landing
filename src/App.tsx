import { Component, useCallback, useEffect, useRef, useState, type CSSProperties, type ErrorInfo, type KeyboardEvent, type ReactNode } from 'react';
import Scene from './scene/Scene';
import DiagnosticsPanel from './DiagnosticsPanel';
import { logDiagnostic } from './diagnostics';
import ElectricalPanel, { LightingChannels } from './ElectricalPanel';
import { ELECTRICAL_POINTS } from './electrical/plan';
import { createInitialState, reduceCommand, tick, exportSummary, scenarioNames, systemNames, systemAvailable, systemUnavailableReason, systemRooms, curtainAvailable, curtainUnavailableReason, electricalControlUnavailableReason } from './state';
import type { Command, HomeState, ScenarioId, SceneMetrics, SceneProps, SystemId, UIState } from './types';

const rooms = [
  { id: 'living', name: 'Гостиная и кухня', note: 'Три окна · шторы · потолок' },
  { id: 'bedroom_west', name: 'Кабинет', note: 'Шторы · отделка · потолок' },
  { id: 'bedroom_east', name: 'Спальня', note: 'Шторы · отделка · потолок' },
  { id: 'bathroom', name: 'Санузел', note: 'Матовое стекло · плитка' },
  { id: 'entry', name: 'Прихожая', note: 'Отделка · потолок · без окна' },
];
const electricalDefaults: NonNullable<UIState['electrical']> = { enabled: false, layer: 'all', routes: false, labels: true, selectedId: null, circuit: null };
const staticHosting = import.meta.env.VITE_STATIC_HOSTING === 'true';
// v1 belonged to the previous mobile renderer; its recovery flag must not pin this profile to low.
const graphicsSafeModeKey = 'smart-house.graphics-safe-mode.v2';
const graphicsQualityChoiceKey = 'smart-house.graphics-quality-choice.v2';
const localGraphicsDiagnostics = ['127.0.0.1', 'localhost'].includes(window.location.hostname) && new URLSearchParams(window.location.search).get('diagnostics') === '1';
function readGraphicsSafeMode() {
  try { return sessionStorage.getItem(graphicsSafeModeKey) === '1'; }
  catch { return false; }
}
function readGraphicsQuality(): UIState['quality'] {
  try {
    const value = sessionStorage.getItem(graphicsQualityChoiceKey);
    if (value === 'auto' || value === 'high' || value === 'low') return value;
  } catch { /* Rendering still works when session storage is unavailable. */ }
  return 'auto';
}
const systems: SystemId[] = ['lighting', 'curtains', 'climate', 'water', 'security', 'media'];
const scenarios: { id: ScenarioId; icon: string; caption: string }[] = [
  { id: 'morning', icon: 'sunrise', caption: 'Начать новый день' },
  { id: 'away', icon: 'away', caption: 'Всё под присмотром' },
  { id: 'home', icon: 'home', caption: 'Добро пожаловать' },
  { id: 'cinema', icon: 'play', caption: 'Время для себя' },
  { id: 'night', icon: 'moon', caption: 'Дом засыпает' },
];
const tabLabels: Record<SystemId, string> = { lighting: 'Свет', curtains: 'Шторы', climate: 'Климат', water: 'Вода', security: 'Охрана', media: 'Медиа' };
const systemCopy: Record<SystemId, { title: string; text: string }> = {
  lighting: { title: 'Свет создаёт настроение', text: 'От мягкого вечернего света до яркого рабочего. Каждая группа управляется отдельно.' },
  curtains: { title: 'Свет в каждой комнате', text: 'Управляйте шторами выбранной комнаты или всего дома. У каждого помещения своё положение полотен.' },
  climate: { title: 'Ваша температура комфорта', text: 'Задайте комфортную температуру. Посмотрите, как отопление приближает её к цели.' },
  water: { title: 'Спокойствие начинается дома', text: 'Проверьте путь от капли воды до сигнала датчика и автоматического перекрытия.' },
  security: { title: 'Дом под присмотром', text: 'Положение двери и окна независимо от охраны. Смоделируйте событие и проверьте реакцию.' },
  media: { title: 'Место для хорошего вечера', text: 'Включите экран, приглушите свет и устройтесь удобнее. Всё готово к вашему фильму.' },
};

function Icon({ name, size = 20, ...props }: { name: string; size?: number; className?: string }) {
  const shapes: Record<string, ReactNode> = {
    lighting: <><path d="M9 18h6M10 21h4M9 15c0-3-4-3-4-7a7 7 0 0 1 14 0c0 4-4 4-4 7z" /><path d="M12 1v2" /></>,
    curtains: <><path d="M3 4h18M5 4v16l6-3V4M19 4v16l-6-3V4M8 7v9M16 7v9" /></>,
    climate: <><path d="M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0Z" /><path d="M12 9v8M17 6h3M17 10h2" /></>,
    water: <><path d="M12 2S5 10 5 15a7 7 0 0 0 14 0c0-5-7-13-7-13Z" /><path d="M9 15c0 2 1 3 3 3" /></>,
    security: <><path d="m12 2 8 3v6c0 5-8 10-8 10S4 16 4 11V5z" /><path d="m8 11 3 3 5-6" /></>,
    media: <><rect x="2" y="4" width="20" height="14" rx="2" /><path d="M8 22h8M12 18v4m-2-15 5 4-5 4z" /></>,
    sunrise: <><path d="M2 18h20M4 22h16M6 18a6 6 0 0 1 12 0M12 2v4M3 7l3 3M21 7l-3 3" /></>,
    away: <><path d="M10 4H4v16h6M14 8l4 4-4 4M8 12h13" /></>,
    home: <><path d="m2 11 10-9 10 9M5 9v12h14V9M10 21v-7h4v7" /></>,
    play: <><circle cx="12" cy="12" r="10" /><path d="m10 8 6 4-6 4z" /></>,
    moon: <path d="M20 14A9 9 0 0 1 10 3a9 9 0 1 0 10 11Z" />,
    arrow: <><path d="M4 12h15m-6-6 6 6-6 6" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    settings: <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" fill="currentColor" /><circle cx="15" cy="17" r="3" fill="currentColor" /></>,
    expand: <><path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5" /></>,
    chevron: <path d="m6 9 6 6 6-6" />,
    check: <path d="m5 12 4 4L19 6" />,
    sound: <><path d="m11 4-6 5H2v6h3l6 5zM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14" /></>,
    info: <><circle cx="12" cy="12" r="10" /><path d="M12 11v6M12 7v.1" /></>,
    reset: <><path d="M3 10a9 9 0 1 1 1 7M3 3v7h7" /></>,
  };
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{shapes[name] ?? shapes.home}</svg>;
}

function initialState(): HomeState {
  const state = createInitialState();
  try {
    const saved = JSON.parse(localStorage.getItem('smart-house.configuration.v1') ?? 'null');
    if (saved && typeof saved === 'object') {
      for (const system of systems) if (typeof saved.systems?.[system] === 'boolean') state.config.systems[system] = saved.systems[system];
      if (Array.isArray(saved.rooms)) state.config.rooms = rooms.filter(room => saved.rooms.includes(room.id)).map(room => room.id);
      if (typeof saved.closeWaterOnAway === 'boolean') state.config.closeWaterOnAway = saved.closeWaterOnAway;
    }
  } catch { /* Unavailable storage leaves the in-memory demonstration usable. */ }
  return state;
}

class SceneBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    logDiagnostic('app.scene-boundary', { name: error.name, message: error.message, stack: error.stack, componentStack: info.componentStack }, 'error');
    this.props.onError();
  }
  render() { return this.state.failed ? null : this.props.children; }
}

function Slider({ label, value, onChange, min = 0, max = 100, step = 1, suffix = '%', note, disabled }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number; suffix?: string; note?: string; disabled?: boolean }) {
  return <label className="slider-control"><span className="control-label"><span>{label}</span><output>{Number(value.toFixed(1))}<small>{suffix}</small></output></span><input aria-label={label} type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={event => onChange(Number(event.target.value))} style={{ '--range-fill': `${(value - min) / (max - min) * 100}%` } as CSSProperties} />{note && <span className="control-note">{note}</span>}</label>;
}

function Toggle({ label, detail, checked, onChange, disabled }: { label: string; detail?: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <label className={`toggle-control ${disabled ? 'is-disabled' : ''}`}><span><strong>{label}</strong>{detail && <small>{detail}</small>}</span><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} disabled={disabled} /><span className="toggle-track" aria-hidden="true" /></label>;
}

function Modal({ title, eyebrow, children, onClose }: { title: string; eyebrow: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); const original = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = original; }; }, []);
  return <dialog className="modal" ref={ref} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }} aria-label={title}><div className="modal-inner"><button className="icon-button modal-close" aria-label="Закрыть диалог" onClick={onClose}><Icon name="close" /></button><span className="eyebrow">{eyebrow}</span><h2>{title}</h2>{children}</div></dialog>;
}

function downloadJSON(value: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function App() {
  const [state, setState] = useState(initialState);
  const [graphicsSafeMode, setGraphicsSafeMode] = useState(readGraphicsSafeMode);
  const [ui, setUI] = useState<UIState>(() => ({ view: 'floor', room: 'living', system: 'lighting', electrical: electricalDefaults, quality: graphicsSafeMode ? 'low' : readGraphicsQuality(), reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches, hideUI: false, cameraRevision: 0 }));
  const [modal, setModal] = useState<'config' | 'lead' | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [curtainScope, setCurtainScope] = useState<'room' | 'all'>('room');
  const [metrics, setMetrics] = useState<SceneMetrics>();
  const [sceneStatus, setSceneStatus] = useState<{ status: 'loading' | 'ready' | 'error' | 'context-lost'; detail?: string }>({ status: 'loading' });
  const [sceneEpoch, setSceneEpoch] = useState(0);
  const [sceneMounted, setSceneMounted] = useState(true);
  const [sceneRecovering, setSceneRecovering] = useState(false);
  const [diagnosticContextLossRequest, setDiagnosticContextLossRequest] = useState(0);
  const currentSceneEpoch = useRef(0);
  const autoRecoveryUsed = useRef(graphicsSafeMode);
  const [sound, setSound] = useState(false);
  const [soundError, setSoundError] = useState('');
  const [savedLead, setSavedLead] = useState<unknown>(null);
  const currentLead = useRef(savedLead);
  currentLead.current = savedLead;
  const [draftContact, setDraftContact] = useState<{ name: string; channel: string; comment: string }>(() => {
    try { const saved = JSON.parse(localStorage.getItem('smart-house.request.v1') ?? 'null'); const contact = saved?.contact; if (contact && typeof contact.name === 'string' && typeof contact.channel === 'string' && typeof contact.comment === 'string') return contact; } catch { /* A fresh draft works without storage. */ }
    return { name: '', channel: '', comment: '' };
  });
  const [storageError, setStorageError] = useState(false);
  const [draftClearFeedback, setDraftClearFeedback] = useState<{ error: boolean; message: string } | null>(null);
  const [serverSave, setServerSave] = useState<{ busy: boolean; id?: string; error?: string }>({ busy: false });
  const audioRef = useRef<{ context: AudioContext; gain: GainNode } | null>(null);
  const dispatch = useCallback((command: Command) => setState(previous => reduceCommand(previous, command)), []);
  const chooseQuality = useCallback((quality: UIState['quality']) => {
    logDiagnostic('ui.quality-choice', { quality });
    setUI(previous => ({ ...previous, quality }));
    setGraphicsSafeMode(false);
    try { sessionStorage.setItem(graphicsQualityChoiceKey, quality); } catch { /* This choice remains active for the current page. */ }
    try { sessionStorage.removeItem(graphicsSafeModeKey); } catch { /* Explicit selection still applies even if persistence is blocked. */ }
    // A manual choice does not replenish the one automatic recovery attempt in this page.
  }, []);
  const restartScene = useCallback((reason: 'manual' | 'context-lost' = 'manual') => {
    // Mark the old instance stale before unmounting: async model/status callbacks may still arrive.
    const nextEpoch = ++currentSceneEpoch.current;
    logDiagnostic('app.scene-retry', { reason, epoch: nextEpoch, quality: 'low' });
    setUI(previous => ({ ...previous, quality: 'low' }));
    setMetrics(undefined);
    setDiagnosticContextLossRequest(0);
    setSceneRecovering(true);
    setSceneStatus({ status: 'loading', detail: 'Перезапускаем 3D в экономичном режиме. Настройки дома сохранены.' });
    setSceneMounted(false);
    setSceneEpoch(nextEpoch);
  }, []);
  const onStatus: NonNullable<SceneProps['onStatus']> = useCallback((status, detail) => {
    if (sceneEpoch !== currentSceneEpoch.current) return;
    logDiagnostic(`app.scene.${status}`, { detail, epoch: sceneEpoch }, status === 'error' || status === 'context-lost' ? 'error' : 'info');
    if (status === 'context-lost') {
      const shouldRetry = !autoRecoveryUsed.current;
      autoRecoveryUsed.current = true;
      try { sessionStorage.setItem(graphicsSafeModeKey, '1'); } catch { /* Recovery still works in this page when storage is unavailable. */ }
      setGraphicsSafeMode(true);
      if (shouldRetry) { restartScene('context-lost'); return; }
      setUI(previous => ({ ...previous, quality: 'low' }));
    }
    if (status !== 'loading') setSceneRecovering(false);
    setSceneStatus({ status, detail });
  }, [sceneEpoch, restartScene]);
  const onMetrics: NonNullable<SceneProps['onMetrics']> = useCallback(value => {
    if (sceneEpoch === currentSceneEpoch.current) setMetrics(value);
  }, [sceneEpoch]);
  useEffect(() => {
    if (sceneMounted) return;
    // Leave a short gap for the previous WebGL context/resources to be released.
    const timer = window.setTimeout(() => {
      if (sceneEpoch === currentSceneEpoch.current) setSceneMounted(true);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [sceneMounted, sceneEpoch]);
  const onSelect = useCallback((system: SystemId, room?: string) => {
    setUI(previous => ({ ...previous, electrical: { ...electricalDefaults, ...previous.electrical, enabled: false }, system, ...(room ? { room, view: previous.view === 'house' ? 'floor' as const : previous.view } : {}), cameraRevision: previous.cameraRevision + 1 }));
    if (system === 'curtains' && room) setCurtainScope('room');
    setPanelOpen(true);
  }, []);
  const onElectricalSelect = useCallback((id: string) => {
    const point = ELECTRICAL_POINTS.find(item => item.id === id);
    setUI(previous => ({ ...previous, view: 'engineering', ...(point?.position ? { room: point.room } : {}), electrical: { ...electricalDefaults, ...previous.electrical, enabled: true, selectedId: id }, cameraRevision: previous.cameraRevision + 1 }));
    setPanelOpen(true);
  }, []);

  useEffect(() => {
    let last = performance.now();
    const timer = window.setInterval(() => { const now = performance.now(); const dt = Math.min((now - last) / 1000, .2); last = now; if (!document.hidden) setState(previous => tick(previous, dt)); }, 50);
    return () => clearInterval(timer);
  }, []);
  const configJSON = JSON.stringify(state.config);
  useEffect(() => { try { localStorage.setItem('smart-house.configuration.v1', configJSON); } catch { /* Configuration remains available for JSON export. */ } }, [configJSON]);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setUI(previous => ({ ...previous, reducedMotion: preference.matches }));
    preference.addEventListener('change', change); return () => preference.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.gain.gain.setTargetAtTime(sound && state.devices.media.playing && !state.devices.media.muted && state.config.systems.media ? state.devices.media.volume * .035 : 0, audio.context.currentTime, .1);
  }, [sound, state.devices.media, state.config.systems.media]);
  useEffect(() => () => { void audioRef.current?.context.close(); }, []);

  function clearDraft() {
    try { localStorage.removeItem('smart-house.request.v1'); }
    catch {
      setDraftClearFeedback({ error: true, message: 'Браузер не разрешил удалить черновик. Сохранённые данные и поля не очищены. Попробуйте ещё раз или удалите данные сайта в настройках браузера.' });
      return;
    }
    currentLead.current = null;
    setDraftContact({ name: '', channel: '', comment: '' });
    setSavedLead(null);
    setServerSave({ busy: false });
    setStorageError(false);
    setDraftClearFeedback({ error: false, message: staticHosting ? 'Черновик удалён из этого браузера. Комплектация сохранена. Скачанные JSON не удалены.' : 'Черновик удалён из этого браузера. Комплектация сохранена. Ранее сохранённые файлы на локальном сервере и скачанные JSON не удалены.' });
  }

  async function saveOnLocalServer() {
    if (staticHosting || !savedLead || serverSave.busy) return;
    const requestedLead = savedLead;
    setServerSave({ busy: true });
    try {
      const response = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestedLead) });
      const result = await response.json();
      if (response.status !== 201 || result.ok !== true || typeof result.id !== 'string') throw new Error('No storage confirmation');
      if (currentLead.current === requestedLead) setServerSave({ busy: false, id: result.id });
    } catch {
      if (currentLead.current === requestedLead) setServerSave({ busy: false, error: 'Локальный сервер не подтвердил сохранение. Черновик и скачивание файла остаются доступны.' });
    }
  }

  async function toggleSound() {
    if (sound) { setSound(false); return; }
    try {
      if (!audioRef.current) {
        const context = new AudioContext(); const gain = context.createGain(); gain.gain.value = 0; gain.connect(context.destination);
        for (const frequency of [130.81, 196]) { const oscillator = context.createOscillator(); oscillator.type = 'sine'; oscillator.frequency.value = frequency; oscillator.connect(gain); oscillator.start(); }
        audioRef.current = { context, gain };
      }
      await audioRef.current.context.resume(); setSound(true); setSoundError('');
    } catch { setSoundError('Браузер не разрешил звук. Управление экраном доступно.'); }
  }

  const { devices } = state;
  const activeSystem = ui.system;
  const curtainTarget = ui.room === 'all' || curtainScope === 'all' ? 'all' : ui.room;
  const availableCurtainRooms = systemRooms.curtains.filter(room => curtainAvailable(state, room));
  const curtainRoomIds = curtainTarget === 'all' ? systemRooms.curtains.filter(room => state.config.rooms.includes(room)) : systemRooms.curtains.includes(curtainTarget) ? [curtainTarget] : [];
  const curtainCurrent = curtainRoomIds.length ? curtainRoomIds.reduce((sum, room) => sum + state.devices.curtainsByRoom[room].current, 0) / curtainRoomIds.length : 0;
  const curtainPosition = curtainRoomIds.length ? curtainRoomIds.reduce((sum, room) => sum + state.devices.curtainsByRoom[room].target, 0) / curtainRoomIds.length : 0;
  const enabled = activeSystem === 'curtains' ? curtainTarget === 'all' ? availableCurtainRooms.length > 0 : curtainAvailable(state, curtainTarget) : systemAvailable(state, activeSystem);
  const noCurtainsInRoom = activeSystem === 'curtains' && curtainTarget !== 'all' && !systemRooms.curtains.includes(curtainTarget);
  const unavailableReason = noCurtainsInRoom ? curtainTarget === 'bathroom' ? 'Матовое стекло — шторы не нужны' : 'В прихожей нет окна и штор' : activeSystem === 'curtains' && curtainTarget !== 'all' ? curtainUnavailableReason(state, curtainTarget) : systemUnavailableReason(state, activeSystem);
  const scenarioUnavailableReason = electricalControlUnavailableReason(state);
  const selectedSystems = systems.filter(system => state.config.systems[system]);
  const activeRoom = rooms.find(room => room.id === ui.room) ?? { name: 'Весь этаж' };
  const waterLabels: Record<HomeState['devices']['water']['phase'], string> = { dry: 'Датчик сухой', flowing: 'Вода поступает', detected: 'Обнаружена вода', closing: 'Кран закрывается', closed: 'Вода перекрыта', fault: 'Привод крана неисправен' };
  const leakStartReason = devices.water.latched ? 'Авария активна. Нажмите «Сбросить протечку» для повторной демонстрации.' : devices.water.leakActive ? 'Протечка уже запущена. Для нового опыта сначала сбросьте её.' : devices.water.valve.current <= 0 ? 'Кран закрыт. Откройте воду перед запуском протечки.' : '';
  const climateLabels: Record<HomeState['devices']['climate']['mode'], string> = { off: 'Отопление выключено', heating: 'Отопление работает', holding: 'Температура достигнута', 'window-pause': 'Пауза: открыто окно' };

  function chooseRoom(room: string) {
    setUI(previous => ({ ...previous, room, view: previous.electrical?.enabled ? 'engineering' : room === 'all' || previous.view === 'house' ? 'floor' : previous.view, ...(previous.electrical?.enabled ? { electrical: { ...previous.electrical, selectedId: null } } : {}), cameraRevision: previous.cameraRevision + 1 }));
  }

  function changeElectrical(patch: Partial<NonNullable<UIState['electrical']>>) {
    setUI(previous => ({ ...previous, electrical: { ...electricalDefaults, ...previous.electrical, ...patch } }));
  }

  function openElectrical() {
    setUI(previous => ({ ...previous, room: previous.electrical?.enabled ? previous.room : 'all', view: 'engineering', electrical: { ...electricalDefaults, ...previous.electrical, enabled: true }, cameraRevision: previous.cameraRevision + 1 }));
    setPanelOpen(true);
  }

  function chooseView(view: UIState['view']) {
    setUI(previous => ({ ...previous, view, electrical: { ...electricalDefaults, ...previous.electrical, enabled: false }, room: view === 'interior' && previous.room === 'all' ? 'living' : previous.room, cameraRevision: previous.cameraRevision + 1 }));
  }

  function adjacentRoom(direction: number) {
    const index = rooms.findIndex(room => room.id === ui.room);
    const next = index < 0 ? direction > 0 ? 0 : rooms.length - 1 : (index + direction + rooms.length) % rooms.length;
    chooseRoom(rooms[next].id);
  }

  function overview() {
    setUI(previous => ({ ...previous, view: 'house', room: 'all', electrical: { ...electricalDefaults, ...previous.electrical, enabled: false }, cameraRevision: previous.cameraRevision + 1 }));
  }

  function inspectUnderSink() {
    setUI(previous => ({ ...previous, room: 'living', view: 'engineering', system: 'water', electrical: { ...electricalDefaults, ...previous.electrical, enabled: false }, cameraRevision: previous.cameraRevision + 1 }));
  }

  function navigateTabs(event: KeyboardEvent<HTMLDivElement>) {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const current = systems.indexOf(activeSystem);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? systems.length - 1 : (current + (event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1) + systems.length) % systems.length;
    setUI(previous => ({ ...previous, system: systems[next] }));
    document.getElementById(`tab-${systems[next]}`)?.focus();
  }

  function controls() {
    switch (activeSystem) {
      case 'lighting': return <LightingChannels state={state} dispatch={dispatch} room={ui.room} />;
      case 'curtains': return <>
        <div className="segmented curtain-scope" aria-label="Область управления шторами"><button aria-pressed={curtainTarget !== 'all'} onClick={() => { if (ui.room === 'all') chooseRoom('living'); setCurtainScope('room'); }}>Эта комната</button><button aria-pressed={curtainTarget === 'all'} onClick={() => setCurtainScope('all')}>Весь дом</button></div>
        <fieldset className="controls-fieldset curtain-controls" disabled={!enabled}>
          <div className="device-reading"><span>{curtainTarget === 'all' ? 'Среднее закрытие по комнатам' : 'Полотна закрыты на'}</span><strong>{curtainRoomIds.length ? <>{Math.round(curtainCurrent * 100)}<small>%</small></> : '—'}</strong></div>
          <Slider label={curtainTarget === 'all' ? 'Общее положение штор' : 'Положение штор в комнате'} value={curtainPosition * 100} onChange={value => dispatch({ type: 'curtain', room: curtainTarget, value: value / 100 })} note="0% — открыто · 100% — закрыто" />
          <div className="button-row"><button className="secondary" onClick={() => dispatch({ type: 'curtain', room: curtainTarget, value: 0 })}>Открыть</button><button className="secondary" onClick={() => dispatch({ type: 'curtain-stop', room: curtainTarget })}>Стоп</button><button className="secondary" onClick={() => dispatch({ type: 'curtain', room: curtainTarget, value: 1 })}>Закрыть</button></div>
        </fieldset>
        {curtainTarget === 'all' && <div className="curtain-room-list" aria-label="Положение штор по комнатам">{systemRooms.curtains.map(room => <button key={room} className={`curtain-room-row ${curtainAvailable(state, room) ? '' : 'unselected'}`} onClick={() => { chooseRoom(room); setCurtainScope('room'); }}><span>{rooms.find(item => item.id === room)?.name ?? room}</span><strong>{Math.round((devices.curtainsByRoom[room]?.current ?? 0) * 100)}%<small>{curtainAvailable(state, room) ? ' закрыто' : ' · не выбрано'}</small></strong><Icon name="arrow" size={13} /></button>)}</div>}
        <p className="soft-note">{curtainTarget === 'all' ? `Общая команда доступна для ${availableCurtainRooms.length} из ${systemRooms.curtains.length} помещений со шторами. Среднее положение рассчитано по выбранным помещениям; отдельные значения — выше.` : !systemRooms.curtains.includes(ui.room) ? 'Выберите гостиную, спальню или управление шторами всего дома.' : ui.room === 'living' ? 'Панорама: две тканевые шторы с закреплённым верхом по скатам. Анимация бокового сбора показывает ручные подхваты; привод не предусмотрен.' : 'Все окна этой комнаты управляются вместе. Остановка и смена направления сохраняют фактическое положение полотен.'}</p>
        {ui.view !== 'interior' && <button className="text-button inspect-curtains" onClick={() => { if (ui.room === 'all') chooseRoom(availableCurtainRooms[0] ?? 'living'); chooseView('interior'); }}>Осмотреть внутри <Icon name="arrow" size={15} /></button>}
      </>;
      case 'climate': return <>
        <div className="climate-reading"><div><span>Сейчас в модели</span><strong>{devices.climate.temperature.toFixed(1)}<small>°</small></strong></div><div><span>Ваш комфорт</span><strong>{devices.climate.setpoint}<small>°</small></strong></div></div>
        <Slider label="Желаемая температура" min={16} max={28} step={.5} value={devices.climate.setpoint} suffix="°C" onChange={value => dispatch({ type: 'setpoint', value })} />
        <Toggle label="Отопление" detail={climateLabels[devices.climate.mode]} checked={devices.climate.enabled} onChange={value => dispatch({ type: 'heating', value })} />
        <p className="soft-note">Температура моделируется в ускоренном времени. Это демонстрация логики, а не теплотехнический расчёт.</p>
      </>;
      case 'water': return <>
        <div className={`device-status ${devices.water.latched ? 'alert' : ''}`}><span className="status-dot" /><span>{waterLabels[devices.water.phase]}</span></div>
        <div className="data-row"><span>Кран под мойкой открыт</span><strong>{Math.round(devices.water.valve.current * 100)}%</strong></div>
        <div className="data-row"><span>Приток</span><strong>{devices.water.inflow ? 'Продолжается' : 'Нет'}</strong></div>
        <div className="data-row"><span>Источник протечки</span><strong>{devices.water.leakActive ? 'Не устранён' : 'Нет'}</strong></div>
        <button className="text-button full-width" onClick={inspectUnderSink}>Посмотреть под мойкой <Icon name="arrow" size={15} /></button>
        <fieldset className="controls-fieldset" disabled={!enabled}>
          <button className="primary full-width" disabled={Boolean(leakStartReason)} aria-describedby={leakStartReason ? 'water-start-reason' : undefined} onClick={() => { inspectUnderSink(); dispatch({ type: 'leak' }); }}><Icon name="water" />Смоделировать протечку под мойкой</button>
          {leakStartReason && <p id="water-start-reason" className="soft-note" role="status">{leakStartReason}</p>}
          <Toggle label="Неисправность привода крана" detail="Проверка отказа при открытии и перекрытии" checked={devices.water.fault} onChange={value => dispatch({ type: 'valve-fault', value })} />
          <div className="button-row"><button className="secondary" onClick={() => dispatch({ type: 'valve', value: 0 })}>Перекрыть воду</button><button className="secondary" disabled={devices.water.latched} onClick={() => dispatch({ type: 'valve', value: 1 })}>Открыть воду</button></div>
        </fieldset>
        {devices.water.latched && <p className="soft-note">Открытие воды заблокировано до сброса протечки. Бытовые сценарии не снимают аварию.</p>}
        <button className="secondary full-width" onClick={() => dispatch({ type: 'water-reset' })}><Icon name="reset" size={16} />Сбросить протечку</button>
        <p className="soft-note">Сброс убирает воду и неисправность, открывает кран для повторной демонстрации. Остальной дом и комплектация сохраняются.</p>
      </>;
      case 'security': return <>
        <div className="segmented compact" aria-label="Режим охраны">{([{ value: 'disarmed', label: 'Снята' }, { value: 'armed', label: 'Охрана' }, { value: 'night', label: 'Ночь' }] as const).map(item => <button key={item.value} aria-pressed={devices.security.mode === item.value} onClick={() => dispatch({ type: 'security', value: item.value })}>{item.label}</button>)}</div>
        <Toggle label="Датчик входной двери" detail={devices.security.doorOpen ? 'Открыта' : 'Закрыта'} checked={devices.security.doorOpen} onChange={value => dispatch({ type: 'door', value })} />
        <Toggle label="Датчик окна гостиной" detail={devices.security.windowOpen ? 'Открыто' : 'Закрыто'} checked={devices.security.windowOpen} onChange={value => dispatch({ type: 'window', value })} />
        <button className="secondary full-width" onClick={() => dispatch({ type: 'motion' })}>Смоделировать движение</button>
        {devices.security.event !== 'none' && !devices.security.acknowledged && <div className="alert-box"><p>Событие: {devices.security.event === 'door' ? 'открытие двери' : devices.security.event === 'window' ? 'открытие окна' : 'движение в доме'}.</p><button className="text-button" onClick={() => dispatch({ type: 'acknowledge' })}>Подтвердить событие <Icon name="check" size={15} /></button></div>}
        <p className="soft-note">Переключатели имитируют сигналы датчиков. Ночной режим следит за периметром и разрешает движение жильцов внутри.</p>
      </>;
      case 'media': return <>
        <Toggle label="Телевизор" detail={devices.media.playing ? 'Экран включён' : 'Экран выключен'} checked={devices.media.playing} onChange={value => dispatch({ type: 'media', value })} />
        <Slider label="Громкость" value={devices.media.volume * 100} onChange={value => dispatch({ type: 'volume', value: value / 100 })} />
        <Toggle label="Без звука" checked={devices.media.muted} onChange={value => dispatch({ type: 'mute', value })} />
        <button className="secondary full-width" aria-pressed={sound} onClick={() => void toggleSound()}><Icon name="sound" size={18} />{sound ? 'Выключить демозвук' : 'Включить демозвук'}</button>
        <p className="soft-note">Демонстрационный тон звучит только после вашего нажатия и при включённом телевизоре.</p>{soundError && <p role="status" className="soft-note">{soundError}</p>}
      </>;
    }
  }

  return <div className={`app ${ui.hideUI ? 'immersive' : ''}`}>
    <header className="site-header"><a className="brand" href="#" aria-label="Smart House — начало"><span className="brand-symbol"><Icon name="home" size={22} /></span><span>smart<span className="brand-light">house</span><span className="brand-dot">.</span></span></a><div className="header-description">Умный дом, который<br />чувствует ваш ритм</div><nav className="header-actions" aria-label="Основные действия"><span className="demo-label"><span />Интерактивный шоурум</span><button className="header-config" onClick={() => setModal('config')}>Моя комплектация <Icon name="settings" size={17} /></button><button className="primary header-cta" onClick={() => { setSavedLead(null); setServerSave({ busy: false }); setModal('lead'); }}>Обсудить проект <Icon name="arrow" size={17} /></button></nav></header>

    <main>
      <div className="intro"><div><div className="eyebrow"><span className="tiny-line" />ТЕХНОЛОГИИ ДЛЯ ЖИЗНИ</div><h1>Дом в вашем ритме<span>.</span></h1></div><p>Представьте свой обычный день.<br />Посмотрите, что дом может взять на себя.</p></div>
      <section className="showroom" aria-label="Интерактивная модель умного дома">
        <div className="scene-column">
          <DiagnosticsPanel />
          <nav className="room-navigation" aria-label="Помещения дома"><button className="electrical-mode-button" aria-pressed={Boolean(ui.electrical?.enabled)} onClick={openElectrical}><Icon name="lighting" size={16} />Электрика</button><span className="eyebrow">ОСМОТРИТЕ ДОМ</span><div className="room-chips"><button aria-pressed={ui.room === 'all'} onClick={() => chooseRoom('all')}>Весь этаж</button>{rooms.map(room => <button key={room.id} aria-pressed={ui.room === room.id} onClick={() => chooseRoom(room.id)}>{room.name}</button>)}</div></nav>
          <div className={`scene-wrapper ${sceneStatus.status === 'error' || sceneStatus.status === 'context-lost' ? 'scene-unavailable' : ''}`}>
            {sceneMounted && <SceneBoundary key={sceneEpoch} onError={() => { if (sceneEpoch !== currentSceneEpoch.current) return; setSceneRecovering(false); setSceneStatus({ status: 'error', detail: 'Ошибка графического модуля. Комплектация и заявка остаются доступны.' }); }}><Scene state={state} ui={ui} onMetrics={onMetrics} onSelect={onSelect} onElectricalSelect={onElectricalSelect} onStatus={onStatus} diagnosticContextLossRequest={localGraphicsDiagnostics ? diagnosticContextLossRequest : undefined} /></SceneBoundary>}
            <div className="scene-toolbar"><div className="segmented view-controls" aria-label="Режим просмотра">{([{ value: 'house', label: 'Дом' }, { value: 'floor', label: 'Этаж' }, { value: 'interior', label: 'Внутри' }, { value: 'engineering', label: 'Инженерия' }] as const).map(item => <button key={item.value} aria-pressed={!ui.electrical?.enabled && ui.view === item.value} onClick={() => chooseView(item.value)}>{item.label}</button>)}</div><button className="icon-button view-expand" title={ui.hideUI ? 'Показать управление' : 'Скрыть панели управления'} aria-label={ui.hideUI ? 'Показать управление' : 'Скрыть панели управления'} onClick={() => setUI(previous => ({ ...previous, hideUI: !previous.hideUI }))}><Icon name={ui.hideUI ? 'close' : 'expand'} /></button></div>
            {sceneStatus.status === 'loading' && <div className="scene-loading" role="status"><span className="loader" /><strong>{sceneRecovering ? 'Восстанавливаем 3D' : 'Готовим ваш дом'}</strong><span>{sceneRecovering ? 'Экономичное качество · настройки дома сохранены' : 'Загрузка 3D-модели'}</span></div>}
            {(sceneStatus.status === 'error' || sceneStatus.status === 'context-lost') && <div className="scene-fallback" role="status"><Icon name="home" size={36} /><h3>{sceneStatus.status === 'context-lost' ? '3D приостановлено' : 'Не удалось загрузить 3D'}</h3><p>{sceneStatus.status === 'context-lost' ? 'Браузер остановил графическую сессию. Настройки дома сохранены. Комплектация и черновик заявки остаются доступны.' : sceneStatus.detail ?? 'Настройте комплектацию и сохраните проект — эти действия остаются доступны.'}</p><button className="secondary" onClick={() => restartScene()}>Повторить 3D в экономичном режиме</button></div>}
            <div className="scene-bottom"><div className="scene-room"><span className="eyebrow">{ui.electrical?.enabled ? 'ЭЛЕКТРИЧЕСКИЙ ПЛАН' : ui.view === 'house' ? 'ВАШ ДОМ' : ui.view === 'engineering' ? 'СИСТЕМЫ ДОМА' : ui.view === 'interior' ? 'ВНУТРИ КОМНАТЫ' : 'ЭТАЖ 01'}</span><label className="room-select"><select aria-label="Выбрать помещение" value={ui.room} onChange={event => chooseRoom(event.target.value)}><option value="all">Весь этаж</option>{rooms.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}</select><Icon name="chevron" size={15} /></label></div><div className="scene-hint"><span className="orbit-mark">↔</span><span>{ui.view === 'interior' ? 'Осмотритесь вокруг' : 'Вращайте · приближайте'}<br /><span>{ui.electrical?.enabled ? 'Нажмите на точку' : ui.view === 'interior' ? 'Поднимите взгляд к потолку' : 'Нажмите на устройство'}</span></span></div></div>
            <div className="scene-corner-note">На основе вашей IFC-модели</div>
          </div>
          <div className="inspection-toolbar"><div className="room-stepper"><button className="icon-button" aria-label="Предыдущая комната" onClick={() => adjacentRoom(-1)}><Icon name="arrow" size={17} className="arrow-back" /></button><span>{activeRoom.name}</span><button className="icon-button" aria-label="Следующая комната" onClick={() => adjacentRoom(1)}><Icon name="arrow" size={17} /></button></div><label className="scene-quality-control"><span>Качество</span><select aria-label="Качество 3D рядом со сценой" value={ui.quality} onChange={event => chooseQuality(event.target.value as UIState['quality'])}><option value="auto">Авто</option><option value="high">Высокое</option><option value="low">Экономичное</option></select></label><div className="inspection-actions"><button className="text-button" onClick={() => setUI(previous => ({ ...previous, cameraRevision: previous.cameraRevision + 1 }))}><Icon name="reset" size={15} />Вернуть ракурс</button><button className="text-button" onClick={overview}><Icon name="home" size={15} />Дом целиком</button></div></div>
          <div className="scenario-section"><div className="section-label"><span>ОДНО НАЖАТИЕ — ЦЕЛЫЙ СЦЕНАРИЙ</span><span className="section-line" /></div><div className="scenario-list" aria-label="Сценарии умного дома">{scenarios.map(item => <button key={item.id} className={`scenario ${state.demo.scenario === item.id ? 'active' : ''}`} aria-pressed={state.demo.scenario === item.id} disabled={Boolean(scenarioUnavailableReason)} title={scenarioUnavailableReason || undefined} aria-describedby={scenarioUnavailableReason ? 'scenario-unavailable' : undefined} onClick={() => dispatch({ type: 'scenario', scenario: item.id })}><span className="scenario-icon"><Icon name={item.icon} size={23} /></span><span className="scenario-name">{item.id === 'away' ? 'Ушёл' : scenarioNames[item.id]}</span><span className="scenario-caption">{item.caption}</span><span className="scenario-indicator" /></button>)}</div>{scenarioUnavailableReason && <p className="scenario-unavailable" id="scenario-unavailable" role="status">{scenarioUnavailableReason}</p>}</div>
        </div>

        <aside className={`control-panel ${panelOpen ? '' : 'panel-collapsed'}`} aria-label="Управление системами">
          <button className="mobile-panel-toggle" aria-expanded={panelOpen} onClick={() => setPanelOpen(value => !value)}><span><Icon name={ui.electrical?.enabled ? 'lighting' : activeSystem} size={19} />{ui.electrical?.enabled ? 'Электрика дома' : 'Управление домом'}</span><Icon name="chevron" size={17} /></button>
          {ui.electrical?.enabled ? <ElectricalPanel state={state} ui={ui} onChange={changeElectrical} onRoom={chooseRoom} onSelect={onElectricalSelect} dispatch={dispatch} /> : <div className="panel-body"><div className="panel-heading"><span className="eyebrow">ВАШ КОМФОРТ</span><span className="live-status"><span />Демо</span></div><h2>Всё под рукой</h2>
          <div className="system-tabs" role="tablist" onKeyDown={navigateTabs} aria-label="Системы умного дома">{systems.map(system => <button key={system} role="tab" tabIndex={activeSystem === system ? 0 : -1} id={`tab-${system}`} aria-controls={`panel-${system}`} aria-selected={activeSystem === system} className={`${activeSystem === system ? 'active' : ''} ${!state.config.systems[system] ? 'excluded' : ''}`} onClick={() => setUI(previous => ({ ...previous, system }))}><Icon name={system} size={19} /><span>{tabLabels[system]}</span>{!state.config.systems[system] && <span className="excluded-dot" title="Не включено в комплектацию" />}</button>)}</div>
          <div className="system-panel" role="tabpanel" id={`panel-${activeSystem}`} aria-labelledby={`tab-${activeSystem}`}><h3>{systemCopy[activeSystem].title}</h3><p className="system-intro">{systemCopy[activeSystem].text}</p><div className="system-location"><span>{activeSystem === 'curtains' ? curtainTarget === 'all' ? 'Шторы во всех выбранных комнатах' : `Шторы · ${activeRoom.name}` : activeSystem === 'security' ? 'Периметр: гостиная и вход' : activeSystem === 'lighting' ? '14 каналов во всех помещениях' : 'Устройства в гостиной и кухне'}</span>{activeSystem !== 'curtains' && activeSystem !== 'lighting' && ui.room !== 'living' && <button className="text-button" onClick={() => chooseRoom('living')}>Показать <Icon name="arrow" size={13} /></button>}</div>{!enabled && <div className="excluded-message"><p>{unavailableReason}.</p>{!noCurtainsInRoom && <button className="text-button" onClick={() => setModal('config')}>Изменить комплектацию <Icon name="arrow" size={15} /></button>}</div>}<fieldset disabled={activeSystem !== 'curtains' && activeSystem !== 'water' && !enabled} className="controls-fieldset">{controls()}</fieldset></div>
          <div className="panel-footer"><span><span className="status-dot" />{selectedSystems.length} из 6 систем в проекте</span><button className="text-button" onClick={() => setModal('config')}>Настроить <Icon name="arrow" size={14} /></button></div></div>}
        </aside>
      </section>

      <section className="below-scene"><div className="scenario-feedback" aria-live="polite" aria-atomic="true"><span className="feedback-icon"><Icon name={state.demo.scenario ? scenarios.find(item => item.id === state.demo.scenario)!.icon : 'check'} size={20} /></span><div><strong>{state.demo.scenario ? `Сценарий «${scenarioNames[state.demo.scenario]}»` : 'Попробуйте управлять домом'}</strong><p>{state.demo.actions.length ? state.demo.actions.join(' · ') : 'Меняйте свет, открывайте шторы и исследуйте возможности систем.'}</p></div></div><button className="text-button reset-button" onClick={() => dispatch({ type: 'reset' })}><Icon name="reset" size={15} />Сбросить демо</button></section>

      <div className="project-note"><div><span className="eyebrow">ПРОЕКТИРУЕМ ПОД ВАС</span><p>Начните с привычек.<br /><span>Технологии мы подберём.</span></p></div><div className="project-note-right"><p>Выберите комнаты и системы.<br />Сохраните конфигурацию для обсуждения проекта.</p><button className="primary" onClick={() => { setSavedLead(null); setServerSave({ busy: false }); setModal('lead'); }}>Собрать мой проект <Icon name="arrow" size={18} /></button></div></div>

      <details className="technical-details"><summary><Icon name="info" size={15} />О демонстрации и 3D-сцене <Icon name="chevron" size={14} /></summary><div className="technical-grid"><div><h3>О модели</h3><p>Архитектура перенесена из предоставленного IFC. Интерьер, устройства и инженерные трассы — проектное предложение. Названия комнат назначены для демонстрации и требуют согласования.</p><p>Шторы подготовлены для пяти окон в гостиной, кабинете и спальне. В санузле — матовое стекло без штор, в прихожей нет окна. Отделка и матовые натяжные потолки предложены для всех пяти помещений. Освещение разделено на 14 каналов по всему дому; климат, защита воды и медиа демонстрируются в гостиной с кухней, охрана — также во входной зоне. Симуляция не подключена к реальным устройствам. Стоимость определяется после уточнения проекта.</p><p>Выбрано помещение: {activeRoom.name}. Камера не меняет состояние устройств. Управление системой действует на выбранную комплектацию.</p></div><div><h3>Параметры отображения</h3><label className="select-label">Качество<select aria-label="Качество сцены" value={ui.quality} onChange={event => chooseQuality(event.target.value as UIState['quality'])}><option value="auto">Автоматически</option><option value="high">Высокое</option><option value="low">Экономичное</option></select></label>{graphicsSafeMode && ui.quality === 'low' && <p className="control-note">После потери графической сессии включено экономичное качество. Вы можете снова выбрать «Авто» или «Высокое». Настройки дома не изменятся.</p>}{localGraphicsDiagnostics && <button className="secondary full-width" disabled={!sceneMounted || sceneStatus.status !== 'ready'} onClick={() => setDiagnosticContextLossRequest(value => value + 1)}>Проверить восстановление 3D</button>}<Toggle label="Уменьшенное движение" checked={ui.reducedMotion} onChange={value => setUI(previous => ({ ...previous, reducedMotion: value }))} /><Slider label="Дневной свет" value={state.demo.daylight * 100} onChange={value => dispatch({ type: 'daylight', value: value / 100 })} />{metrics && <dl className="metrics"><div><dt>FPS / p95 кадра</dt><dd>{Math.round(metrics.fps)} / {metrics.p95.toFixed(1)} мс</dd></div><div><dt>Треугольники / вызовы</dt><dd>{metrics.triangles.toLocaleString('ru-RU')} / {metrics.calls}</dd></div><div><dt>3D-ресурсы</dt><dd>{(metrics.loadedBytes / 1048576).toFixed(2)} MiB</dd></div><div><dt>Готовность сцены</dt><dd>{(metrics.loadMs / 1000).toFixed(2)} с</dd></div><div><dt>Профиль</dt><dd>{metrics.profile}</dd></div></dl>}<p className="control-note">Показатели текущей сессии. Они не подтверждают производительность на других устройствах.</p></div><div><h3>Журнал событий</h3><ol className="event-log">{state.demo.events.slice(-8).reverse().map(event => <li key={event.id}><time>{Math.floor(event.time / 60).toString().padStart(2, '0')}:{Math.floor(event.time % 60).toString().padStart(2, '0')}</time><span>{event.text}</span></li>)}</ol></div></div></details>
    </main>
    <footer className="site-footer"><span>smarthouse. <span>Технологии, которые становятся привычкой.</span></span><span>Интерактивная демонстрация · 2026</span></footer>

    {modal === 'config' && <Modal eyebrow="ВАШ БУДУЩИЙ ДОМ" title="Ничего лишнего. Только ваше." onClose={() => setModal(null)}><p className="modal-intro">Выберите системы и помещения. Шторы управляются по комнатам: гостиная, кабинет и спальня. В санузле — матовое стекло без штор. Освещение охватывает все помещения: 14 каналов. Климат, вода и медиа демонстрируются в гостиной с кухней, охрана — также во входной зоне. Отделка и потолки — проектное предложение для всех помещений.</p><h3 className="form-section-title">Системы</h3><div className="configuration-systems">{systems.map(system => <label key={system} className={`configuration-card ${state.config.systems[system] ? 'selected' : ''}`}><Icon name={system} size={22} /><span>{systemNames[system]}</span><input type="checkbox" checked={state.config.systems[system]} onChange={event => dispatch({ type: 'system', system, value: event.target.checked })} /><span className="checkbox-art" aria-hidden="true"><Icon name="check" size={12} /></span></label>)}</div><h3 className="form-section-title">Помещения</h3><div className="room-checks">{rooms.map(room => <label key={room.id}><input type="checkbox" checked={state.config.rooms.includes(room.id)} onChange={event => dispatch({ type: 'room', room: room.id, value: event.target.checked })} /><span>{room.name}<small>{room.note}</small></span></label>)}</div><Toggle label="Перекрывать воду, когда никого нет" detail="Дополнительное действие сценария «Ушёл»" checked={state.config.closeWaterOnAway} disabled={!state.config.systems.water} onChange={value => dispatch({ type: 'close-water-away', value })} /><div className="modal-bottom"><span>{selectedSystems.length} систем · {state.config.rooms.length} помещений<br /><small>Стоимость — после обсуждения проекта</small></span><button className="primary" onClick={() => setModal(null)}>Готово <Icon name="check" size={17} /></button></div></Modal>}

    {modal === 'lead' && <Modal eyebrow="ПЕРВЫЙ ШАГ К ВАШЕМУ ДОМУ" title={savedLead ? (storageError && !serverSave.id ? 'Скачайте ваш проект' : staticHosting ? 'Черновик сохранён в браузере' : 'Ваш проект сохранён') : 'Начнём с ваших пожеланий'} onClose={() => setModal(null)}>{savedLead ? <div className="lead-success"><span className="success-icon"><Icon name="check" size={30} /></span><p>{storageError ? 'Браузер не разрешил локальное сохранение. Скачайте файл, чтобы не потерять проект.' : 'Черновик сохранён на этом устройстве.'} {staticHosting ? 'Серверной отправки на этой странице нет. Скачайте черновик и передайте файл самостоятельно.' : 'Заявка ещё не отправлена: в демоверсии нет подключения к отделу продаж.'}</p><button className="primary full-width" onClick={() => downloadJSON(savedLead, 'smart-house-request.json')}>Скачать заявку и комплектацию <Icon name="arrow" size={17} /></button>{staticHosting ? <><button className="secondary full-width" onClick={() => downloadJSON(exportSummary(state), 'smart-house-configuration.json')}>Скачать комплектацию JSON</button><p className="server-save-note">Страница работает без сервера заявок. Этот файл содержит комплектацию без контактов.</p></> : <><button className="secondary full-width" disabled={serverSave.busy || Boolean(serverSave.id)} onClick={() => void saveOnLocalServer()}>{serverSave.busy ? 'Сохраняем…' : serverSave.id ? 'Сохранено на локальном сервере' : 'Сохранить на локальном сервере'}</button><p className="server-save-note" role="status">{serverSave.id ? `Файл сохранён, номер ${serverSave.id}. В отдел продаж ничего не отправлено.` : serverSave.error ?? 'Дополнительно можно записать заявку на локальном сервере этого проекта. Это не отправка специалисту.'}</p></>}<button className="text-button return-home" onClick={() => setModal(null)}>Вернуться к дому <Icon name="arrow" size={15} /></button></div> : <><p className="modal-intro">Сохраните выбранную комплектацию и контакты в черновик заявки. Файл можно передать специалисту удобным способом.</p><div className="lead-summary"><span className="eyebrow">В ВАШЕМ ПРОЕКТЕ</span><p>{selectedSystems.map(system => systemNames[system]).join(' · ') || 'Системы пока не выбраны'}</p><small>{rooms.filter(room => state.config.rooms.includes(room.id)).map(room => room.name).join(' · ') || 'Помещения пока не выбраны'}</small><button className="text-button" onClick={() => setModal('config')}>Изменить комплектацию <Icon name="arrow" size={14} /></button></div><form onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); if (!String(form.get('name')).trim() || !String(form.get('contact')).trim()) { const input = event.currentTarget.elements.namedItem(!String(form.get('name')).trim() ? 'name' : 'contact') as HTMLInputElement; input.setCustomValidity('Пожалуйста, заполните это поле.'); input.reportValidity(); return; } const lead = { createdAt: new Date().toISOString(), status: 'local-draft', contact: { name: String(form.get('name')).trim(), channel: String(form.get('contact')).trim(), comment: String(form.get('comment')).trim() }, configuration: exportSummary(state) }; try { localStorage.setItem('smart-house.request.v1', JSON.stringify(lead)); setStorageError(false); } catch { setStorageError(true); } setDraftContact(lead.contact); setDraftClearFeedback(null); setServerSave({ busy: false }); setSavedLead(lead); }}><label className="form-label">Как к вам обращаться<input name="name" value={draftContact.name} onChange={event => { const value = event.target.value; setDraftContact(previous => ({ ...previous, name: value })); }} onInput={event => event.currentTarget.setCustomValidity('')} placeholder="Ваше имя" required maxLength={120} autoComplete="name" /></label><label className="form-label">Телефон или электронная почта<input name="contact" value={draftContact.channel} onChange={event => { const value = event.target.value; setDraftContact(previous => ({ ...previous, channel: value })); }} onInput={event => event.currentTarget.setCustomValidity('')} placeholder="Для связи по проекту" required minLength={3} maxLength={180} autoComplete="email" /></label><label className="form-label">Что для вас важно <span>необязательно</span><textarea name="comment" value={draftContact.comment} onChange={event => { const value = event.target.value; setDraftContact(previous => ({ ...previous, comment: value })); }} placeholder="Например, управление светом и климатом в загородном доме" maxLength={2000} rows={3} /></label><p className="privacy-note">Данные сохраняются только в этом браузере и в скачанном вами файле. Отправки на сервер нет.</p><button className="primary full-width" type="submit">Сохранить черновик заявки <Icon name="arrow" size={17} /></button></form><button className="text-button download-config" onClick={() => downloadJSON(exportSummary(state), 'smart-house-configuration.json')}>Скачать комплектацию без контактов</button></>}{Boolean(savedLead || draftContact.name || draftContact.channel || draftContact.comment) && <div className="draft-clear-actions"><button className="text-button" onClick={clearDraft}>Очистить черновик</button><p>{staticHosting ? 'Удаляется только черновик в этом браузере. Скачанные JSON сохраняются.' : 'Удаляется только черновик в этом браузере. Файлы локального сервера и скачанные JSON сохраняются.'}</p></div>}{draftClearFeedback && <p className={`draft-clear-feedback ${draftClearFeedback.error ? 'error' : ''}`} role={draftClearFeedback.error ? 'alert' : 'status'}>{draftClearFeedback.message}</p>}</Modal>}
  </div>;
}
