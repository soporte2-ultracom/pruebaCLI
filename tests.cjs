'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { normalizeTasks, filterTasks, loadTasks, saveTasks } = require('./app.js');
let checks = 0;
function test(name, run) { run(); checks++; console.log(`PASS ${name}`); }
const sample = [
  { id: 'a', title: ' Uno ', description: 'Detalle', completed: false },
  { id: 'b', title: 'Dos', description: '', completed: true }
];
test('Normaliza y descarta registros inválidos y duplicados', () => {
  const result = normalizeTasks([...sample, null, { ...sample[0] }, { id: 'c', title: ' ', completed: false }]);
  assert.equal(result.length, 2);
  assert.equal(result[0].title, 'Uno');
  assert.throws(() => normalizeTasks({}));
});
test('Filtros Todas, Pendientes y Completadas', () => {
  assert.equal(filterTasks(sample, 'all').length, 2);
  assert.equal(filterTasks(sample, 'pending')[0].id, 'a');
  assert.equal(filterTasks(sample, 'completed')[0].id, 'b');
});
test('Guarda y carga tareas; JSON corrupto y almacenamiento bloqueado', () => {
  let raw = null;
  const storage = { getItem: () => raw, setItem: (key, value) => { raw = value; } };
  assert.deepEqual(loadTasks(storage), { tasks: [], error: false });
  assert.equal(saveTasks(storage, sample), true);
  assert.equal(loadTasks(storage).tasks.length, 2);
  raw = '{invalid';
  assert.equal(loadTasks(storage).error, true);
  raw = '{}';
  assert.equal(loadTasks(storage).error, true);
  assert.equal(loadTasks(null).error, true);
  assert.equal(saveTasks(null, sample), false);
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('quota'); } };
  assert.equal(loadTasks(blocked).error, true);
  assert.equal(saveTasks(blocked, sample), false);
});
test('HTML enlaza CSS y JS existentes y no carga recursos externos', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.match(html, /href="styles\.css"/);
  assert.match(html, /src="app\.js" defer/);
  assert.ok(fs.existsSync('styles.css') && fs.existsSync('app.js'));
  assert.doesNotMatch(html, /(?:src|href)\s*=\s*["']\s*(?:https?:)?\/\//i);
  assert.doesNotMatch(fs.readFileSync('styles.css', 'utf8'), /@import|url\(/i);
});

// DOM mínimo para ejercitar los manejadores reales sin paquetes ni navegador.
class Element {
  constructor() { this.children = []; this.listeners = {}; this.attributes = {}; this.dataset = {}; this.value = ''; this.hidden = false; }
  append(...items) { this.children.push(...items); }
  replaceChildren(...items) { this.children = items; }
  setAttribute(key, value) { this.attributes[key] = value; }
  removeAttribute(key) { delete this.attributes[key]; }
  addEventListener(name, fn) { this.listeners[name] = fn; }
  fire(name) { this.listeners[name]({ preventDefault() {} }); }
  focus() { this.focused = true; }
  querySelectorAll(selector) {
    return this.children.flatMap(child => [ ...(child.className === selector.slice(1) ? [child] : []), ...child.querySelectorAll(selector) ]);
  }
}
function makeApp(storage) {
  const nodes = new Map();
  const get = selector => {
    if (!nodes.has(selector)) nodes.set(selector, new Element());
    return nodes.get(selector);
  };
  const filters = ['all', 'pending', 'completed'].map(filter => {
    const element = new Element(); element.dataset.filter = filter; return element;
  });
  get('#task-form').reset = () => { get('#title').value = ''; get('#description').value = ''; };
  const document = { querySelector: get, querySelectorAll: () => filters, createElement: () => new Element() };
  const window = {};
  Object.defineProperty(window, 'localStorage', { get: () => { if (storage instanceof Error) throw storage; return storage; } });
  vm.runInNewContext(fs.readFileSync('app.js', 'utf8'), { document, window });
  return { get, filters };
}
test('aria-pressed inicial selecciona únicamente Todas', () => {
  const { filters } = makeApp({ getItem: () => null });
  assert.deepEqual(filters.map(button => [button.dataset.filter, button.attributes['aria-pressed']]), [
    ['all', 'true'], ['pending', 'false'], ['completed', 'false']
  ]);
});
test('aria-pressed se actualiza al seleccionar Pendientes y Completadas', () => {
  const { filters } = makeApp({ getItem: () => null });
  filters[1].fire('click');
  assert.deepEqual(filters.map(button => button.attributes['aria-pressed']), ['false', 'true', 'false']);
  filters[2].fire('click');
  assert.deepEqual(filters.map(button => button.attributes['aria-pressed']), ['false', 'false', 'true']);
});
test('Crear una tarea restablece Todas y su aria-pressed desde cada filtro', () => {
  for (const filterIndex of [1, 2]) {
    const { get, filters } = makeApp({ getItem: () => null, setItem() {} });
    filters[filterIndex].fire('click');
    get('#title').value = 'Nueva tarea';
    get('#task-form').fire('submit');
    assert.equal(get('#task-list').children.length, 1);
    assert.deepEqual(filters.map(button => button.attributes['aria-pressed']), ['true', 'false', 'false']);
  }
});
test('Flujo real: rechaza espacios, crea texto seguro, completa, filtra, elimina y deshace', () => {
  let raw = null;
  let writes = 0;
  const app = makeApp({ getItem: () => raw, setItem: (key, value) => { raw = value; writes++; } });
  const { get, filters } = app;
  get('#title').value = '   ';
  get('#task-form').fire('submit');
  assert.equal(get('#task-list').children.length, 0);
  assert.equal(get('#title-error').hidden, false);
  get('#title').value = '<img onerror=alert(1)>';
  get('#description').value = 'Detalle';
  get('#task-form').fire('submit');
  const list = get('#task-list');
  assert.equal(list.children.length, 1);
  assert.equal(list.children[0].children[1].children[0].textContent, '<img onerror=alert(1)>');
  assert.equal(get('#pending-count').textContent, '1 pendiente');
  let checkbox = list.children[0].children[0];
  checkbox.checked = true;
  checkbox.fire('change');
  assert.equal(JSON.parse(raw)[0].completed, true);
  assert.equal(get('#pending-count').textContent, '0 pendientes');
  filters[1].fire('click');
  assert.equal(list.children.length, 0);
  assert.equal(get('#empty-state').hidden, false);
  filters[2].fire('click');
  assert.equal(list.children.length, 1);
  checkbox = list.children[0].children[0];
  checkbox.checked = false;
  checkbox.fire('change');
  assert.equal(list.children.length, 0);
  filters[0].fire('click');
  list.children[0].children[2].fire('click');
  assert.equal(JSON.parse(raw).length, 0);
  assert.equal(get('#undo-panel').hidden, false);
  get('#undo-button').fire('click');
  assert.equal(JSON.parse(raw).length, 1);
  assert.equal(list.children.length, 1);
  assert.equal(writes, 5);
  assert.equal(makeApp({ getItem: () => raw }).get('#task-list').children.length, 1);
});
test('Deshacer B tras crear N restaura el orden exacto N, A, B, C', () => {
  let raw = JSON.stringify(['A', 'B', 'C'].map(id => ({ id, title: id, completed: false })));
  const { get } = makeApp({ getItem: () => raw, setItem: (key, value) => { raw = value; } });
  const list = get('#task-list');
  const titles = () => list.children.map(item => item.children[1].children[0].textContent);
  assert.deepEqual(titles(), ['A', 'B', 'C']);
  list.children[1].children[2].fire('click');
  assert.deepEqual(titles(), ['A', 'C']);
  get('#title').value = 'N';
  get('#task-form').fire('submit');
  assert.deepEqual(titles(), ['N', 'A', 'C']);
  get('#undo-button').fire('click');
  assert.deepEqual(titles(), ['N', 'A', 'B', 'C']);
  assert.deepEqual(JSON.parse(raw).map(task => task.title), ['N', 'A', 'B', 'C']);
});

test('Deshacer conserva posiciones extremas, nuevas tareas, cambios de estado y filtros', () => {
  for (const ids of [['A', 'B', 'C'], ['A']]) {
    for (let index = 0; index < ids.length; index++) {
      let raw = JSON.stringify(ids.map(id => ({ id, title: id, completed: false })));
      const { get, filters } = makeApp({ getItem: () => raw, setItem: (key, value) => { raw = value; } });
      const list = get('#task-list');
      list.children[index].children[2].fire('click');
      for (const title of ['N', 'M']) {
        get('#title').value = title;
        get('#task-form').fire('submit');
      }
      const checkbox = list.children[0].children[0];
      checkbox.checked = true;
      checkbox.fire('change');
      filters[1].fire('click');
      get('#undo-button').fire('click');
      assert.deepEqual(JSON.parse(raw).map(task => task.title), ['M', 'N', ...ids]);
      assert.equal(JSON.parse(raw)[0].completed, true);
      assert.deepEqual(list.children.map(item => item.children[1].children[0].textContent), ['N', ...ids]);
      filters[0].fire('click');
      assert.deepEqual(list.children.map(item => item.children[1].children[0].textContent), ['M', 'N', ...ids]);
      get('#undo-button').fire('click');
      assert.deepEqual(JSON.parse(raw).map(task => task.title), ['M', 'N', ...ids]);
      assert.equal(get('#undo-panel').hidden, true);
    }
  }
});

test('Otra eliminacion reemplaza la posicion pendiente de deshacer', () => {
  let raw = JSON.stringify(['A', 'B', 'C'].map(id => ({ id, title: id, completed: false })));
  const { get } = makeApp({ getItem: () => raw, setItem: (key, value) => { raw = value; } });
  const list = get('#task-list');
  list.children[1].children[2].fire('click');
  get('#title').value = 'N';
  get('#task-form').fire('submit');
  list.children[1].children[2].fire('click');
  get('#undo-button').fire('click');
  assert.deepEqual(JSON.parse(raw).map(task => task.title), ['N', 'A', 'C']);
  assert.deepEqual(list.children.map(item => item.children[1].children[0].textContent), ['N', 'A', 'C']);
});

test('La app sigue creando tareas con acceso a localStorage denegado', () => {
  const { get } = makeApp(new Error('Access denied'));
  assert.equal(get('#storage-warning').hidden, false);
  get('#title').value = 'En memoria';
  get('#task-form').fire('submit');
  assert.equal(get('#task-list').children.length, 1);
  assert.equal(get('#storage-warning').hidden, false);
});
console.log(`${checks} pruebas correctas.`);
