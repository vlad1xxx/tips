import { ApiError } from "./api-client.js";

const ALLOWED_PRIORITIES = new Set(["low", "medium", "high"]);
const ALLOWED_FILTERS = new Set(["completed", "priority", "categoryId", "q"]);
const ALLOWED_CHANGES = new Set(["title", "priority", "categoryId", "completed"]);
const QUERY_MAX_LENGTH = 100;

function invalidResponse(message) {
  return new ApiError(message, { kind: "invalid-response" });
}

function isPositiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isTask(value) {
  return Boolean(
    value
    && typeof value === "object"
    && isPositiveSafeInteger(value.id)
    && typeof value.title === "string"
    && value.title.trim().length >= 1
    && value.title.trim().length <= 100
    && typeof value.completed === "boolean"
    && ALLOWED_PRIORITIES.has(value.priority)
    && isPositiveSafeInteger(value.categoryId),
  );
}

export function isCategory(value) {
  return Boolean(
    value
    && typeof value === "object"
    && isPositiveSafeInteger(value.id)
    && typeof value.name === "string"
    && value.name.trim().length >= 1
    && value.name.trim().length <= 100,
  );
}

function requireId(id) {
  if (!isPositiveSafeInteger(id)) {
    throw new TypeError("id задачи должен быть положительным целым числом.");
  }
}

// Из ПР5: проверка фильтров до запроса, значения не превращаются в строки.
function normalizeFilters(filters) {
  if (!isPlainObject(filters)) {
    throw new TypeError("Фильтры должны быть обычным объектом.");
  }

  const query = {};
  for (const [name, value] of Object.entries(filters)) {
    if (!ALLOWED_FILTERS.has(name)) {
      throw new TypeError(`Неизвестный фильтр: ${name}.`);
    }
    if (value === undefined) continue;

    if (name === "completed") {
      if (typeof value !== "boolean") throw new TypeError("completed должен быть boolean.");
      query.completed = value;
    } else if (name === "priority") {
      if (!ALLOWED_PRIORITIES.has(value)) throw new TypeError("priority: low, medium или high.");
      query.priority = value;
    } else if (name === "categoryId") {
      if (!isPositiveSafeInteger(value)) throw new TypeError("categoryId — положительное целое.");
      query.categoryId = value;
    } else {
      if (typeof value !== "string") throw new TypeError("q должен быть строкой.");
      const q = value.trim();
      if (q.length > QUERY_MAX_LENGTH) {
        throw new TypeError(`q не должен быть длиннее ${QUERY_MAX_LENGTH} символов.`);
      }
      query.q = q;
    }
  }
  return query;
}

function checkCollection(payload, isItem, label) {
  if (!isPlainObject(payload) || !Array.isArray(payload.data)) {
    throw invalidResponse(`Ответ ${label}: поле data должно быть массивом.`);
  }
  if (!isPlainObject(payload.meta) || payload.meta.total !== payload.data.length) {
    throw invalidResponse(`Ответ ${label}: meta.total не совпадает с длиной data.`);
  }

  const ids = new Set();
  for (const item of payload.data) {
    if (!isItem(item)) {
      throw invalidResponse(`Ответ ${label}: элемент не соответствует схеме.`);
    }
    if (ids.has(item.id)) {
      throw invalidResponse(`Ответ ${label}: повторяющийся id ${item.id}.`);
    }
    ids.add(item.id);
  }
  return payload;
}

function checkSingleTask(payload) {
  if (!isPlainObject(payload) || !isTask(payload.data)) {
    throw invalidResponse("Ответ задачи не соответствует схеме.");
  }
  return payload.data;
}

// Методы результата:
// getTasks, getTaskById, getCategories, loadInitialData, createTask, updateTask,
// setTaskCompleted, deleteTask и resetDemoData.
// Последний аргумент каждого метода данных — { signal }.
// Модуль не работает с DOM и не формирует пользовательские сообщения.
export function createTaskApi(client) {
  if (!client || typeof client.requestJson !== "function") {
    throw new TypeError("createTaskApi ожидает клиент с методом requestJson.");
  }

  async function getTasks(filters = {}, { signal } = {}) {
    const query = normalizeFilters(filters);
    const payload = await client.requestJson("/tasks", { query, signal });
    checkCollection(payload, isTask, "списка задач");
    return { tasks: payload.data, meta: payload.meta };
  }

  async function getTaskById(id, { signal } = {}) {
    requireId(id);
    return checkSingleTask(await client.requestJson(`/tasks/${id}`, { signal }));
  }

  async function getCategories({ signal } = {}) {
    const payload = await client.requestJson("/categories", { signal });
    checkCollection(payload, isCategory, "категорий");
    return payload.data;
  }

  // Запросы задач и категорий начинаются до общего await.
  async function loadInitialData(filters = {}, options = {}) {
    const [taskResult, categories] = await Promise.all([
      getTasks(filters, options),
      getCategories(options),
    ]);
    return { tasks: taskResult.tasks, categories, meta: taskResult.meta };
  }

  // id и completed назначает сервер, поэтому в тело попадают только три поля.
  // Содержимое полей проверяет форма и повторно — сервер.
  async function createTask(draft, { signal } = {}) {
    if (!isPlainObject(draft)) throw new TypeError("draft должен быть объектом.");
    const body = { title: draft.title, priority: draft.priority, categoryId: draft.categoryId };
    return checkSingleTask(await client.requestJson("/tasks", { method: "POST", body, signal }));
  }

  async function updateTask(id, changes, { signal } = {}) {
    requireId(id);
    if (!isPlainObject(changes) || Object.keys(changes).length === 0) {
      throw new TypeError("changes должен быть непустым объектом.");
    }
    for (const key of Object.keys(changes)) {
      if (!ALLOWED_CHANGES.has(key)) throw new TypeError(`Поле ${key} нельзя изменить.`);
    }
    return checkSingleTask(await client.requestJson(`/tasks/${id}`, {
      method: "PATCH",
      body: { ...changes },
      signal,
    }));
  }

  async function setTaskCompleted(id, completed, options = {}) {
    if (typeof completed !== "boolean") throw new TypeError("completed должен быть boolean.");
    return updateTask(id, { completed }, options);
  }

  // Успешное удаление — 204 без тела, requestJson возвращает null.
  async function deleteTask(id, { signal } = {}) {
    requireId(id);
    const result = await client.requestJson(`/tasks/${id}`, { method: "DELETE", signal });
    if (result !== null) {
      throw invalidResponse("После DELETE ожидался пустой ответ 204.");
    }
    return null;
  }

  async function resetDemoData({ signal } = {}) {
    const payload = await client.requestJson("/debug/reset", { method: "POST", signal });
    if (
      !isPlainObject(payload)
      || !isPlainObject(payload.data)
      || payload.data.reset !== true
      || !Number.isSafeInteger(payload.data.total)
      || payload.data.total < 0
    ) {
      throw invalidResponse("Ответ reset не соответствует контракту.");
    }
    return payload.data;
  }

  return {
    getTasks,
    getTaskById,
    getCategories,
    loadInitialData,
    createTask,
    updateTask,
    setTaskCompleted,
    deleteTask,
    resetDemoData,
  };
}
