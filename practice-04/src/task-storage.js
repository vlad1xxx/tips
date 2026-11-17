export const STORAGE_VERSION = 1;

const ALLOWED_PRIORITIES = new Set(["low", "medium", "high"]);
const TITLE_MAX_LENGTH = 100;

// Все функции принимают объект storage явно, чтобы их можно было проверить
// без обращения к глобальному window.localStorage.

function copyTasks(tasks) {
  return tasks.map((task) => ({ ...task }));
}

function isValidTask(value) {
  return (
    value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Number.isSafeInteger(value.id)
    && value.id > 0
    && typeof value.title === "string"
    // Название уже должно быть нормализовано: при чтении данные не исправляются.
    && value.title === value.title.trim()
    && value.title.length >= 1
    && value.title.length <= TITLE_MAX_LENGTH
    && typeof value.completed === "boolean"
    && ALLOWED_PRIORITIES.has(value.priority)
  );
}

// Проверяет весь массив и уникальность id. Значение не исправляется.
export function isValidTaskList(value) {
  if (!Array.isArray(value)) return false;

  const ids = new Set();
  for (const task of value) {
    if (!isValidTask(task) || ids.has(task.id)) return false;
    ids.add(task.id);
  }
  return true;
}

export function loadTasks(storage, key, fallbackTasks) {
  const fallback = copyTasks(fallbackTasks);
  const fail = (error) => ({ ok: false, source: "fallback", tasks: fallback, error });

  let raw;
  try {
    raw = storage.getItem(key);
  } catch (error) {
    return fail(`Не удалось прочитать localStorage: ${error.message}. Используется исходный набор.`);
  }

  if (raw === null) {
    return { ok: true, source: "initial", tasks: fallback };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fail("Сохранённые данные повреждены (некорректный JSON). Используется исходный набор.");
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return fail("Сохранённые данные имеют неверный формат. Используется исходный набор.");
  }
  if (parsed.version !== STORAGE_VERSION) {
    return fail(
      `Неподдерживаемая версия сохранённых данных: ${String(parsed.version)}. Используется исходный набор.`,
    );
  }
  if (!isValidTaskList(parsed.tasks)) {
    return fail("Сохранённые задачи не прошли проверку схемы. Используется исходный набор.");
  }

  return { ok: true, source: "storage", tasks: copyTasks(parsed.tasks) };
}

export function saveTasks(storage, key, tasks) {
  if (!isValidTaskList(tasks)) {
    return { ok: false, error: "Список задач некорректен и не был сохранён." };
  }

  try {
    storage.setItem(key, JSON.stringify({ version: STORAGE_VERSION, tasks }));
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: `Не удалось сохранить в localStorage: ${error.message}. После перезагрузки изменения могут быть потеряны.`,
    };
  }
}

// Удаляет только переданный ключ; localStorage.clear() не используется.
export function removeSavedTasks(storage, key) {
  try {
    storage.removeItem(key);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: `Не удалось удалить сохранённые данные: ${error.message}.` };
  }
}
