const PRIORITY_LABELS = Object.freeze({
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
});

// Серверные строки считаются недоверенными: только textContent, без innerHTML.
function createTextElement(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function createActionButton(action, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.action = action;
  button.append(createTextElement("span", "action-label", label));
  return button;
}

export function createTaskElement(task, category) {
  const card = document.createElement("li");
  card.className = "task-card";
  card.classList.toggle("is-completed", task.completed);
  card.dataset.taskId = String(task.id);

  const title = createTextElement("h3", "task-title", task.title);

  const meta = document.createElement("p");
  meta.className = "task-meta";
  meta.append(
    createTextElement("span", "task-status", task.completed ? "Выполнена" : "В работе"),
    createTextElement("span", "task-priority", PRIORITY_LABELS[task.priority] ?? task.priority),
    createTextElement("span", "task-category", category?.name ?? "Без категории"),
  );

  const toggle = createActionButton("toggle", task.completed ? "Вернуть в работу" : "Выполнена");
  toggle.setAttribute("aria-pressed", String(task.completed));

  const actions = document.createElement("div");
  actions.className = "task-actions";
  actions.append(
    toggle,
    createActionButton("edit", "Изменить"),
    createActionButton("delete", "Удалить"),
  );

  card.append(title, meta, actions);
  return card;
}

export function renderTaskList(list, tasks, categories) {
  const byId = new Map(categories.map((category) => [category.id, category]));
  // replaceChildren: повторная отрисовка не накапливает старые карточки.
  list.replaceChildren(...tasks.map((task) => createTaskElement(task, byId.get(task.categoryId))));
}
