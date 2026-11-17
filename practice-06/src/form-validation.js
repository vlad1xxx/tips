const ALLOWED_PRIORITIES = new Set(["low", "medium", "high"]);
const TITLE_MAX_LENGTH = 100;

// Значение select приходит строкой; пустая строка не превращается в 0.
function parseCategoryId(raw) {
  if (typeof raw === "number") return raw;
  if (typeof raw !== "string" || raw.trim() === "") return Number.NaN;
  return Number(raw);
}

// Возвращает { valid, value, errors }.
// value содержит нормализованные title, priority и числовой categoryId.
// Функция не читает DOM и не изменяет входные объекты.
export function validateTaskDraft(draft, categories) {
  const errors = {};
  const source = draft ?? {};
  const knownCategories = Array.isArray(categories) ? categories : [];

  let title = "";
  if (typeof source.title !== "string") {
    errors.title = "Название должно быть строкой.";
  } else {
    title = source.title.trim();
    if (title.length === 0) {
      errors.title = "Введите название: строка из пробелов не подходит.";
    } else if (title.length > TITLE_MAX_LENGTH) {
      errors.title = `Название не должно быть длиннее ${TITLE_MAX_LENGTH} символов.`;
    }
  }

  const priority = source.priority;
  if (!ALLOWED_PRIORITIES.has(priority)) {
    errors.priority = "Выберите приоритет: низкий, средний или высокий.";
  }

  const categoryId = parseCategoryId(source.categoryId);
  if (!Number.isSafeInteger(categoryId) || categoryId <= 0) {
    errors.categoryId = "Выберите категорию.";
  } else if (!knownCategories.some((category) => category.id === categoryId)) {
    errors.categoryId = "Такой категории нет в загруженном справочнике.";
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, value: null, errors };
  }
  return { valid: true, value: { title, priority, categoryId }, errors: {} };
}
