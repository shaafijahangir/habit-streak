/* ─── CONFIG ─────────────────────────────────────────────────────────────── */

const DEFAULT_HABITS = [
  { id: 'gym-001',    name: 'Gym',            icon: '🏋️' },
  { id: 'code-001',   name: 'Write code',     icon: '💻' },
  { id: 'pray-001',   name: 'Pray',           icon: '🙏' },
  { id: 'social-001', name: 'Post on social', icon: '📱' },
];

const STORAGE_KEY = 'streaks_v1';

/* ─── STATE ──────────────────────────────────────────────────────────────── */

let state = {
  habits: [],
  completedToday: [],
  lastCheckedDate: null,
  history: {},  // { "2026-03-27": ["gym-001", "code-001"], ... }
};

/* ─── DATE UTILS ─────────────────────────────────────────────────────────── */

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getYesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateLabel() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function formatDateStr(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/* ─── STORAGE ────────────────────────────────────────────────────────────── */

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      state = JSON.parse(raw);
      // Migrate: ensure history exists
      if (!state.history) state.history = {};
    } else {
      state.habits = DEFAULT_HABITS.map(h => ({
        ...h,
        streak: 0,
        lastCompleted: null,
      }));
      state.completedToday = [];
      state.lastCheckedDate = getToday();
      state.history = {};
    }
  } catch (_) {
    state.habits = DEFAULT_HABITS.map(h => ({ ...h, streak: 0, lastCompleted: null }));
    state.completedToday = [];
    state.lastCheckedDate = getToday();
    state.history = {};
  }

  // Backfill today's history from completedToday
  const today = getToday();
  if (state.completedToday.length > 0) {
    if (!state.history[today]) state.history[today] = [];
    state.completedToday.forEach(id => {
      if (!state.history[today].includes(id)) state.history[today].push(id);
    });
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_) { /* storage unavailable, degrade gracefully */ }
}

function resetIfNewDay() {
  const today = getToday();
  if (state.lastCheckedDate === today) return;

  const yesterday = getYesterday();
  state.habits.forEach(h => {
    if (h.lastCompleted !== yesterday && h.lastCompleted !== today) {
      h.streak = 0;
    }
  });
  state.completedToday = [];
  state.lastCheckedDate = today;
  save();
}

/* ─── HABIT LOGIC ────────────────────────────────────────────────────────── */

function completeHabit(id) {
  if (state.completedToday.includes(id)) return;
  const habit = state.habits.find(h => h.id === id);
  if (!habit) return;
  habit.streak += 1;
  habit.lastCompleted = getToday();
  state.completedToday.push(id);

  // Track in history
  const today = getToday();
  if (!state.history[today]) state.history[today] = [];
  if (!state.history[today].includes(id)) state.history[today].push(id);

  save();
}

function generateId(name) {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '-' + Date.now();
}

/* ─── RENDER ─────────────────────────────────────────────────────────────── */

const habitListEl = document.getElementById('habitList');
const editListEl  = document.getElementById('editList');
const dateLabel   = document.getElementById('dateLabel');

function renderHabits() {
  habitListEl.innerHTML = '';

  if (state.habits.length === 0) {
    habitListEl.innerHTML = '<p class="empty-state">No habits yet.<br>Tap the pencil to add some.</p>';
    return;
  }

  state.habits.forEach(habit => {
    const done = state.completedToday.includes(habit.id);

    const pill = document.createElement('button');
    pill.className = 'habit-pill' + (done ? ' completed' : '');
    pill.dataset.id = habit.id;
    pill.setAttribute('aria-label', `${habit.name}, streak ${habit.streak}`);

    pill.innerHTML = `
      <div class="pill-fill"></div>
      <div class="pill-content">
        <span class="habit-icon">${habit.icon}</span>
        <span class="habit-name">${escHtml(habit.name)}</span>
        <span class="habit-streak">🔥<span class="streak-num">${habit.streak}</span></span>
      </div>
      <div class="pill-check">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
    `;

    habitListEl.appendChild(pill);
  });

  checkAllDone();
}

function checkAllDone() {
  // Remove existing banner
  const existing = habitListEl.querySelector('.all-done');
  if (existing) existing.remove();

  if (state.habits.length === 0) return;
  const allDone = state.habits.every(h => state.completedToday.includes(h.id));
  if (!allDone) return;

  const banner = document.createElement('div');
  banner.className = 'all-done';
  banner.innerHTML = `
    <span class="all-done-emoji">🎉</span>
    <span class="all-done-text">All done for today!</span>
    <span class="all-done-sub">Come back tomorrow to keep your streaks.</span>
  `;
  habitListEl.appendChild(banner);
  requestAnimationFrame(() => banner.classList.add('visible'));
}

function renderEditList() {
  editListEl.innerHTML = '';
  state.habits.forEach(habit => {
    const li = document.createElement('li');
    li.className = 'edit-item';
    li.dataset.id = habit.id;
    li.setAttribute('draggable', 'true');
    li.innerHTML = `
      <span class="drag-handle" aria-hidden="true">⠿</span>
      <span class="edit-item-icon">${habit.icon}</span>
      <span class="edit-item-name">${escHtml(habit.name)}</span>
      <button class="btn-delete" aria-label="Delete ${escHtml(habit.name)}">✕</button>
    `;
    editListEl.appendChild(li);
  });
  bindEditListEvents();
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ─── ANIMATION ──────────────────────────────────────────────────────────── */

function animatePill(pillEl, id) {
  if (pillEl.classList.contains('animating') || pillEl.classList.contains('completed')) return;
  pillEl.classList.add('animating', 'completing');

  setTimeout(() => {
    completeHabit(id);
    pillEl.classList.add('completed');
    pillEl.classList.remove('completing');

    // Update streak number without full re-render
    const habit = state.habits.find(h => h.id === id);
    const numEl = pillEl.querySelector('.streak-num');
    if (numEl && habit) numEl.textContent = habit.streak;

    // Confetti burst from pill center
    const rect = pillEl.getBoundingClientRect();
    confettiBurst(rect.left + rect.width / 2, rect.top + rect.height / 2);

    checkAllDone();
  }, 380);
}

/* ─── CONFETTI ───────────────────────────────────────────────────────────── */

const canvas = document.getElementById('confettiCanvas');
const ctx = canvas.getContext('2d');
let particles = [];
let rafId = null;

function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const COLORS = ['#7C5CFC', '#FF6B35', '#FFFFFF', '#A78BFA', '#FDB563'];

function confettiBurst(cx, cy) {
  for (let i = 0; i < 28; i++) {
    const angle = (Math.PI * 2 * i) / 28 + (Math.random() - 0.5) * 0.4;
    const speed = 2.5 + Math.random() * 4;
    particles.push({
      x:  cx,
      y:  cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      size: 4 + Math.random() * 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      alpha: 1,
      rot: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 0.2,
    });
  }
  if (!rafId) loop();
}

function loop() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles = particles.filter(p => p.alpha > 0.02);

  particles.forEach(p => {
    p.x  += p.vx;
    p.y  += p.vy;
    p.vy += 0.18;        // gravity
    p.vx *= 0.98;        // drag
    p.alpha -= 0.022;
    p.rot += p.rotV;

    ctx.save();
    ctx.globalAlpha = Math.max(p.alpha, 0);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
    ctx.restore();
  });

  if (particles.length > 0) {
    rafId = requestAnimationFrame(loop);
  } else {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    rafId = null;
  }
}

/* ─── CALENDAR ──────────────────────────────────────────────────────────── */

const calendarPanel = document.getElementById('calendarPanel');
const calGrid       = document.getElementById('calGrid');
const calMonthLabel = document.getElementById('calMonthLabel');
const calStreaks     = document.getElementById('calStreaks');
const btnCalendar   = document.getElementById('btnCalendar');
const btnPrevMonth  = document.getElementById('btnPrevMonth');
const btnNextMonth  = document.getElementById('btnNextMonth');

let calYear, calMonth; // 0-indexed month

function openCalendar() {
  const now = new Date();
  calYear = now.getFullYear();
  calMonth = now.getMonth();

  appHeader.classList.add('hidden');
  habitListEl.classList.add('hidden');
  editPanel.setAttribute('hidden', '');
  calendarPanel.removeAttribute('hidden');
  btnCalendar.classList.add('active');

  renderCalendar();
}

function closeCalendar() {
  calendarPanel.setAttribute('hidden', '');
  appHeader.classList.remove('hidden');
  habitListEl.classList.remove('hidden');
  btnCalendar.classList.remove('active');
  renderHabits();
}

function toggleCalendar() {
  if (calendarPanel.hasAttribute('hidden')) {
    openCalendar();
  } else {
    closeCalendar();
  }
}

function renderCalendar() {
  const now = new Date();
  const todayY = now.getFullYear();
  const todayM = now.getMonth();
  const todayD = now.getDate();
  const todayStr = getToday();

  // Month label
  const monthName = new Date(calYear, calMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  calMonthLabel.textContent = monthName;

  // Disable next if current month
  btnNextMonth.disabled = (calYear === todayY && calMonth === todayM);

  // Build grid
  calGrid.innerHTML = '';

  // Day-of-week headers
  const dows = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  dows.forEach(d => {
    const el = document.createElement('div');
    el.className = 'calendar-dow';
    el.textContent = d;
    calGrid.appendChild(el);
  });

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const habitCount = state.habits.length;

  let completedDays = 0;
  let totalCompletions = 0;

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    const el = document.createElement('div');
    el.className = 'calendar-day empty';
    calGrid.appendChild(el);
  }

  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = formatDateStr(calYear, calMonth, d);
    const completions = state.history[dateStr] || [];
    const count = completions.length;
    const isFuture = (calYear > todayY) ||
                     (calYear === todayY && calMonth > todayM) ||
                     (calYear === todayY && calMonth === todayM && d > todayD);
    const isToday = dateStr === todayStr;
    const allDone = habitCount > 0 && count >= habitCount;

    const el = document.createElement('div');
    el.className = 'calendar-day';
    if (isToday) el.classList.add('today');
    if (isFuture) el.classList.add('future');
    if (count > 0 && !isFuture) el.classList.add('has-completions');
    if (allDone && !isFuture) el.classList.add('all-completed');

    // Day number
    const numEl = document.createElement('span');
    numEl.textContent = d;
    el.appendChild(numEl);

    // Dots for partial completions (skip if all done — already highlighted)
    if (count > 0 && !allDone && !isFuture) {
      const dotsEl = document.createElement('div');
      dotsEl.className = 'calendar-dots';
      const dotsToShow = Math.min(count, 4);
      for (let i = 0; i < dotsToShow; i++) {
        const dot = document.createElement('div');
        dot.className = 'calendar-dot';
        dotsEl.appendChild(dot);
      }
      el.appendChild(dotsEl);
    }

    if (!isFuture && count > 0) {
      totalCompletions += count;
      if (allDone) completedDays++;
    }

    calGrid.appendChild(el);
  }

  // Streak summary
  calStreaks.innerHTML = '';

  if (state.habits.length > 0) {
    // Month stats
    const statsEl = document.createElement('div');
    statsEl.className = 'calendar-month-stats';
    const pastDays = (calYear === todayY && calMonth === todayM) ? todayD : daysInMonth;
    statsEl.textContent = `${completedDays} perfect day${completedDays !== 1 ? 's' : ''} · ${totalCompletions} total check-in${totalCompletions !== 1 ? 's' : ''} this month`;
    calStreaks.appendChild(statsEl);

    // Per-habit streaks
    state.habits.forEach(habit => {
      const row = document.createElement('div');
      row.className = 'calendar-streak-row';
      row.innerHTML = `
        <span class="calendar-streak-icon">${habit.icon}</span>
        <span class="calendar-streak-name">${escHtml(habit.name)}</span>
        <span class="calendar-streak-badge">🔥 ${habit.streak}</span>
      `;
      calStreaks.appendChild(row);
    });
  }
}

/* ─── EDIT MODE ──────────────────────────────────────────────────────────── */

const editPanel  = document.getElementById('editPanel');
const appHeader  = document.querySelector('.app-header');
const btnEdit    = document.getElementById('btnEdit');
const btnDone    = document.getElementById('btnDone');
const addInput   = document.getElementById('addInput');
const btnAdd     = document.getElementById('btnAdd');

function openEditMode() {
  // Close calendar if open
  calendarPanel.setAttribute('hidden', '');
  btnCalendar.classList.remove('active');

  appHeader.classList.add('hidden');
  habitListEl.classList.add('hidden');
  editPanel.removeAttribute('hidden');
  renderEditList();
}

function closeEditMode() {
  editPanel.setAttribute('hidden', '');
  appHeader.classList.remove('hidden');
  habitListEl.classList.remove('hidden');
  renderHabits();
}

function addHabit() {
  const raw = addInput.value.trim();
  if (!raw) return;
  if (state.habits.some(h => h.name.toLowerCase() === raw.toLowerCase())) {
    addInput.style.borderColor = '#FF6B6B';
    setTimeout(() => { addInput.style.borderColor = ''; }, 1000);
    return;
  }
  state.habits.push({
    id: generateId(raw),
    name: raw,
    icon: '✨',
    streak: 0,
    lastCompleted: null,
  });
  save();
  addInput.value = '';
  renderEditList();
  addInput.focus();
}

function deleteHabit(id) {
  state.habits = state.habits.filter(h => h.id !== id);
  state.completedToday = state.completedToday.filter(cid => cid !== id);
  save();
  renderEditList();
}

/* ─── DRAG-TO-REORDER (Pointer Events — works on touch + mouse) ──────────── */

let dragSrc = null;

function bindEditListEvents() {
  // Delete buttons
  editListEl.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', e => {
      const item = e.currentTarget.closest('.edit-item');
      deleteHabit(item.dataset.id);
    });
  });

  // Drag reorder
  editListEl.querySelectorAll('.edit-item').forEach(item => {
    item.addEventListener('dragstart', e => {
      dragSrc = item;
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      editListEl.querySelectorAll('.edit-item').forEach(i => i.classList.remove('drag-over'));
      dragSrc = null;
    });

    item.addEventListener('dragover', e => {
      e.preventDefault();
      if (!dragSrc || dragSrc === item) return;
      editListEl.querySelectorAll('.edit-item').forEach(i => i.classList.remove('drag-over'));
      item.classList.add('drag-over');
    });

    item.addEventListener('drop', e => {
      e.preventDefault();
      if (!dragSrc || dragSrc === item) return;
      item.classList.remove('drag-over');

      const ids = [...editListEl.querySelectorAll('.edit-item')].map(i => i.dataset.id);
      const srcIdx  = ids.indexOf(dragSrc.dataset.id);
      const destIdx = ids.indexOf(item.dataset.id);

      const reordered = [...state.habits];
      const [moved] = reordered.splice(srcIdx, 1);
      reordered.splice(destIdx, 0, moved);
      state.habits = reordered;
      save();
      renderEditList();
    });
  });
}

/* ─── INIT ───────────────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  load();
  resetIfNewDay();

  dateLabel.textContent = formatDateLabel();

  renderHabits();

  // Delegated click on habit list
  habitListEl.addEventListener('click', e => {
    const pill = e.target.closest('.habit-pill');
    if (!pill || pill.classList.contains('completed') || pill.classList.contains('animating')) return;
    animatePill(pill, pill.dataset.id);
  });

  btnEdit.addEventListener('click', openEditMode);
  btnDone.addEventListener('click', closeEditMode);

  btnAdd.addEventListener('click', addHabit);
  addInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') addHabit();
  });

  // Calendar
  btnCalendar.addEventListener('click', toggleCalendar);
  btnPrevMonth.addEventListener('click', () => {
    calMonth--;
    if (calMonth < 0) { calMonth = 11; calYear--; }
    renderCalendar();
  });
  btnNextMonth.addEventListener('click', () => {
    const now = new Date();
    if (calYear === now.getFullYear() && calMonth === now.getMonth()) return;
    calMonth++;
    if (calMonth > 11) { calMonth = 0; calYear++; }
    renderCalendar();
  });
});
