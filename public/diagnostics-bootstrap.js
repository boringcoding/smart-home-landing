(function () {
  'use strict';
  // Classic script, loaded before the module graph. Works without React/WebGL/CSS.
  var storageKey = 'smart-house.bootstrap.v1';
  var build = document.querySelector('meta[name="smart-house-build"]');
  var startedAt = new Date().toISOString();
  var events = [];
  var previous = null;
  var appReady = false;
  var pendingShow = false;
  var watchdog;
  function safe(value) {
    return String(value == null ? '' : value).replace(/https?:\/\/[^\s)"'<>]+/g, function (raw) {
      try { var url = new URL(raw); return url.origin + url.pathname; } catch (_) { return '[url]'; }
    }).slice(0, 2600);
  }
  try { previous = JSON.parse(sessionStorage.getItem(storageKey) || 'null'); } catch (_) {}
  function report() {
    if (api.report) return api.report();
    return 'SMART HOUSE · STARTUP DIAGNOSTICS\n' + JSON.stringify({
      reportVersion: 1, build: build ? build.content : 'unknown', startedAt: startedAt,
      page: location.origin + location.pathname, userAgent: navigator.userAgent,
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      online: navigator.onLine, lastStage: events.length ? events[events.length - 1].stage : 'bootstrap',
      events: events, previousSession: previous
    }, null, 2);
  }
  function refresh() {
    var textarea = document.getElementById('boot-diagnostics-report');
    if (textarea && document.activeElement !== textarea) textarea.value = report();
  }
  function showFallback() {
    pendingShow = true;
    var panel = document.getElementById('boot-diagnostics');
    if (panel) { panel.hidden = false; panel.open = true; refresh(); }
  }
  function log(stage, detail, level) {
    var entry = { time: new Date().toISOString(), stage: stage, detail: detail, level: level || 'info' };
    events.push(entry);
    if (events.length > 30) events.shift();
    try { sessionStorage.setItem(storageKey, JSON.stringify({ build: build ? build.content : 'unknown', startedAt: startedAt, events: events })); } catch (_) {}
    if (api.receive) api.receive(stage, detail, entry.level);
    if (entry.level === 'error' && !appReady) showFallback();
    refresh();
  }
  var api = window.__smartHouseDiagnostics = {
    events: events, previous: previous,
    appReady: function () {
      appReady = true;
      clearTimeout(watchdog);
      var panel = document.getElementById('boot-diagnostics');
      if (panel) panel.hidden = true;
    },
    showFallback: showFallback
  };
  window.addEventListener('error', function (event) {
    var target = event.target;
    if (target && target !== window) {
      log('resource.error', { tag: target.tagName, url: safe(target.src || target.href) }, 'error');
    } else {
      log('window.error', { message: safe(event.message), file: safe(event.filename), line: event.lineno, column: event.colno, stack: safe(event.error && event.error.stack) }, 'error');
    }
  }, true);
  window.addEventListener('unhandledrejection', function (event) {
    var reason = event.reason;
    log('promise.unhandled', { message: safe(reason && reason.message || reason), stack: safe(reason && reason.stack) }, 'error');
  });
  log('bootstrap.start', { readyState: document.readyState });
  watchdog = setTimeout(function () {
    if (!appReady) { log('bootstrap.still-loading', { seconds: 20, visibility: document.visibilityState }, 'warn'); showFallback(); }
  }, 20000);
  document.addEventListener('DOMContentLoaded', function () {
    var panel = document.getElementById('boot-diagnostics');
    if (!panel) return;
    panel.hidden = appReady;
    if (pendingShow || new URLSearchParams(location.search).get('debug') === '1') panel.open = true;
    panel.addEventListener('toggle', refresh);
    var textarea = document.getElementById('boot-diagnostics-report');
    var status = document.getElementById('boot-diagnostics-status');
    document.getElementById('boot-diagnostics-copy').addEventListener('click', function () {
      var value = report();
      textarea.value = value;
      function failed() { status.textContent = 'Копирование недоступно. Выделите текст отчёта ниже и скопируйте вручную или скачайте файл.'; textarea.focus(); }
      try {
        if (!navigator.clipboard || !navigator.clipboard.writeText) return failed();
        navigator.clipboard.writeText(value).then(function () { status.textContent = 'Отчёт скопирован. Вставьте его в сообщение.'; }, failed);
      } catch (_) { failed(); }
    });
    document.getElementById('boot-diagnostics-download').addEventListener('click', function () {
      try {
        var url = URL.createObjectURL(new Blob([report()], { type: 'text/plain;charset=utf-8' }));
        var anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'smart-house-startup-diagnostics.txt';
        document.body.appendChild(anchor); anchor.click(); anchor.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
        status.textContent = 'Запрошено скачивание отчёта. Проверьте загрузки браузера.';
      } catch (_) { status.textContent = 'Скачивание недоступно. Скопируйте текст отчёта вручную.'; }
    });
    refresh();
  });
})();
