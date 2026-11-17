// Собственные проверки (раздел 6.5) и проверки расширения (раздел 8, вариант А).
import assert from "node:assert/strict";
import { demoTasks } from "./src/data.js";
import { addTask, setTaskCompleted, renameTask, removeTask, getTaskStats } from "./src/task-service.js";
import { searchTasks } from "./src/task-extra.js";

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`OK: ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`FAIL: ${name}\n  ${error.message}`);
  }
}

const ids = (tasks) => tasks.map((task) => task.id);

check("С1. Добавление после удаления: id удалённой задачи можно использовать снова", () => {
  const removed = removeTask(demoTasks, 7);
  assert.equal(removed.ok, true);
  const added = addTask(removed.tasks, 7, "Новая задача с прежним id", "low");
  assert.equal(added.ok, true);
  assert.deepEqual(ids(added.tasks), [1, 4, 10, 7]);
  assert.equal(added.tasks[3].title, "Новая задача с прежним id");
});

check("С2. Изменение первой и последней записи без затрагивания средних", () => {
  const first = setTaskCompleted(demoTasks, 1, false);
  const last = renameTask(first.tasks, 10, "Последняя задача");
  assert.equal(last.ok, true);
  assert.equal(last.tasks[0].completed, false);
  assert.equal(last.tasks[3].title, "Последняя задача");
  assert.equal(last.tasks[1], demoTasks[1]); // неизменённые записи переиспользуются
  assert.equal(last.tasks[2], demoTasks[2]);
  assert.deepEqual(getTaskStats(last.tasks), { total: 4, completed: 1, pending: 3, progress: 25 });
});

check("С3. Последовательное выполнение всех задач даёт 100% и не меняет исходный набор", () => {
  const snapshot = JSON.stringify(demoTasks);
  let current = demoTasks;
  for (const id of [4, 7]) {
    current = setTaskCompleted(current, id, true).tasks;
  }
  assert.equal(getTaskStats(current).progress, 100);
  assert.equal(JSON.stringify(demoTasks), snapshot);
});

check("С4. Ошибка в середине цепочки не портит предыдущее состояние", () => {
  const step1 = addTask(demoTasks, 30, "Шаг 1");
  const step2 = renameTask(step1.tasks, 30, "   ");
  assert.equal(step2.ok, false);
  assert.deepEqual(ids(step1.tasks), [1, 4, 7, 10, 30]);
  assert.equal(step1.tasks[4].title, "Шаг 1");
});

check("Р1. Поиск без учёта регистра и с краевыми пробелами", () => {
  assert.deepEqual(ids(searchTasks(demoTasks, " ФУНК ")), [1]);
  assert.deepEqual(ids(searchTasks(demoTasks, "ПОДГОТОВИТЬ")), [4]);
});

check("Р2. Нет совпадений, пустой запрос и пустой список", () => {
  assert.deepEqual(searchTasks(demoTasks, "несуществующий фрагмент"), []);
  const all = searchTasks(demoTasks, "   ");
  assert.deepEqual(ids(all), [1, 4, 7, 10]);
  assert.notEqual(all, demoTasks); // новый массив
  assert.deepEqual(searchTasks([], "задача"), []);
});

check("Р3. Поиск не изменяет исходные данные", () => {
  const snapshot = JSON.stringify(demoTasks);
  searchTasks(demoTasks, "о");
  assert.equal(JSON.stringify(demoTasks), snapshot);
});

console.log(`\nСобственных проверок пройдено: ${passed}; не пройдено: ${failed}.`);
if (failed > 0) {
  process.exitCode = 1;
}
