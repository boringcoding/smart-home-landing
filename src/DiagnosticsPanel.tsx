import { memo, useEffect, useRef, useState } from 'react';
import { getDiagnosticReport, getDiagnosticsSnapshot, subscribeDiagnostics } from './diagnostics';

function summaryValue(value: unknown): string {
  if (value == null || value === '') return 'Нет данных';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try { return JSON.stringify(value) ?? 'См. полный отчёт'; } catch { return 'См. полный отчёт'; }
}

function errorSummary(detail: unknown): string {
  if (detail && typeof detail === 'object') {
    const record = detail as Record<string, unknown>;
    return summaryValue(record.message ?? record.error ?? record.detail ?? detail);
  }
  return summaryValue(detail);
}

export default memo(function DiagnosticsPanel({ openRequest = 0 }: { openRequest?: number }) {
  const [snapshot, setSnapshot] = useState(getDiagnosticsSnapshot);
  const [expanded, setExpanded] = useState(() => new URLSearchParams(window.location.search).get('debug') === '1' || snapshot.errorCount > 0);
  const [report, setReport] = useState(getDiagnosticReport);
  const [copying, setCopying] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);
  const reportElement = useRef<HTMLTextAreaElement>(null);
  const reportFocused = useRef(false);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const errorsSeen = useRef(snapshot.errorCount);

  useEffect(() => {
    const refresh = () => {
      const next = getDiagnosticsSnapshot();
      const newError = next.errorCount > errorsSeen.current;
      errorsSeen.current = next.errorCount;
      setSnapshot(next);
      if (newError) setExpanded(true);
      // Do not replace text while the user is selecting it for manual copying.
      if ((expandedRef.current || newError) && !reportFocused.current) setReport(getDiagnosticReport());
    };
    const unsubscribe = subscribeDiagnostics(refresh);
    refresh();
    return unsubscribe;
  }, []);
  useEffect(() => { if (expanded && !reportFocused.current) setReport(getDiagnosticReport()); }, [expanded]);
  useEffect(() => { if (openRequest > 0) setExpanded(true); }, [openRequest]);

  async function copyReport() {
    const currentReport = getDiagnosticReport();
    setReport(currentReport);
    setCopying(true);
    setFeedback(null);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
      await navigator.clipboard.writeText(currentReport);
      setFeedback({ error: false, text: 'Отчёт скопирован. Вставьте его в сообщение.' });
    } catch {
      setFeedback({ error: true, text: 'Браузер не разрешил копирование. Выделите текст отчёта ниже и скопируйте вручную либо скачайте файл.' });
      reportElement.current?.focus();
    } finally { setCopying(false); }
  }

  function downloadReport() {
    const currentReport = getDiagnosticReport();
    setReport(currentReport);
    let url: string | undefined;
    let anchor: HTMLAnchorElement | undefined;
    try {
      url = URL.createObjectURL(new Blob([currentReport], { type: 'text/plain;charset=utf-8' }));
      anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `smart-house-diagnostics-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
      anchor.hidden = true;
      document.body.appendChild(anchor);
      anchor.click();
      setFeedback({ error: false, text: 'Запрошено скачивание отчёта. Проверьте загрузки браузера; файл никуда не отправлен.' });
    } catch {
      setFeedback({ error: true, text: 'Не удалось начать скачивание. Скопируйте отчёт кнопкой или выделите текст вручную.' });
    } finally {
      anchor?.remove();
      if (url) { const downloadUrl = url; window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 10_000); }
    }
  }

  const lastError = snapshot.lastError ?? [...snapshot.events].reverse().find(event => event.level === 'error');
  const graphics = snapshot.graphics;
  const gpuInfo = graphics.gpu && typeof graphics.gpu === 'object' ? graphics.gpu as Record<string, unknown> : {};
  const gpu = graphics.unmaskedRenderer ?? graphics.renderer ?? gpuInfo.unmaskedRenderer ?? gpuInfo.renderer ?? graphics.gpu;
  const profile = snapshot.metrics?.profile ?? graphics.profile ?? graphics.quality;

  return <section id="diagnostics-panel" tabIndex={-1} className={`diagnostics-panel ${snapshot.errorCount ? 'has-errors' : ''}`} aria-label="Диагностика 3D">
    <button className="diagnostics-toggle" type="button" aria-expanded={expanded} aria-controls="diagnostics-content" onClick={() => setExpanded(value => !value)}>
      <span>Диагностика 3D</span><span className="diagnostics-count">Ошибок: {snapshot.errorCount}</span><span className="diagnostics-chevron" aria-hidden="true">{expanded ? '−' : '+'}</span>
    </button>
    {expanded && <div id="diagnostics-content" className="diagnostics-content">
      <p className="diagnostics-intro">Если 3D не работает, передайте этот отчёт вместе с описанием проблемы. Отчёт никуда не отправляется автоматически.</p>
      <dl className="diagnostics-summary">
        <div><dt>Сборка</dt><dd>{snapshot.build}</dd></div>
        <div><dt>Последний этап</dt><dd>{snapshot.lastStage || 'Запуск'}</dd></div>
        <div><dt>Последняя ошибка</dt><dd>{lastError ? `${lastError.stage}: ${errorSummary(lastError.detail).slice(0, 360)}` : 'Ошибки пока не зарегистрированы'}</dd></div>
        <div><dt>GPU</dt><dd>{summaryValue(gpu)}</dd></div>
        <div><dt>Профиль</dt><dd>{summaryValue(profile)}</dd></div>
      </dl>
      <div className="diagnostics-actions"><button type="button" className="primary" disabled={copying} onClick={() => void copyReport()}>{copying ? 'Копируем…' : 'Скопировать отчёт'}</button><button type="button" className="secondary" onClick={downloadReport}>Скачать отчёт</button></div>
      {feedback && <p className={`diagnostics-feedback ${feedback.error ? 'error' : ''}`} role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>}
      <label className="diagnostics-report-label" htmlFor="diagnostics-report">Полный отчёт · можно выделить и скопировать вручную</label>
      <textarea ref={reportElement} id="diagnostics-report" className="diagnostics-report" readOnly spellCheck={false} value={report} onFocus={() => { reportFocused.current = true; }} onBlur={() => { reportFocused.current = false; }} rows={9} />
    </div>}
  </section>;
});
