(function() {
  "use strict";

  // --- Storage helpers ---

  function load(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  var KEYS = {
    tasks: "timewatch_tasks",
    entries: "timewatch_entries",
    activeTimer: "timewatch_activeTimer"
  };

  function uuid() {
    return crypto.randomUUID ? crypto.randomUUID() :
      "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0;
        return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
      });
  }

  // --- Date helpers ---

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function formatDateDisplay(dateStr) {
    var d = new Date(dateStr + "T12:00:00");
    var opts = { weekday: "short", month: "short", day: "numeric" };
    return d.toLocaleDateString(undefined, opts);
  }

  function shiftDate(dateStr, days) {
    var d = new Date(dateStr + "T12:00:00");
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  // --- UI utilities ---

  function escapeHTML(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  var toastTimeout = null;

  function showToast(msg) {
    var el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(function() {
      el.classList.remove("show");
    }, 2000);
  }

  // --- Data layer ---

  function getTasks() {
    return load(KEYS.tasks) || [];
  }

  function saveTasks(tasks) {
    save(KEYS.tasks, tasks);
  }

  function getEntries() {
    return load(KEYS.entries) || [];
  }

  function saveEntries(entries) {
    save(KEYS.entries, entries);
  }

  function getActiveTimer() {
    return load(KEYS.activeTimer);
  }

  function saveActiveTimer(timer) {
    save(KEYS.activeTimer, timer);
  }

  function addTask(name) {
    var tasks = getTasks();
    var task = { id: uuid(), name: name.trim(), createdAt: new Date().toISOString() };
    tasks.push(task);
    saveTasks(tasks);
    return task;
  }

  function renameTask(taskId, newName) {
    var tasks = getTasks();
    for (var i = 0; i < tasks.length; i++) {
      if (tasks[i].id === taskId) {
        tasks[i].name = newName.trim();
        break;
      }
    }
    saveTasks(tasks);
  }

  function removeTask(taskId) {
    var tasks = getTasks().filter(function(t) { return t.id !== taskId; });
    saveTasks(tasks);
  }

  function findTask(taskId) {
    var tasks = getTasks();
    for (var i = 0; i < tasks.length; i++) {
      if (tasks[i].id === taskId) return tasks[i];
    }
    return null;
  }

  function recordEntry(taskId, startISO, endISO) {
    var entries = getEntries();
    var date = startISO.slice(0, 10);
    entries.push({
      id: uuid(),
      taskId: taskId,
      start: startISO,
      end: endISO,
      date: date
    });
    saveEntries(entries);
  }

  function getEntriesForDate(dateStr) {
    return getEntries().filter(function(e) { return e.date === dateStr; });
  }

  function entryHours(entry) {
    var start = new Date(entry.start).getTime();
    var end = new Date(entry.end).getTime();
    return Math.max(0, (end - start) / 3600000);
  }

  // --- Timer display ---

  var timerInterval = null;

  function formatHMS(totalSec) {
    totalSec = Math.floor(totalSec);
    var h = Math.floor(totalSec / 3600);
    var m = Math.floor((totalSec % 3600) / 60);
    var s = totalSec % 60;
    return String(h).padStart(2, "0") + ":" +
           String(m).padStart(2, "0") + ":" +
           String(s).padStart(2, "0");
  }

  function formatElapsed(ms) {
    return formatHMS(ms / 1000);
  }

  function hoursToHMS(hours) {
    return formatHMS(hours * 3600);
  }

  function updateTimerDisplay() {
    var el = document.getElementById("timer-display");
    var active = getActiveTimer();
    if (!active) {
      el.classList.remove("active");
      el.innerHTML = '<span class="timer-idle">Click a task to start tracking</span>';
      return;
    }
    var task = findTask(active.taskId);
    var name = task ? task.name : "Unknown";
    var elapsed = Date.now() - new Date(active.start).getTime();
    var hours = (elapsed / 3600000).toFixed(2);
    el.classList.add("active");
    el.innerHTML =
      '<span class="timer-task">' + escapeHTML(name) + '</span>' +
      '<span class="timer-time">' + formatElapsed(elapsed) + ' (' + hours + 'h)</span>';
  }

  function startTimerDisplay() {
    stopTimerDisplay();
    updateTimerDisplay();
    timerInterval = setInterval(updateTimerDisplay, 1000);
  }

  function stopTimerDisplay() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    updateTimerDisplay();
  }

  // --- Timer logic ---

  function startTimer(taskId) {
    var active = getActiveTimer();
    if (active) {
      var now = new Date().toISOString();
      recordEntry(active.taskId, active.start, now);
    }

    var timer = { taskId: taskId, start: new Date().toISOString() };
    saveActiveTimer(timer);
    startTimerDisplay();
    render();
  }

  function stopTimer() {
    var active = getActiveTimer();
    if (!active) return;
    var now = new Date().toISOString();
    recordEntry(active.taskId, active.start, now);
    saveActiveTimer(null);
    stopTimerDisplay();
    render();
  }

  function toggleTimer(taskId) {
    var active = getActiveTimer();
    if (active && active.taskId === taskId) {
      stopTimer();
    } else {
      startTimer(taskId);
    }
  }

  // --- UI State ---

  var selectedDate = todayStr();

  function isToday() {
    return selectedDate === todayStr();
  }

  // --- Rendering ---

  function renderTaskGrid() {
    var grid = document.getElementById("task-grid");
    var tasks = getTasks();
    var active = getActiveTimer();
    var html = "";

    for (var i = 0; i < tasks.length; i++) {
      var t = tasks[i];
      var isActive = active && active.taskId === t.id;
      html += '<button class="task-btn' + (isActive ? " active" : "") + '" ' +
              'data-task-id="' + t.id + '">' +
              '<span class="task-remove" data-remove-id="' + t.id + '" title="Remove task">&times;</span>' +
              escapeHTML(t.name) +
              '</button>';
    }

    html += '<button class="task-btn task-btn-add" id="grid-add-task" title="Add task">+</button>';
    grid.innerHTML = html;
  }

  function renderTally() {
    var container = document.getElementById("tally-content");
    var entries = getEntriesForDate(selectedDate);
    var active = getActiveTimer();

    var taskHours = {};
    var taskOrder = [];

    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (!taskHours[e.taskId]) {
        taskHours[e.taskId] = 0;
        taskOrder.push(e.taskId);
      }
      taskHours[e.taskId] += entryHours(e);
    }

    if (active && active.start.slice(0, 10) === selectedDate) {
      if (!taskHours[active.taskId]) {
        taskHours[active.taskId] = 0;
        taskOrder.push(active.taskId);
      }
      taskHours[active.taskId] += (Date.now() - new Date(active.start).getTime()) / 3600000;
    }

    if (taskOrder.length === 0) {
      container.innerHTML = '<div class="tally-empty">No time entries for this day</div>';
      return;
    }

    var total = 0;
    var rows = "";
    for (var j = 0; j < taskOrder.length; j++) {
      var tid = taskOrder[j];
      var task = findTask(tid);
      var name = task ? task.name : "Deleted task";
      var h = taskHours[tid];
      total += h;
      rows += '<tr><td class="task-name">' + escapeHTML(name) + '</td>' +
              '<td class="task-hours" title="' + hoursToHMS(h) + '">' + h.toFixed(2) + 'h</td></tr>';
    }

    rows += '<tr class="total-row"><td class="task-name">Total</td>' +
            '<td class="task-hours" title="' + hoursToHMS(total) + '">' + total.toFixed(2) + 'h</td></tr>';

    container.innerHTML = '<table class="tally-table">' + rows + '</table>';
  }

  function renderDateNav() {
    document.getElementById("date-display").textContent = formatDateDisplay(selectedDate);
    var todayBtn = document.getElementById("date-today");
    todayBtn.classList.toggle("hidden", isToday());
  }

  function render() {
    renderDateNav();
    renderTaskGrid();
    renderTally();
  }

  // --- Modal dialog system ---

  function openModal(options, callback) {
    var overlay     = document.getElementById("modal-overlay");
    var titleEl     = document.getElementById("modal-title");
    var messageEl   = document.getElementById("modal-message");
    var inputEl     = document.getElementById("modal-input");
    var confirmBtn  = document.getElementById("modal-confirm");
    var cancelBtn   = document.getElementById("modal-cancel");

    titleEl.textContent   = options.title   || "";
    messageEl.textContent = options.message || "";
    confirmBtn.textContent = options.confirmLabel || "OK";
    confirmBtn.className = "action-btn " + (options.danger ? "danger" : "primary");

    var isPrompt = options.type === "prompt";
    inputEl.style.display = isPrompt ? "block" : "none";
    if (isPrompt) {
      inputEl.value = options.defaultValue || "";
    }

    overlay.classList.add("open");

    if (isPrompt) {
      inputEl.focus();
      inputEl.select();
    } else {
      confirmBtn.focus();
    }

    function close(result) {
      overlay.classList.remove("open");
      confirmBtn.removeEventListener("click", onConfirm);
      cancelBtn.removeEventListener("click", onCancel);
      overlay.removeEventListener("click", onOverlayClick);
      document.removeEventListener("keydown", onKeydown);
      callback(result);
    }

    function onConfirm() {
      close(isPrompt ? inputEl.value : true);
    }

    function onCancel() {
      close(null);
    }

    function onOverlayClick(e) {
      if (e.target === overlay) close(null);
    }

    function onKeydown(e) {
      if (e.key === "Escape") { e.preventDefault(); close(null); }
      if (e.key === "Enter")  { e.preventDefault(); onConfirm(); }
    }

    confirmBtn.addEventListener("click", onConfirm);
    cancelBtn.addEventListener("click", onCancel);
    overlay.addEventListener("click", onOverlayClick);
    document.addEventListener("keydown", onKeydown);
  }

  // --- Task management UI ---

  function promptAddTask() {
    openModal({ type: "prompt", title: "New Task", message: "Task name:" }, function(name) {
      if (name && name.trim()) {
        addTask(name);
        render();
      }
    });
  }

  function promptRenameTask(taskId) {
    var task = findTask(taskId);
    if (!task) return;
    openModal({
      type: "prompt",
      title: "Rename Task",
      message: "New name for \"" + task.name + "\":",
      defaultValue: task.name
    }, function(name) {
      if (name && name.trim() && name.trim() !== task.name) {
        renameTask(taskId, name);
        render();
      }
    });
  }

  function confirmRemoveTask(taskId) {
    var task = findTask(taskId);
    if (!task) return;
    openModal({
      type: "confirm",
      title: "Remove Task",
      message: "Remove \"" + task.name + "\"? Historical entries will be kept.",
      confirmLabel: "Remove",
      danger: true
    }, function(confirmed) {
      if (confirmed) {
        var active = getActiveTimer();
        if (active && active.taskId === taskId) {
          stopTimer();
        }
        removeTask(taskId);
        render();
      }
    });
  }

  // --- Export: Copy Summary ---

  function copySummary() {
    var entries = getEntriesForDate(selectedDate);
    var active = getActiveTimer();
    var taskHours = {};
    var taskOrder = [];

    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (!taskHours[e.taskId]) {
        taskHours[e.taskId] = 0;
        taskOrder.push(e.taskId);
      }
      taskHours[e.taskId] += entryHours(e);
    }

    if (active && active.start.slice(0, 10) === selectedDate) {
      if (!taskHours[active.taskId]) {
        taskHours[active.taskId] = 0;
        taskOrder.push(active.taskId);
      }
      taskHours[active.taskId] += (Date.now() - new Date(active.start).getTime()) / 3600000;
    }

    if (taskOrder.length === 0) {
      showToast("No entries to copy");
      return;
    }

    var total = 0;
    var rows = [];
    for (var j = 0; j < taskOrder.length; j++) {
      var tid = taskOrder[j];
      var task = findTask(tid);
      var name = task ? task.name : "Deleted task";
      var h = taskHours[tid];
      total += h;
      rows.push("| " + name + " | " + h.toFixed(2) + "h |");
    }
    rows.push("| **Total** | **" + total.toFixed(2) + "h** |");

    var dateLabel = formatDateDisplay(selectedDate);
    var text = "**TimeWatch — " + dateLabel + "**\n\n" +
      "| Task | Hours |\n" +
      "|------|-------|\n" +
      rows.join("\n");

    navigator.clipboard.writeText(text).then(function() {
      showToast("Summary copied to clipboard");
    }, function() {
      showToast("Failed to copy");
    });
  }

  // --- Export: JSON Backup & Restore ---

  function backupData() {
    var envelope = {
      version: 1,
      exportedAt: new Date().toISOString(),
      app: "timewatch",
      data: {
        tasks: load(KEYS.tasks),
        entries: load(KEYS.entries),
        activeTimer: load(KEYS.activeTimer)
      }
    };
    var json = JSON.stringify(envelope, null, 2);
    var blob = new Blob([json], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "timewatch-backup-" + todayStr() + ".json";
    a.click();
    URL.revokeObjectURL(url);
    showToast("Backup downloaded");
  }

  function handleRestoreFile(e) {
    var file = e.target.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        var data = JSON.parse(ev.target.result);
        if (!data.version || data.app !== "timewatch" ||
            !data.data || !data.data.tasks || !data.data.entries) {
          showToast("Invalid backup file");
          return;
        }
        backupData();
        save(KEYS.tasks, data.data.tasks);
        save(KEYS.entries, data.data.entries);
        save(KEYS.activeTimer, data.data.activeTimer || null);
        render();
        showToast("Data restored successfully");
      } catch (err) {
        showToast("Failed to restore: invalid file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  // --- Export: Date Range CSV ---

  function getEntriesForRange(startDate, endDate) {
    return getEntries().filter(function(e) {
      return e.date >= startDate && e.date <= endDate;
    });
  }

  function exportCSVRange(startDate, endDate) {
    var entries = getEntriesForRange(startDate, endDate);
    if (entries.length === 0) {
      showToast("No entries in selected range");
      return;
    }

    var lines = ["Date,Task,Start,End,Hours"];
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var task = findTask(e.taskId);
      var name = task ? task.name : "Deleted task";
      var hours = entryHours(e).toFixed(2);
      var startTime = new Date(e.start).toLocaleTimeString();
      var endTime = new Date(e.end).toLocaleTimeString();
      lines.push(e.date + ',"' + name.replace(/"/g, '""') + '",' + startTime + ',' + endTime + ',' + hours);
    }

    var csv = lines.join("\n");
    var blob = new Blob([csv], { type: "text/csv" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    var filename = startDate === endDate
      ? "timewatch-" + startDate + ".csv"
      : "timewatch-" + startDate + "-to-" + endDate + ".csv";
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast("CSV downloaded");
  }

  function toggleCSVPanel() {
    var panel = document.getElementById("csv-panel");
    panel.classList.toggle("open");
  }

  function setCSVPreset(preset) {
    var today = todayStr();
    var startInput = document.getElementById("csv-start");
    var endInput = document.getElementById("csv-end");

    if (preset === "today") {
      startInput.value = today;
      endInput.value = today;
    } else if (preset === "week") {
      var d = new Date(today + "T12:00:00");
      var day = d.getDay();
      var diff = day === 0 ? 6 : day - 1;
      startInput.value = shiftDate(today, -diff);
      endInput.value = today;
    } else if (preset === "month") {
      startInput.value = today.slice(0, 8) + "01";
      endInput.value = today;
    }
  }

  function downloadCSVRange() {
    var startDate = document.getElementById("csv-start").value;
    var endDate = document.getElementById("csv-end").value;
    if (!startDate || !endDate) {
      showToast("Select start and end dates");
      return;
    }
    if (startDate > endDate) {
      showToast("Start date must be before end date");
      return;
    }
    exportCSVRange(startDate, endDate);
  }

  // --- Event wiring ---

  document.getElementById("task-grid").addEventListener("click", function(e) {
    var removeId = e.target.getAttribute("data-remove-id");
    if (removeId) {
      e.stopPropagation();
      confirmRemoveTask(removeId);
      return;
    }

    if (e.target.id === "grid-add-task") {
      promptAddTask();
      return;
    }

    var btn = e.target.closest(".task-btn");
    if (btn && btn.dataset.taskId) {
      toggleTimer(btn.dataset.taskId);
    }
  });

  document.getElementById("task-grid").addEventListener("dblclick", function(e) {
    var btn = e.target.closest(".task-btn");
    if (btn && btn.dataset.taskId) {
      e.preventDefault();
      promptRenameTask(btn.dataset.taskId);
    }
  });

  document.getElementById("date-prev").addEventListener("click", function() {
    selectedDate = shiftDate(selectedDate, -1);
    render();
  });

  document.getElementById("date-next").addEventListener("click", function() {
    selectedDate = shiftDate(selectedDate, 1);
    render();
  });

  document.getElementById("date-today").addEventListener("click", function() {
    selectedDate = todayStr();
    render();
  });

  document.getElementById("btn-add-task").addEventListener("click", promptAddTask);
  document.getElementById("btn-export-csv").addEventListener("click", toggleCSVPanel);
  document.getElementById("btn-copy-summary").addEventListener("click", copySummary);
  document.getElementById("btn-backup").addEventListener("click", backupData);
  document.getElementById("btn-restore").addEventListener("click", function() {
    document.getElementById("restore-file-input").click();
  });
  document.getElementById("restore-file-input").addEventListener("change", handleRestoreFile);
  document.getElementById("btn-csv-download").addEventListener("click", downloadCSVRange);

  document.querySelectorAll(".csv-preset-btn").forEach(function(btn) {
    btn.addEventListener("click", function() {
      setCSVPreset(btn.dataset.preset);
    });
  });

  // --- Initialization ---

  var active = getActiveTimer();
  if (active) {
    startTimerDisplay();
  }

  setInterval(function() {
    if (getActiveTimer()) {
      renderTally();
    }
  }, 1000);

  render();
})();
