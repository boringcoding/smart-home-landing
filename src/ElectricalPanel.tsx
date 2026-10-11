import { useEffect, useState, type CSSProperties } from 'react';
import type { Command, HomeState, UIState } from './types';
import { electricalButtonUnavailableReason, electricalLightUnavailableReason } from './state';
import { CIRCUITS, ELECTRICAL_POINTS, ELECTRICAL_ROUTES, LIGHT_GROUPS, NETWORK_LINKS, type ElectricalPoint } from './electrical/plan';

type ElectricalUI = NonNullable<UIState['electrical']>;
type Dispatch = (command: Command) => void;
const roomNames: Record<string, string> = { living: 'Гостиная и кухня', bedroom_west: 'Кабинет', bedroom_east: 'Спальня', bathroom: 'Санузел', entry: 'Прихожая и улица' };
const statusNames = { planned: 'Предложено', reserve: 'Резерв', optional: 'Опция', coordination: 'Уточнить' };
const layerNames: Record<ElectricalUI['layer'], string> = { all: 'Все', sockets: 'Розетки', lighting: 'Свет', switches: 'Клавиши', network: 'Сеть', sensors: 'Датчики', routes: 'Трассы' };
const routeNames: Record<string, string> = { power: 'Питание', lighting: 'Свет', signal: 'Сигнал', ethernet: 'Ethernet', rs485: 'RS-485' };
const mountingNames: Record<string, string> = { wall: 'На стене', ceiling: 'На потолке', floor: 'На полу', vertical: 'Вертикально на стене', 'vertical-wall-block': 'Вертикальный блок на стене', 'cabinet-proposal': 'Предлагаемая секция шкафа', 'cornice-reserve': 'Резерв у карниза', 'existing-fixture': 'У светильника в модели', 'inside-cabinet': 'Внутри тумбы', 'inside-panel': 'Внутри щита', 'low-route': 'Низкая подсветка пути' };
const pointKinds: Record<ElectricalUI['layer'], string[] | null> = { all: null, sockets: ['socket', 'load', 'curtain', 'panel'], lighting: ['light', 'emergency'], switches: ['switch'], network: ['ethernet', 'panel'], sensors: ['sensor', 'emergency'], routes: [] };

export function LightingChannels({ state, dispatch, room }: { state: HomeState; dispatch: Dispatch; room: string }) {
  const grouped = Object.keys(roomNames).map(id => ({ id, groups: LIGHT_GROUPS.filter(group => group.room === id) })).filter(item => item.groups.length);
  return <div className="lighting-channels">
    <p className="channel-intro">14 независимых каналов · раскройте нужное помещение. В схеме — включение и выключение; ползунок демонстрирует яркость. Диммеры требуют отдельного подбора.</p>
    {grouped.map(({ id, groups }) => <details key={`${id}:${room}`} className="channel-room" open={room === 'all' || room === id}>
      <summary><span>{roomNames[id]}</span><small>{groups.length} кан.</small></summary>
      <div className="channel-room-body">{groups.map(group => {
        const reason = electricalLightUnavailableReason(state, group.id);
        const value = Math.round((state.electrical.lights[group.id] ?? 0) * 100);
        return <div className={`electrical-channel ${reason ? 'unavailable' : ''}`} key={group.id}>
          <label className="slider-control"><span className="control-label"><span><b>{group.id}</b> {group.label}</span><output>{value}<small>%</small></output></span><input type="range" aria-label={`${group.id} ${group.label}`} min={0} max={100} step={1} value={value} disabled={Boolean(reason)} onChange={event => dispatch({ type: 'electrical-light', id: group.id, value: Number(event.target.value) / 100 })} style={{ '--range-fill': `${value}%` } as CSSProperties} /></label>
          <span className="channel-wiring">{group.circuit} · модуль {group.module}, канал {group.channel} · {group.controlledBy.join(', ')}</span>
          {reason && <p className="channel-reason">{reason}</p>}
        </div>;
      })}</div>
    </details>)}
  </div>;
}

function PointCard({ point, state, dispatch }: { point: ElectricalPoint; state: HomeState; dispatch: Dispatch }) {
  const circuitNames = point.circuits.map(id => CIRCUITS.find(circuit => circuit.id === id)).filter(Boolean);
  const links = NETWORK_LINKS.filter(link => link.pointId === point.id);
  return <article className="electrical-point-card" aria-label={`Точка ${point.id}`}>
    <div className="point-heading"><span className="point-code">{point.id}</span><span className={`point-status status-${point.status}`}>{statusNames[point.status]}</span></div>
    <h3>{point.label}</h3><p className="point-room">{roomNames[point.room] ?? point.room}</p>
    {!point.position && <p className="point-coordination">Требует привязки. Маркер в 3D не установлен.</p>}
    <p className="point-note">{point.note}</p>
    <dl className="point-facts">
      {point.sockets !== undefined && <div><dt>Гнёзд</dt><dd>{point.sockets}</dd></div>}
      {point.ports !== undefined && <div><dt>Портов Ethernet</dt><dd>{point.ports}</dd></div>}
      {point.heightNote && <div><dt>Высота</dt><dd>{point.heightNote}</dd></div>}
      {point.mounting && <div><dt>Размещение</dt><dd>{mountingNames[point.mounting] ?? 'Уточняется по проекту'}</dd></div>}
      {point.lightGroup && <div><dt>Канал света</dt><dd>{point.lightGroup}</dd></div>}
      {point.lightGroup && <div><dt>Сейчас</dt><dd>{Math.round((state.electrical.lights[point.lightGroup] ?? 0) * 100)}%</dd></div>}
      {point.controls?.length ? <div><dt>Управление</dt><dd>{point.controls.join(', ')}</dd></div> : null}
    </dl>
    {circuitNames.length > 0 && <div className="point-circuits">{circuitNames.map(circuit => <span key={circuit!.id}><b>{circuit!.id}</b> {circuit!.label}</span>)}</div>}
    {point.keys?.length ? <div className="physical-keys"><h4>Физические клавиши</h4><p>Имитируют нажатие на стене.</p>{point.keys.map(key => {
      const reason = electricalButtonUnavailableReason(state, point.id, key.key, 'short');
      const longReason = key.longPress ? electricalButtonUnavailableReason(state, point.id, key.key, 'long') : '';
      return <div className="physical-key" key={key.key}><button className="secondary full-width" disabled={Boolean(reason)} title={reason || key.label} onClick={() => dispatch({ type: 'electrical-button', id: point.id, key: key.key, press: 'short' })}><b>{key.key}</b><span>{key.label}<small>{key.targets.join(' · ') || (key.action === 'reserve' ? 'Резерв' : 'Сценарий')}</small></span></button>{reason && <p>{reason}</p>}{key.longPress && <><button className="key-long-press" disabled={Boolean(longReason)} onClick={() => dispatch({ type: 'electrical-button', id: point.id, key: key.key, press: 'long' })}>Удержать {key.key}: {key.longPress.label}</button>{longReason && <p>{longReason}</p>}</>}</div>;
    })}</div> : null}
    {links.length > 0 && <details className="electrical-subdetails"><summary>Отдельные сетевые линии · {links.length}</summary><ul>{links.map(link => <li key={link.id}><b>{link.port}</b> → {link.panelId}<span>{link.role} · {link.routeId}</span></li>)}</ul></details>}
  </article>;
}

export default function ElectricalPanel({ state, ui, onChange, onRoom, onSelect, dispatch }: { state: HomeState; ui: UIState; onChange: (patch: Partial<ElectricalUI>) => void; onRoom: (room: string) => void; onSelect: (id: string) => void; dispatch: Dispatch }) {
  const [search, setSearch] = useState('');
  const [section, setSection] = useState<'plan' | 'lights' | 'faults'>('plan');
  const settings = ui.electrical!;
  useEffect(() => { if (settings.selectedId) setSection('plan'); }, [settings.selectedId, ui.cameraRevision]);
  const chosenPoint = ELECTRICAL_POINTS.find(point => point.id === settings.selectedId);
  const chosenCircuit = CIRCUITS.find(circuit => circuit.id === settings.circuit);
  const query = search.trim().toLocaleLowerCase('ru');
  const visiblePoints = ELECTRICAL_POINTS.filter(point => (ui.room === 'all' || point.room === ui.room) && (!settings.circuit || point.circuits.includes(settings.circuit)) && (!pointKinds[settings.layer] || pointKinds[settings.layer]!.includes(point.kind)) && (!query || `${point.id} ${point.label} ${point.note}`.toLocaleLowerCase('ru').includes(query)));
  const visibleRoutes = ELECTRICAL_ROUTES.filter(route => (!settings.circuit || route.circuits.includes(settings.circuit)) && (ui.room === 'all' || route.pointIds.some(id => ELECTRICAL_POINTS.some(point => point.id === id && point.room === ui.room))));
  const faultCount = Object.values(state.electrical.faults).filter(Boolean).length;
  return <div className="panel-body electrical-panel">
    <div className="panel-heading"><span className="eyebrow">СХЕМА ДОМА</span><span className="live-status"><span />Проект</span></div><h2>Электрика</h2>
    <p className="electrical-intro">Точки, линии и местное управление</p>
    <div className="electrical-sections" role="group" aria-label="Раздел электрики">{([{ id: 'plan', label: 'План' }, { id: 'lights', label: '14 каналов' }, { id: 'faults', label: faultCount ? `Отказы · ${faultCount}` : 'Отказы' }] as const).map(item => <button key={item.id} aria-pressed={section === item.id} onClick={() => setSection(item.id)}>{item.label}</button>)}</div>
    {section === 'plan' && <>
      <div className="electrical-layer-filter" role="group" aria-label="Слой электрического плана">{Object.entries(layerNames).map(([value, label]) => <button key={value} aria-pressed={settings.layer === value} onClick={() => onChange({ layer: value as ElectricalUI['layer'], selectedId: null, ...(value === 'routes' ? { routes: true } : {}) })}>{label}</button>)}</div>
      <div className="electrical-display-options"><label><input type="checkbox" checked={settings.routes} onChange={event => onChange({ routes: event.target.checked })} />Трассы</label><label><input type="checkbox" checked={settings.labels} onChange={event => onChange({ labels: event.target.checked })} />Метки</label></div>
      <label className="select-label electrical-select">Помещение<select value={ui.room} onChange={event => { onRoom(event.target.value); onChange({ selectedId: null }); }}><option value="all">Весь дом</option>{Object.entries(roomNames).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label className="select-label electrical-select">Группа щита<select value={settings.circuit ?? ''} onChange={event => onChange({ circuit: event.target.value || null, selectedId: null })}><option value="">Все 25 групп</option>{CIRCUITS.map(circuit => <option key={circuit.id} value={circuit.id}>{circuit.id} · {circuit.label}</option>)}</select></label>
      {chosenCircuit && <div className="circuit-card"><div className="point-heading"><b>{chosenCircuit.id}</b><span className={`point-status status-${chosenCircuit.status}`}>{statusNames[chosenCircuit.status]}</span></div><h3>{chosenCircuit.label}</h3><p>{chosenCircuit.note}</p><details><summary>Исходные ориентиры линии</summary><p>{chosenCircuit.sourceCableNote}</p><p>{chosenCircuit.sourceProtectionNote}</p></details></div>}
      {chosenPoint && <><button className="point-clear" onClick={() => onChange({ selectedId: null })}>Закрыть карточку ×</button><PointCard point={chosenPoint} state={state} dispatch={dispatch} /></>}
      {settings.layer === 'routes' ? <div className="electrical-route-list"><p>Маршруты концептуальные, без назначения монтажных проходок.</p>{visibleRoutes.map(route => <details key={route.id}><summary><b>{route.id}</b><span>{routeNames[route.kind] ?? route.kind}</span></summary><p>{route.note}</p><small>{route.circuits.join(' · ')}{route.circuits.length ? ' · ' : ''}{route.pointIds.join(', ')}</small></details>)}{!visibleRoutes.length && <p className="electrical-empty">В этом фильтре трасс нет.</p>}</div> : <><label className="electrical-search">Найти точку<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Номер или назначение" /></label><div className="electrical-list-heading"><span>Точки · {visiblePoints.length}</span><small>Нажмите для подробностей</small></div><div className="electrical-point-list">{visiblePoints.map(point => <button key={point.id} aria-pressed={settings.selectedId === point.id} onClick={() => onSelect(point.id)}><b>{point.id}</b><span>{point.label}<small>{!point.position ? 'Требует привязки' : point.status === 'planned' ? roomNames[point.room] : statusNames[point.status]}</small></span><span aria-hidden="true">›</span></button>)}{!visiblePoints.length && <p className="electrical-empty">Точек с такими условиями нет. Измените помещение, группу или поиск.</p>}</div></>}
    </>}
    {section === 'lights' && <LightingChannels state={state} dispatch={dispatch} room={ui.room} />}
    {section === 'faults' && <div className="electrical-faults"><h3>Проверить местное управление</h3><p>Включите отказ, затем выберите S01–S10 в плане и нажмите физическую клавишу.</p>{([{ id: 'internet', label: 'Нет интернета', note: 'Местное управление продолжает работать.' }, { id: 'ha', label: 'Home Assistant остановлен', note: 'Управление светом и сценариями с экрана недоступно. Физические клавиши и сценарии WB сохраняются.' }, { id: 'wb', label: 'WB / RS-485 недоступны', note: 'Прямые клавиши света работают. Сценарные клавиши WB недоступны.' }] as const).map(fault => <label className={`electrical-fault-toggle ${state.electrical.faults[fault.id] ? 'active' : ''}`} key={fault.id}><span><strong>{fault.label}</strong><small>{fault.note}</small></span><input type="checkbox" checked={state.electrical.faults[fault.id]} onChange={event => dispatch({ type: 'electrical-fault', target: fault.id, value: event.target.checked })} /></label>)}<button className="secondary full-width" onClick={() => { setSection('plan'); onChange({ layer: 'switches', circuit: null, selectedId: null }); onRoom('all'); }}>Перейти к физическим клавишам</button><p className="soft-note">Показана логика исправных модулей при сбоях связи и контроллеров. Отказ самого модуля или питания 230 В здесь не моделируется.</p></div>}
    <footer className="electrical-panel-footer"><p>Предпроектная схема. Точки и прокладку уточняют в рабочем проекте.</p><a href="https://chatgpt.com/c/6acb52a6-8790-832a-89a7-0da9c48150a1" target="_blank" rel="noreferrer">Источник: «Схема умного дома» ↗</a></footer>
  </div>;
}
