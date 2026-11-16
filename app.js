'use strict';

const STORAGE_KEY = 'taskflow.tasks.v1';

function normalizeTasks(value) {
  if (!Array.isArray(value)) throw new Error('Formato de tareas inválido');
  const ids = new Set();
  return value.filter(task => {
    if (!task || typeof task.id !== 'string' || !task.id || ids.has(task.id) ||
        typeof task.title !== 'string' || !task.title.trim() ||
        typeof task.completed !== 'boolean') return false;
    ids.add(task.id);
    return true;
  }).map(task => ({
    id: task.id,
    title: task.title.trim().slice(0, 160),
    description: typeof task.description === 'string' ? task.description.slice(0, 2000) : '',
    completed: task.completed
  }));
}

function filterTasks(tasks, filter) {
  return tasks.filter(task => filter === 'pending' ? !task.completed :
    filter === 'completed' ? task.completed : true);
}

function loadTasks(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return { tasks: raw === null ? [] : normalizeTasks(JSON.parse(raw)), error: false };
  } catch {
    return { tasks: [], error: true };
  }
}

function saveTasks(storage, tasks) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    return true;
  } catch {
    return false;
  }
}

function initApp() {
  const form = document.querySelector('#task-form');
  const title = document.querySelector('#title');
  const description = document.querySelector('#description');
  const list = document.querySelector('#task-list');
  const warning = document.querySelector('#storage-warning');
  const announcement = document.querySelector('#announcement');
  const undoPanel = document.querySelector('#undo-panel');
  const filters = [...document.querySelectorAll('[data-filter]')];
  let storage;
  try { storage = window.localStorage; } catch { storage = null; }
  const loaded = loadTasks(storage);
  let tasks = loaded.tasks;
  let activeFilter = 'all';
  let deleted = null;
  let sequence = 0;

  function showWarning(message) {
    warning.textContent = message;
    warning.hidden = false;
  }
  if (loaded.error) showWarning('No se pudieron recuperar las tareas guardadas. Puedes seguir usando la aplicación; los cambios se intentarán guardar en este navegador.');

  function persist(message) {
    if (!saveTasks(storage, tasks)) {
      showWarning('No se pueden guardar las tareas en este navegador. Los cambios permanecerán solo durante esta sesión.');
    } else {
      warning.hidden = true;
    }
    render();
    announcement.textContent = message;
  }

  function render() {
    const pending = tasks.filter(task => !task.completed).length;
    document.querySelector('#pending-count').textContent = `${pending} ${pending === 1 ? 'pendiente' : 'pendientes'}`;
    document.querySelector('#total-count').textContent = `${tasks.length} ${tasks.length === 1 ? 'tarea' : 'tareas'} en total`;
    filters.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === activeFilter)));
    list.replaceChildren();
    const visible = filterTasks(tasks, activeFilter);
    document.querySelector('#empty-state').hidden = visible.length > 0;
    const emptyCopy = activeFilter === 'completed'
      ? ['Cada paso cuenta', 'Las tareas que completes aparecerán aquí.']
      : activeFilter === 'pending'
        ? ['Todo al día', 'No tienes tareas pendientes. Disfruta este momento.']
        : ['Todo empieza con un paso', 'Añade tu primera tarea y dale espacio a tus ideas.'];
    document.querySelector('#empty-title').textContent = emptyCopy[0];
    document.querySelector('#empty-description').textContent = emptyCopy[1];
    visible.forEach(task => {
      const item = document.createElement('li');
      item.className = `task${task.completed ? ' completed' : ''}`;
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'task-check';
      checkbox.id = `task-${task.id}`;
      checkbox.checked = task.completed;
      const content = document.createElement('div');
      content.className = 'task-content';
      const label = document.createElement('label');
      label.className = 'task-title';
      label.htmlFor = checkbox.id;
      label.textContent = task.title;
      content.append(label);
      if (task.description) {
        const details = document.createElement('p');
        details.className = 'task-description';
        details.textContent = task.description;
        content.append(details);
      }
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'delete';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Eliminar tarea: ${task.title}`);
      checkbox.addEventListener('change', () => {
        task.completed = checkbox.checked;
        persist(task.completed ? 'Tarea completada.' : 'Tarea pendiente.');
        const next = [...list.querySelectorAll('.task-check')].find(input => input.id === checkbox.id);
        (next || filters.find(button => button.dataset.filter === activeFilter)).focus();
      });
      remove.addEventListener('click', () => {
        deleted = { task, index: tasks.indexOf(task) };
        tasks = tasks.filter(current => current.id !== task.id);
        undoPanel.hidden = false;
        persist('Tarea eliminada. Puedes deshacer la última eliminación.');
        document.querySelector('#undo-button').focus();
      });
      item.append(checkbox, content, remove);
      list.append(item);
    });
  }

  form.addEventListener('submit', event => {
    event.preventDefault();
    const invalid = !title.value.trim();
    document.querySelector('#title-error').hidden = !invalid;
    title.setAttribute('aria-invalid', String(invalid));
    if (invalid) { title.focus(); return; }
    let id;
    do { id = `${Date.now().toString(36)}-${++sequence}`; } while (tasks.some(task => task.id === id));
    tasks.unshift({ id, title: title.value.trim().slice(0, 160), description: description.value.trim().slice(0, 2000), completed: false });
    if (deleted) deleted.index++;
    activeFilter = 'all';
    persist('Tarea añadida.');
    form.reset();
    title.focus();
  });
  title.addEventListener('input', () => {
    title.removeAttribute('aria-invalid');
    document.querySelector('#title-error').hidden = true;
  });
  filters.forEach(button => button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    render();
    announcement.textContent = `${filterTasks(tasks, activeFilter).length} tareas en este filtro.`;
  }));
  document.querySelector('#undo-button').addEventListener('click', () => {
    if (!deleted) return;
    tasks.splice(deleted.index, 0, deleted.task);
    deleted = null;
    undoPanel.hidden = true;
    persist('Tarea restaurada.');
    title.focus();
  });
  render();
}

if (typeof document !== 'undefined') initApp();
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { normalizeTasks, filterTasks, loadTasks, saveTasks };
}
