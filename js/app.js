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
    activeTimer: "timewatch_activeTimer",
    theme: "timewatch_theme"
  };

  function uuid() {
    return crypto.randomUUID ? crypto.randomUUID() :
      "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0;
        return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
      });
  }

  // --- Date helpers ---

  function localDateStr(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, "0");
    var d = String(date.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  function parseLocalDate(dateStr) {
    var p = dateStr.split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  function todayStr() {
    return localDateStr(new Date());
  }

  function formatDateDisplay(dateStr) {
    var d = parseLocalDate(dateStr);
    var opts = { weekday: "short", month: "short", day: "numeric" };
    return d.toLocaleDateString(undefined, opts);
  }

  function shiftDate(dateStr, days) {
    var d = parseLocalDate(dateStr);
    d.setDate(d.getDate() + days);
    return localDateStr(d);
  }

  // --- UI utilities ---

  function escapeHTML(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Theme ---

  function applyTheme(name) {
    document.documentElement.setAttribute("data-theme", name);
    save(KEYS.theme, name);
    document.querySelectorAll(".theme-swatch").forEach(function(s) {
      s.classList.toggle("active", s.dataset.theme === name);
    });
  }

  function initTheme() {
    var name = load(KEYS.theme) || "amber";
    document.documentElement.setAttribute("data-theme", name);
    document.querySelectorAll(".theme-swatch").forEach(function(s) {
      s.classList.toggle("active", s.dataset.theme === name);
    });
  }

  var toastTimeout = null;
  var undoStack = null; // { action: string, data: object }

  function pushUndo(action, data) {
    undoStack = { action: action, data: data };
  }

  function clearUndo() {
    undoStack = null;
  }

  function performUndo() {
    if (!undoStack) return;
    var entry = undoStack;
    clearUndo();
    document.getElementById("toast").classList.remove("show");

    if (entry.action === "remove-task") {
      var tasks = getTasks();
      tasks.splice(entry.data.index, 0, entry.data.task);
      saveTasks(tasks);
      var entries = getEntries();
      entry.data.entries.forEach(function(e) { entries.push(e); });
      saveEntries(entries);
      if (entry.data.activeTimer) {
        saveActiveTimer(entry.data.activeTimer);
        startTimerDisplay();
      }
      render();
      showToast("Task restored");

    } else if (entry.action === "stop-timer") {
      var timerEntries = getEntries().filter(function(e) { return e.id !== entry.data.entryId; });
      saveEntries(timerEntries);
      saveActiveTimer(entry.data.timer);
      startTimerDisplay();
      render();
      showToast("Timer restored");

    } else if (entry.action === "restore-backup") {
      saveTasks(entry.data.tasks);
      saveEntries(entry.data.entries);
      saveActiveTimer(entry.data.activeTimer);
      if (entry.data.activeTimer) {
        startTimerDisplay();
      } else {
        stopTimerDisplay();
      }
      render();
      showToast("Restore undone");
    }
  }

  function showToast(msg, undoable) {
    var el = document.getElementById("toast");
    el.innerHTML = "";
    var msgSpan = document.createElement("span");
    msgSpan.textContent = msg;
    el.appendChild(msgSpan);

    if (undoable && undoStack) {
      var btn = document.createElement("button");
      btn.className = "toast-undo-btn";
      btn.textContent = "Undo";
      btn.addEventListener("click", function() {
        performUndo();
      });
      el.appendChild(btn);
    }

    el.classList.add("show");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(function() {
      el.classList.remove("show");
      clearUndo();
    }, undoable ? 5000 : 2000);
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

  function validateTaskName(name) {
    if (!name || !name.trim()) return "Task name cannot be blank";
    if (name.trim().length > 60) return "Task name must be 60 characters or less";
    return null;
  }

  function addTask(name) {
    var err = validateTaskName(name);
    if (err) { showToast(err); return null; }
    var trimmed = name.trim();
    var tasks = getTasks();
    for (var i = 0; i < tasks.length; i++) {
      if (tasks[i].name.toLowerCase() === trimmed.toLowerCase()) {
        showToast("A task named \u201c" + trimmed + "\u201d already exists");
        break;
      }
    }
    var task = { id: uuid(), name: trimmed, createdAt: new Date().toISOString() };
    tasks.push(task);
    saveTasks(tasks);
    return task;
  }

  function renameTask(taskId, newName) {
    var err = validateTaskName(newName);
    if (err) { showToast(err); return false; }
    var trimmed = newName.trim();
    var tasks = getTasks();
    for (var i = 0; i < tasks.length; i++) {
      if (tasks[i].id !== taskId && tasks[i].name.toLowerCase() === trimmed.toLowerCase()) {
        showToast("A task named \u201c" + trimmed + "\u201d already exists");
        break;
      }
    }
    for (var j = 0; j < tasks.length; j++) {
      if (tasks[j].id === taskId) {
        tasks[j].name = trimmed;
        break;
      }
    }
    saveTasks(tasks);
    return true;
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
    var start = new Date(startISO);
    var end = new Date(endISO);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      showToast("Invalid time entry: bad date format");
      return false;
    }
    if (end <= start) {
      showToast("End time must be after start time");
      return false;
    }
    var entries = getEntries();
    entries.push({
      id: uuid(),
      taskId: taskId,
      start: startISO,
      end: endISO,
      date: localDateStr(start)
    });
    saveEntries(entries);
    return true;
  }

  function getEntriesForDate(dateStr) {
    return getEntries().filter(function(e) { return e.date === dateStr; });
  }

  function updateEntry(entryId, taskId, startISO, endISO) {
    var start = new Date(startISO);
    var end = new Date(endISO);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      showToast("End time must be after start time");
      return false;
    }
    var entries = getEntries();
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].id === entryId) {
        entries[i].taskId = taskId;
        entries[i].start = startISO;
        entries[i].end = endISO;
        entries[i].date = localDateStr(start);
        break;
      }
    }
    saveEntries(entries);
    return true;
  }

  function deleteEntry(entryId) {
    var entries = getEntries().filter(function(e) { return e.id !== entryId; });
    saveEntries(entries);
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
    var entryId = uuid();

    pushUndo("stop-timer", {
      timer: active,
      entryId: entryId
    });

    var entries = getEntries();
    var start = new Date(active.start);
    entries.push({
      id: entryId,
      taskId: active.taskId,
      start: active.start,
      end: now,
      date: localDateStr(start)
    });
    saveEntries(entries);
    saveActiveTimer(null);
    stopTimerDisplay();
    render();
    showToast("Timer stopped", true);
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
      var tabindex = i === 0 ? '0' : '-1';
      html += '<button class="task-btn' + (isActive ? " active" : "") + '" ' +
              'role="gridcell" ' +
              'aria-pressed="' + (isActive ? 'true' : 'false') + '" ' +
              'tabindex="' + tabindex + '" ' +
              'data-task-id="' + t.id + '">' +
              '<span class="task-remove" role="button" tabindex="-1" data-remove-id="' + t.id + '" title="Remove task" aria-label="Remove task">&times;</span>' +
              escapeHTML(t.name) +
              '</button>';
    }

    html += '<button class="task-btn task-btn-add" id="grid-add-task" title="Add task" aria-label="Add task" tabindex="0">+</button>';
    grid.innerHTML = html;
  }

  function renderTally() {
    var container = document.getElementById("tally-content");
    var entries = getEntriesForDate(selectedDate);
    var active = getActiveTimer();

    var rows = "";
    var total = 0;

    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var task = findTask(e.taskId);
      var name = task ? task.name : "Deleted task";
      var h = entryHours(e);
      total += h;
      var startDate = new Date(e.start);
      var endDate = new Date(e.end);
      var startStr = String(startDate.getHours()).padStart(2, "0") + ":" + String(startDate.getMinutes()).padStart(2, "0");
      var endStr   = String(endDate.getHours()).padStart(2, "0") + ":" + String(endDate.getMinutes()).padStart(2, "0");
      rows += '<tr>' +
        '<td class="task-name">' + escapeHTML(name) + '</td>' +
        '<td class="task-hours">' + startStr + '\u2013' + endStr + '</td>' +
        '<td class="task-hours" title="' + hoursToHMS(h) + '">' + h.toFixed(2) + 'h</td>' +
        '<td><button class="tally-edit-btn" data-entry-id="' + e.id + '" aria-label="Edit entry" title="Edit entry">\u270e</button></td>' +
        '</tr>';
    }

    if (active && localDateStr(new Date(active.start)) === selectedDate) {
      var activeTask = findTask(active.taskId);
      var activeName = activeTask ? activeTask.name : "Unknown";
      var activeH = (Date.now() - new Date(active.start).getTime()) / 3600000;
      total += activeH;
      var activeStart = new Date(active.start);
      var activeStartStr = String(activeStart.getHours()).padStart(2, "0") + ":" + String(activeStart.getMinutes()).padStart(2, "0");
      rows += '<tr>' +
        '<td class="task-name">' + escapeHTML(activeName) + ' <span style="opacity:0.5">(active)</span></td>' +
        '<td class="task-hours">' + activeStartStr + '\u2013\u2026</td>' +
        '<td class="task-hours">' + activeH.toFixed(2) + 'h</td>' +
        '<td></td>' +
        '</tr>';
    }

    if (!rows) {
      container.innerHTML = '<div class="tally-empty">No time entries for this day</div>';
      return;
    }

    rows += '<tr class="total-row">' +
      '<td class="task-name">Total</td>' +
      '<td class="task-hours"></td>' +
      '<td class="task-hours" title="' + hoursToHMS(total) + '">' + total.toFixed(2) + 'h</td>' +
      '<td></td>' +
      '</tr>';

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
        var allTasks = getTasks();
        var taskIndex = -1;
        for (var i = 0; i < allTasks.length; i++) {
          if (allTasks[i].id === taskId) { taskIndex = i; break; }
        }
        var taskToRemove = findTask(taskId);
        var removedEntries = getEntries().filter(function(e) { return e.taskId === taskId; });
        var active = getActiveTimer();
        var timerWasActive = (active && active.taskId === taskId) ? active : null;

        if (timerWasActive) {
          saveActiveTimer(null);
          stopTimerDisplay();
        }

        pushUndo("remove-task", {
          task: taskToRemove,
          index: taskIndex,
          entries: removedEntries,
          activeTimer: timerWasActive
        });

        removeTask(taskId);
        render();
        showToast("Task removed", true);
      }
    });
  }

  // --- Manual time entry ---

  var manualModalKeyHandler = null;

  function openManualEntryModal() {
    var tasks = getTasks();
    if (tasks.length === 0) {
      showToast("Add a task first");
      return;
    }

    var select = document.getElementById("manual-task");
    select.innerHTML = "";
    for (var i = 0; i < tasks.length; i++) {
      var opt = document.createElement("option");
      opt.value = tasks[i].id;
      opt.textContent = tasks[i].name;
      select.appendChild(opt);
    }

    document.getElementById("manual-start").value = "";
    document.getElementById("manual-end").value = "";
    document.getElementById("manual-entry-modal").classList.add("open");
    document.getElementById("manual-start").focus();

    manualModalKeyHandler = function(e) {
      if (e.key === "Escape") { e.preventDefault(); closeManualEntryModal(); }
      if (e.key === "Enter")  { e.preventDefault(); submitManualEntry(); }
    };
    document.addEventListener("keydown", manualModalKeyHandler);
  }

  function closeManualEntryModal() {
    document.getElementById("manual-entry-modal").classList.remove("open");
    if (manualModalKeyHandler) {
      document.removeEventListener("keydown", manualModalKeyHandler);
      manualModalKeyHandler = null;
    }
  }

  var editEntryModalKeyHandler = null;
  var currentEditEntryId = null;

  function openEditEntryModal(entryId) {
    var entries = getEntries();
    var entry = null;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].id === entryId) { entry = entries[i]; break; }
    }
    if (!entry) return;

    var tasks = getTasks();
    var select = document.getElementById("edit-entry-task");
    select.innerHTML = "";
    for (var j = 0; j < tasks.length; j++) {
      var opt = document.createElement("option");
      opt.value = tasks[j].id;
      opt.textContent = tasks[j].name;
      if (tasks[j].id === entry.taskId) opt.selected = true;
      select.appendChild(opt);
    }

    var startDate = new Date(entry.start);
    var endDate = new Date(entry.end);
    document.getElementById("edit-entry-date").value = entry.date;
    document.getElementById("edit-entry-start").value =
      String(startDate.getHours()).padStart(2, "0") + ":" + String(startDate.getMinutes()).padStart(2, "0");
    document.getElementById("edit-entry-end").value =
      String(endDate.getHours()).padStart(2, "0") + ":" + String(endDate.getMinutes()).padStart(2, "0");

    currentEditEntryId = entryId;
    document.getElementById("edit-entry-modal").classList.add("open");
    document.getElementById("edit-entry-start").focus();

    editEntryModalKeyHandler = function(e) {
      if (e.key === "Escape") { e.preventDefault(); closeEditEntryModal(); }
    };
    document.addEventListener("keydown", editEntryModalKeyHandler);
  }

  function closeEditEntryModal() {
    document.getElementById("edit-entry-modal").classList.remove("open");
    currentEditEntryId = null;
    if (editEntryModalKeyHandler) {
      document.removeEventListener("keydown", editEntryModalKeyHandler);
      editEntryModalKeyHandler = null;
    }
  }

  function submitEditEntry() {
    if (!currentEditEntryId) return;
    var taskId = document.getElementById("edit-entry-task").value;
    var dateVal = document.getElementById("edit-entry-date").value;
    var startVal = document.getElementById("edit-entry-start").value;
    var endVal = document.getElementById("edit-entry-end").value;

    if (!dateVal || !startVal || !endVal) {
      showToast("Fill in all fields");
      return;
    }

    var startISO = new Date(dateVal + "T" + startVal + ":00").toISOString();
    var endISO   = new Date(dateVal + "T" + endVal   + ":00").toISOString();

    if (!updateEntry(currentEditEntryId, taskId, startISO, endISO)) return;
    closeEditEntryModal();
    render();
    showToast("Entry updated");
  }

  function confirmDeleteEntry(entryId) {
    closeEditEntryModal();
    openModal({
      type: "confirm",
      title: "Delete Entry",
      message: "Delete this time entry? This cannot be undone.",
      confirmLabel: "Delete",
      danger: true
    }, function(confirmed) {
      if (confirmed) {
        deleteEntry(entryId);
        render();
        showToast("Entry deleted");
      }
    });
  }

  function submitManualEntry() {
    var taskId = document.getElementById("manual-task").value;
    var startVal = document.getElementById("manual-start").value;
    var endVal = document.getElementById("manual-end").value;

    if (!startVal || !endVal) {
      showToast("Enter both start and end times");
      return;
    }

    var startISO = new Date(selectedDate + "T" + startVal + ":00").toISOString();
    var endISO = new Date(selectedDate + "T" + endVal + ":00").toISOString();

    if (endISO <= startISO) {
      showToast("End time must be after start time");
      return;
    }

    recordEntry(taskId, startISO, endISO);
    closeManualEntryModal();
    render();
    showToast("Time entry added");
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

    if (active && localDateStr(new Date(active.start)) === selectedDate) {
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
        pushUndo("restore-backup", {
          tasks: load(KEYS.tasks) || [],
          entries: load(KEYS.entries) || [],
          activeTimer: load(KEYS.activeTimer)
        });
        save(KEYS.tasks, data.data.tasks);
        save(KEYS.entries, data.data.entries);
        save(KEYS.activeTimer, data.data.activeTimer || null);
        render();
        showToast("Data restored. Click Undo to revert.", true);
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
      var d = parseLocalDate(today);
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

  document.getElementById("task-grid").addEventListener("keydown", function(e) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" &&
        e.key !== "ArrowDown"  && e.key !== "ArrowUp") return;

    var taskBtns = Array.prototype.slice.call(
      document.querySelectorAll("#task-grid .task-btn[data-task-id]")
    );
    if (taskBtns.length === 0) return;

    var current = document.activeElement;
    var idx = taskBtns.indexOf(current);
    if (idx === -1) return;

    e.preventDefault();

    var next;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      next = taskBtns[(idx + 1) % taskBtns.length];
    } else {
      next = taskBtns[(idx - 1 + taskBtns.length) % taskBtns.length];
    }

    // Roving tabindex: move tabindex="0" to the newly focused button
    taskBtns.forEach(function(btn) { btn.setAttribute("tabindex", "-1"); });
    next.setAttribute("tabindex", "0");
    next.focus();
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

  document.getElementById("theme-picker").addEventListener("click", function(e) {
    var btn = e.target.closest(".theme-swatch");
    if (btn && btn.dataset.theme) applyTheme(btn.dataset.theme);
  });

  document.getElementById("tally-content").addEventListener("click", function(e) {
    var editBtn = e.target.closest(".tally-edit-btn");
    if (editBtn && editBtn.dataset.entryId) {
      openEditEntryModal(editBtn.dataset.entryId);
    }
  });

  document.getElementById("edit-entry-cancel").addEventListener("click", closeEditEntryModal);
  document.getElementById("edit-entry-save").addEventListener("click", submitEditEntry);
  document.getElementById("edit-entry-delete").addEventListener("click", function() {
    if (currentEditEntryId) confirmDeleteEntry(currentEditEntryId);
  });
  document.getElementById("edit-entry-modal").addEventListener("click", function(e) {
    if (e.target === document.getElementById("edit-entry-modal")) closeEditEntryModal();
  });

  document.getElementById("btn-add-task").addEventListener("click", promptAddTask);
  document.getElementById("btn-add-time").addEventListener("click", openManualEntryModal);
  document.getElementById("manual-cancel").addEventListener("click", closeManualEntryModal);
  document.getElementById("manual-submit").addEventListener("click", submitManualEntry);
  document.getElementById("manual-entry-modal").addEventListener("click", function(e) {
    if (e.target === document.getElementById("manual-entry-modal")) closeManualEntryModal();
  });
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

  // --- Multi-tab safety ---

  window.addEventListener("storage", function(e) {
    if (!e.key || e.key.indexOf("timewatch_") !== 0) return;
    if (e.key === KEYS.theme) return;

    if (e.key === KEYS.activeTimer) {
      var hadTimer = e.oldValue && JSON.parse(e.oldValue);
      var nowHasTimer = e.newValue && JSON.parse(e.newValue);
      stopTimerDisplay();
      if (nowHasTimer) {
        startTimerDisplay();
        if (hadTimer) {
          showToast("Timer switched in another tab");
        } else {
          showToast("Timer started in another tab");
        }
      } else {
        updateTimerDisplay();
        if (hadTimer) showToast("Timer stopped in another tab");
      }
    }

    render();
  });

  // --- Initialization ---

  initTheme();

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
