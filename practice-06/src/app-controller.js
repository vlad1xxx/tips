import { ApiError } from "./api-client.js";
import { validateTaskDraft } from "./form-validation.js";

export function messageForError(error) {
  if (!(error instanceof ApiError)) return "Не удалось выполнить операцию.";
  if (error.kind === "timeout") return "Сервер не ответил вовремя. Попробуйте ещё раз.";
  if (error.kind === "network") return "Нет соединения с учебным API. Проверьте, запущен ли npm start.";
  if (error.kind === "invalid-response") return "Сервер вернул ответ неожиданного формата.";
  if (error.kind === "http" && error.status === 404) return "Запись уже отсутствует на сервере. Обновите список.";
  if (error.kind === "http") return error.message || `Сервер вернул ошибку ${error.status}.`;
  return "Не удалось выполнить операцию.";
}

const API_METHODS = [
  "loadInitialData", "getTasks", "createTask", "updateTask",
  "setTaskCompleted", "deleteTask", "resetDemoData",
];
const VIEW_METHODS = [
  "setListState", "setTasks", "setCategories", "setTotal",
  "setFormTask", "showFormErrors", "setMutationPending", "notify",
];

function requireMethods(target, names, label) {
  if (!target || typeof target !== "object") {
    throw new TypeError(`${label} должен быть объектом.`);
  }
  for (const name of names) {
    if (typeof target[name] !== "function") {
      throw new TypeError(`${label}.${name} должен быть функцией.`);
    }
  }
}

function isAbort(error) {
  return error instanceof ApiError && error.kind === "aborted";
}

// view — адаптер из dom-app.js. Контроллер не обращается к document,
// а все HTTP-операции выполняет через переданный api.
export function createAppController({ api, view, validateDraft = validateTaskDraft } = {}) {
  requireMethods(api, API_METHODS, "api");
  requireMethods(view, VIEW_METHODS, "view");
  if (typeof validateDraft !== "function") {
    throw new TypeError("validateDraft должен быть функцией.");
  }

  // Снимок последнего ответа сервера; источником истины остаётся API.
  let tasks = [];
  let categories = null; // null — справочник ещё не получен
  let filters = {};
  let editingId = null;
  let activeLoad = null; // AbortController текущей загрузки
  let loadSequence = 0; // номер последней запущенной загрузки
  let mutationPending = false;

  // Загружает список с текущими фильтрами. Пока категорий нет —
  // выполняется начальная параллельная загрузка задач и категорий.
  async function loadCurrentTasks() {
    activeLoad?.abort();
    const controller = new AbortController();
    activeLoad = controller;
    const sequence = ++loadSequence;
    const isInitial = categories === null;
    const requestFilters = { ...filters };

    view.setListState("loading");
    try {
      const result = isInitial
        ? await api.loadInitialData(requestFilters, { signal: controller.signal })
        : await api.getTasks(requestFilters, { signal: controller.signal });

      // Устаревший ответ (уже запущена более новая загрузка) не применяется,
      // даже если источник не отреагировал на отмену.
      if (sequence !== loadSequence) return;

      if (isInitial) {
        categories = result.categories;
        view.setCategories(categories);
      }
      tasks = result.tasks;
      view.setTasks(tasks, categories);
      view.setTotal(result.meta?.total ?? tasks.length);
      view.setListState(tasks.length > 0 ? "ready" : "empty");
    } catch (error) {
      if (sequence !== loadSequence) return;
      // Отмена — ожидаемое управление потоком, а не ошибка для пользователя.
      if (isAbort(error)) return;
      view.setListState("error", messageForError(error));
    } finally {
      if (activeLoad === controller) activeLoad = null;
    }
  }

  // Общая схема мутации: блокировка → запрос → сообщение → повторный GET → разблокировка.
  async function runMutation(operation, successMessage, { onSuccess, onError } = {}) {
    if (mutationPending) return false;
    mutationPending = true;
    view.setMutationPending(true);
    try {
      await operation();
      onSuccess?.();
      view.notify(successMessage, "success");
      await loadCurrentTasks();
      return true;
    } catch (error) {
      onError?.(error);
      view.notify(messageForError(error), "error");
      return false;
    } finally {
      mutationPending = false;
      view.setMutationPending(false);
    }
  }

  function findTask(id) {
    return tasks.find((task) => task.id === id);
  }

  function cancelEdit() {
    editingId = null;
    view.setFormTask(null);
    view.showFormErrors({});
  }

  function beginEdit(id) {
    const task = findTask(id);
    if (!task) {
      view.notify("Задача не найдена в текущем списке. Обновите список.", "error");
      return false;
    }
    editingId = task.id;
    view.showFormErrors({});
    view.setFormTask(task);
    return true;
  }

  async function submit(draft) {
    const checked = validateDraft(draft, categories ?? []);
    view.showFormErrors(checked.errors);
    if (!checked.valid) {
      view.notify("Исправьте ошибки в форме.", "error");
      return false;
    }

    const id = editingId;
    return runMutation(
      () => (id === null ? api.createTask(checked.value) : api.updateTask(id, checked.value)),
      id === null ? "Задача создана." : `Задача № ${id} обновлена.`,
      {
        onSuccess: cancelEdit,
        // Серверная валидация может отклонить данные, прошедшие клиентскую.
        onError(error) {
          if (error instanceof ApiError && error.code === "VALIDATION_ERROR" && error.details) {
            view.showFormErrors(error.details);
          }
        },
      },
    );
  }

  async function toggleTask(id) {
    const task = findTask(id);
    if (!task) {
      view.notify("Задача не найдена в текущем списке. Обновите список.", "error");
      return false;
    }
    const next = !task.completed;
    return runMutation(
      () => api.setTaskCompleted(id, next),
      next ? `Задача № ${id} выполнена.` : `Задача № ${id} возвращена в работу.`,
    );
  }

  async function deleteTask(id) {
    return runMutation(
      () => api.deleteTask(id),
      `Задача № ${id} удалена.`,
      { onSuccess: () => { if (editingId === id) cancelEdit(); } },
    );
  }

  async function resetData() {
    return runMutation(
      () => api.resetDemoData(),
      "Учебные данные восстановлены.",
      { onSuccess: cancelEdit },
    );
  }

  return {
    start(initialFilters = {}) {
      filters = { ...initialFilters };
      return loadCurrentTasks();
    },
    applyFilters(nextFilters = {}) {
      filters = { ...nextFilters };
      return loadCurrentTasks();
    },
    refresh() {
      return loadCurrentTasks();
    },
    submit,
    beginEdit,
    cancelEdit,
    toggleTask,
    deleteTask,
    resetData,
    destroy() {
      loadSequence += 1;
      activeLoad?.abort();
      activeLoad = null;
    },
  };
}
