// Расширение (вариант А): поиск задач по части названия.

export function searchTasks(tasks, query) {
  const normalizedQuery = query.trim().toLowerCase();

  if (normalizedQuery.length === 0) {
    return [...tasks];
  }

  return tasks.filter((task) => task.title.toLowerCase().includes(normalizedQuery));
}
