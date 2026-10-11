import http from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX_BODY_BYTES = 64 * 1024;
const SYSTEMS = { lighting: 'Освещение', curtains: 'Шторы', climate: 'Отопление', water: 'Защита от протечки', security: 'Охрана', media: 'Мультимедиа' };
const ROOMS = { living: 'Гостиная и кухня', bedroom_west: 'Западная спальня', bedroom_east: 'Восточная спальня', bathroom: 'Санузел', entry: 'Прихожая' };
const SCENARIOS = { morning: 'Утро', away: 'Ушёл из дома', home: 'Вернулся', cinema: 'Кино', night: 'Ночь' };
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.map': 'application/json' };

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const plainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const within = (directory, target) => { const relative = path.relative(directory, target); return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)); };

function send(response, status, body, type = 'application/json; charset=utf-8', head = false) {
  const content = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  response.writeHead(status, {
    'Content-Type': type, 'Content-Length': Buffer.byteLength(content),
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  });
  response.end(head ? undefined : content);
}

function readBody(request) {
  if (Number(request.headers['content-length'] ?? 0) > MAX_BODY_BYTES) {
    request.resume();
    return Promise.reject(new HttpError(413, 'Размер заявки превышает 64 KiB.'));
  }
  return new Promise((resolve, reject) => {
    const parts = []; let bytes = 0; let rejected = false;
    request.on('data', chunk => {
      if (rejected) return;
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) { rejected = true; parts.length = 0; reject(new HttpError(413, 'Размер заявки превышает 64 KiB.')); return; }
      parts.push(chunk);
    });
    request.on('end', () => { if (!rejected) resolve(Buffer.concat(parts).toString('utf8')); });
    request.on('error', () => reject(new HttpError(400, 'Не удалось прочитать заявку.')));
    request.on('aborted', () => reject(new HttpError(400, 'Передача заявки прервана.')));
  });
}

function textField(value, label, min, max) {
  if (typeof value !== 'string') throw new HttpError(400, `Поле «${label}» должно содержать текст.`);
  const result = value.trim();
  if (result.length < min || result.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(result)) {
    throw new HttpError(400, `Проверьте поле «${label}»: от ${min} до ${max} символов.`);
  }
  return result;
}

function validateLead(payload) {
  if (!plainObject(payload) || !plainObject(payload.contact) || !plainObject(payload.configuration)) throw new HttpError(400, 'Нужны контактные данные и сводка комплектации.');
  const contact = {
    name: textField(payload.contact.name, 'Имя', 1, 120),
    channel: textField(payload.contact.channel, 'Телефон или электронная почта', 3, 180),
    comment: textField(payload.contact.comment ?? '', 'Комментарий', 0, 2000),
  };
  const configuration = payload.configuration;
  if (configuration.schemaVersion !== 1 || !Array.isArray(configuration.systems) || !Array.isArray(configuration.selectedRooms)) throw new HttpError(400, 'Некорректная версия или структура комплектации.');
  for (const [field, known] of [['systems', SYSTEMS], ['selectedRooms', ROOMS]]) {
    const entries = configuration[field];
    if (entries.length > Object.keys(known).length || entries.some(entry => !plainObject(entry) || typeof entry.id !== 'string' || !Object.hasOwn(known, entry.id)) || new Set(entries.map(entry => entry.id)).size !== entries.length) {
      throw new HttpError(400, 'Комплектация содержит неизвестные или повторяющиеся системы/помещения.');
    }
  }
  if (configuration.lastScenario != null && (!plainObject(configuration.lastScenario) || typeof configuration.lastScenario.id !== 'string' || !Object.hasOwn(SCENARIOS, configuration.lastScenario.id))) throw new HttpError(400, 'Неизвестный сценарий в комплектации.');
  return { contact, configuration };
}

function fromForm(form) {
  return {
    contact: { name: form.get('name'), channel: form.get('channel'), comment: form.get('comment') ?? '' },
    configuration: {
      schemaVersion: 1, project: 'Smart House · first.ifc', sourceModel: 'first.ifc',
      systems: form.getAll('system').map(id => ({ id, name: SYSTEMS[id], status: 'Проектное предложение' })),
      selectedRooms: form.getAll('room').map(id => ({ id, name: ROOMS[id] })),
      lastScenario: form.get('scenario') ? { id: form.get('scenario'), name: SCENARIOS[form.get('scenario')] } : null,
      closeWaterOnAway: form.get('closeWaterOnAway') === 'on',
      status: 'Оборудование и расстановка — проектное предложение.',
      commercialTerms: 'Стоимость и состав оборудования уточняются после обследования.',
      delivery: 'Локальная запись. В отдел продаж и внешним сервисам не отправлена.',
    },
  };
}

function formHTML({ form = new URLSearchParams(), error = '', id = '' } = {}) {
  const hasValues = [...form].length > 0;
  const checks = (entries, field) => Object.entries(entries).map(([key, label]) => `<label class="check"><input type="checkbox" name="${field}" value="${key}"${!hasValues || form.getAll(field).includes(key) ? ' checked' : ''}>${label}</label>`).join('');
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Локальная заявка · Smart House</title><style>body{margin:0;background:#f4f3ed;color:#273d36;font:16px/1.6 system-ui,sans-serif}main{max-width:760px;margin:48px auto;padding:28px}a{color:#455d46}h1{font-size:clamp(32px,6vw,52px);line-height:1.1;letter-spacing:-.04em}h2{font-size:20px;margin-top:30px}.note{color:#66716a}.box{padding:24px;border:1px solid #d8ddd0;border-radius:16px;background:#fff}.error{color:#8b3424;border:1px solid #d29d8f;padding:16px;border-radius:10px}.success{padding:24px;background:#e5ebd8;border-radius:14px}label{display:block;margin:16px 0 7px}input:not([type=checkbox]),textarea,select{box-sizing:border-box;width:100%;padding:12px;border:1px solid #bec7b7;border-radius:8px;background:#fff;font:inherit;color:inherit}.checks{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:4px 12px}.check{display:flex;gap:10px;align-items:center}.check input{width:18px;height:18px;accent-color:#526644}.button{display:inline-block;border:0;border-radius:8px;background:#526644;color:#fff;padding:14px 24px;margin-top:20px;font:inherit;cursor:pointer}input:focus-visible,textarea:focus-visible,select:focus-visible,a:focus-visible,button:focus-visible{outline:3px solid #9baf69;outline-offset:3px}.small{font-size:14px}code{overflow-wrap:anywhere}</style></head><body><main><a href="/">← Вернуться к дому</a><p class="note">SMART HOUSE · ЛОКАЛЬНЫЙ ПРОЕКТ</p><h1>Ваш дом начинается<br>с ваших пожеланий.</h1><p>Эта форма работает без 3D и JavaScript. Данные сохраняются на компьютере, где запущен локальный сервер. В отдел продаж они не отправляются.</p>${id ? `<div class="success" role="status"><strong>Заявка сохранена на локальном сервере.</strong><p>Номер: <code>${escapeHTML(id)}</code></p><p>Файл доступен владельцу проекта в папке <code>data/leads</code>. Отправки внешним получателям не было.</p><a href="/">Вернуться к демонстрации</a></div>` : `${error ? `<p class="error" role="alert">${escapeHTML(error)}</p>` : ''}<form method="post" action="/request" class="box"><label for="name">Как к вам обращаться</label><input id="name" name="name" required maxlength="120" autocomplete="name" value="${escapeHTML(form.get('name'))}"><label for="channel">Телефон или электронная почта</label><input id="channel" name="channel" required minlength="3" maxlength="180" autocomplete="email" value="${escapeHTML(form.get('channel'))}"><label for="comment">Что для вас важно</label><textarea id="comment" name="comment" maxlength="2000" rows="4">${escapeHTML(form.get('comment'))}</textarea><h2>Системы</h2><div class="checks">${checks(SYSTEMS, 'system')}</div><h2>Помещения</h2><div class="checks">${checks(ROOMS, 'room')}</div><p class="note small">Шторы предложены для гостиной и обеих спален. В санузле — матовое стекло без штор. Остальные управляемые системы демонстрируются в гостиной с кухней и входной зоне.</p><label for="scenario">Интересующий сценарий</label><select id="scenario" name="scenario"><option value="">Выбрать позже</option>${Object.entries(SCENARIOS).map(([key, label]) => `<option value="${key}"${form.get('scenario') === key ? ' selected' : ''}>${label}</option>`).join('')}</select><label class="check"><input type="checkbox" name="closeWaterOnAway"${form.get('closeWaterOnAway') === 'on' ? ' checked' : ''}>Перекрывать воду при уходе</label><p class="note small">Оборудование — проектное предложение. Стоимость определяется после уточнения проекта. Нажатие кнопки сохраняет контактные данные и комплектацию только в локальный файл.</p><button class="button" type="submit">Сохранить на локальном сервере</button></form>`}</main></body></html>`;
}

/** Native Node server; importing this module never binds a port or writes files. */
export function createLeadServer({ rootDirectory = projectRoot, dataDirectory = path.join(rootDirectory, 'data', 'leads'), allowedOrigins = [] } = {}) {
  const distDirectory = path.resolve(rootDirectory, 'dist');
  const storageDirectory = path.resolve(dataDirectory);
  const permittedOrigins = new Set(allowedOrigins);
  const server = http.createServer(async (request, response) => {
    let form;
    try {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 4174;
      const localOrigins = new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`, ...permittedOrigins]);
      const localHosts = new Set([...localOrigins].map(origin => new URL(origin).host));
      if (!request.headers.host || !localHosts.has(request.headers.host)) throw new HttpError(403, 'Доступ разрешён только через локальный адрес сервера.');
      const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
      let pathname;
      try { pathname = decodeURIComponent(url.pathname); } catch { throw new HttpError(400, 'Некорректный путь.'); }
      if (pathname.includes('\0') || pathname.includes('\\')) throw new HttpError(400, 'Некорректный путь.');
      const method = request.method ?? 'GET';
      if (method === 'POST') {
        const origin = request.headers.origin;
        if ((origin && !localOrigins.has(origin)) || request.headers['sec-fetch-site'] === 'cross-site') throw new HttpError(403, 'Заявка принимается только с локальной страницы проекта.');
        if (pathname !== '/api/leads' && pathname !== '/request') throw new HttpError(404, 'Страница не найдена.');
        const contentType = (request.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
        const expectedType = pathname === '/api/leads' ? 'application/json' : 'application/x-www-form-urlencoded';
        if (contentType !== expectedType) throw new HttpError(415, 'Неподдерживаемый формат заявки.');
        const body = await readBody(request);
        let payload;
        if (pathname === '/request') { form = new URLSearchParams(body); payload = fromForm(form); }
        else { try { payload = JSON.parse(body); } catch { throw new HttpError(400, 'Заявка содержит некорректный JSON.'); } }
        const validated = validateLead(payload);
        const id = randomUUID();
        const record = { schemaVersion: 1, id, createdAt: new Date().toISOString(), stored: 'local', status: 'local-only-not-sent-to-sales', ...validated };
        await fs.mkdir(storageDirectory, { recursive: true, mode: 0o700 });
        await fs.writeFile(path.join(storageDirectory, `${id}.json`), JSON.stringify(record, null, 2) + '\n', { encoding: 'utf8', flag: 'wx', mode: 0o600 });
        if (pathname === '/request') send(response, 201, formHTML({ id }), 'text/html; charset=utf-8');
        else send(response, 201, { ok: true, id, stored: 'local' });
        return;
      }
      if (method !== 'GET' && method !== 'HEAD') throw new HttpError(405, 'Метод не поддерживается.');
      const head = method === 'HEAD';
      if (pathname === '/request') { send(response, 200, formHTML(), 'text/html; charset=utf-8', head); return; }
      if (pathname.startsWith('/api/')) throw new HttpError(405, 'Для сохранения заявки нужен POST.');
      if (pathname.split('/').some(segment => segment.startsWith('.'))) throw new HttpError(403, 'Этот путь недоступен.');
      let filename = path.resolve(distDirectory, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!within(distDirectory, filename)) throw new HttpError(403, 'Этот путь недоступен.');
      try {
        const realDist = await fs.realpath(distDirectory);
        let realFile;
        try { realFile = await fs.realpath(filename); }
        catch (error) {
          if (error.code !== 'ENOENT' || path.extname(pathname)) throw error;
          filename = path.join(distDirectory, 'index.html');
          realFile = await fs.realpath(filename);
        }
        if (!within(realDist, realFile)) throw new HttpError(403, 'Этот путь недоступен.');
        if (!(await fs.stat(realFile)).isFile()) throw new HttpError(404, 'Файл не найден.');
        const body = await fs.readFile(realFile);
        send(response, 200, body, MIME[path.extname(realFile)] ?? 'application/octet-stream', head);
      } catch (error) {
        if (error.code === 'ENOENT') throw new HttpError(404, 'Файл не найден. Соберите сайт командой npm run build. Форма доступна по /request.');
        throw error;
      }
    } catch (error) {
      if (response.destroyed || response.headersSent) return;
      const status = error instanceof HttpError ? error.status : 500;
      const message = error instanceof HttpError ? error.message : 'Не удалось сохранить данные или открыть страницу. Повторите попытку; успешное сохранение не подтверждено.';
      if (form) send(response, status, formHTML({ form, error: message }), 'text/html; charset=utf-8');
      else send(response, status, { ok: false, error: message });
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  server.maxHeadersCount = 64;
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT ?? 4174);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT должен быть целым числом от 1 до 65535.');
  const allowedOrigins = process.env.SMART_HOUSE_DEV_ORIGIN ? [process.env.SMART_HOUSE_DEV_ORIGIN] : [];
  const server = createLeadServer({ allowedOrigins });
  server.on('error', error => { console.error(`Локальный сервер не запущен: ${error.message}`); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`Smart House: http://127.0.0.1:${port} · локальная форма /request · записи data/leads`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { server.close(() => process.exit(0)); server.closeIdleConnections(); });
}
