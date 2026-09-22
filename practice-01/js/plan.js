"use strict";

const totalTasks = 12;
const completedTasks = 5;
const dailyLimit = 3;

if (typeof totalTasks !== "number" || typeof completedTasks !== "number") {
  console.log("Ошибка: количество задач должно быть числом");
} else if (!Number.isInteger(totalTasks) || !Number.isInteger(completedTasks)) {
  console.log("Ошибка: количество задач должно быть целым числом");
} else if (totalTasks < 0 || totalTasks > 1000) {
  console.log("Ошибка: totalTasks должно быть в диапазоне от 0 до 1000");
} else if (completedTasks < 0 || completedTasks > totalTasks) {
  console.log("Ошибка: completedTasks должно быть от 0 до totalTasks");
} else if (typeof dailyLimit !== "number" || !Number.isInteger(dailyLimit)) {
  console.log("Ошибка: dailyLimit должен быть целым числом");
} else if (dailyLimit < 1 || dailyLimit > 1000) {
  console.log("Ошибка: dailyLimit должен быть в диапазоне от 1 до 1000");
} else {
  let remainingTasks = totalTasks - completedTasks;
  console.log("Осталось задач:", remainingTasks);

  if (remainingTasks === 0) {
    console.log("Все задачи уже выполнены");
    console.log("Потребуется дней: 0");
  } else {
    let day = 0;

    while (remainingTasks > 0) {
      day += 1;
      const doneToday = Math.min(dailyLimit, remainingTasks);
      remainingTasks -= doneToday;
      console.log(`День ${day}: выполнено ${doneToday}, осталось ${remainingTasks}`);
    }

    console.log("Потребуется дней:", day);
  }
}
