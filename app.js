// app.js - UPSC AWFG 3-Month Intensive Tracker
// Production Grade Architecture with Reactive State & LocalStorage Persistence

(function() {
  'use strict';

  // State Management
  const STATE = {
    currentUser: null,
    users: {},
    activeView: 'schedule', // 'schedule' | 'roadmap' | 'matrix' | 'wysk'
    paperFilter: 'ALL',     // 'ALL' | 'GS-1' | 'GS-2' | 'GS-3' | 'GS-4'
    statusFilter: 'ALL',    // 'ALL' | 'completed' | 'pending' | 'overdue'
    searchQuery: '',
    startDate: '',
    targetDays: 90,
    cadence: 'auto_distribute',
    theme: 'dark',
    wyskPaper: 'ALL',
    wyskTopic: 'ALL',
    wyskSearch: '',
    wyskLimit: 60
  };

  // Helper: Format Date
  function formatDate(d) {
    if (!d || isNaN(d.getTime())) return 'N/A';
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  function getISO(d) {
    if (!d || isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  }

  function parseISO(str) {
    if (!str) return null;
    const parts = str.split('-');
    if (parts.length !== 3) return null;
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  }

  function daysDiff(d1, d2) {
    const t1 = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate()).getTime();
    const t2 = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate()).getTime();
    return Math.round((t1 - t2) / 86400000);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function escapeQuotes(str) {
    if (!str) return '';
    return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
  }

  // Toast Notification
  function showToast(message, icon = '✓') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => {
        if (toast.remove) toast.remove();
        else if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 2800);
  }

  // Load from Storage
  function loadStorage() {
    try {
      const savedUsers = localStorage.getItem('awfg_users_v2');
      if (savedUsers) {
        STATE.users = JSON.parse(savedUsers);
      }
      const active = localStorage.getItem('awfg_active_user_v2');
      if (active && STATE.users[active]) {
        STATE.currentUser = STATE.users[active];
      }
    } catch (e) {
      console.error('Storage error:', e);
    }

    // Default start date = today
    if (!STATE.startDate) {
      const today = new Date();
      STATE.startDate = getISO(today);
    }
  }

  function saveStorage() {
    try {
      if (STATE.currentUser) {
        STATE.users[STATE.currentUser.username] = STATE.currentUser;
        localStorage.setItem('awfg_active_user_v2', STATE.currentUser.username);
      }
      localStorage.setItem('awfg_users_v2', JSON.stringify(STATE.users));
    } catch (e) {
      console.error('Save error:', e);
    }
  }

  // Initialize Default User Profile if none exists
  function ensureUser(username, password = '') {
    if (!STATE.users[username]) {
      STATE.users[username] = {
        username: username,
        password: password,
        startDate: STATE.startDate || getISO(new Date()),
        targetDays: STATE.targetDays || 90,
        cadence: 'auto_distribute',
        theme: 'dark',
        testStatus: {}, // testId: { completed: bool, actualDate: '', notes: '' }
        mainsChecked: {},     // 'testId_idx': bool
        coincidingChecked: {},// 'testId_idx': bool
        exclusiveChecked: {}, // 'testId_idx': bool
        wyskChecked: {},      // 'testId_idx': bool
        wyskMasterChecked: {},// 'WYSK_id': bool
        notes: {},            // testId: string
        pyqAttempts: {},      // qKey: { selected, isCorrect, score, timestamp }
        mainsAnswers: {}      // mKey: { text, wordCount, targetWords, savedAt }
      };
    } else {
      if (!STATE.users[username].targetDays) STATE.users[username].targetDays = 90;
      if (!STATE.users[username].pyqAttempts) STATE.users[username].pyqAttempts = {};
      if (!STATE.users[username].mainsAnswers) STATE.users[username].mainsAnswers = {};
      if (!STATE.users[username].wyskMasterChecked) STATE.users[username].wyskMasterChecked = {};
    }
    STATE.currentUser = STATE.users[username];
    saveStorage();
  }

  function getTargetDays() {
    const user = STATE.currentUser;
    const days = parseInt(user ? user.targetDays : STATE.targetDays, 10);
    return (days && !isNaN(days) && days >= 15) ? days : 90;
  }

  // Target Date Calculator based on user-defined targetDays & cadence
  function getTargetDateForTest(test) {
    const baseDate = parseISO(STATE.currentUser ? STATE.currentUser.startDate : STATE.startDate) || new Date();
    const cadence = STATE.currentUser ? STATE.currentUser.cadence : STATE.cadence;
    const totalDays = getTargetDays();

    // Scale dynamically across user-defined target duration
    const bufferDays = Math.max(2, Math.round(totalDays * 0.12)); // ~12% buffer for final revision
    const activeSpan = Math.max(test.id, totalDays - bufferDays);

    let dayOffset = 0;
    if (cadence === 'every_2_days') {
      dayOffset = (test.id - 1) * 2;
    } else if (cadence === 'every_3_days') {
      dayOffset = (test.id - 1) * 3;
    } else if (cadence === 'mon_wed_fri' && totalDays === 90) {
      dayOffset = test.dayOffset; // preserve exact default AWFG schedule for 90d
    } else {
      // Dynamic proportional distribution across user-selected targetDays
      dayOffset = Math.round((test.id - 1) * (activeSpan / 32));
    }

    const target = new Date(baseDate.getTime() + dayOffset * 86400000);
    return target;
  }

  // Evaluate Test Status
  function getTestStatus(test) {
    const targetDate = getTargetDateForTest(test);
    const today = new Date();
    const user = STATE.currentUser;
    const testInfo = user && user.testStatus && user.testStatus[test.id] ? user.testStatus[test.id] : {};
    const isCompleted = !!testInfo.completed;
    const actualDateStr = testInfo.actualDate || '';
    const actualDate = actualDateStr ? parseISO(actualDateStr) : null;

    if (isCompleted) {
      if (actualDate && targetDate) {
        const diff = daysDiff(actualDate, targetDate);
        if (diff > 0) {
          return {
            type: 'delayed',
            label: `Delayed (+${diff}d)`,
            badgeClass: 'delayed',
            desc: `Completed on ${formatDate(actualDate)} (${diff} days after target)`
          };
        }
      }
      return {
        type: 'completed',
        label: 'Completed',
        badgeClass: 'completed',
        desc: actualDate ? `Completed on ${formatDate(actualDate)}` : 'Marked Completed'
      };
    }

    // Pending test
    const diffFromToday = daysDiff(targetDate, today);
    if (diffFromToday < 0) {
      const overdueDays = Math.abs(diffFromToday);
      return {
        type: 'overdue',
        label: `Overdue (+${overdueDays}d)`,
        badgeClass: 'overdue',
        desc: `Target date was ${formatDate(targetDate)} (${overdueDays} days ago)`
      };
    } else {
      return {
        type: 'ontrack',
        label: diffFromToday === 0 ? 'Due Today' : `In ${diffFromToday} days`,
        badgeClass: 'ontrack',
        desc: `Target: ${formatDate(targetDate)}`
      };
    }
  }

  // KPI Calculations
  function calculateMetrics() {
    const schedule = window.AWFG_SCHEDULE || [];
    const totalTests = schedule.length;
    let completedTests = 0;
    let overdueTests = 0;
    let ontrackTests = 0;
    let delayedTests = 0;

    let totalMainsMTs = 0;
    let doneMainsMTs = 0;
    let totalCoinciding = 0;
    let doneCoinciding = 0;
    let totalExclusive = 0;
    let doneExclusive = 0;
    let totalWysk = 0;
    let doneWysk = 0;

    const user = STATE.currentUser;

    schedule.forEach(t => {
      const status = getTestStatus(t);
      if (status.type === 'completed') completedTests++;
      else if (status.type === 'delayed') { completedTests++; delayedTests++; }
      else if (status.type === 'overdue') overdueTests++;
      else ontrackTests++;

      // Microthemes
      (t.mainsMicrothemes || []).forEach((_, idx) => {
        totalMainsMTs++;
        if (user && user.mainsChecked && user.mainsChecked[`${t.id}_${idx}`]) doneMainsMTs++;
      });
      (t.coincidingPrelims || []).forEach((_, idx) => {
        totalCoinciding++;
        if (user && user.coincidingChecked && user.coincidingChecked[`${t.id}_${idx}`]) doneCoinciding++;
      });
      (t.exclusivePrelims || []).forEach((_, idx) => {
        totalExclusive++;
        if (user && user.exclusiveChecked && user.exclusiveChecked[`${t.id}_${idx}`]) doneExclusive++;
      });
      (t.wyskQuestions || []).forEach((_, idx) => {
        totalWysk++;
        if (user && user.wyskChecked && user.wyskChecked[`${t.id}_${idx}`]) doneWysk++;
      });
    });

    const overallPct = totalTests > 0 ? Math.round((completedTests / totalTests) * 100) : 0;
    
    // Timeline calculation based on user-defined targetDays
    const totalDays = getTargetDays();
    const baseDate = parseISO(user ? user.startDate : STATE.startDate) || new Date();
    const today = new Date();
    const daysElapsed = Math.max(0, daysDiff(today, baseDate));
    const daysRemaining = Math.max(0, totalDays - daysElapsed);

    return {
      totalTests, completedTests, overdueTests, ontrackTests, delayedTests, overallPct,
      totalMainsMTs, doneMainsMTs,
      totalCoinciding, doneCoinciding,
      totalExclusive, doneExclusive,
      totalWysk, doneWysk,
      totalDays, daysElapsed, daysRemaining
    };
  }

  // Render Top KPI Metrics
  function renderKPIs() {
    const m = calculateMetrics();
    const el = document.getElementById('kpi-metrics-grid');
    if (!el) return;

    // Update brand days badge in header
    const brandDays = document.getElementById('brand-days-badge');
    if (brandDays) {
      brandDays.textContent = `33 Tests • ${m.totalDays} Days`;
    }

    el.innerHTML = `
      <div class="kpi-card kpi-tests">
        <div class="kpi-icon">📝</div>
        <div class="kpi-data">
          <div class="kpi-value">${m.completedTests} / ${m.totalTests}</div>
          <div class="kpi-label">Tests Completed (${m.overallPct}%)</div>
          <div class="kpi-progress">${m.ontrackTests} on track · ${m.delayedTests} delayed</div>
        </div>
      </div>
      <div class="kpi-card kpi-mains">
        <div class="kpi-icon">🎯</div>
        <div class="kpi-data">
          <div class="kpi-value">${m.doneMainsMTs} / ${m.totalMainsMTs}</div>
          <div class="kpi-label">Mains Microthemes</div>
          <div class="kpi-progress">${Math.round((m.doneMainsMTs / (m.totalMainsMTs || 1)) * 100)}% Syllabus Covered</div>
        </div>
      </div>
      <div class="kpi-card kpi-prelims">
        <div class="kpi-icon">🔗</div>
        <div class="kpi-data">
          <div class="kpi-value">${m.doneCoinciding} / ${m.totalCoinciding}</div>
          <div class="kpi-label">Prelims Overlap MTs</div>
          <div class="kpi-progress">+ ${m.doneExclusive} / ${m.totalExclusive} Exclusive Focus</div>
        </div>
      </div>
      <div class="kpi-card kpi-overdue">
        <div class="kpi-icon">⚠️</div>
        <div class="kpi-data">
          <div class="kpi-value" style="color: ${m.overdueTests > 0 ? '#ef4444' : '#10b981'};">${m.overdueTests}</div>
          <div class="kpi-label">Overdue Tests</div>
          <div class="kpi-progress">${m.overdueTests === 0 ? 'All scheduled work on track!' : 'Needs immediate catch-up'}</div>
        </div>
      </div>
      <div class="kpi-card kpi-days">
        <div class="kpi-icon">⏳</div>
        <div class="kpi-data">
          <div class="kpi-value">${m.daysRemaining}d</div>
          <div class="kpi-label">${m.totalDays}-Day Target Remaining</div>
          <div class="kpi-progress">Day ${m.daysElapsed} of ${m.totalDays} (${(m.totalDays / 30).toFixed(1)} Months)</div>
        </div>
      </div>
    `;
  }

  // Render Test Card
  function renderTestCard(t) {
    const user = STATE.currentUser;
    const testInfo = user && user.testStatus && user.testStatus[t.id] ? user.testStatus[t.id] : {};
    const isCompleted = !!testInfo.completed;
    const actualDate = testInfo.actualDate || '';
    const notes = (user && user.notes && user.notes[t.id]) || '';
    
    const targetDate = getTargetDateForTest(t);
    const targetDateStr = formatDate(targetDate);
    const status = getTestStatus(t);

    // Calculate sub-progress for this test
    const mainsTotal = (t.mainsMicrothemes || []).length;
    let mainsDone = 0;
    (t.mainsMicrothemes || []).forEach((_, idx) => {
      if (user && user.mainsChecked && user.mainsChecked[`${t.id}_${idx}`]) mainsDone++;
    });

    const coincideTotal = (t.coincidingPrelims || []).length;
    let coincideDone = 0;
    (t.coincidingPrelims || []).forEach((_, idx) => {
      if (user && user.coincidingChecked && user.coincidingChecked[`${t.id}_${idx}`]) coincideDone++;
    });

    const exclusiveTotal = (t.exclusivePrelims || []).length;
    let exclusiveDone = 0;
    (t.exclusivePrelims || []).forEach((_, idx) => {
      if (user && user.exclusiveChecked && user.exclusiveChecked[`${t.id}_${idx}`]) exclusiveDone++;
    });

    const wyskTotal = (t.wyskQuestions || []).length;
    let wyskDone = 0;
    (t.wyskQuestions || []).forEach((_, idx) => {
      if (user && user.wyskChecked && user.wyskChecked[`${t.id}_${idx}`]) wyskDone++;
    });

    const grandTotal = mainsTotal + coincideTotal + exclusiveTotal + wyskTotal;
    const grandDone = mainsDone + coincideDone + exclusiveDone + wyskDone;
    const testPct = grandTotal > 0 ? Math.round((grandDone / grandTotal) * 100) : (isCompleted ? 100 : 0);

    return `
      <div class="test-card is-${status.type} ${isCompleted ? 'is-completed' : ''}" id="test-card-${t.id}">
        <!-- Top Bar -->
        <div class="card-top">
          <div class="card-title-group">
            <div class="main-checkbox-wrapper" title="Tick mark when test completed">
              <input type="checkbox" class="custom-checkbox test-toggle-cb" data-testid="${t.id}" ${isCompleted ? 'checked' : ''}>
            </div>
            <div class="card-title-info">
              <div class="card-badges">
                <span class="paper-badge ${t.paper}">${t.paper}</span>
                <span class="week-badge">Week ${t.week} · Day ${t.dayOffset + 1}</span>
                <span class="status-badge ${status.badgeClass}">${status.label}</span>
              </div>
              <h2 class="card-title">${t.name}</h2>
              <div class="card-focus-title">Focus: ${t.focusTitle}</div>
              <div class="card-syllabus-raw">Syllabus: ${t.syllabusRaw}</div>
            </div>
          </div>

          <!-- Dynamic Date Control Panel -->
          <div class="date-tracker-panel">
            <div class="date-block">
              <span class="label">Target Date (3-Mo Plan)</span>
              <span class="target-date-display" id="target-date-display-${t.id}">📅 ${targetDateStr}</span>
            </div>
            <div class="date-block">
              <span class="label">Actual Date (Manual / Delay)</span>
              <div style="display: flex; gap: 6px; align-items: center; margin-top: 2px;">
                <input type="date" class="actual-date-input" data-testid="${t.id}" value="${actualDate}">
                <button class="btn btn-outline btn-sm done-today-btn" data-testid="${t.id}" title="Record today as actual date">Done Today</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Progress Indicator -->
        <div class="card-progress-bar-wrapper">
          <div class="progress-track">
            <div class="progress-fill" style="width: ${testPct}%;"></div>
          </div>
          <span class="progress-text">${testPct}%</span>
        </div>

        <!-- Content Sections -->
        <div class="card-sections">
          <!-- Section 1: Mains Topics & Microthemes -->
          <div class="section-box section-mains">
            <div class="section-header">
              <h3>🎯 Mains Microthemes (${mainsDone}/${mainsTotal})</h3>
              <span class="section-tag">Analytical & Conceptual</span>
            </div>
            <div class="checklist">
              ${(t.mainsMicrothemes || []).map((mt, idx) => {
                const checked = user && user.mainsChecked && user.mainsChecked[`${t.id}_${idx}`];
                return `
                  <label class="checklist-item">
                    <input type="checkbox" class="mt-cb" data-type="mains" data-testid="${t.id}" data-idx="${idx}" ${checked ? 'checked' : ''}>
                    <div class="checklist-content">
                      <div class="checklist-title">${mt}</div>
                      <div class="checklist-meta">
                        <span class="qs-pill">GS Mains Core</span>
                        <span>Structured for 10M & 15M answer frameworks</span>
                      </div>
                    </div>
                  </label>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Section 2: Coinciding Prelims Microthemes (Placed Directly Below Mains) -->
          <div class="section-box section-coinciding">
            <div class="section-header">
              <h3>🔗 Coinciding Prelims Microthemes (${coincideDone}/${coincideTotal})</h3>
              <span class="section-tag">Prelims + Mains Integrated Overlap</span>
            </div>
            <p style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 10px;">
              These high-yield Prelims topics directly coincide with this test's Mains themes. Master factual precision here to strengthen both stages.
            </p>
            <div class="checklist">
              ${(t.coincidingPrelims || []).map((cp, idx) => {
                const checked = user && user.coincidingChecked && user.coincidingChecked[`${t.id}_${idx}`];
                return `
                  <label class="checklist-item">
                    <input type="checkbox" class="mt-cb" data-type="coinciding" data-testid="${t.id}" data-idx="${idx}" ${checked ? 'checked' : ''}>
                    <div class="checklist-content">
                      <div class="checklist-title">
                        ${cp.name} 
                        <span class="qs-pill" style="margin-left: 6px;">${cp.qs} Prelims PYQs</span>
                      </div>
                      <div class="rationale-note">
                        <strong>Integrated Overlap:</strong> ${cp.overlap_rationale}
                      </div>
                    </div>
                  </label>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Section 3: Prelims-Exclusive Focus Topics (Separated in Dedicated Distinct Box) -->
          ${(t.exclusivePrelims && t.exclusivePrelims.length > 0) ? `
            <div class="section-box section-exclusive">
              <div class="section-header">
                <h3>⚡ Prelims-Exclusive Focus Topics (${exclusiveDone}/${exclusiveTotal})</h3>
                <span class="section-tag">Distinct / Prelims Only</span>
              </div>
              <p style="font-size: 0.8rem; color: #fbbf24; margin-bottom: 10px;">
                <strong>Note:</strong> These topics are unique to Prelims (factual provisions, tables, lists). Study them separately during this test's revision cycle.
              </p>
              <div class="checklist">
                ${t.exclusivePrelims.map((ep, idx) => {
                  const checked = user && user.exclusiveChecked && user.exclusiveChecked[`${t.id}_${idx}`];
                  return `
                    <label class="checklist-item" style="border-left: 3px solid #f59e0b;">
                      <input type="checkbox" class="mt-cb" data-type="exclusive" data-testid="${t.id}" data-idx="${idx}" ${checked ? 'checked' : ''}>
                      <div class="checklist-content">
                        <div class="checklist-title" style="color: #fbbf24;">
                          ${ep.name}
                          <span class="qs-pill" style="background: rgba(245, 158, 11, 0.25); color: #fbbf24; margin-left: 6px;">${ep.qs} Prelims Qs</span>
                        </div>
                        <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 4px;">
                          <strong>Key Factual Focus:</strong> ${ep.focus_keypoints}
                        </div>
                      </div>
                    </label>
                  `;
                }).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Section 4: What You Should Know (WYSK) Questions -->
          ${(t.wyskQuestions && t.wyskQuestions.length > 0) ? `
            <div class="section-box section-wysk">
              <div class="section-header">
                <h3>💡 What You Should Know (WYSK Questions) (${wyskDone}/${wyskTotal})</h3>
                <span class="section-tag">Essential Concept Check</span>
              </div>
              <div class="checklist">
                ${t.wyskQuestions.map((wq, idx) => {
                  const checked = user && user.wyskChecked && user.wyskChecked[`${t.id}_${idx}`];
                  return `
                    <label class="checklist-item">
                      <input type="checkbox" class="mt-cb" data-type="wysk" data-testid="${t.id}" data-idx="${idx}" ${checked ? 'checked' : ''}>
                      <div class="checklist-content">
                        <div class="checklist-title" style="font-size: 0.85rem;">${wq.question}</div>
                      </div>
                    </label>
                  `;
                }).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Section 5: Case Studies (For GS-4) -->
          ${(t.caseStudies && t.caseStudies.length > 0) ? `
            <div class="section-box" style="border-top: 3px solid var(--gs4-color);">
              <div class="section-header">
                <h3>⚖️ Real UPSC Ethics Case Studies</h3>
                <span class="section-tag" style="background: var(--gs4-bg); color: var(--gs4-color);">Section B Practice</span>
              </div>
              <div>
                ${t.caseStudies.map(cs => `
                  <div class="case-study-box">
                    <strong>Case Scenario:</strong> ${cs}
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Section 6: Personal Test Notes & Strategy Log -->
          <div class="notes-wrapper">
            <label style="font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); text-transform: uppercase;">
              ✍️ Test Notes & Reflection (Weak areas, answer marks, revisions):
            </label>
            <textarea class="notes-textarea" data-testid="${t.id}" placeholder="Write notes, marks scored, or revision pointers... (Auto-saved)">${notes}</textarea>
          </div>
        </div>
      </div>
    `;
  }

  // Filter Schedule
  function getFilteredSchedule() {
    let list = window.AWFG_SCHEDULE || [];
    
    // Paper Filter
    if (STATE.paperFilter !== 'ALL') {
      list = list.filter(t => t.paper === STATE.paperFilter);
    }

    // Status Filter
    if (STATE.statusFilter !== 'ALL') {
      list = list.filter(t => {
        const s = getTestStatus(t);
        if (STATE.statusFilter === 'completed') return s.type === 'completed' || s.type === 'delayed';
        if (STATE.statusFilter === 'pending') return s.type === 'ontrack' || s.type === 'overdue';
        if (STATE.statusFilter === 'overdue') return s.type === 'overdue';
        return true;
      });
    }

    // Search Query
    if (STATE.searchQuery.trim()) {
      const q = STATE.searchQuery.toLowerCase();
      list = list.filter(t => {
        if (t.name.toLowerCase().includes(q)) return true;
        if (t.focusTitle.toLowerCase().includes(q)) return true;
        if (t.syllabusRaw.toLowerCase().includes(q)) return true;
        if ((t.mainsMicrothemes || []).some(m => m.toLowerCase().includes(q))) return true;
        if ((t.coincidingPrelims || []).some(cp => cp.name.toLowerCase().includes(q))) return true;
        if ((t.exclusivePrelims || []).some(ep => ep.name.toLowerCase().includes(q))) return true;
        if ((t.wyskQuestions || []).some(wq => wq.question.toLowerCase().includes(q))) return true;
        return false;
      });
    }

    return list;
  }

  // Render Current Active View
  function renderView() {
    renderKPIs();
    const container = document.getElementById('view-content');
    if (!container) return;

    if (STATE.activeView === 'schedule') {
      const filtered = getFilteredSchedule();
      if (filtered.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 60px 20px; background: var(--bg-secondary); border-radius: var(--radius-lg); border: 1px solid var(--border-color);">
            <div style="font-size: 2.5rem; margin-bottom: 12px;">🔍</div>
            <h3 style="font-size: 1.2rem; font-weight: 700;">No Tests Match Current Filters</h3>
            <p style="color: var(--text-secondary); margin-top: 6px;">Try clearing search keywords or switching paper/status tabs.</p>
          </div>
        `;
        return;
      }
      container.innerHTML = `<div class="tests-list">${filtered.map(renderTestCard).join('')}</div>`;
      bindCardEvents();
    } else if (STATE.activeView === 'roadmap') {
      renderRoadmapView(container);
    } else if (STATE.activeView === 'matrix') {
      renderMatrixView(container);
    } else if (STATE.activeView === 'wysk') {
      renderWyskExplorer(container);
    }
  }

  // Render Dynamic Custom Duration Roadmap View
  function renderRoadmapView(container) {
    const schedule = window.AWFG_SCHEDULE || [];
    const totalDays = getTargetDays();
    const totalWeeks = Math.max(3, Math.ceil(totalDays / 7));
    const baseDate = parseISO(STATE.currentUser ? STATE.currentUser.startDate : STATE.startDate) || new Date();

    const weeksMap = {};
    for (let w = 1; w <= totalWeeks; w++) weeksMap[w] = [];

    schedule.forEach(t => {
      const target = getTargetDateForTest(t);
      const diffDays = Math.max(0, daysDiff(target, baseDate));
      const w = Math.min(totalWeeks, Math.floor(diffDays / 7) + 1);
      if (!weeksMap[w]) weeksMap[w] = [];
      weeksMap[w].push(t);
    });

    const bufferStartWeek = Math.max(1, Math.floor((totalDays * 0.86) / 7) + 1);

    let html = `
      <div class="roadmap-view">
        <div class="roadmap-header">
          <h2>🗓️ ${totalDays}-Day (${totalWeeks}-Week) Comprehensive Roadmap</h2>
          <p style="color: var(--text-secondary); font-size: 0.88rem; margin-top: 4px;">
            Full sequence of 33 tests dynamically distributed across ${totalDays} days from your selected Start Date. Click any test to inspect and update.
          </p>
        </div>
        <div class="roadmap-grid">
    `;

    for (let w = 1; w <= totalWeeks; w++) {
      const testsInWeek = weeksMap[w] || [];
      const isBufferWeek = w >= bufferStartWeek && testsInWeek.length === 0;
      html += `
        <div class="week-column">
          <div class="week-title">
            <span>Week ${w}</span>
            <span style="font-size: 0.75rem; color: var(--text-muted);">${testsInWeek.length} Tests</span>
          </div>
          <div class="week-tests">
            ${testsInWeek.length === 0 ? `
              <div style="font-size: 0.8rem; color: var(--text-muted); padding: 12px; text-align: center; border: 1px dashed var(--border-color); border-radius: var(--radius-sm);">
                ${isBufferWeek ? '🎯 Buffer & Full Syllabus Revisions' : 'Rest / Catch-up'}
              </div>
            ` : testsInWeek.map(t => {
              const status = getTestStatus(t);
              const target = getTargetDateForTest(t);
              const isDone = status.type === 'completed' || status.type === 'delayed';
              return `
                <div class="roadmap-test-card ${isDone ? 'done' : (status.type === 'overdue' ? 'late' : '')}" onclick="window.AWFG_APP.jumpToTest(${t.id})">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span class="paper-badge ${t.paper}" style="font-size: 0.65rem; padding: 2px 6px;">${t.paper}</span>
                    <span class="status-badge ${status.badgeClass}" style="font-size: 0.68rem; padding: 1px 6px;">${status.label}</span>
                  </div>
                  <div style="font-weight: 700; font-size: 0.86rem; margin: 4px 0 2px;">${t.name.split('(')[0]}</div>
                  <div style="font-size: 0.74rem; color: var(--accent-gold); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${t.focusTitle}</div>
                  <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px;">📅 ${formatDate(target)}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    html += `</div></div>`;
    container.innerHTML = html;
  }

  // Render Prelims vs Mains Synergy Matrix View
  function renderMatrixView(container) {
    const prelims = window.MASTER_PRELIMS_CATALOG || {};
    
    let html = `
      <div class="matrix-view">
        <h2>🔄 Prelims vs Mains Microthemes Synergy Matrix</h2>
        <p style="color: var(--text-secondary); font-size: 0.88rem; margin: 6px 0 16px;">
          Comprehensive alignment of all 209 Prelims Microthemes with Mains Syllabus. Coinciding topics reinforce both papers simultaneously, while exclusive topics demand dedicated factual mastery.
        </p>
        <table class="matrix-table">
          <thead>
            <tr>
              <th style="width: 14%;">Subject</th>
              <th style="width: 24%;">Prelims Microtheme</th>
              <th style="width: 10%;">Prelims PYQs</th>
              <th style="width: 14%;">Synergy Status</th>
              <th style="width: 26%;">Integrated Mains Strategy</th>
              <th style="width: 12%;">PYQ Explorer</th>
            </tr>
          </thead>
          <tbody>
    `;

    Object.keys(prelims).forEach(sub => {
      const items = prelims[sub];
      items.forEach((item, i) => {
        const isCoinciding = item.coincides;
        html += `
          <tr>
            ${i === 0 ? `<td rowspan="${items.length}" style="font-weight: 700; vertical-align: top; background: var(--bg-primary);">${sub}</td>` : ''}
            <td style="font-weight: 600;">
              <span class="microtheme-clickable" onclick="AWFG_APP.openPyqModal('${escapeQuotes(item.name)}')" title="Click to open all questions">${item.name}</span>
            </td>
            <td><span class="qs-pill">${item.qs} Qs</span></td>
            <td>
              <span class="status-badge ${isCoinciding ? 'completed' : 'delayed'}" style="font-size: 0.72rem;">
                ${isCoinciding ? '🔗 Overlaps with Mains' : '⚡ Prelims-Exclusive'}
              </span>
            </td>
            <td style="color: var(--text-secondary); font-size: 0.82rem;">
              ${isCoinciding ? 
                'Direct conceptual overlap in GS Mains tests. Use factual details as illustrations in Mains answers.' : 
                'Distinct factual focus (articles, lists, geographical locations, treaties, definitions). Revise via flashnotes.'}
            </td>
            <td>
              <button class="pyq-pill-trigger" onclick="AWFG_APP.openPyqModal('${escapeQuotes(item.name)}')">👁️ View PYQs</button>
            </td>
          </tr>
        `;
      });
    });

    html += `</tbody></table></div>`;
    container.innerHTML = html;
  }

  // Render Full 1,697 WYSK Question Explorer
  function renderWyskExplorer(container) {
    const allWysk = window.ALL_WYSK_QUESTIONS || [];
    const user = STATE.currentUser;
    const userWysk = (user && user.wyskMasterChecked) ? user.wyskMasterChecked : {};

    // Calculate Master Stats
    const totalAll = allWysk.length;
    const totalMastered = allWysk.filter(q => userWysk[q.id]).length;
    const masterPct = totalAll > 0 ? Math.round((totalMastered / totalAll) * 100) : 0;

    // Filter by Paper
    const currentPaper = STATE.wyskPaper || 'ALL';
    let filtered = currentPaper === 'ALL' ? allWysk : allWysk.filter(q => q.paper === currentPaper);

    // Get unique topics for the selected paper to populate dropdown
    const topicSet = new Map();
    filtered.forEach(q => {
      if (!topicSet.has(q.topicNum)) {
        topicSet.set(q.topicNum, { num: q.topicNum, label: q.topicName || q.topic });
      }
    });
    const sortedTopics = Array.from(topicSet.values()).sort((a, b) => a.num - b.num);

    // Filter by Topic
    const currentTopic = STATE.wyskTopic || 'ALL';
    if (currentTopic !== 'ALL') {
      const tNum = parseInt(currentTopic, 10);
      filtered = filtered.filter(q => q.topicNum === tNum);
    }

    // Filter by Search Query
    const searchVal = (STATE.wyskSearch || '').trim().toLowerCase();
    if (searchVal) {
      filtered = filtered.filter(q => 
        q.question.toLowerCase().includes(searchVal) || 
        (q.topicName && q.topicName.toLowerCase().includes(searchVal)) ||
        q.topic.toLowerCase().includes(searchVal)
      );
    }

    // Paper counts for badges
    const paperCounts = {
      'ALL': allWysk.length,
      'GS-1': allWysk.filter(q => q.paper === 'GS-1').length,
      'GS-2': allWysk.filter(q => q.paper === 'GS-2').length,
      'GS-3': allWysk.filter(q => q.paper === 'GS-3').length,
      'GS-4': allWysk.filter(q => q.paper === 'GS-4').length
    };

    const paperMastered = {
      'ALL': totalMastered,
      'GS-1': allWysk.filter(q => q.paper === 'GS-1' && userWysk[q.id]).length,
      'GS-2': allWysk.filter(q => q.paper === 'GS-2' && userWysk[q.id]).length,
      'GS-3': allWysk.filter(q => q.paper === 'GS-3' && userWysk[q.id]).length,
      'GS-4': allWysk.filter(q => q.paper === 'GS-4' && userWysk[q.id]).length
    };

    const limit = STATE.wyskLimit || 60;
    const visibleList = filtered.slice(0, limit);

    let html = `
      <div class="question-view" style="max-width: 1200px; margin: 0 auto;">
        <!-- Header & Progress Card -->
        <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 20px 24px; margin-bottom: 20px; box-shadow: var(--shadow-sm);">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
            <div>
              <h2 style="margin: 0 0 6px; font-size: 1.4rem; display: flex; align-items: center; gap: 8px;">
                <span>💡</span> "What You Should Know" (WYSK) Question Bank
              </h2>
              <p style="color: var(--text-secondary); font-size: 0.9rem; margin: 0;">
                Comprehensive pool of <strong>${totalAll} high-yield syllabus questions</strong> across all 4 GS papers from official AWFG curriculum.
              </p>
            </div>
            <div style="text-align: right; min-width: 180px;">
              <div style="font-size: 1.15rem; font-weight: 700; color: #10b981;">${totalMastered} / ${totalAll} Mastered (${masterPct}%)</div>
              <div style="width: 100%; height: 8px; background: var(--bg-secondary); border-radius: 99px; margin-top: 6px; overflow: hidden; border: 1px solid var(--border-color);">
                <div style="width: ${masterPct}%; height: 100%; background: linear-gradient(90deg, #10b981, #059669); border-radius: 99px; transition: width 0.3s ease;"></div>
              </div>
            </div>
          </div>

          <!-- Paper Filters Tabs -->
          <div style="display: flex; gap: 8px; margin-top: 18px; flex-wrap: wrap;">
            ${['ALL', 'GS-1', 'GS-2', 'GS-3', 'GS-4'].map(p => `
              <button class="btn btn-sm ${currentPaper === p ? 'btn-primary' : 'btn-outline'}" 
                      onclick="AWFG_APP.setWyskPaper('${p}')" 
                      style="font-weight: 600; font-size: 0.82rem; padding: 6px 14px;">
                ${p === 'ALL' ? 'All Papers' : p} (${paperCounts[p]}) 
                <span style="opacity: 0.75; font-size: 0.75rem; margin-left: 4px;">• ${paperMastered[p]}✓</span>
              </button>
            `).join('')}
          </div>

          <!-- Secondary Filters: Topic Dropdown & Search -->
          <div style="display: flex; gap: 12px; margin-top: 14px; flex-wrap: wrap; align-items: center;">
            <div style="flex: 1; min-width: 260px;">
              <input type="text" id="wysk-search-input" class="form-input" placeholder="🔍 Search ${filtered.length} questions by keyword..." 
                     value="${escapeHtml(STATE.wyskSearch || '')}" 
                     style="width: 100%; font-size: 0.86rem; padding: 8px 14px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-sm);"
                     oninput="AWFG_APP.setWyskSearch(this.value)">
            </div>
            <div style="min-width: 220px;">
              <select class="form-select" style="width: 100%; font-size: 0.86rem; padding: 8px 12px; background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-sm);"
                      onchange="AWFG_APP.setWyskTopic(this.value)">
                <option value="ALL">All Syllabus Topics (${filtered.length})</option>
                ${sortedTopics.map(t => `
                  <option value="${t.num}" ${currentTopic === String(t.num) ? 'selected' : ''}>
                    Topic ${t.num}: ${escapeHtml(t.label.length > 45 ? t.label.substring(0, 42) + '...' : t.label)}
                  </option>
                `).join('')}
              </select>
            </div>
          </div>
        </div>

        <!-- Questions Count Status -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding: 0 4px;">
          <span style="font-size: 0.88rem; color: var(--text-secondary);">
            Showing <strong>${visibleList.length}</strong> of <strong>${filtered.length}</strong> matching questions
          </span>
          ${visibleList.length < filtered.length ? `
            <button class="btn btn-subtle btn-sm" onclick="AWFG_APP.loadAllWysk()">Show All (${filtered.length})</button>
          ` : ''}
        </div>

        <!-- Questions List -->
        <div class="checklist">
    `;

    visibleList.forEach((q, idx) => {
      const isMastered = !!userWysk[q.id];
      html += `
        <div class="checklist-item ${isMastered ? 'is-completed' : ''}" style="padding: 14px 16px; margin-bottom: 8px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: var(--bg-card); display: flex; align-items: flex-start; gap: 14px;">
          <input type="checkbox" class="custom-checkbox" ${isMastered ? 'checked' : ''} 
                 onchange="AWFG_APP.toggleWyskMaster('${q.id}')" 
                 title="Mark as learned/mastered" style="margin-top: 3px; cursor: pointer;">
          <div class="checklist-content" style="flex: 1;">
            <div style="display: flex; gap: 8px; margin-bottom: 6px; align-items: center; flex-wrap: wrap;">
              <span class="paper-badge ${q.paper}" style="font-size: 0.7rem; font-weight: 700; padding: 2px 8px;">${q.paper}</span>
              <span class="week-badge" style="font-size: 0.72rem; padding: 2px 8px;">${q.topic}</span>
              <span style="font-size: 0.74rem; color: var(--text-muted); font-weight: 500;">${escapeHtml(q.topicName || '')}</span>
            </div>
            <div style="font-size: 0.94rem; font-weight: 600; line-height: 1.45; color: ${isMastered ? 'var(--text-muted)' : 'var(--text-primary)'}; text-decoration: ${isMastered ? 'line-through' : 'none'};">
              ${escapeHtml(q.question)}
            </div>
          </div>
          <button class="btn btn-subtle btn-sm" onclick="AWFG_APP.copyQuestion('${escapeHtml(q.question).replace(/'/g, "\\'")}', this)" title="Copy question" style="padding: 4px 10px; font-size: 0.78rem;">📋 Copy</button>
        </div>
      `;
    });

    if (visibleList.length < filtered.length) {
      html += `
        <div style="text-align: center; margin: 24px 0 32px;">
          <button class="btn btn-outline" onclick="AWFG_APP.loadMoreWysk()" style="padding: 10px 24px; font-weight: 600;">
            ⬇️ Load Next 60 Questions (${visibleList.length} of ${filtered.length} Loaded)
          </button>
        </div>
      `;
    }

    html += `</div></div>`;
    container.innerHTML = html;
  }

  // Bind Event Listeners for Test Cards
  function bindCardEvents() {
    // 1. Master Test Checkbox
    document.querySelectorAll('.test-toggle-cb').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const testId = e.target.dataset.testid;
        const user = STATE.currentUser;
        if (!user) return;
        if (!user.testStatus[testId]) user.testStatus[testId] = {};
        user.testStatus[testId].completed = e.target.checked;
        if (e.target.checked && !user.testStatus[testId].actualDate) {
          user.testStatus[testId].actualDate = getISO(new Date());
        }
        saveStorage();
        renderView();
        showToast(e.target.checked ? `Test #${testId} marked as completed!` : `Test #${testId} reopened.`);
      });
    });

    // 2. Actual Date Picker Change
    document.querySelectorAll('.actual-date-input').forEach(inp => {
      inp.addEventListener('change', (e) => {
        const testId = e.target.dataset.testid;
        const user = STATE.currentUser;
        if (!user) return;
        if (!user.testStatus[testId]) user.testStatus[testId] = {};
        user.testStatus[testId].actualDate = e.target.value;
        if (e.target.value) {
          user.testStatus[testId].completed = true;
        }
        saveStorage();
        renderView();
        showToast(`Actual date updated for Test #${testId}`);
      });
    });

    // 3. Done Today Button
    document.querySelectorAll('.done-today-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const testId = e.target.dataset.testid;
        const user = STATE.currentUser;
        if (!user) return;
        if (!user.testStatus[testId]) user.testStatus[testId] = {};
        user.testStatus[testId].actualDate = getISO(new Date());
        user.testStatus[testId].completed = true;
        saveStorage();
        renderView();
        showToast(`Test #${testId} marked completed for today!`);
      });
    });

    // 4. Granular Microtheme & WYSK Checkboxes
    document.querySelectorAll('.mt-cb').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const type = e.target.dataset.type; // 'mains' | 'coinciding' | 'exclusive' | 'wysk'
        const testId = e.target.dataset.testid;
        const idx = e.target.dataset.idx;
        const key = `${testId}_${idx}`;
        const user = STATE.currentUser;
        if (!user) return;

        if (type === 'mains') user.mainsChecked[key] = e.target.checked;
        else if (type === 'coinciding') user.coincidingChecked[key] = e.target.checked;
        else if (type === 'exclusive') user.exclusiveChecked[key] = e.target.checked;
        else if (type === 'wysk') user.wyskChecked[key] = e.target.checked;

        saveStorage();
        renderKPIs();

        // Update card progress bar in place
        const card = document.getElementById(`test-card-${testId}`);
        if (card) {
          const t = (window.AWFG_SCHEDULE || []).find(x => x.id === parseInt(testId));
          if (t) {
            const mTot = (t.mainsMicrothemes || []).length;
            let mDone = 0;
            (t.mainsMicrothemes || []).forEach((_, i) => { if (user.mainsChecked[`${t.id}_${i}`]) mDone++; });
            const cTot = (t.coincidingPrelims || []).length;
            let cDone = 0;
            (t.coincidingPrelims || []).forEach((_, i) => { if (user.coincidingChecked[`${t.id}_${i}`]) cDone++; });
            const eTot = (t.exclusivePrelims || []).length;
            let eDone = 0;
            (t.exclusivePrelims || []).forEach((_, i) => { if (user.exclusiveChecked[`${t.id}_${i}`]) eDone++; });
            const wTot = (t.wyskQuestions || []).length;
            let wDone = 0;
            (t.wyskQuestions || []).forEach((_, i) => { if (user.wyskChecked[`${t.id}_${i}`]) wDone++; });

            const tot = mTot + cTot + eTot + wTot;
            const dn = mDone + cDone + eDone + wDone;
            const pct = tot > 0 ? Math.round((dn / tot) * 100) : 0;
            const fill = card.querySelector('.progress-fill');
            const txt = card.querySelector('.progress-text');
            if (fill) fill.style.width = `${pct}%`;
            if (txt) txt.textContent = `${pct}%`;
          }
        }
      });
    });

    // 5. Notes Textarea Auto-save
    document.querySelectorAll('.notes-textarea').forEach(tx => {
      tx.addEventListener('input', (e) => {
        const testId = e.target.dataset.testid;
        const user = STATE.currentUser;
        if (!user) return;
        if (!user.notes) user.notes = {};
        user.notes[testId] = e.target.value;
        saveStorage();
      });
    });
  }

  // Jump to specific test card
  function jumpToTest(testId) {
    STATE.activeView = 'schedule';
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.view === 'schedule'));
    STATE.paperFilter = 'ALL';
    document.querySelectorAll('.pill-btn').forEach(b => b.classList.toggle('active', b.dataset.paper === 'ALL'));
    renderView();
    setTimeout(() => {
      const el = document.getElementById(`test-card-${testId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.borderColor = '#f59e0b';
        setTimeout(() => el.style.borderColor = '', 2000);
      }
    }, 100);
  }

  // Initialize UI & Header Controls
  function initUI() {
    // 1. Theme
    const currentTheme = (STATE.currentUser && STATE.currentUser.theme) || 'dark';
    document.documentElement.setAttribute('data-theme', currentTheme);
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (themeBtn) {
      themeBtn.textContent = currentTheme === 'dark' ? '☀️ Light' : '🌙 Dark';
      themeBtn.addEventListener('click', () => {
        const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        themeBtn.textContent = next === 'dark' ? '☀️ Light' : '🌙 Dark';
        if (STATE.currentUser) {
          STATE.currentUser.theme = next;
          saveStorage();
        }
      });
    }

    // 2. Start Date Picker
    const startInp = document.getElementById('start-date-input');
    if (startInp) {
      startInp.value = STATE.currentUser ? STATE.currentUser.startDate : STATE.startDate;
      startInp.addEventListener('change', (e) => {
        STATE.startDate = e.target.value;
        if (STATE.currentUser) {
          STATE.currentUser.startDate = e.target.value;
          saveStorage();
        }
        renderView();
        showToast('All 33 test target dates dynamically updated!');
      });
    }

    // 3. Target Duration Input (Custom Total Days)
    const targetDaysInp = document.getElementById('target-days-input');
    if (targetDaysInp) {
      targetDaysInp.value = getTargetDays();
      targetDaysInp.addEventListener('change', (e) => {
        let val = parseInt(e.target.value, 10);
        if (isNaN(val) || val < 15) val = 90;
        e.target.value = val;
        STATE.targetDays = val;
        if (STATE.currentUser) {
          STATE.currentUser.targetDays = val;
          saveStorage();
        }
        renderView();
        showToast(`Target timeline updated to ${val} days! All 33 test target dates recalculated.`);
      });
    }

    // 4. Cadence Selector
    const cadenceSel = document.getElementById('cadence-selector');
    if (cadenceSel) {
      cadenceSel.value = STATE.currentUser ? STATE.currentUser.cadence : STATE.cadence;
      cadenceSel.addEventListener('change', (e) => {
        STATE.cadence = e.target.value;
        if (STATE.currentUser) {
          STATE.currentUser.cadence = e.target.value;
          saveStorage();
        }
        renderView();
        showToast(`Schedule cadence updated to ${cadenceSel.options[cadenceSel.selectedIndex].text}`);
      });
    }

    // 4. View Switcher Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        STATE.activeView = btn.dataset.view;
        renderView();
      });
    });

    // 5. Paper Filter Pills
    document.querySelectorAll('.pill-btn[data-paper]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.pill-btn[data-paper]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        STATE.paperFilter = btn.dataset.paper;
        renderView();
      });
    });

    // 6. Status Filter Selector
    const statusSel = document.getElementById('status-filter-select');
    if (statusSel) {
      statusSel.addEventListener('change', (e) => {
        STATE.statusFilter = e.target.value;
        renderView();
      });
    }

    // 7. Live Search
    const searchInp = document.getElementById('search-query-input');
    if (searchInp) {
      searchInp.addEventListener('input', (e) => {
        STATE.searchQuery = e.target.value;
        renderView();
      });
    }

    // 8. Auth Controls & Modals
    initAuthModal();
    initBackupModal();
    initPyqModal();
    initBackToTop();

    // 9. Initial Render
    renderUserBadge();
    renderView();
  }

  // Floating Back to Top Handler
  function initBackToTop() {
    const btn = document.getElementById('back-to-top-btn');
    if (!btn) return;

    window.addEventListener('scroll', () => {
      if (window.scrollY > 250) {
        btn.classList.remove('hidden');
      } else {
        btn.classList.add('hidden');
      }
    }, { passive: true });

    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Auth Modal & User Handling
  function renderUserBadge() {
    const badge = document.getElementById('user-badge-container');
    if (!badge) return;
    if (STATE.currentUser) {
      const u = STATE.currentUser.username;
      badge.innerHTML = `
        <div class="user-badge">
          <div class="user-avatar">${u.charAt(0).toUpperCase()}</div>
          <span>${u}</span>
          <button class="btn btn-subtle btn-sm" id="auth-switch-btn" title="Switch account or logout">Switch</button>
        </div>
      `;
      document.getElementById('auth-switch-btn').addEventListener('click', openAuthModal);
    } else {
      badge.innerHTML = `
        <button class="btn btn-primary btn-sm" id="auth-login-btn">Sign In / Register</button>
      `;
      document.getElementById('auth-login-btn').addEventListener('click', openAuthModal);
    }
  }

  function openAuthModal() {
    const m = document.getElementById('auth-modal');
    if (m) m.classList.remove('hidden');
  }

  function closeAuthModal() {
    const m = document.getElementById('auth-modal');
    if (m) m.classList.add('hidden');
  }

  function initAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;

    const loginBtn = document.getElementById('modal-login-btn');
    const guestBtn = document.getElementById('modal-guest-btn');
    const closeBtn = document.getElementById('modal-close-btn');
    const usernameInp = document.getElementById('modal-username');
    const passwordInp = document.getElementById('modal-password');

    function handleLogin() {
      const u = (usernameInp.value || '').trim();
      const p = passwordInp.value || '';
      if (!u) {
        alert('Please enter an ID or Username');
        return;
      }
      ensureUser(u, p);
      closeAuthModal();
      renderUserBadge();
      renderView();
      showToast(`Welcome back, ${u}! Progress saved to your account.`);
    }

    if (loginBtn) {
      loginBtn.addEventListener('click', handleLogin);
    }

    if (usernameInp) {
      usernameInp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleLogin();
      });
    }

    if (passwordInp) {
      passwordInp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleLogin();
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        if (!STATE.currentUser) {
          ensureUser('Aspirant_2027', '');
          renderUserBadge();
          renderView();
        }
        closeAuthModal();
      });
    }

    // Close on overlay backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        if (!STATE.currentUser) {
          ensureUser('Aspirant_2027', '');
          renderUserBadge();
          renderView();
        }
        closeAuthModal();
      }
    });

    if (guestBtn) {
      guestBtn.addEventListener('click', () => {
        ensureUser('Aspirant_2027', '');
        closeAuthModal();
        renderUserBadge();
        renderView();
        showToast('Logged in as Aspirant_2027!');
      });
    }

    // Auto prompt auth modal if fresh session without user
    if (!STATE.currentUser) {
      // Default to Aspirant_2027 so user can immediately view everything
      ensureUser('Aspirant_2027', '');
    }
  }

  // Backup Import & Export
  function initBackupModal() {
    const exportBtn = document.getElementById('export-backup-btn');
    const importBtn = document.getElementById('import-backup-btn');
    const fileInp = document.getElementById('import-file-input');

    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(STATE.users, null, 2));
        const a = document.createElement('a');
        a.setAttribute("href", dataStr);
        a.setAttribute("download", `UPSC_AWFG_Backup_${getISO(new Date())}.json`);
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast('Backup JSON downloaded successfully!');
      });
    }

    if (importBtn && fileInp) {
      importBtn.addEventListener('click', () => fileInp.click());
      fileInp.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const imported = JSON.parse(event.target.result);
            STATE.users = Object.assign({}, STATE.users, imported);
            const firstKey = Object.keys(imported)[0];
            if (firstKey) STATE.currentUser = STATE.users[firstKey];
            saveStorage();
            renderUserBadge();
            renderView();
            showToast('Backup restored successfully!');
          } catch (err) {
            alert('Invalid JSON backup file.');
          }
        };
        reader.readAsText(file);
      });
    }
  }

  // Microtheme PYQ Explorer Modal Engine
  let currentPyqData = {
    name: '',
    mains: [],
    prelims: [],
    activeTab: 'mains',
    filterText: ''
  };

  function openPyqModal(microthemeName) {
    if (!microthemeName) return;

    // Normalize and fetch from questions_data.js
    const qData = (window.getMicrothemeQuestions && typeof window.getMicrothemeQuestions === 'function')
      ? window.getMicrothemeQuestions(microthemeName)
      : { mains: [], prelims: [] };

    currentPyqData.name = microthemeName;
    currentPyqData.mains = qData.mains || [];
    currentPyqData.prelims = qData.prelims || [];
    currentPyqData.filterText = '';

    // Choose default active tab based on available questions
    if (currentPyqData.mains.length > 0) {
      currentPyqData.activeTab = 'mains';
    } else if (currentPyqData.prelims.length > 0) {
      currentPyqData.activeTab = 'prelims';
    } else {
      currentPyqData.activeTab = 'mains';
    }

    const titleEl = document.getElementById('pyq-modal-title');
    if (titleEl) titleEl.textContent = microthemeName;

    const mCountEl = document.getElementById('pyq-mains-count');
    if (mCountEl) mCountEl.textContent = currentPyqData.mains.length;

    const pCountEl = document.getElementById('pyq-prelims-count');
    if (pCountEl) pCountEl.textContent = currentPyqData.prelims.length;

    const searchInp = document.getElementById('pyq-search-inp');
    if (searchInp) searchInp.value = '';

    updatePyqTabsUI();
    renderPyqBody();

    const modal = document.getElementById('pyq-modal');
    if (modal) modal.classList.remove('hidden');
  }

  function closePyqModal() {
    const modal = document.getElementById('pyq-modal');
    if (modal) modal.classList.add('hidden');
  }

  function switchPyqTab(tab) {
    currentPyqData.activeTab = tab;
    updatePyqTabsUI();
    renderPyqBody();
  }

  function updatePyqTabsUI() {
    document.querySelectorAll('.pyq-tab-btn').forEach(btn => {
      if (btn.dataset.pyqTab === currentPyqData.activeTab) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  // Mains Answer Pad Timers
  let mainsTimers = {};

  function toggleTimer(mKey) {
    if (!mainsTimers[mKey]) {
      mainsTimers[mKey] = { seconds: 0, interval: null, isRunning: false };
    }
    const t = mainsTimers[mKey];
    const btn = document.getElementById(`tbtn-${mKey}`);
    const disp = document.getElementById(`tdisp-${mKey}`);

    if (t.isRunning) {
      clearInterval(t.interval);
      t.isRunning = false;
      if (btn) btn.textContent = '▶ Resume';
    } else {
      t.isRunning = true;
      if (btn) btn.textContent = '⏸ Pause';
      t.interval = setInterval(() => {
        t.seconds++;
        if (disp) {
          const m = String(Math.floor(t.seconds / 60)).padStart(2, '0');
          const s = String(t.seconds % 60).padStart(2, '0');
          disp.textContent = `${m}:${s}`;
        }
      }, 1000);
    }
  }

  function resetTimer(mKey) {
    if (mainsTimers[mKey]) {
      clearInterval(mainsTimers[mKey].interval);
      mainsTimers[mKey] = { seconds: 0, interval: null, isRunning: false };
    }
    const btn = document.getElementById(`tbtn-${mKey}`);
    const disp = document.getElementById(`tdisp-${mKey}`);
    if (btn) btn.textContent = '▶ Start';
    if (disp) disp.textContent = '00:00';
  }

  function toggleAnswerPad(mKey) {
    const pad = document.getElementById(`pad-${mKey}`);
    if (pad) {
      pad.classList.toggle('hidden');
      if (!pad.classList.contains('hidden')) {
        const ta = pad.querySelector('textarea');
        if (ta) ta.focus();
      }
    }
  }

  function handleMainsWordCount(mKey, targetWords) {
    const ta = document.getElementById(`ta-${mKey}`);
    const wcEl = document.getElementById(`wc-${mKey}`);
    const pbEl = document.getElementById(`pb-${mKey}`);
    if (!ta || !wcEl) return;

    const text = ta.value.trim();
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    wcEl.textContent = words;

    if (pbEl) {
      const pct = Math.min(100, Math.round((words / targetWords) * 100));
      pbEl.style.width = `${pct}%`;
      if (words >= targetWords * 0.9 && words <= targetWords * 1.15) {
        pbEl.style.backgroundColor = '#10b981'; // optimal green
      } else if (words > targetWords * 1.15) {
        pbEl.style.backgroundColor = '#f59e0b'; // over target
      } else {
        pbEl.style.backgroundColor = '#3b82f6'; // in progress
      }
    }
  }

  function saveMainsAnswer(mKey, targetWords) {
    if (!STATE.currentUser) ensureUser('Aspirant_2027', '');
    if (!STATE.currentUser.mainsAnswers) STATE.currentUser.mainsAnswers = {};

    const ta = document.getElementById(`ta-${mKey}`);
    if (!ta) return;

    const text = ta.value.trim();
    const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
    const timeSpent = mainsTimers[mKey] ? mainsTimers[mKey].seconds : 0;

    STATE.currentUser.mainsAnswers[mKey] = {
      text: text,
      wordCount: words,
      targetWords: targetWords,
      timeSeconds: timeSpent,
      savedAt: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    };
    saveStorage();

    showToast(`Answer draft saved! (${words} words)`, '💾');
    renderPyqBody();
  }

  function copyMainsAnswer(mKey) {
    if (!STATE.currentUser || !STATE.currentUser.mainsAnswers) return;
    const ans = STATE.currentUser.mainsAnswers[mKey];
    if (ans && ans.text) {
      navigator.clipboard.writeText(ans.text).then(() => {
        showToast('Your drafted answer copied to clipboard!');
      });
    } else {
      const ta = document.getElementById(`ta-${mKey}`);
      if (ta && ta.value) {
        navigator.clipboard.writeText(ta.value).then(() => {
          showToast('Answer copied to clipboard!');
        });
      }
    }
  }

  // -------------------------------------------------------------
  // UPSC Mains Answer Framework & "How to Approach" Engine
  // -------------------------------------------------------------
  function generateMainsApproach(qText, marks, subject) {
    const marksNum = parseFloat(marks) || 10;
    const targetWords = (marksNum >= 15) ? 250 : (marksNum >= 20 ? 300 : 150);
    const suggestedTime = (marksNum >= 15) ? 11 : (marksNum >= 20 ? 14 : 7);

    let directive = "Discuss";
    let directiveMeaning = "Explore the topic from multiple dimensions (Social, Economic, Political, Legal, Administrative) and provide a balanced synthesis.";
    const qLower = (qText || '').toLowerCase();

    if (qLower.includes("critically examine") || qLower.includes("critically analyze") || qLower.includes("critically evaluate")) {
      directive = "Critically Examine / Analyze";
      directiveMeaning = "Conduct a rigorous scrutiny of both sides. Highlight strengths/merits vs limitations/concerns, and arrive at a well-substantiated, balanced verdict.";
    } else if (qLower.includes("examine") || qLower.includes("investigate")) {
      directive = "Examine";
      directiveMeaning = "Look deeply into the facts, root causes, and practical implications of the issue with supporting evidence.";
    } else if (qLower.includes("evaluate") || qLower.includes("assess")) {
      directive = "Evaluate / Assess";
      directiveMeaning = "Determine the value, impact, or success of the policy/provision against stated constitutional or socio-economic goals.";
    } else if (qLower.includes("comment")) {
      directive = "Comment";
      directiveMeaning = "Take an informed, principled position on the statement and defend your viewpoint using constitutional provisions and real-world examples.";
    } else if (qLower.includes("illustrate") || qLower.includes("elaborate")) {
      directive = "Illustrate / Elaborate";
      directiveMeaning = "Substantiate the core arguments through concrete instances, landmark judicial precedents, and current case studies.";
    } else if (qLower.includes("what") || qLower.includes("why") || qLower.includes("how")) {
      directive = "Direct Question (What / Why / How)";
      directiveMeaning = "Address all sub-parts directly with crisp, categorized bullet points and practical remedies.";
    }

    const valueAdds = [];
    if (qLower.includes("privacy") || qLower.includes("article 21") || qLower.includes("liberty")) {
      valueAdds.push("Landmark Case: Justice K.S. Puttaswamy v. Union of India (2017) - 9-Judge bench affirmed Right to Privacy as intrinsic to Article 21.");
      valueAdds.push("Doctrine: 4-Prong Proportionality Test (Legitimate Aim, Suitability, Necessity, Balancing).");
      valueAdds.push("Statute / Committee: Digital Personal Data Protection (DPDP) Act 2023 & Justice B.N. Srikrishna Committee.");
    }
    if (qLower.includes("section 66a") || qLower.includes("speech") || qLower.includes("article 19")) {
      valueAdds.push("Landmark Case: Shreya Singhal v. Union of India (2015) - Struck down Section 66A of IT Act for chilling free speech.");
      valueAdds.push("Constitutional Balance: Reasonable restrictions under Article 19(2) (Public order, decency, sovereignty).");
    }
    if (qLower.includes("preamble") || qLower.includes("basic structure")) {
      valueAdds.push("Landmark Cases: Kesavananda Bharati (1973), Minerva Mills (1980), S.R. Bommai (1994).");
      valueAdds.push("Constitutional Ideal: Preamble reflects the foundational philosophy, goals, and solemn resolve of the Constitution.");
    }
    if (qLower.includes("federal") || qLower.includes("governor") || qLower.includes("centre-state")) {
      valueAdds.push("Key Committees: Sarkaria Commission (1988), M.M. Punchhi Commission (2010), 2nd ARC Report.");
      valueAdds.push("Landmark Case: S.R. Bommai case (1994) restricting arbitrary imposition of Article 356.");
    }
    if (qLower.includes("judiciary") || qLower.includes("collegium") || qLower.includes("judicial review")) {
      valueAdds.push("Key Cases: Kesavananda Bharati (Judicial review as Basic Structure), NJAC judgment (2015).");
      valueAdds.push("Constitutional Balance: Separation of Powers (Article 50) vs Judicial Activism vs Complete Justice (Article 142).");
    }
    if (qLower.includes("environment") || qLower.includes("pollution") || qLower.includes("climate")) {
      valueAdds.push("Judicial Doctrines: M.C. Mehta cases - Polluter Pays Principle, Precautionary Principle, Public Trust Doctrine.");
      valueAdds.push("Constitutional Mandate: Article 48A (State duty) & Article 51A(g) (Citizen's fundamental duty).");
    }
    if (qLower.includes("women") || qLower.includes("gender") || qLower.includes("transgender")) {
      valueAdds.push("Landmark Case: NALSA v. Union of India (2014) recognizing transgender persons under Articles 14, 15, 21.");
      valueAdds.push("Legal Framework: Transgender Persons (Protection of Rights) Act 2019 & 2026 amendments.");
      valueAdds.push("Global Benchmark: UN SDG Goal 5 (Gender Equality & Women Empowerment).");
    }

    if (valueAdds.length === 0) {
      valueAdds.push("Analytical Framework: PESTLE Dimensions (Political, Economic, Social, Technological, Legal, Environmental).");
      valueAdds.push("Administrative Touchpoint: 2nd Administrative Reforms Commission (ARC) recommendations.");
      valueAdds.push("Guiding Compass: Constitutional Morality, Directive Principles (Part IV), and UN Sustainable Development Goals (SDGs).");
    }

    return {
      directive,
      directiveMeaning,
      targetWords,
      suggestedTime,
      valueAdds,
      marksNum
    };
  }

  function getMainsOutlineText(qText, marks, approach) {
    const is15M = approach.marksNum >= 15;
    const introWords = is15M ? "35-40" : "25-30";
    const bodyWords = is15M ? "160-180" : "90-100";
    const conclWords = is15M ? "35-40" : "25-30";
    const partWords = Math.round(parseInt(bodyWords.split('-')[0]) / 2);

    return `### 1. Introduction (~${introWords} words)
- Context / Definition / Constitutional Article / Recent Data point:
- Core premise addressing the demand of the question:

### 2. Body Part 1: Core Arguments & Dimensions (~${partWords} words)
- Key Subheading (Arguments / Provisions / Mechanisms):
  • Point 1 (Fact / Keyword / Impact): 
  • Point 2 (Institutional dimension): 
  • Supporting Example / Case Law: 

### 3. Body Part 2: Critical Challenges / Counter-Perspective (~${partWords} words)
- Analytical Subheading (Bottlenecks / Institutional gaps / Concerns):
  • Point 1: 
  • Point 2: 
  • ${approach.valueAdds[0] ? `Relevant Case / Recommendation: ${approach.valueAdds[0]}` : 'Diagram / Schematic idea: [Draw flowchart or comparative table]'}

### 4. Way Forward & Conclusion (~${conclWords} words)
- Forward-looking solution / Committee recommendation:
- Concluding vision / Constitutional Morality / SDG alignment:
`;
  }

  function renderMainsApproachHtml(mKey, qText, marks, subject) {
    const approach = generateMainsApproach(qText, marks, subject);
    const is15M = approach.marksNum >= 15;

    return `
      <div class="approach-header">
        <div class="approach-title">
          <span>📐</span> Structural Answer Blueprint & Strategy
        </div>
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <span class="approach-directive-badge">🎯 Directive: ${approach.directive}</span>
          <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; font-weight: 700; font-size: 0.78rem;">
            ⏱️ ${approach.suggestedTime} Mins • ~${approach.targetWords} Words
          </span>
        </div>
      </div>

      <div class="approach-directive-desc">
        <strong>Directive Guidance (${approach.directive}):</strong> ${approach.directiveMeaning}
      </div>

      <!-- Step-by-Step Architecture -->
      <div style="margin-top: 4px;">
        <div class="approach-step-card">
          <div class="approach-step-header">
            <span>1. Introduction (~${is15M ? '35-40' : '25-30'} words)</span>
            <span style="font-size: 0.74rem; color: var(--text-muted);">~15% Word Count</span>
          </div>
          <div class="approach-step-desc">
            Define key terms, cite the governing Constitutional Article/statute, or give a crisp contextual backdrop/recent landmark judgment. Avoid lengthy background history.
          </div>
        </div>

        <div class="approach-step-card">
          <div class="approach-step-header">
            <span>2. Body Architecture (~${is15M ? '160-180' : '90-100'} words)</span>
            <span style="font-size: 0.74rem; color: var(--text-muted);">~70% Word Count</span>
          </div>
          <div class="approach-step-desc">
            Divide into 2 distinct subheadings. Use 4-5 crisp, numbered bullet points with underline keywords. Incorporate dimensions: Constitutional, Legal, Socio-Economic, and Institutional. Add a micro-flowchart or hub-and-spoke diagram if applicable.
          </div>
        </div>

        <div class="approach-step-card">
          <div class="approach-step-header">
            <span>3. Way Forward & Conclusion (~${is15M ? '35-40' : '25-30'} words)</span>
            <span style="font-size: 0.74rem; color: var(--text-muted);">~15% Word Count</span>
          </div>
          <div class="approach-step-desc">
            Conclude with a progressive, solution-oriented Way Forward citing a committee recommendation (e.g. 2nd ARC, Law Commission), Constitutional Morality, or SDG goals. Never end on a pessimistic note.
          </div>
        </div>
      </div>

      <!-- Value Addition Recommendations -->
      <div class="approach-value-adds">
        <h5>💡 Recommended Value Additions for this Question:</h5>
        <ul>
          ${approach.valueAdds.map(va => `<li>${escapeHtml(va)}</li>`).join('')}
        </ul>
      </div>

      <!-- Quick Action Buttons -->
      <div class="approach-actions">
        <button class="btn btn-subtle btn-sm" onclick="AWFG_APP.copyMainsOutline('${mKey}', this)">
          📋 Copy Outline
        </button>
        <button class="btn btn-primary btn-sm" onclick="AWFG_APP.insertTemplateToPad('${mKey}', ${marks})">
          📥 Insert Outline into Answer Pad
        </button>
      </div>
    `;
  }

  function toggleMainsApproach(mKey) {
    const el = document.getElementById(`approach-${mKey}`);
    if (el) {
      el.classList.toggle('hidden');
    }
  }

  function insertTemplateToPad(mKey, marks) {
    const pad = document.getElementById(`pad-${mKey}`);
    const ta = document.getElementById(`ta-${mKey}`);
    if (!pad || !ta) return;

    pad.classList.remove('hidden');

    const card = document.getElementById(`mcard-${mKey}`);
    const stemEl = card ? card.querySelector('.pyq-stem-text') : null;
    const qText = stemEl ? stemEl.textContent : '';

    const approach = generateMainsApproach(qText, marks);
    const outline = getMainsOutlineText(qText, marks, approach);

    if (ta.value.trim().length > 0) {
      if (confirm('Your answer pad already has some text. Do you want to append the template outline at the bottom?')) {
        ta.value = ta.value + '\n\n' + outline;
      }
    } else {
      ta.value = outline;
    }

    const targetWords = (parseFloat(marks) >= 15) ? 250 : 150;
    handleMainsWordCount(mKey, targetWords);

    ta.scrollIntoView({ behavior: 'smooth', block: 'center' });
    ta.focus();
    showToast('Outline inserted into your Answer Pad! Ready to draft.', '✍️');
  }

  function copyMainsOutline(mKey, btn) {
    const card = document.getElementById(`mcard-${mKey}`);
    const stemEl = card ? card.querySelector('.pyq-stem-text') : null;
    const qText = stemEl ? stemEl.textContent : '';
    const marksBadge = card ? card.querySelector('.pyq-marks-badge') : null;
    const marksMatch = marksBadge ? marksBadge.textContent.match(/(\d+(?:\.\d+)?)\s*Marks/) : null;
    const marks = marksMatch ? parseFloat(marksMatch[1]) : 10;

    const approach = generateMainsApproach(qText, marks);
    const outline = getMainsOutlineText(qText, marks, approach);

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(outline).then(() => {
        const old = btn.textContent;
        btn.textContent = '✓ Copied Outline!';
        setTimeout(() => btn.textContent = old, 2000);
        showToast('Template outline copied to clipboard!');
      });
    }
  }

  // Prelims Attempt Engine
  function attemptPrelims(qKey, choiceLetter, correctLetter) {
    if (!STATE.currentUser) ensureUser('Aspirant_2027', '');
    if (!STATE.currentUser.pyqAttempts) STATE.currentUser.pyqAttempts = {};

    choiceLetter = choiceLetter.toUpperCase();
    correctLetter = (correctLetter || '').toUpperCase();
    const isCorrect = choiceLetter === correctLetter;
    const score = isCorrect ? 2.0 : -0.66;

    STATE.currentUser.pyqAttempts[qKey] = {
      selected: choiceLetter,
      correct: correctLetter,
      isCorrect: isCorrect,
      score: score,
      timestamp: Date.now()
    };
    saveStorage();

    if (isCorrect) {
      showToast(`✅ Correct! +2.00 Marks (Option ${choiceLetter})`, '🎉');
    } else {
      showToast(`❌ Incorrect (-0.66). Official Key is (${correctLetter})`, '⚠️');
    }

    renderPyqBody();
  }

  function resetMicrothemeQuiz() {
    if (!STATE.currentUser || !STATE.currentUser.pyqAttempts) return;
    const norm = currentPyqData.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const prefix = `p_${norm}_`;
    let count = 0;
    for (const k in STATE.currentUser.pyqAttempts) {
      if (k.startsWith(prefix)) {
        delete STATE.currentUser.pyqAttempts[k];
        count++;
      }
    }
    saveStorage();
    renderPyqBody();
    showToast(`Quiz reset! ${count} question attempts cleared.`);
  }

  function resetQuestionAttempt(qKey) {
    if (!STATE.currentUser || !STATE.currentUser.pyqAttempts) return;
    delete STATE.currentUser.pyqAttempts[qKey];
    saveStorage();
    showToast('Question reset. You can now re-attempt it fresh!', '🔄');
    renderPyqBody();
  }

  // WYSK Question Bank Actions
  function setWyskPaper(paper) {
    STATE.wyskPaper = paper;
    STATE.wyskTopic = 'ALL';
    STATE.wyskLimit = 60;
    renderView();
  }

  function setWyskTopic(topic) {
    STATE.wyskTopic = topic;
    STATE.wyskLimit = 60;
    renderView();
  }

  function setWyskSearch(query) {
    STATE.wyskSearch = query;
    STATE.wyskLimit = 60;
    renderView();
    // Maintain focus on search input
    setTimeout(() => {
      const inp = document.getElementById('wysk-search-input');
      if (inp) {
        inp.focus();
        inp.selectionStart = inp.selectionEnd = inp.value.length;
      }
    }, 10);
  }

  function loadMoreWysk() {
    STATE.wyskLimit = (STATE.wyskLimit || 60) + 60;
    renderView();
  }

  function loadAllWysk() {
    STATE.wyskLimit = 99999;
    renderView();
  }

  function toggleWyskMaster(qId) {
    if (!STATE.currentUser) ensureUser('Aspirant_2027', '');
    if (!STATE.currentUser.wyskMasterChecked) STATE.currentUser.wyskMasterChecked = {};
    const curr = !!STATE.currentUser.wyskMasterChecked[qId];
    STATE.currentUser.wyskMasterChecked[qId] = !curr;
    saveStorage();
    renderView();
    showToast(curr ? 'Marked as unread' : '🎉 Question marked as mastered!');
  }

  function renderPyqBody() {
    const body = document.getElementById('pyq-modal-body');
    if (!body) return;

    const filter = (currentPyqData.filterText || '').toLowerCase().trim();
    const normMt = currentPyqData.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const userAttempts = (STATE.currentUser && STATE.currentUser.pyqAttempts) || {};
    const userMains = (STATE.currentUser && STATE.currentUser.mainsAnswers) || {};

    if (currentPyqData.activeTab === 'mains') {
      let list = currentPyqData.mains;
      if (filter) {
        list = list.filter(q => (q.text || '').toLowerCase().includes(filter) || String(q.year).includes(filter));
      }

      if (list.length === 0) {
        body.innerHTML = `
          <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
            <div style="font-size: 2.2rem; margin-bottom: 10px;">📝</div>
            <h3 style="color: var(--text-primary); margin-bottom: 6px;">No Mains Questions Found</h3>
            <p style="font-size: 0.88rem;">${currentPyqData.mains.length === 0 ? 'No Mains theory PYQs explicitly tagged under this microtheme.' : 'No questions match your search filter.'}</p>
            ${currentPyqData.prelims.length > 0 ? `<button class="btn btn-primary btn-sm" style="margin-top: 14px;" onclick="AWFG_APP.switchPyqTab('prelims')">Switch to ${currentPyqData.prelims.length} Prelims PYQs ➔</button>` : ''}
          </div>
        `;
        return;
      }

      body.innerHTML = list.map((q, idx) => {
        const mKey = `m_${normMt}_${q.year}_${idx}`;
        const draft = userMains[mKey];
        const isAttempted = !!draft && !!draft.text;
        const targetWords = (q.marks >= 15) ? 250 : 150;
        const suggestedMinutes = (q.marks >= 15) ? 11 : 7;
        const savedWords = draft ? draft.wordCount : 0;
        const pct = Math.min(100, Math.round((savedWords / targetWords) * 100));
        const approach = generateMainsApproach(q.text, q.marks, q.subject);

        return `
          <div class="pyq-question-card mains" id="mcard-${mKey}">
            <div class="pyq-card-top">
              <div class="pyq-meta-badges">
                <span class="pyq-year-badge">UPSC Mains ${q.year}</span>
                <span class="pyq-marks-badge">${q.marks} Marks • ~${targetWords} words (${suggestedMinutes} mins)</span>
                ${isAttempted ? `<span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #10b981; font-weight: 700;">✓ Answer Saved (${savedWords} words)</span>` : ''}
              </div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button class="btn ${isAttempted ? 'btn-subtle' : 'btn-primary'} btn-sm" onclick="AWFG_APP.toggleAnswerPad('${mKey}')">
                  ✍️ ${isAttempted ? 'Edit Answer' : 'Draft Answer'}
                </button>
                <button class="btn btn-outline btn-sm" onclick="AWFG_APP.toggleMainsApproach('${mKey}')" style="border-color: #818cf8; color: #818cf8; font-weight: 600;">
                  📐 How to Approach
                </button>
                <button class="btn btn-subtle btn-sm" onclick="AWFG_APP.copyQuestion('${escapeQuotes(q.text)}', this)" title="Copy question text">📋 Copy</button>
              </div>
            </div>
            <div class="pyq-stem-text">${escapeHtml(q.text)}</div>

            <!-- Dynamic How to Approach Blueprint Box -->
            <div id="approach-${mKey}" class="pyq-approach-box hidden">
              ${renderMainsApproachHtml(mKey, q.text, q.marks, q.subject)}
            </div>

            <!-- Expandable Answer Writing Pad -->
            <div id="pad-${mKey}" class="pyq-answer-pad ${isAttempted ? '' : 'hidden'}">
              <!-- Integrated Approach & Quick Template Toolbar Banner -->
              <div class="pad-template-banner">
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 1.15rem;">💡</span>
                    <div>
                      <strong style="color: #818cf8; font-size: 0.88rem;">UPSC Structure Blueprint:</strong>
                      <span style="color: var(--text-secondary); font-size: 0.82rem; margin-left: 6px;">Directive: <strong style="color: var(--text-primary);">${approach.directive}</strong> • ~${targetWords} words (${suggestedMinutes} mins)</span>
                    </div>
                  </div>
                  <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button type="button" class="btn btn-subtle btn-sm" onclick="AWFG_APP.toggleMainsApproach('${mKey}')" style="font-size: 0.8rem;">
                      🔍 View Case Laws & Framework
                    </button>
                    <button type="button" class="btn btn-primary btn-sm" onclick="AWFG_APP.insertTemplateToPad('${mKey}', ${q.marks})" style="background: linear-gradient(135deg, #6366f1, #4f46e5); font-weight: 700; font-size: 0.82rem;">
                      📥 Pre-fill 3-Part Answer Template
                    </button>
                  </div>
                </div>
              </div>

              <div class="pyq-pad-toolbar">
                <div class="pyq-timer-box">
                  <span>⏱️ Time:</span>
                  <strong id="tdisp-${mKey}">00:00</strong>
                  <button class="btn btn-subtle btn-sm" id="tbtn-${mKey}" onclick="AWFG_APP.toggleTimer('${mKey}')">▶ Start</button>
                  <button class="btn btn-subtle btn-sm" onclick="AWFG_APP.resetTimer('${mKey}')" title="Reset stopwatch">🔄</button>
                </div>
                <div>
                  <strong>Words: </strong><span id="wc-${mKey}">${savedWords}</span> / ${targetWords}
                </div>
              </div>

              <div class="word-progress-container">
                <div id="pb-${mKey}" class="word-progress-bar" style="width: ${pct}%;"></div>
              </div>

              <textarea id="ta-${mKey}" class="pyq-textarea" placeholder="Write your structured answer here (Introduction ➔ Body arguments, case laws, committees, data ➔ Way Forward / Conclusion)..." oninput="AWFG_APP.handleMainsWordCount('${mKey}', ${targetWords})">${draft ? escapeHtml(draft.text) : ''}</textarea>

              <div class="pyq-pad-actions">
                <div style="font-size: 0.78rem; color: var(--text-muted);">
                  ${draft ? `Saved on: ${draft.savedAt}` : 'Not saved yet'}
                </div>
                <div style="display: flex; gap: 8px;">
                  ${isAttempted ? `<button class="btn btn-subtle btn-sm" onclick="AWFG_APP.copyMainsAnswer('${mKey}')">📋 Copy My Answer</button>` : ''}
                  <button class="btn btn-primary btn-sm" onclick="AWFG_APP.saveMainsAnswer('${mKey}', ${targetWords})">💾 Save Answer</button>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join('');

    } else {
      // Prelims Tab
      let list = currentPyqData.prelims;
      if (filter) {
        list = list.filter(q => (q.fullText || q.stem || '').toLowerCase().includes(filter) || String(q.year).includes(filter));
      }

      if (list.length === 0) {
        body.innerHTML = `
          <div style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
            <div style="font-size: 2.2rem; margin-bottom: 10px;">🎯</div>
            <h3 style="color: var(--text-primary); margin-bottom: 6px;">No Prelims Questions Found</h3>
            <p style="font-size: 0.88rem;">${currentPyqData.prelims.length === 0 ? 'No Prelims objective PYQs explicitly tagged under this microtheme.' : 'No questions match your search filter.'}</p>
            ${currentPyqData.mains.length > 0 ? `<button class="btn btn-primary btn-sm" style="margin-top: 14px;" onclick="AWFG_APP.switchPyqTab('mains')">Switch to ${currentPyqData.mains.length} Mains PYQs ➔</button>` : ''}
          </div>
        `;
        return;
      }

      // Calculate Quiz Scoreboard Stats
      let attemptedCount = 0;
      let correctCount = 0;
      let wrongCount = 0;
      let netScore = 0;

      currentPyqData.prelims.forEach((q, idx) => {
        const qKey = `p_${normMt}_${q.year}_${q.qNum || idx}`;
        const att = userAttempts[qKey];
        if (att) {
          attemptedCount++;
          if (att.isCorrect) {
            correctCount++;
            netScore += 2.0;
          } else {
            wrongCount++;
            netScore -= 0.66;
          }
        }
      });

      const accuracy = attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 0;
      const formattedNet = netScore >= 0 ? `+${netScore.toFixed(2)}` : netScore.toFixed(2);

      // Scoreboard Header HTML
      const scoreboardHtml = `
        <div class="pyq-quiz-scoreboard">
          <div class="score-pills-group">
            <div class="score-pill score-net">
              <span class="score-label">Net Score:</span>
              <span class="score-val">${formattedNet}</span>
            </div>
            <div class="score-pill score-attempted">
              <span class="score-label">Attempted:</span>
              <span class="score-val">${attemptedCount} / ${currentPyqData.prelims.length}</span>
            </div>
            <div class="score-pill" style="color: #10b981;">
              <span>✅ ${correctCount} Correct</span>
            </div>
            <div class="score-pill" style="color: #ef4444;">
              <span>❌ ${wrongCount} Wrong</span>
            </div>
            <div class="score-pill score-accuracy">
              <span class="score-label">Accuracy:</span>
              <span class="score-val">${accuracy}%</span>
            </div>
          </div>
          ${attemptedCount > 0 ? `<button class="btn btn-subtle btn-sm" onclick="AWFG_APP.resetMicrothemeQuiz()">🔄 Reset Quiz</button>` : ''}
        </div>
      `;

      const questionsHtml = list.map((q, idx) => {
        const qKey = `p_${normMt}_${q.year}_${q.qNum || idx}`;
        const att = userAttempts[qKey];
        const isAttempted = !!att;
        const correctAns = (q.ans || '').toUpperCase();

        // Parse options into structured array if available
        let optList = q.options && q.options.length > 0 ? q.options : [];
        const hasStructuredOpts = optList.length >= 2;

        return `
          <div class="pyq-question-card prelims ${isAttempted ? (att.isCorrect ? 'is-correct-border' : 'is-wrong-border') : ''}">
            <div class="pyq-card-top">
              <div class="pyq-meta-badges">
                <span class="pyq-year-badge">UPSC Prelims ${q.year}</span>
                <span class="badge" style="font-size: 0.72rem; background: rgba(16, 185, 129, 0.15); color: #10b981;">Q# ${q.qNum || (idx + 1)}</span>
                ${isAttempted ? (att.isCorrect
                  ? `<span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #10b981; font-weight: 700;">✅ +2.00 Marks</span>`
                  : `<span class="badge" style="background: rgba(239, 68, 68, 0.2); color: #ef4444; font-weight: 700;">❌ -0.66 Marks</span>`
                ) : '<span class="badge" style="font-size: 0.72rem; background: var(--bg-tertiary); color: var(--text-secondary);">Click an option to attempt</span>'}
              </div>
            </div>

            <div class="pyq-stem-text">${escapeHtml(q.stem || q.fullText)}</div>

            <!-- Attemptable Option Cards -->
            <div class="pyq-options-list">
              ${hasStructuredOpts ? optList.map((opt, optIdx) => {
                const letterMatch = opt.match(/^\(([a-d])\)/i);
                const optLetter = letterMatch ? letterMatch[1].toUpperCase() : ['A', 'B', 'C', 'D'][optIdx];
                const optText = letterMatch ? opt.substring(letterMatch[0].length).trim() : opt;

                let stateClass = '';
                if (isAttempted) {
                  if (att.selected === optLetter) {
                    stateClass = att.isCorrect ? 'is-correct' : 'is-wrong';
                  } else if (optLetter === correctAns) {
                    stateClass = 'is-correct-reveal';
                  }
                }

                return `
                  <div class="pyq-option-card ${stateClass}" onclick="AWFG_APP.attemptPrelims('${qKey}', '${optLetter}', '${correctAns}')">
                    <span class="pyq-opt-letter">${optLetter}</span>
                    <span style="flex: 1;">${escapeHtml(optText)}</span>
                    ${isAttempted && att.selected === optLetter ? (att.isCorrect ? '<span>✅</span>' : '<span>❌</span>') : ''}
                    ${isAttempted && !att.isCorrect && optLetter === correctAns ? '<span title="Correct Answer">✓</span>' : ''}
                  </div>
                `;
              }).join('') : `
                <!-- Fallback 4 Option Buttons if options were embedded in stem -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px;">
                  ${['A', 'B', 'C', 'D'].map(letter => {
                    let stateClass = '';
                    if (isAttempted) {
                      if (att.selected === letter) stateClass = att.isCorrect ? 'is-correct' : 'is-wrong';
                      else if (letter === correctAns) stateClass = 'is-correct-reveal';
                    }
                    return `
                      <div class="pyq-option-card ${stateClass}" onclick="AWFG_APP.attemptPrelims('${qKey}', '${letter}', '${correctAns}')" style="justify-content: center; font-weight: 700;">
                        <span class="pyq-opt-letter">${letter}</span> Option (${letter})
                      </div>
                    `;
                  }).join('')}
                </div>
              `}
            </div>

            <!-- Feedback Banner after attempt -->
            ${isAttempted ? `
              <div class="pyq-feedback-banner ${att.isCorrect ? 'correct' : 'wrong'}">
                <div style="flex: 1;">
                  ${att.isCorrect
                    ? `<strong>🎉 Correct Answer!</strong> You secured <strong>+2.00 marks</strong> (Official Key: <strong>${correctAns}</strong>).`
                    : `<strong>⚠️ Incorrect Attempt (-0.66 marks).</strong> You picked <strong>(${att.selected})</strong>, but the official UPSC answer key is <strong>(${correctAns})</strong>.`
                  }
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                  <button class="btn btn-subtle btn-sm" onclick="AWFG_APP.resetQuestionAttempt('${qKey}')" title="Reset and re-attempt this question fresh">🔄 Re-attempt</button>
                </div>
              </div>
            ` : ''}

            <!-- Legacy reveal button if not attempted yet -->
            ${(!isAttempted && correctAns) ? `
              <div class="pyq-ans-container">
                <button class="btn btn-outline btn-sm" onclick="this.nextElementSibling.classList.toggle('hidden'); this.textContent = this.nextElementSibling.classList.contains('hidden') ? '👁️ Peek Answer' : '🙈 Hide Answer';">👁️ Peek Answer</button>
                <div class="pyq-ans-pill hidden">Official UPSC Key: (${escapeHtml(correctAns)})</div>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');

      body.innerHTML = scoreboardHtml + questionsHtml;
    }
  }

  function copyQuestion(text, btn) {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        const oldText = btn.textContent;
        btn.textContent = '✓ Copied!';
        setTimeout(() => btn.textContent = oldText, 2000);
        showToast('Question copied to clipboard!');
      }).catch(() => {
        showToast('Question selected');
      });
    } else {
      showToast('Question text ready');
    }
  }

  function initPyqModal() {
    const modal = document.getElementById('pyq-modal');
    if (!modal) return;

    const closeBtn = document.getElementById('pyq-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', closePyqModal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closePyqModal();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closePyqModal();
    });

    document.querySelectorAll('.pyq-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentPyqData.activeTab = btn.dataset.pyqTab;
        updatePyqTabsUI();
        renderPyqBody();
      });
    });

    const searchInp = document.getElementById('pyq-search-inp');
    if (searchInp) {
      searchInp.addEventListener('input', (e) => {
        currentPyqData.filterText = e.target.value;
        renderPyqBody();
      });
    }
  }

  // Expose global controller
  window.AWFG_APP = {
    jumpToTest: jumpToTest,
    openPyqModal: openPyqModal,
    closePyqModal: closePyqModal,
    switchPyqTab: switchPyqTab,
    copyQuestion: copyQuestion,
    attemptPrelims: attemptPrelims,
    resetMicrothemeQuiz: resetMicrothemeQuiz,
    resetQuestionAttempt: resetQuestionAttempt,
    setWyskPaper: setWyskPaper,
    setWyskTopic: setWyskTopic,
    setWyskSearch: setWyskSearch,
    loadMoreWysk: loadMoreWysk,
    loadAllWysk: loadAllWysk,
    toggleWyskMaster: toggleWyskMaster,
    toggleAnswerPad: toggleAnswerPad,
    handleMainsWordCount: handleMainsWordCount,
    saveMainsAnswer: saveMainsAnswer,
    copyMainsAnswer: copyMainsAnswer,
    toggleTimer: toggleTimer,
    resetTimer: resetTimer,
    toggleMainsApproach: toggleMainsApproach,
    insertTemplateToPad: insertTemplateToPad,
    copyMainsOutline: copyMainsOutline,
    getState: () => STATE,
    showToast: showToast
  };

  // Bootstrap when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    loadStorage();
    initUI();
  });

})();
