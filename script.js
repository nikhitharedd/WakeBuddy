
// WakeBuddy - Smart Sleep Tracker

const $ = (id) => document.getElementById(id);

let records = [];

try {
  records = JSON.parse(localStorage.getItem("wakebuddyRecords")) || [];
  if (!Array.isArray(records)) records = [];
} catch {
  records = [];
}

let sleepChart = null;
let alarmInterval = null;
let ringingInterval = null;
let audioContext = null;
let alarmTimeValue = localStorage.getItem("wakebuddyAlarm") || "";
let reminderTimeValue = localStorage.getItem("wakebuddyReminder") || "";
let lastAlarmTriggered = "";
let lastReminderTriggered = "";

function saveRecords() {
  localStorage.setItem("wakebuddyRecords", JSON.stringify(records));
}

function timeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function calculateDuration(bedtime, wakeup) {
  let difference = timeToMinutes(wakeup) - timeToMinutes(bedtime);

  if (difference <= 0) {
    difference += 24 * 60;
  }

  return difference;
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function showMessage(id, message) {
  $(id).textContent = message;
}

// Sleep record form
$("saveSleep").addEventListener("click", () => {
  const bedtime = $("bedtime").value;
  const wakeup = $("wakeup").value;

  if (!bedtime || !wakeup) {
    showMessage("trackerMessage", "Please enter both bedtime and wake-up time.");
    return;
  }

  const duration = calculateDuration(bedtime, wakeup);

  if (duration <= 0 || duration > 24 * 60) {
    showMessage("trackerMessage", "Please enter valid times.");
    return;
  }

  const today = new Date().toLocaleDateString("en-CA");

  records.push({
    id: Date.now(),
    date: today,
    bedtime,
    wakeup,
    duration
  });

  saveRecords();
  updateAll();

  $("bedtime").value = "";
  $("wakeup").value = "";

  showMessage("trackerMessage", "Sleep record saved successfully!");
});

// Dashboard
function updateDashboard() {
  const latest = records[records.length - 1];

  if (!latest) {
    $("bedtimeDisplay").textContent = "--:--";
    $("wakeupDisplay").textContent = "--:--";
    $("durationDisplay").textContent = "0h 0m";
    $("dashboardAverage").textContent = "0h 0m";
    return;
  }

  $("bedtimeDisplay").textContent = latest.bedtime;
  $("wakeupDisplay").textContent = latest.wakeup;
  $("durationDisplay").textContent = formatDuration(latest.duration);

  const average = records.reduce((sum, item) => sum + item.duration, 0) / records.length;
  $("dashboardAverage").textContent = formatDuration(Math.round(average));
}

// Sleep analysis
function analyzeSleep() {
  const total = records.length;

  $("totalRecords").textContent = total;

  if (total === 0) {
    $("averageSleep").textContent = "0h 0m";
    $("goalDays").textContent = "0";
    $("sleepSuggestion").textContent =
      "Save your first sleep record to receive personalized sleep suggestions.";
    return;
  }

  const totalMinutes = records.reduce((sum, item) => sum + item.duration, 0);
  const average = totalMinutes / total;

  const goalCount = records.filter(item => item.duration >= 480).length;

  $("averageSleep").textContent = formatDuration(Math.round(average));
  $("goalDays").textContent = goalCount;

  if (average < 360) {
    $("sleepSuggestion").textContent =
      "You are sleeping less than 6 hours on average. Try to increase your sleep time.";
  } else if (average < 420) {
    $("sleepSuggestion").textContent =
      "Your sleep is a little below the recommended amount. Try maintaining a regular bedtime.";
  } else if (average <= 540) {
    $("sleepSuggestion").textContent =
      "Great! Your average sleep is within the commonly recommended 7–9 hour range.";
  } else {
    $("sleepSuggestion").textContent =
      "You are sleeping more than 9 hours on average. Monitor how rested you feel and maintain a consistent routine.";
  }
}

// Sleep history
function displayHistory() {
  const table = $("historyTable");
  table.innerHTML = "";

  if (records.length === 0) {
    table.innerHTML = '<tr><td colspan="5">No sleep records yet.</td></tr>';
    return;
  }

  [...records].reverse().forEach(record => {
    const row = document.createElement("tr");

    const values = [
      record.date,
      record.bedtime,
      record.wakeup,
      formatDuration(record.duration)
    ];

    values.forEach(value => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.appendChild(cell);
    });

    const actionCell = document.createElement("td");
    const deleteButton = document.createElement("button");

    deleteButton.textContent = "Delete";
    deleteButton.className = "delete-button";
    deleteButton.dataset.id = record.id;

    actionCell.appendChild(deleteButton);
    row.appendChild(actionCell);
    table.appendChild(row);
  });
}

// Delete a sleep record
$("historyTable").addEventListener("click", event => {
  if (!event.target.classList.contains("delete-button")) return;

  const id = Number(event.target.dataset.id);

  records = records.filter(record => Number(record.id) !== id);

  saveRecords();
  updateAll();
});

// Weekly sleep graph
function drawWeeklyGraph() {
  const canvas = $("sleepChart");
  const message = $("chartMessage");

  if (typeof Chart === "undefined") {
    message.textContent = "Please check your internet connection to load the graph.";
    return;
  }

  const labels = [];
  const data = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);

    const dateString = date.toLocaleDateString("en-CA");

    labels.push(date.toLocaleDateString("en-IN", {
      weekday: "short"
    }));

    const dayRecords = records.filter(item => item.date === dateString);

    const total = dayRecords.length
      ? dayRecords.reduce((sum, item) => sum + item.duration, 0) / dayRecords.length
      : 0;

    data.push(Number((total / 60).toFixed(2)));
  }

  message.textContent = "Graph shows average sleep duration for each day.";

  if (sleepChart) {
    sleepChart.destroy();
  }

  sleepChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Sleep Hours",
        data,
        backgroundColor: "#00bfa6",
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        y: {
          beginAtZero: true,
          suggestedMax: 10,
          title: {
            display: true,
            text: "Hours of Sleep",
            color: "#cccccc"
          },
          ticks: {
            color: "#cccccc"
          },
          grid: {
            color: "#333333"
          }
        },
        x: {
          ticks: {
            color: "#cccccc"
          },
          grid: {
            color: "#333333"
          }
        }
      },
      plugins: {
        legend: {
          labels: {
            color: "#cccccc"
          }
        }
      }
    }
  });
}

// Alarm sound
function playAlarmSound() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) return;

    if (!audioContext || audioContext.state === "closed") {
      audioContext = new AudioContextClass();
    }

    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.frequency.value = 850;
    gain.gain.value = 0.25;

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (error) {
    console.log("Audio could not play:", error);
  }
}

function startRinging() {
  if (ringingInterval) return;

  showMessage("alarmDisplay", "Wake up! Your alarm is ringing.");

  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("WakeBuddy Alarm", {
      body: "It's time to wake up!"
    });
  }

  playAlarmSound();
  ringingInterval = setInterval(playAlarmSound, 1200);
}

function stopRinging() {
  if (ringingInterval) {
    clearInterval(ringingInterval);
    ringingInterval = null;
  }

  if (audioContext && audioContext.state !== "closed") {
    audioContext.close();
    audioContext = null;
  }
}

// Set alarm
$("setAlarm").addEventListener("click", async () => {
  const selectedTime = $("alarmTime").value;

  if (!selectedTime) {
    showMessage("alarmDisplay", "Please choose an alarm time.");
    return;
  }

  stopRinging();

  alarmTimeValue = selectedTime;
  localStorage.setItem("wakebuddyAlarm", alarmTimeValue);

  if ("Notification" in window && Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch (error) {
      console.log("Notification permission unavailable.");
    }
  }

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioContext = new AudioContextClass();
      await audioContext.resume();
    }
  } catch (error) {
    console.log("Audio permission unavailable.");
  }

  showMessage("alarmDisplay", `Alarm set for ${alarmTimeValue}. Keep this page open.`);
});

$("stopAlarm").addEventListener("click", () => {
  stopRinging();

  alarmTimeValue = "";
  localStorage.removeItem("wakebuddyAlarm");

  showMessage("alarmDisplay", "Alarm stopped or removed.");
});

// Daily bedtime reminder
$("setReminder").addEventListener("click", async () => {
  const selectedTime = $("reminderTime").value;

  if (!selectedTime) {
    showMessage("reminderDisplay", "Please choose a reminder time.");
    return;
  }

  reminderTimeValue = selectedTime;
  localStorage.setItem("wakebuddyReminder", reminderTimeValue);

  if ("Notification" in window && Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch (error) {
      console.log("Notification permission unavailable.");
    }
  }

  showMessage("reminderDisplay", `Daily sleep reminder set for ${reminderTimeValue}.`);
});

$("removeReminder").addEventListener("click", () => {
  reminderTimeValue = "";
  localStorage.removeItem("wakebuddyReminder");

  showMessage("reminderDisplay", "Sleep reminder removed.");
});

// Check alarms and reminders
function checkSchedules() {
  const now = new Date();

  const currentTime = now.toTimeString().slice(0, 5);
  const today = now.toLocaleDateString("en-CA");
  const triggerKey = `${today}-${currentTime}`;

  if (alarmTimeValue && currentTime === alarmTimeValue &&
      lastAlarmTriggered !== triggerKey) {
    lastAlarmTriggered = triggerKey;
    startRinging();
  }

  if (reminderTimeValue && currentTime === reminderTimeValue &&
      lastReminderTriggered !== triggerKey) {
    lastReminderTriggered = triggerKey;

    showMessage("reminderDisplay", "It's bedtime! Time to get ready for sleep.");

    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("WakeBuddy Sleep Reminder", {
        body: "It's time to get ready for bed. Have a good night!"
      });
    }
  }
}

// Restore saved schedules after page refresh
function restoreSchedules() {
  if (alarmTimeValue) {
    $("alarmTime").value = alarmTimeValue;
    showMessage("alarmDisplay", `Alarm set for ${alarmTimeValue}.`);
  }

  if (reminderTimeValue) {
    $("reminderTime").value = reminderTimeValue;
    showMessage("reminderDisplay", `Daily reminder set for ${reminderTimeValue}.`);
  }
}

function updateAll() {
  updateDashboard();
  analyzeSleep();
  displayHistory();
  drawWeeklyGraph();
}

// Initialize application
restoreSchedules();
updateAll();

setInterval(checkSchedules, 1000);
