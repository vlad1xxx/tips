// Общий контрольный набор. Для своего варианта ниже предусмотрен отдельный массив.
// Идентификатор задачи не совпадает с её индексом в массиве.
export const demoTasks = [
  { id: 1, title: "Изучить функции", completed: true, priority: "medium" },
  { id: 4, title: "Подготовить модель задач", completed: false, priority: "high" },
  { id: 7, title: "Проверить методы массивов", completed: false, priority: "low" },
  { id: 10, title: "Оформить README", completed: true, priority: "medium" },
];

// Вариант 1: «Подготовка учебного проекта». K = 0 — изначально ни одна задача не выполнена.
export const variantNumber = 1;
export const variantTasks = [
  { id: 11, title: "Выбрать тему проекта", completed: false, priority: "high" },
  { id: 23, title: "Составить план работ", completed: false, priority: "medium" },
  { id: 37, title: "Подобрать источники", completed: false, priority: "low" },
  { id: 41, title: "Написать черновик", completed: false, priority: "high" },
  { id: 58, title: "Подготовить презентацию", completed: false, priority: "medium" },
  { id: 64, title: "Отрепетировать защиту", completed: false, priority: "low" },
];
