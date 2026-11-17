const ALLOWED_PRIORITIES = new Set(["low", "medium", "high"]);
const TITLE_MAX_LENGTH = 100;

function isPositiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

// Значение id из формы приходит строкой. Пустая строка и строка из пробелов
// не превращаются в 0: Number("") === 0, поэтому они отклоняются отдельно.
function parseDraftId(rawId) {
  if (typeof rawId === "number") return rawId;
  if (typeof rawId !== "string" || rawId.trim() === "") return Number.NaN;
  return Number(rawId);
}

// Чистая проверка данных формы. DOM и показ сообщений выполняются в main.js.
// draft: { id, title, priority }; editingId: null либо id редактируемой задачи.
// Входные draft и tasks не изменяются.
export function validateTaskDraft(draft, tasks, editingId = null) {
  const errors = {};
  let id;

  if (editingId === null) {
    // Режим создания: id берётся из формы и должен быть уникальным.
    id = parseDraftId(draft?.id);
    if (!isPositiveSafeInteger(id)) {
      errors.id = "Укажите положительное целое число.";
    } else if (tasks.some((task) => task.id === id)) {
      errors.id = `Задача с id ${id} уже существует.`;
    }
  } else {
    // Режим редактирования: draft.id не используется (поле заблокировано).
    id = editingId;
    if (!isPositiveSafeInteger(id)) {
      errors.id = "Некорректный идентификатор редактируемой задачи.";
    } else if (!tasks.some((task) => task.id === id)) {
      errors.id = `Редактируемая задача с id ${id} не найдена.`;
    }
  }

  const rawTitle = draft?.title;
  let title = "";
  if (typeof rawTitle !== "string") {
    errors.title = "Название должно быть строкой.";
  } else {
    title = rawTitle.trim();
    if (title.length === 0) {
      errors.title = "Введите название: строка из пробелов не подходит.";
    } else if (title.length > TITLE_MAX_LENGTH) {
      errors.title = `Название не должно быть длиннее ${TITLE_MAX_LENGTH} символов.`;
    }
  }

  const priority = draft?.priority;
  if (!ALLOWED_PRIORITIES.has(priority)) {
    errors.priority = "Выберите приоритет: low, medium или high.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, value: { id, title, priority } };
}
