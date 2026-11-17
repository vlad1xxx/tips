import { ApiError } from "./api-client.js";

const ALLOWED_PRIORITIES = new Set(["low", "medium", "high"]);
const ALLOWED_FILTERS = new Set(["completed", "priority", "categoryId", "q"]);
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

function isTask(value) {
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

function isCategory(value) {
  return Boolean(
    value
    && typeof value === "object"
    && isPositiveSafeInteger(value.id)
    && typeof value.name === "string"
    && value.name.trim().length >= 1
    && value.name.trim().length <= 100,
  );
}

// Проверяет фильтры до запроса и возвращает новый объект query.
// Значения не превращаются в строки: это делает URLSearchParams в api-client.
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

// Проверка коллекции: массив, схема элементов, уникальные id, meta.total.
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

// client — объект, созданный createApiClient.
// Контракт результата:
// getTasks(filters) -> Promise<{ tasks, meta }>
// getTaskById(id) -> Promise<task>
// getCategories() -> Promise<category[]>
// loadInitialData(filters) -> Promise<{ tasks, categories, meta }>
export function createTaskApi(client) {
  if (!client || typeof client.requestJson !== "function") {
    throw new TypeError("createTaskApi ожидает клиент с методом requestJson.");
  }

  async function getTasks(filters = {}) {
    const query = normalizeFilters(filters);
    const payload = await client.requestJson("/tasks", { query });
    checkCollection(payload, isTask, "списка задач");
    return { tasks: payload.data, meta: payload.meta };
  }

  async function getTaskById(id) {
    if (!isPositiveSafeInteger(id)) {
      throw new TypeError("id задачи должен быть положительным целым числом.");
    }
    const payload = await client.requestJson(`/tasks/${id}`);
    if (!isPlainObject(payload) || !isTask(payload.data)) {
      throw invalidResponse("Ответ задачи не соответствует схеме.");
    }
    return payload.data;
  }

  async function getCategories() {
    const payload = await client.requestJson("/categories");
    checkCollection(payload, isCategory, "категорий");
    return payload.data;
  }

  // Оба запроса начинаются до общего await.
  async function loadInitialData(filters = {}) {
    const [taskResult, categories] = await Promise.all([
      getTasks(filters),
      getCategories(),
    ]);
    return { tasks: taskResult.tasks, categories, meta: taskResult.meta };
  }

  return { getTasks, getTaskById, getCategories, loadInitialData };
}
