import { demoTasks, variantNumber, variantTasks } from "./data.js";
import {
  createTask,
  findTaskById,
  getPendingTasks,
  getTaskTitles,
  getTaskStats,
  addTask,
  setTaskCompleted,
  renameTask,
  removeTask,
} from "./task-service.js";
import { searchTasks } from "./task-extra.js";

// Вспомогательные функции вывода. Расчёты выполняются в task-service.js.

function printStats(label, tasks) {
  const { total, completed, pending, progress } = getTaskStats(tasks);

  console.log(`${label}: всего ${total}; выполнено ${completed}; осталось ${pending}`);
  if (total === 0) {
    console.log("  Задач пока нет");
  } else {
    console.log(`  Прогресс: ${progress.toFixed(1)}%`);
  }
}

function printIds(label, tasks) {
  console.log(`${label}: [${tasks.map((task) => task.id).join(", ")}]`);
}

// Применяет результат операции: при успехе возвращает новый список, при ошибке — прежний.
function applyResult(label, currentTasks, result) {
  if (result.ok) {
    printStats(label, result.tasks);
    return result.tasks;
  }

  console.error(`${label} — отказ. Ошибка: ${result.error}`);
  printIds("  Состояние не изменилось", currentTasks);
  return currentTasks;
}

function runScenario(title, sourceTasks, steps) {
  console.log(`\n=== ${title} ===`);
  const snapshot = JSON.stringify(sourceTasks);

  console.table(sourceTasks);
  console.log("Названия:", getTaskTitles(sourceTasks));
  printIds("Невыполненные", getPendingTasks(sourceTasks));
  printStats("Исходный набор", sourceTasks);

  let currentTasks = sourceTasks;
  for (const [label, operation] of steps) {
    currentTasks = applyResult(label, currentTasks, operation(currentTasks));
  }

  console.log("\nИтоговый список:");
  console.table(currentTasks);
  printIds("Идентификаторы итогового списка", currentTasks);
  printIds("Невыполненные", getPendingTasks(currentTasks));
  console.log(
    "Исходный набор не изменён:",
    JSON.stringify(sourceTasks) === snapshot ? "да" : "НЕТ",
  );

  return currentTasks;
}

console.log("ПР2. Функции, объекты, массивы и организация кода");

// Создание и поиск отдельно от сценария
const created = createTask(20, "  Подготовить демонстрацию  ");
console.log("createTask:", created);
console.log("createTask с id = \"4\":", createTask("4", "Задача"));
console.log("findTaskById(demoTasks, 4):", findTaskById(demoTasks, 4));
console.log("findTaskById(demoTasks, 777):", findTaskById(demoTasks, 777));

// Общий сценарий (раздел 6.5)
runScenario("Общий сценарий", demoTasks, [
  ["Добавление id 20", (tasks) => addTask(tasks, 20, "Добавить проверку", "high")],
  ["Выполнение id 4", (tasks) => setTaskCompleted(tasks, 4, true)],
  ["Переименование id 10", (tasks) => renameTask(tasks, 10, "Подготовить инструкцию запуска")],
  ["Удаление id 7", (tasks) => removeTask(tasks, 7)],
  ["Повторное добавление id 20", (tasks) => addTask(tasks, 20, "Дубликат", "low")],
  ["Статус строкой \"true\" для id 1", (tasks) => setTaskCompleted(tasks, 1, "true")],
  ["Удаление отсутствующей id 999", (tasks) => removeTask(tasks, 999)],
]);

// Индивидуальный вариант (раздел 7)
runScenario(`Вариант ${variantNumber}: подготовка учебного проекта`, variantTasks, [
  ["Добавление id 80", (tasks) => addTask(tasks, 80, "Сдать проект преподавателю", "high")],
  ["Выполнение id 11", (tasks) => setTaskCompleted(tasks, 11, true)],
  ["Переименование id 23", (tasks) => renameTask(tasks, 23, "  Составить подробный план работ  ")],
  ["Удаление id 37", (tasks) => removeTask(tasks, 37)],
  ["Повторное добавление id 80", (tasks) => addTask(tasks, 80, "Ещё одна сдача", "high")],
]);

// Расширение: поиск по части названия
console.log("\n=== Расширение: поиск по названию ===");
printIds("Запрос \" ФУНК \"", searchTasks(demoTasks, " ФУНК "));
printIds("Запрос \"проверить\"", searchTasks(demoTasks, "проверить"));
printIds("Запрос \"несуществующий фрагмент\"", searchTasks(demoTasks, "несуществующий фрагмент"));
printIds("Пустой запрос", searchTasks(demoTasks, "   "));
