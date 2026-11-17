import { getTaskStats } from "./task-service.js";

// Здесь создаётся DOM, но не изменяется состояние приложения.

const PRIORITY_LABELS = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
};

function createElementWithText(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function createActionButton(action, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.action = action;
  button.append(createElementWithText("span", "action-label", label));
  return button;
}

export function createTaskElement(task) {
  const card = document.createElement("li");
  card.classList.add("task-card");
  card.classList.toggle("is-completed", task.completed);
  card.dataset.taskId = String(task.id);

  const title = createElementWithText("h3", "task-title", task.title);
  const status = createElementWithText(
    "p",
    "task-status",
    task.completed ? "Выполнена" : "В работе",
  );
  const priority = createElementWithText(
    "p",
    "task-priority",
    PRIORITY_LABELS[task.priority],
  );

  const toggleButton = createActionButton("toggle", "Выполнена");
  toggleButton.setAttribute("aria-pressed", String(task.completed));
  const deleteButton = createActionButton("delete", "Удалить");

  const actions = document.createElement("div");
  actions.className = "task-actions";
  actions.append(toggleButton, deleteButton);

  card.append(title, status, priority, actions);
  return card;
}

export function renderTaskList(listElement, tasks) {
  const cards = tasks.map((task) => createTaskElement(task));
  listElement.replaceChildren(...cards);
}

export function renderSummary(summaryElement, tasks, visibleCount) {
  const { total, completed, pending, progress } = getTaskStats(tasks);
  const values = {
    total: String(total),
    completed: String(completed),
    pending: String(pending),
    progress: `${progress.toFixed(1)}%`,
    visible: String(visibleCount),
  };

  for (const [name, value] of Object.entries(values)) {
    const node = summaryElement.querySelector(`[data-stat="${name}"]`);
    if (node !== null) {
      node.textContent = value;
    }
  }
}

export function renderEmptyState(messageElement, total, visibleCount) {
  if (visibleCount > 0) {
    messageElement.textContent = "";
    messageElement.hidden = true;
    return;
  }

  messageElement.textContent =
    total === 0 ? "Список задач пуст." : "Нет задач по выбранному фильтру.";
  messageElement.hidden = false;
}
