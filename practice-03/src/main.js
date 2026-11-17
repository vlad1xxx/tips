import { demoTasks, variantTasks, variantNumber } from "./data.js";
import { findTaskById, setTaskCompleted, removeTask } from "./task-service.js";
import { getVisibleTasks, filterByPriority } from "./task-selectors.js";
import { renderTaskList, renderSummary, renderEmptyState } from "./task-view.js";

const elements = {
  list: document.querySelector("#task-list"),
  filters: document.querySelector("#task-filters"),
  priorityFilters: document.querySelector("#priority-filters"),
  summary: document.querySelector("#task-summary"),
  empty: document.querySelector("#empty-message"),
  message: document.querySelector("#operation-message"),
  datasetLabel: document.querySelector("#dataset-label"),
};

const FILTERS = ["all", "pending", "completed"];
const PRIORITY_FILTERS = ["all", "low", "medium", "high"];
const ACTIONS = ["toggle", "delete"];

// Готовая служебная часть: ?dataset=variant включает данные своего варианта.
// Наборы не смешиваются, редактировать код для переключения не требуется.
const isVariant = new URLSearchParams(window.location.search).get("dataset") === "variant";
const initialTasks = isVariant ? variantTasks : demoTasks;
let currentTasks = initialTasks.map((task) => ({ ...task }));
let currentFilter = "all";
let currentPriority = "all";

elements.datasetLabel.textContent = isVariant
  ? `Индивидуальный вариант: ${variantNumber ?? "не указан"}`
  : "Общий контрольный набор";

// Отмечает активную кнопку группы классом is-active и aria-pressed.
function markActiveButton(container, attribute, activeValue) {
  for (const button of container.querySelectorAll(`button[${attribute}]`)) {
    const isActive = button.getAttribute(attribute) === activeValue;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }
}

function renderApp() {
  const visibleTasks = filterByPriority(
    getVisibleTasks(currentTasks, currentFilter),
    currentPriority,
  );

  renderTaskList(elements.list, visibleTasks);
  renderSummary(elements.summary, currentTasks, visibleTasks.length);
  renderEmptyState(elements.empty, currentTasks.length, visibleTasks.length);
  markActiveButton(elements.filters, "data-filter", currentFilter);
  if (elements.priorityFilters !== null) {
    markActiveButton(elements.priorityFilters, "data-priority", currentPriority);
  }
}

function showError(text) {
  elements.message.textContent = text;
}

function handleTaskListClick(event) {
  if (!(event.target instanceof Element)) return;

  const button = event.target.closest("button[data-action]");
  if (!button || !elements.list.contains(button)) return;

  const action = button.dataset.action;
  if (!ACTIONS.includes(action)) return;

  const card = button.closest("li[data-task-id]");
  if (!card) return;

  const rawId = card.dataset.taskId;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    showError(`Некорректный идентификатор задачи: «${rawId}»`);
    return;
  }

  let result;
  if (action === "toggle") {
    const task = findTaskById(currentTasks, id);
    if (task === undefined) {
      showError(`Задача с id ${id} не найдена`);
      return;
    }
    result = setTaskCompleted(currentTasks, id, !task.completed);
  } else {
    result = removeTask(currentTasks, id);
  }

  if (!result.ok) {
    showError(result.error);
    return;
  }

  currentTasks = result.tasks;
  showError("");
  renderApp();
  restoreTaskFocus(id, action);
}

function handleFilterClick(event) {
  if (!(event.target instanceof Element)) return;

  const button = event.target.closest("button[data-filter]");
  if (!button || !elements.filters.contains(button)) return;

  const filter = button.dataset.filter;
  if (!FILTERS.includes(filter)) return;

  currentFilter = filter;
  showError("");
  renderApp();
}

// Расширение: фильтр по приоритету работает так же, как фильтр по статусу.
function handlePriorityFilterClick(event) {
  if (!(event.target instanceof Element)) return;

  const button = event.target.closest("button[data-priority]");
  if (!button || !elements.priorityFilters.contains(button)) return;

  const priority = button.dataset.priority;
  if (!PRIORITY_FILTERS.includes(priority)) return;

  currentPriority = priority;
  showError("");
  renderApp();
}

// Готовая вспомогательная функция. Сохраняет понятную позицию клавиатурного фокуса
// после замены карточек. Если карточки больше нет, фокус получает активный фильтр.
function restoreTaskFocus(id, action) {
  const actionButton = elements.list.querySelector(
    `[data-task-id="${id}"] button[data-action="${action}"]`,
  );
  const filterButton = elements.filters.querySelector(`[data-filter="${currentFilter}"]`);
  (actionButton ?? filterButton)?.focus();
}

// Подписки выполняются один раз. Эти контейнеры не заменяются при перерисовке.
elements.list.addEventListener("click", handleTaskListClick);
elements.filters.addEventListener("click", handleFilterClick);
elements.priorityFilters?.addEventListener("click", handlePriorityFilterClick);

// try/catch здесь — диагностика старта, а не замена проверки result.ok.
try {
  renderApp();
} catch (error) {
  elements.message.textContent = `Ошибка запуска: ${error.message}`;
  console.error(error);
}
