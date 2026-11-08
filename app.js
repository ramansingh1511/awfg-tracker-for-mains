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
                      <div class="checklist-title" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
                        <span class="microtheme-clickable" onclick="event.stopPropagation(); AWFG_APP.openPyqModal('${escapeQuotes(mt)}', 'mains')" title="Click to view & practice Mains questions">${mt}</span>
                        <button type="button" class="pyq-pill-trigger" onclick="event.stopPropagation(); AWFG_APP.openPyqModal('${escapeQuotes(mt)}', 'mains')" title="Open Mains questions">📝 Mains PYQs</button>
                      </div>
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
                      <div class="checklist-title" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
                        <div>
                          <span class="microtheme-clickable" onclick="event.stopPropagation(); AWFG_APP.openPyqModal('${escapeQuotes(cp.name)}', 'mains')" title="Click to view Mains & Prelims questions">${cp.name}</span>
                          <span class="qs-pill" style="margin-left: 6px;">${cp.qs} Prelims PYQs</span>
                        </div>
                        <button type="button" class="pyq-pill-trigger" onclick="event.stopPropagation(); AWFG_APP.openPyqModal('${escapeQuotes(cp.name)}', 'mains')" title="Open PYQ Explorer">👁️ View PYQs</button>
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
                        <div class="checklist-title" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px; color: #fbbf24;">
                          <div>
                            <span class="microtheme-clickable" onclick="event.stopPropagation(); AWFG_APP.openPyqModal('${escapeQuotes(ep.name)}', 'prelims')" title="Click to practice Prelims questions" style="color: #fbbf24;">${ep.name}</span>
                            <span class="qs-pill" style="background: rgba(245, 158, 11, 0.25); color: #fbbf24; margin-left: 6px;">${ep.qs} Prelims Qs</span>
                          </div>
                          <button type="button" class="pyq-pill-trigger" onclick="event.stopPropagation(); AWFG_APP.openPyqModal('${escapeQuotes(ep.name)}', 'prelims')" title="Open Prelims Quiz">🎯 Practice</button>
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
    // Synchronize top toolbar paper pills with current STATE.paperFilter
    document.querySelectorAll('.pill-btn[data-paper]').forEach(b => {
      b.classList.toggle('active', b.dataset.paper === STATE.paperFilter);
    });
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
    const baseSchedule = window.AWFG_SCHEDULE || [];
    const schedule = (STATE.paperFilter === 'ALL')
      ? baseSchedule
      : baseSchedule.filter(t => t.paper === STATE.paperFilter);
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

  // Render Prelims vs Mains Synergy Matrix View (Filtered by Paper & Search)
  function renderMatrixView(container) {
    const prelims = window.MASTER_PRELIMS_CATALOG || {};
    const searchQ = (STATE.searchQuery || '').trim().toLowerCase();

    const SUBJECT_PAPER_MAP = {
      'Arts & Culture': 'GS-1',
      'Modern History': 'GS-1',
      'Geography': 'GS-1',
      'Off Topics': 'GS-1',
      'Polity': 'GS-2',
      'Governance': 'GS-2',
      'International Relations': 'GS-2',
      'Economics': 'GS-3',
      'Agriculture': 'GS-3',
      'Environment': 'GS-3',
      'Science & Technology': 'GS-3',
      'Ethics': 'GS-4'
    };

    let subjectKeys = Object.keys(prelims);
    if (STATE.paperFilter !== 'ALL') {
      subjectKeys = subjectKeys.filter(sub => SUBJECT_PAPER_MAP[sub] === STATE.paperFilter);
    }

    let rowsHtml = '';
    let totalMatchingItems = 0;

    subjectKeys.forEach(sub => {
      let items = prelims[sub] || [];
      if (searchQ) {
        items = items.filter(it => it.name.toLowerCase().includes(searchQ) || sub.toLowerCase().includes(searchQ));
      }
      if (items.length === 0) return;
      totalMatchingItems += items.length;

      items.forEach((item, i) => {
        const isCoinciding = item.coincides;
        rowsHtml += `
          <tr>
            ${i === 0 ? `<td rowspan="${items.length}" style="font-weight: 700; vertical-align: top; background: var(--bg-primary);"><span class="paper-badge ${SUBJECT_PAPER_MAP[sub] || 'GS-1'}" style="font-size: 0.65rem; padding: 2px 6px; margin-right: 4px;">${SUBJECT_PAPER_MAP[sub] || 'GS-1'}</span><br>${sub}</td>` : ''}
            <td style="font-weight: 600;">
              <span class="microtheme-clickable" onclick="AWFG_APP.openPyqModal('${escapeQuotes(item.name)}', '${isCoinciding ? 'mains' : 'prelims'}')" title="Click to open all questions">${item.name}</span>
            </td>
            <td><span class="qs-pill">${item.qs} Qs</span></td>
            <td>
              <span class="status-badge ${isCoinciding ? 'completed' : 'delayed'} microtheme-clickable" onclick="AWFG_APP.openPyqModal('${escapeQuotes(item.name)}', '${isCoinciding ? 'mains' : 'prelims'}')" style="font-size: 0.72rem; cursor: pointer;" title="Click to view ${isCoinciding ? 'Mains' : 'Prelims'} questions">
                ${isCoinciding ? '🔗 Overlaps with Mains' : '⚡ Prelims-Exclusive'}
              </span>
            </td>
            <td style="color: var(--text-secondary); font-size: 0.82rem;">
              ${isCoinciding ? 
                'Direct conceptual overlap in GS Mains tests. Use factual details as illustrations in Mains answers.' : 
                'Distinct factual focus (articles, lists, geographical locations, treaties, definitions). Revise via flashnotes.'}
            </td>
            <td>
              <button class="pyq-pill-trigger" onclick="AWFG_APP.openPyqModal('${escapeQuotes(item.name)}', '${isCoinciding ? 'mains' : 'prelims'}')">👁️ View PYQs</button>
            </td>
          </tr>
        `;
      });
    });

    let html = `
      <div class="matrix-view">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px; margin-bottom: 12px;">
          <div>
            <h2>🔄 Prelims vs Mains Microthemes Synergy Matrix</h2>
            <p style="color: var(--text-secondary); font-size: 0.88rem; margin: 4px 0 0;">
              Filtering by <strong>${STATE.paperFilter === 'ALL' ? 'All Papers' : STATE.paperFilter}</strong> • ${totalMatchingItems} Microthemes displayed.
            </p>
          </div>
          ${STATE.paperFilter !== 'ALL' ? `<button class="btn btn-subtle btn-sm" onclick="AWFG_APP.setFilterPaper('ALL')">Clear Paper Filter (Show All)</button>` : ''}
        </div>
        ${totalMatchingItems === 0 ? `
          <div style="text-align: center; padding: 40px 20px; background: var(--bg-secondary); border-radius: var(--radius-md); border: 1px solid var(--border-color);">
            <div style="font-size: 2rem; margin-bottom: 8px;">🔍</div>
            <h3>No Microthemes Match Filter (${STATE.paperFilter})</h3>
            <p style="color: var(--text-secondary); font-size: 0.88rem;">Try selecting 'ALL' papers or clearing your search term.</p>
          </div>
        ` : `
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
            <tbody>${rowsHtml}</tbody>
          </table>
        `}
      </div>
    `;
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

    // Filter by Paper (Synced with top toolbar paperFilter)
    const currentPaper = (STATE.paperFilter && STATE.paperFilter !== 'ALL') ? STATE.paperFilter : (STATE.wyskPaper || 'ALL');
    STATE.wyskPaper = currentPaper;
    STATE.paperFilter = currentPaper;
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

    // 5. Paper Filter Pills (Synced across all views including WYSK)
    document.querySelectorAll('.pill-btn[data-paper]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.pill-btn[data-paper]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const paper = btn.dataset.paper;
        STATE.paperFilter = paper;
        STATE.wyskPaper = paper;
        STATE.wyskTopic = 'ALL';
        STATE.wyskLimit = 60;
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

    // 7. Live Search (Synced across all views including WYSK)
    const searchInp = document.getElementById('search-query-input');
    if (searchInp) {
      searchInp.addEventListener('input', (e) => {
        STATE.searchQuery = e.target.value;
        STATE.wyskSearch = e.target.value;
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

  function openPyqModal(microthemeName, preferredTab) {
    if (!microthemeName) return;

    // Normalize and fetch from questions_data.js
    const qData = (window.getMicrothemeQuestions && typeof window.getMicrothemeQuestions === 'function')
      ? window.getMicrothemeQuestions(microthemeName)
      : { mains: [], prelims: [] };

    currentPyqData.name = microthemeName;
    currentPyqData.mains = qData.mains || [];
    currentPyqData.prelims = qData.prelims || [];
    currentPyqData.filterText = '';

    // Choose default active tab based on preferredTab and available questions
    if (preferredTab === 'mains' && currentPyqData.mains.length > 0) {
      currentPyqData.activeTab = 'mains';
    } else if (preferredTab === 'prelims' && currentPyqData.prelims.length > 0) {
      currentPyqData.activeTab = 'prelims';
    } else if (currentPyqData.mains.length > 0) {
      currentPyqData.activeTab = 'mains';
    } else if (currentPyqData.prelims.length > 0) {
      currentPyqData.activeTab = 'prelims';
    } else {
      currentPyqData.activeTab = preferredTab || 'mains';
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

  // =============================================================
  // UPSC Mains Answer Framework & "How to Approach" Engine
  // Comprehensive, Academic Subject-Calibrated Blueprint Engine
  // =============================================================

  function detectQuestionDomain(qText, subject) {
    if (window.TOPPER_ENGINE && window.TOPPER_ENGINE.detectQuestionDomain) {
      return window.TOPPER_ENGINE.detectQuestionDomain(qText, subject);
    }
    const s = (subject || '').toLowerCase();
    const q = (qText || '').toLowerCase();

    // 1. Climatology & Atmospheric Dynamics (GS-1 Geography)
    if (q.includes('troposphere') || q.includes('atmosphere') || q.includes('inversion') || 
        q.includes('air mass') || q.includes('front') || q.includes('monsoon') || 
        q.includes('cyclone') || q.includes('jet stream') || q.includes('lapse rate') || 
        q.includes('weather') || q.includes('climate change') || q.includes('cryosphere') || 
        q.includes('glacier') || q.includes('cloudburst') || q.includes('heat wave') || 
        q.includes('western disturbance') || q.includes('itcz') || q.includes('albedo')) {
      return 'GEOGRAPHY_CLIMATOLOGY';
    }

    // 2. Physical Geomorphology, Oceanography & Earth Systems (GS-1 Geography)
    if (q.includes('plate tectonic') || q.includes('volcano') || q.includes('earthquake') || 
        q.includes('ocean current') || q.includes('coral reef') || q.includes('continental shelf') || 
        q.includes('tides') || q.includes('land subsidence') || q.includes('landslide') || 
        q.includes('western ghats') || q.includes('desert') || q.includes('geomorphic') || 
        q.includes('lithosphere') || q.includes('crust') || q.includes('tsunami') || 
        s.includes('geography')) {
      return 'GEOGRAPHY_PHYSICAL';
    }

    // 3. Indian Society, Demography & Social Justice (GS-1 Society)
    if (q.includes('transgender') || q.includes('caste') || q.includes('regionalism') || 
        q.includes('secularism') || q.includes('communalism') || q.includes('child labour') || 
        q.includes('women') || q.includes('gender') || q.includes('vulnerab') || 
        q.includes('family') || q.includes('marriage') || q.includes('diversity of india') || 
        q.includes('urbanization') || q.includes('population') || q.includes('fertility') || 
        q.includes('tribal') || q.includes('linguistic') || q.includes('care economy') || 
        s.includes('society')) {
      return 'INDIAN_SOCIETY';
    }

    // 4. Polity, Constitution & Governance (GS-2)
    if (q.includes('article ') || q.includes('fundamental rights') || q.includes('privacy') || 
        q.includes('directive principles') || q.includes('basic structure') || q.includes('judicial review') || 
        q.includes('supreme court') || q.includes('governor') || q.includes('federal') || 
        q.includes('parliament') || q.includes('separation of powers') || q.includes('ordinance') || 
        q.includes('election commission') || q.includes('living instrument') || q.includes('section 66a') || 
        q.includes('freedom of speech') || s.includes('polity') || s.includes('governance')) {
      return 'POLITY_CONSTITUTION';
    }

    // 5. Modern Indian & World History, Art & Culture (GS-1 History)
    if (q.includes('1857') || q.includes('freedom struggle') || q.includes('non-cooperation') || 
        q.includes('civil disobedience') || q.includes('quit india') || q.includes('gandhi') || 
        q.includes('buddhism') || q.includes('jainism') || q.includes('temple') || 
        q.includes('sculpture') || q.includes('harappa') || q.includes('bismarck') || 
        q.includes('world war') || q.includes('industrial revolution') || q.includes('decolonization') || 
        q.includes('bhakti') || q.includes('sufism') || q.includes('british') || 
        s.includes('history') || s.includes('culture')) {
      return 'HISTORY_CULTURE';
    }

    // 6. Economy, Agriculture & Environment (GS-3)
    if (q.includes('msp') || q.includes('subsidy') || q.includes('agriculture') || 
        q.includes('irrigation') || q.includes('food security') || q.includes('renewable energy') || 
        q.includes('wetland') || q.includes('eia') || q.includes('pollution') || 
        q.includes('disaster') || q.includes('gdp') || q.includes('inflation') || 
        s.includes('economy') || s.includes('environment')) {
      return 'ECONOMY_ENVIRONMENT';
    }

    return 'GENERAL_MAINS';
  }

  // -------------------------------------------------------------
  // Comprehensive UPSC Mains Subject Blueprint Engine
  // -------------------------------------------------------------
  function generateMainsApproach(qText, marks, subject) {
    return generateComprehensiveBlueprint(qText, marks, subject);
  }

  function generateComprehensiveBlueprint(qText, marks, subject) {
    if (window.TOPPER_ENGINE && window.TOPPER_ENGINE.getComprehensiveBlueprint) {
      return window.TOPPER_ENGINE.getComprehensiveBlueprint(qText, marks, subject);
    }
    const marksNum = parseFloat(marks) || 10;
    const targetWords = (marksNum >= 15) ? 250 : 150;
    const suggestedTime = (marksNum >= 15) ? 11 : 7;
    const domain = detectQuestionDomain(qText, subject);
    const qLower = (qText || '').toLowerCase();

    // Directive Detection & Meaning
    let directive = "Examine";
    let directiveMeaning = "Analyze the core facts, underlying mechanisms, and practical implications of the issue with empirical evidence.";
    if (qLower.includes("critically examine") || qLower.includes("critically analyze") || qLower.includes("critically evaluate")) {
      directive = "Critically Examine / Analyze";
      directiveMeaning = "Conduct a rigorous scrutiny of both affirmative strengths and structural limitations, arriving at an objective verdict.";
    } else if (qLower.includes("discuss")) {
      directive = "Discuss";
      directiveMeaning = "Explore multiple interrelated dimensions and synthesize a comprehensive, multi-faceted perspective.";
    } else if (qLower.includes("evaluate") || qLower.includes("assess")) {
      directive = "Evaluate / Assess";
      directiveMeaning = "Appraise the practical effectiveness, success, or shortcomings against foundational objectives.";
    } else if (qLower.includes("comment")) {
      directive = "Comment";
      directiveMeaning = "Formulate a reasoned, principled stance on the proposition, defending it with grounded facts and principles.";
    } else if (qLower.includes("how") || qLower.includes("why") || qLower.includes("what")) {
      directive = "Direct Analytical Query";
      directiveMeaning = "Directly deconstruct all components of the prompt with technical clarity, diagrams, and empirical substantiation.";
    }

    // ---------------------------------------------------------
    // 1. GEOGRAPHY: TROPOSPHERE & WEATHER PROCESSES
    // ---------------------------------------------------------
    if (qLower.includes('troposphere')) {
      return {
        domainLabel: 'Physical Geography • Climatology & Atmospheric Dynamics',
        directive,
        directiveMeaning,
        targetWords,
        suggestedTime,
        marksNum,
        intros: [
          {
            type: 'Option 1: Atmospheric Physics & Definition Hook',
            text: 'The troposphere is the lowest atmospheric layer extending from Earth\'s surface up to ~8 km at the poles and ~18 km at the equator. Containing 75–80% of total atmospheric mass and 99% of all water vapour and aerosols, it serves as the planetary convective engine where almost all terrestrial weather phenomena occur.'
          },
          {
            type: 'Option 2: Thermodynamic & Heat Engine Hook',
            text: 'Unlike upper atmospheric layers heated by radiation absorption, the troposphere is heated from below by terrestrial infrared radiation, establishing an unstable Normal Lapse Rate (6.5°C/km). This vertical temperature gradient powers continuous convective overturning, cloud genesis, and global precipitation systems.'
          },
          {
            type: 'Option 3: Meteorological Boundary Hook',
            text: 'Capped above by the isothermal thermal ceiling of the Tropopause, the troposphere functions as a closed fluid envelope that traps water phase changes, latent heat release, and planetary circulation cells sustaining the biosphere.'
          }
        ],
        headings: [
          {
            title: '1. Thermodynamic & Physical Drivers Making Troposphere the Weather Engine',
            points: [
              '99% Concentration of Water Vapour & Aerosols: Moisture and hygroscopic condensation nuclei are confined below the tropopause; without them, cloud condensation, dew, and precipitation cannot physically occur.',
              'Normal Lapse Rate (6.5°C/km) & Adiabatic Instability: Direct surface heating makes warm surface air buoyant, triggering vigorous vertical convective updrafts and cyclonic cloud formation.',
              'Latent Heat of Condensation as Energy Catalyst: Phase change of moisture releases vast latent heat into the middle troposphere, powering tropical cyclones, monsoonal depressions, and thunderstorms.'
            ]
          },
          {
            title: '2. Major Weather Phenomena Governed Exclusively within Troposphere',
            points: [
              'Triglobal Circulation Cells: Hadley, Ferrel, and Polar cells circulate entirely within the tropospheric depth, driving planetary Trade Winds, Westerlies, and seasonal Monsoons.',
              'Upper Tropospheric Jet Streams: Narrow meandering bands of high-speed winds (Subtropical Westerly Jet, Polar Front Jet) guide temperate cyclones and steer Indian Western Disturbances.',
              'Frontogenesis & Airmass Mixing: Collisions of polar cold and tropical warm air masses occur in middle-high latitudes, generating temperate frontal weather.'
            ]
          },
          {
            title: '3. Role of the Tropopause as a Dynamic Meteorological Ceiling',
            points: [
              'Thermal Inversion Barrier: At the tropopause, temperature stops decreasing and begins rising in the stratosphere (due to ozone UV absorption), creating an absolute stability lid that halts vertical convective cloud penetration.',
              'Latitudinal Elevation Asymmetry: Convective intensity expands the tropopause to 18 km at the equator versus 8 km at the poles, determining the spatial depth of global weather systems.'
            ]
          },
          {
            title: '4. Anthropogenic Destabilization of Tropospheric Balance',
            points: [
              'Tropospheric Warming & Tropopause Height Expansion: Rising greenhouse gas concentrations elevate the tropopause level, expanding the tropical Hadley cell polewards and intensifying unseasonal weather extremes (IPCC AR6).'
            ]
          }
        ],
        diagramTitle: 'Atmospheric Layer Cross-Section & Thermodynamic Lapse Rate',
        diagramSketchInstructions: '1. Draw vertical Y-axis for Altitude (0–20 km) and horizontal X-axis for Temperature (-60°C to +20°C). 2. Draw sloping Tropopause line (18 km at Equator down to 8 km at Poles). 3. Draw temperature line sloping leftward from +15°C down to -56°C (Lapse Rate 6.5°C/km). 4. Sketch convective cloud cell with 99% moisture labeled below Tropopause ceiling.',
        diagramVisual: `  Altitude (km)
      ▲
  20 ─┤              STRATOSPHERE (Ozone Layer: O3)
      │ ═════════════════ TROPOPAUSE (Thermal Ceiling) ═════════════════
  18 ─┤       ▲ (18 km at Equator)                \\
      │      / \\                                   \\  Temp Line:
  12 ─┤     /   \\  [Subtropical Jet Stream]         \\ Decreases
      │    /     \\                                   \\ 6.5°C/km
   8 ─┤   /       \\ (8 km at Poles)                   \\ (Lapse Rate)
      │  [  ☁️ Cumulonimbus  ]   [ Cyclonic Circulation ]\\
   4 ─┤  [  Thunderstorm Cell ]    ▲ Convection Currents  \\
      │  [ 99% Water Vapour ]     │ (Heated from Below)   \\
   0 ─┴────────────────────────────────────────────────────► Temp (°C)
         Earth Surface (Terrestrial Radiation)   -56°C  0°C  +15°C`,
        valueAdds: [
          'Physical Constants: Normal Lapse Rate (6.5°C per 1,000 m), Dry Adiabatic Lapse Rate (DALR: 9.8°C/km), Wet Adiabatic Lapse Rate (WALR: 5°C/km).',
          'Atmospheric Mass Allocation: 75% of atmospheric mass and >99% moisture restricted below the Tropopause boundary.',
          'Scientific Report: IPCC AR6 Working Group I (Physical Science Basis) on Tropospheric Warming, Jet Stream Meandering, and Tropical Width Expansion.'
        ],
        conclusion: 'The troposphere is the indispensable thermodynamic heat engine and protective moisture envelope of the biosphere. Monitoring its thermal stability is paramount for climate resilience and extreme weather early warning systems.'
      };
    }

    // ---------------------------------------------------------
    // 2. GEOGRAPHY: AIR MASSES & FRONTS
    // ---------------------------------------------------------
    if (qLower.includes('air mass') || (qLower.includes('front') && domain.startsWith('GEOGRAPHY'))) {
      return {
        domainLabel: 'Physical Geography • Climatology & Synoptic Meteorology',
        directive,
        directiveMeaning,
        targetWords,
        suggestedTime,
        marksNum,
        intros: [
          {
            type: 'Option 1: Geographical Definition Hook',
            text: 'An air mass is an extensive body of tropospheric air, covering thousands of square kilometers, characterized by horizontally uniform temperature and moisture gradients acquired over an expansive, homogeneous source region.'
          },
          {
            type: 'Option 2: Synoptic Climatological Hook',
            text: 'Originating over expansive uniform continental or oceanic source regions under high-pressure anticyclonic stagnation, air masses act as primary global transporters of sensible heat and moisture across planetary latitudes.'
          },
          {
            type: 'Option 3: Frontogenetic Interaction Hook',
            text: 'When divergent air masses migrate from their source regions, their convergence zones create sharp discontinuity boundaries known as fronts, serving as the primary breeding grounds for mid-latitude temperate cyclones.'
          }
        ],
        headings: [
          {
            title: '1. Foundational Concept & Essential Prerequisites for Air Mass Genesis',
            points: [
              'Homogeneous Source Region: Requires vast, topographically uniform surfaces (e.g. Siberian plains for cP, tropical oceans for mT) with gentle atmospheric divergence.',
              'Atmospheric Stagnation: High-pressure anticyclonic conditions must persist over the region for days or weeks to allow equilibrium heat and moisture exchange.',
              'Bergeron Classification Matrix: Categorized into Polar (P), Tropical (T), Continental (c - dry), and Maritime (m - humid), producing 4 primary archetypes: cP, cT, mP, and mT.'
            ]
          },
          {
            title: '2. Role of Air Masses in Driving Macro-Climatic Changes & Weather',
            points: [
              'Global Latitudinal Heat Balance: Transfers surplus solar heat from equatorial oceans (mT) polewards, while transporting Arctic cold deficits (cP) toward the subtropics.',
              'Mid-Latitude Frontogenesis & Temperate Cyclones: Collisions between cold polar air (cP) and warm subtropical air (mT) along the Polar Front create Rossby waves and migratory depressions.',
              'Monsoonal & Extreme Weather Teleconnections: Modification of Maritime Tropical (mT) air masses across the Indian Ocean fuels South-West Monsoon precipitation surges.'
            ]
          },
          {
            title: '3. Thermodynamic & Mechanical Modification upon Migration',
            points: [
              'Lake-Effect Snow & Heatwaves: A cold dry cP air mass passing over warm water absorbs moisture, triggering extreme snowfall (e.g., Laurentian Great Lakes). Conversely, cT air masses produce severe heatwaves (Loo in North India).'
            ]
          }
        ],
        diagramTitle: 'Air Mass Frontal Wedge Cross-Section (Cold Front vs Warm Air)',
        diagramSketchInstructions: '1. Draw ground surface line. 2. Draw steep sloping wedge of dense Cold Air (cP) advancing rightward. 3. Draw buoyant Warm Air (mT) forced upward along the frontal slope. 4. Sketch cumulonimbus cloud along the steep front with rainfall arrows.',
        diagramVisual: `  Altitude
     ▲
     │                      Buoyant Warm Air (mT)
     │                     ▲  ▲  ▲ (Forced Updraft)
     │                    /  /  /
     │           ☁️ Cumulonimbus
     │             [ Rain / Storm ]
     │                 │ │ │ │
     │   Cold Air      │ │ │ │
     │   Mass (cP)     ▼ ▼ ▼ ▼
     │   ══════════════════════════════════════════════════════
     │  [Dense Wedge] ──► Advancing Cold Front Boundary ──►
     └──────────────────────────────────────────────────────────► Surface`,
        valueAdds: [
          'Climatological Classification: Tor Bergeron Classification System & Bjerknes Polar Front Theory.',
          'Indian Climatology Linkage: Influence of Continental Tropical (cT) air mass in North-West Indian pre-monsoon heatwaves, alternating with Maritime Tropical (mT) monsoon surge.',
          'Atmospheric Law: Conservation of absolute vorticity during meridional air mass displacement.'
        ],
        conclusion: 'Air masses are the fundamental fluid pulleys of the planetary heat budget. Understanding their modification trajectories is vital for precision agricultural forecasting and disaster mitigation.'
      };
    }

    // ---------------------------------------------------------
    // 3. GEOGRAPHY: TEMPERATURE INVERSION
    // ---------------------------------------------------------
    if (qLower.includes('inversion')) {
      return {
        domainLabel: 'Physical Geography • Micro-Climatology & Boundary Layer Physics',
        directive,
        directiveMeaning,
        targetWords,
        suggestedTime,
        marksNum,
        intros: [
          {
            type: 'Option 1: Thermodynamic Definition Hook',
            text: 'Temperature inversion is a meteorological anomaly in the troposphere where the normal lapse rate is reversed, causing air temperature to increase with altitude rather than decrease, creating an exceptionally stable thermal lid.'
          },
          {
            type: 'Option 2: Atmospheric Boundary Layer Hook',
            text: 'Under specific radiative or advective conditions, cooling of Earth\'s surface outpaces lower atmospheric heat retention, inverting the normal vertical temperature gradient (-6.5°C/km) and halting vertical atmospheric mixing.'
          },
          {
            type: 'Option 3: Socio-Environmental Impact Hook',
            text: 'While physically functioning as a local micro-climatic stabilizer, temperature inversion acts as an ecological trap in valleys and urban basins, intensifying winter smog episodes and agricultural frost damage.'
          }
        ],
        headings: [
          {
            title: '1. Essential Prerequisites & Suitable Conditions for Temperature Inversion',
            points: [
              'Long Winter Nights: Extended nocturnal duration allows maximum terrestrial longwave radiative cooling from the Earth\'s surface.',
              'Clear, Cloudless Skies: Absence of cloud cover prevents reflection and greenhouse re-radiation of outgoing terrestrial radiation into space.',
              'Calm, Stagnant Atmospheric Air: Wind speeds below 5 km/h prevent turbulent mechanical mixing between surface cold air and warmer layers aloft.',
              'Dry Air & Snow Cover (Albedo): Dry air has minimal greenhouse absorption, while high-albedo snow reflects insolation, chilling the ground.'
            ]
          },
          {
            title: '2. Multi-Faceted Impacts of Temperature Inversion across Spheres',
            points: [
              'Pollutant Entrapment & Severe Urban Smog: The inversion lid prevents vertical dispersion of vehicular and industrial emissions, producing dangerous winter smog (e.g. Delhi NCR AQI > 400).',
              'Dense Radiation Fog & Transport Disruption: Near-surface condensation forms thick radiation fog, severely disrupting aviation, rail, and road networks.',
              'Valley Agricultural Zoning: Katabatic cold air drains into valley bottoms causing severe ground frost; consequently, apple orchards and settlements in Himachal Pradesh and Switzerland locate on higher slopes (Thermal Belt).',
              'Atmospheric Stability & Drought: Suppresses vertical convection, preventing cumulus cloud development and local precipitation.'
            ]
          }
        ],
        diagramTitle: 'Temperature Inversion Curve & Valley Thermal Belt Profile',
        diagramSketchInstructions: '1. Draw vertical Altitude axis and horizontal Temperature axis. 2. Show Temperature decreasing, then reversing and increasing sharply (Inversion Layer), then decreasing again. 3. Draw U-shaped valley with Cold Air at the bottom, Warm Thermal Belt on mid-slopes, and Orchards located safely above frost level.',
        diagramVisual: `  Altitude (m)                VALLEY INVERSION & THERMAL BELT:
      ▲                          Mountain Ridge           Mountain Ridge
 1000 ┤     \\   Normal Lapse           \\                         /
      │      \\  Resumes                 \\   Warm Air Layer       /
  600 ┤       \\                          \\═════════════════════/
      │        \\ ◄── Thermal Lid          \\ [🍎 Orchard Zone] /  <-- Thermal Belt
  300 ┤        /   (Inversion Layer)       \\  (Above Frost)  /
      │       /                             \\               /
    0 ─┴─────/────────────────► Temp         \\ [❄️ Frost/Fog] /   <-- Valley Bottom
       Cold Surface   Warm Air                ═══════════════`,
        valueAdds: [
          'Micro-Climatic Zone: Identification of the "Thermal Belt" on middle mountain slopes, preventing frostbite in sub-temperate horticulture.',
          'Public Health Benchmark: CPCB air quality telemetry documenting particulate matter (PM2.5) trapping under NCR winter inversion ceilings.',
          'Physical Law: Stefan-Boltzmann Law of terrestrial nocturnal longwave radiation ($E = \sigma T^4$).'
        ],
        conclusion: 'Temperature inversion exemplifies the delicate interplay between thermodynamic boundary layers and human geography. Urban airshed management and smart horticultural micro-zoning are imperative for mitigating its hazards.'
      };
    }

    // ---------------------------------------------------------
    // 4. GEOGRAPHY: PLATE TECTONICS & CRUSTAL DYNAMICS
    // ---------------------------------------------------------
    if (qLower.includes('plate tectonic') || qLower.includes('tectonic')) {
      return {
        domainLabel: 'Physical Geography • Geomorphology & Lithospheric Geodynamics',
        directive,
        directiveMeaning,
        targetWords,
        suggestedTime,
        marksNum,
        intros: [
          {
            type: 'Option 1: Comprehensive Geological Hook',
            text: 'Formulated by Morgan, McKenzie, and Parker (1967) and synthesizing Continental Drift and Seafloor Spreading, Plate Tectonics posits that Earth\'s rigid lithosphere is fragmented into major and minor plates floating atop the ductile asthenosphere.'
          },
          {
            type: 'Option 2: Geodynamic Driving Force Hook',
            text: 'Powered by radioactive thermal mantle convection currents and slab-pull forces, plate tectonics serves as the unifying geological framework explaining planetary orogeny, seismicity, and volcanism.'
          },
          {
            type: 'Option 3: Morpho-Genesis Hook',
            text: 'Plate tectonic boundaries represent the planet\'s most dynamic geological frontiers, governing the continuous recycling of crustal material through constructive ridges and destructive subduction zones.'
          }
        ],
        headings: [
          {
            title: '1. Foundational Mechanism: Convection Cells & Plate Kinematics',
            points: [
              'Mantle Convection Cells: Arthur Holmes\' thermal convection currents in the asthenosphere generate lateral traction beneath lithospheric plates.',
              'Ridge-Push and Slab-Pull Mechanisms: Gravitational sliding away from elevated mid-ocean ridges combined with the negative buoyancy of cold subducting slabs drives plate velocity.',
              'Boundary Taxonomy: Divergent (constructive), Convergent (destructive), and Transform (conservative) plate margins.'
            ]
          },
          {
            title: '2. Major Landform Manifestations along Plate Boundaries',
            points: [
              'Oceanic-Continental Convergence: Subduction of denser oceanic crust forms oceanic trenches (e.g. Peru-Chile trench) and volcanic cordilleras (e.g. Andes Mountains).',
              'Continent-Continent Collision: Absence of subduction due to low buoyancy contrast produces massive folded mountain belts without volcanism (e.g. Indo-Eurasian collision forming Himalayas).',
              'Divergent Seafloor Spreading: Upwelling basaltic magma creates submarine mountain chains and new oceanic crust (Mid-Atlantic Ridge).'
            ]
          },
          {
            title: '3. Seismicity, Volcanism & Economic Geography Linkages',
            points: [
              'Pacific Ring of Fire: Concentrates 75% of active volcanoes and 90% of global earthquakes along convergent margins.',
              'Mineral Wealth & Geothermal Energy: Hydrothermal vents deposit massive copper-gold polymetallic sulfides; basaltic weathering generates fertile black regur soil (Deccan Traps).'
            ]
          }
        ],
        diagramTitle: 'Oceanic-Continental Subduction Zone Cross-Section',
        diagramSketchInstructions: '1. Draw horizontal Continental Crust on right and Oceanic Crust on left. 2. Show oceanic plate subducting at 45° into the Asthenosphere. 3. Label Deep Sea Trench at collision point, Wadati-Benioff seismic zone along the subducting slab, partial melting zone at 100 km depth, and volcanic mountain arc on the continent.',
        diagramVisual: `  Oceanic Plate (Denser)                   Continental Plate (Lighter)
  ════════════════════►                     ◄══════════════════════════
               \\   Deep Trench                 ▲ Volcanic Arc
                \\      ▼                      / \\  (e.g. Andes)
                 \\   ┌────┐                  /   \\
                  \\  │ ⚓  │                 /     \\    Continental
                   \\ └────┘                /  🔥   \\   Crust
                    \\                     [ Magma  ]
                     \\                    [Chamber ]
                      \\                      ▲
                       \\  Partial Melting    │
                        \\ (100-200 km) ──────┘
                         \\ [Wadati-Benioff Zone]
                          ▼  (Deep Earthquakes)
                     ASTHENOSPHERE (Mantle Convection)`,
        valueAdds: [
          'Geological Evidence: Paleomagnetic striping (Vine-Matthews-Morley hypothesis) and Glomar Challenger seafloor age dating.',
          'Indian Geodynamics Link: Northward drift of the Indian Plate (5 cm/year) and ongoing seismic strain accumulation along Main Central Thrust (MCT).',
          'Economic Output: Formation of hydrothermal porphyry copper deposits along convergent margins.'
        ],
        conclusion: 'Plate Tectonics provides the unifying architecture of terrestrial geology. Incorporating plate kinematic data into regional seismic hazard zoning is vital for infrastructure resilience.'
      };
    }

    // ---------------------------------------------------------
    // 5. SOCIETY: TRANSGENDER RIGHTS & ARTICLE 21
    // ---------------------------------------------------------
    if (qLower.includes('transgender') || (qLower.includes('privacy') && (qLower.includes('self-identity') || qLower.includes('identity')))) {
      return {
        domainLabel: 'Indian Society & Constitutional Law • Transgender Justice & Article 21',
        directive,
        directiveMeaning,
        targetWords,
        suggestedTime,
        marksNum,
        intros: [
          {
            type: 'Option 1: Constitutional Jurisprudence Hook',
            text: 'In Justice K.S. Puttaswamy (2017) and NALSA v. Union of India (2014), the Supreme Court affirmed that gender self-identity and personal autonomy are foundational, non-negotiable components of the Right to Dignity under Article 21 and Equality under Article 14.'
          },
          {
            type: 'Option 2: Sociological Vulnerability Hook',
            text: 'Self-identity is not merely a legal certification but the primary anchor of human agency, psychological integrity, and equal citizenship. For India\'s transgender community, self-determination is the first line of defense against generational destitution and systemic ostracization.'
          },
          {
            type: 'Option 3: Legislative Evolution Hook',
            text: 'The amendments to the Transgender Persons (Protection of Rights) framework mark a progressive transition from invasive medical gatekeeping toward autonomous, self-perceived gender recognition in alignment with constitutional morality.'
          }
        ],
        headings: [
          {
            title: '1. Direct Affirmative Impact of Legal Reforms on Right to Self-Identity (Art 21)',
            points: [
              'Demolishing Medical Gatekeeping: Dismantles mandatory surgical certification requirements for legal gender recognition, enshrining pure self-declaration as mandated in NALSA.',
              'Streamlined DM Digital Certification: Replaces discretionary district screening committees with time-bound digital portals, preventing administrative harassment and bureaucratic humiliation.',
              'Affirmative Healthcare Inclusivity: Expands composite health insurance under Ayushman Bharat for gender-affirming medical procedures, hormone therapy, and mental health counseling.'
            ]
          },
          {
            title: '2. Critical Implementation Bottlenecks & Unaddressed Structural Gaps',
            points: [
              'Absence of Horizontal Reservation: The legal framework leaves unaddressed the critical demand for horizontal quotas in education and public employment, leaving trans individuals trapped in informal precarity.',
              'Deficit of Garima Grehs (Shelter Homes): Lack of decentralized, safe shelter homes leaves trans youth who face domestic rejection vulnerable to forced homelessness and street begging.',
              'Civil Rights Vacuum: Personal laws continue to deny equal civil rights in marriage, adoption, succession, and property inheritance, creating incomplete constitutional citizenship.'
            ]
          },
          {
            title: '3. Strategic Multi-Sectoral Roadmap for Substantive Equality',
            points: [
              'Statutory Anti-Discrimination Architecture: Enacting an overarching Equal Opportunity Law across private employment and rental housing markets.',
              'Grassroots Sensitisation: Mandatory training for law enforcement agencies and healthcare personnel to eliminate institutional prejudice.'
            ]
          }
        ],
        diagramTitle: 'Transgender Structural Inclusion vs Marginalization Cycle',
        diagramSketchInstructions: '1. Draw Central Box for Article 21 Self-Identity. 2. Branch out to Legal Autonomy, Healthcare Equity, and Social Housing. 3. Show Vicious Cycle of Stigma -> Dropout -> Informal Labour at the base.',
        diagramVisual: `        ┌─────────────────────────────────────────────────────────┐
        │       Right to Self-Identity & Dignity (Article 21)     │
        └────────────────────────────┬────────────────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         ▼                           ▼                           ▼
  [ Legal Autonomy ]          [ Healthcare Justice ]      [ Economic Inclusion ]
  Self-declaration without    Ayushman Bharat coverage    Horizontal Quotas (Gap)
  medical gatekeeping         Gender-affirming care       Garima Greh Shelters
                                     │
                                     ▼
        [ The Vicious Cycle: Stigma ──► School Dropout ──► Street Begging ]`,
        valueAdds: [
          'Judicial Benchmarks: NALSA v. UOI (2014), K.S. Puttaswamy (2017), Navtej Singh Johar (2018).',
          'International Standard: Yogyakarta Principles (Principle 3: Universal Right to Legal Recognition of Gender Identity).',
          'Statutory Schemes: SMILE Scheme (Support for Marginalized Individuals for Livelihood and Enterprise), Garima Greh Rules.'
        ],
        conclusion: 'True realization of Article 21 demands bridging legal decriminalization with affirmative socio-economic inclusion, realizing Dr. B.R. Ambedkar\'s vision of constitutional morality over social prejudice.'
      };
    }

    // ---------------------------------------------------------
    // 6. SOCIETY: CHILD LABOUR & VULNERABILITY
    // ---------------------------------------------------------
    if (qLower.includes('child labour') || (qLower.includes('vulnerab') && qLower.includes('child'))) {
      return {
        domainLabel: 'Indian Society & Social Justice • Vulnerability Matrix & Child Rights',
        directive,
        directiveMeaning,
        targetWords,
        suggestedTime,
        marksNum,
        intros: [
          {
            type: 'Option 1: Sociological Structural Hook',
            text: 'Child labour is not merely an economic survival strategy but a symptom of deep-seated structural vulnerabilities—manifested through intergenerational poverty, caste marginalization, and educational deficits that rob children of human capital development.'
          },
          {
            type: 'Option 2: Constitutional & Rights-Based Hook',
            text: 'Despite constitutional guarantees under Article 24 (prohibition of child labour in hazardous occupations) and Article 21A (Right to Education), socio-economic distress continues to push over 10 million Indian children (Census 2011) into informal economic exploitation.'
          },
          {
            type: 'Option 3: Holistic Vulnerability Hook',
            text: 'No child enters the labour force voluntarily; child labour represents the culmination of household economic shocks, agrarian distress, and systemic gaps in social security nets.'
          }
        ],
        headings: [
          {
            title: '1. Underlying Social Determinants Driving Child Vulnerability',
            points: [
              'Intergenerational Chronic Poverty & Debt Traps: Impoverished families depend on child earnings for baseline subsistence, often pledging children to bonded labour in brick kilns and agriculture.',
              'Social Identity & Caste Intersection: Over 80% of child labourers belong to SC, ST, and OBC communities, reflecting deep overlaps between social stratification and economic destitution.',
              'Inadequate Educational Infrastructure & High Dropout: Poor school infrastructure, distance, hidden schooling costs, and low learning outcomes push adolescents out of classrooms into the unorganized workforce.'
            ]
          },
          {
            title: '2. Legislative & Implementation Faultlines in India',
            points: [
              'The "Family Enterprise" Loophole: Section 3 of the Child Labour Amendment Act (2016) permits children to work in family enterprises, effectively shielding domestic, agricultural, and artisanal exploitation from state inspection.',
              'Informal Economy Blindspots: Dominance of child labour in decentralized informal sectors (dhabas, domestic work, zari, bangle units) beyond the reach of understaffed factory inspectorates.',
              'Poverty vs Law Enforcement Dilemma: Raids without robust family economic rehabilitation often plunge rescued children back into deeper debt and hazardous work.'
            ]
          },
          {
            title: '3. Multi-Pronged Transformative Interventions',
            points: [
              'Universal Conditional Cash Transfers: Linking welfare schemes (e.g., PM-POSHAN, MGNREGA) to school attendance guarantees income security for vulnerable households.',
              'Revisiting Gurupadaswamy Committee Insights: Recognizing that child labour cannot be eliminated through punitive policing alone without structural poverty eradication.'
            ]
          }
        ],
        diagramTitle: 'Socio-Economic Root Cause Web & Policy Intervention Ladder',
        diagramSketchInstructions: '1. Draw central vicious cycle box: Poverty -> Indebtedness -> School Dropout -> Child Labour. 2. Draw statutory shield: Articles 21A, 24, Child Labour Act. 3. Draw exit arrows toward Vocational Skill Formation and Conditional Cash Transfers.',
        diagramVisual: `      ┌────────────────────────────────────────────────────────┐
      │   Vicious Intergenerational Trap of Child Labour       │
      └───────────────────────────┬────────────────────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         ▼                        ▼                        ▼
  [ Agrarian Distress ]    [ Low Quality Schooling ] [ Informal Exploitation ]
  Crop failure / Debt      Hidden costs / Dropouts   Cheap, docile workforce
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  ▼
      [ THE CYCLE: Child Labour ──► Low Human Capital ──► Adult Poverty ]
                                  │
      ════════════════════════════╪═════════════════════════════════════
      🛡️ CONSTITUTIONAL SHIELD: Art 21A (RTE) + Art 24 + PENCIL Portal`,
        valueAdds: [
          'Constitutional Articles: Article 21A (Right to Free Education), Article 24 (Prohibition of child labour), Article 39(e) & (f) (Protection of childhood against exploitation).',
          'Statutory Portal: PENCIL Portal (Platform for Effective Enforcement for No Child Labour) & National Child Labour Project (NCLP).',
          'International Conventions: ILO Convention 138 (Minimum Age) & ILO Convention 182 (Worst Forms of Child Labour).'
        ],
        conclusion: 'Eliminating child labour demands treating children not as economic survival instruments, but as constitutional rights-holders, ensuring universal education and dignified family living wages.'
      };
    }

    // ---------------------------------------------------------
    // 7. SOCIETY: REGIONALISM AS A DOUBLE-EDGED SWORD
    // ---------------------------------------------------------
    if (qLower.includes('regionalism')) {
      return {
        domainLabel: 'Indian Society & Political Sociology • Federalism & National Integration',
        directive,
        directiveMeaning,
        targetWords,
        suggestedTime,
        marksNum,
        intros: [
          {
            type: 'Option 1: Sociological Definition Hook',
            text: 'Regionalism in India is an ideology where individuals identify strongly with a distinct sub-national spatial, linguistic, or cultural region, balancing between pride in local identity and loyalty to the larger nation-state.'
          },
          {
            type: 'Option 2: Dynamic "Double-Edged Sword" Hook',
            text: 'Regionalism functions as a double-edged sword: on one edge, it strengthens democratic federalism through localized self-assertion; on the other, it poses centrifugal threats through chauvinistic identity politics and secessionist tendencies.'
          },
          {
            type: 'Option 3: Historical Evolution Hook',
            text: 'From the linguistic reorganization of states (1956) to contemporary demands for regional autonomy, regionalism has been both an instrument of decentralized development and a potential faultline in national cohesion.'
          }
        ],
        headings: [
          {
            title: '1. Positive Edge: Regionalism as a Catalyst for Democratic Deepening',
            points: [
              'Democratic Accommodation of Cultural Diversity: Prevents linguistic hegemony and gives political voice to marginalized regional cultures (e.g. 8th Schedule linguistic states).',
              'Competitive & Cooperative Federalism: Regional pride drives states to compete in health indices, ease of doing business, and green energy investments (e.g. Tamil Nadu, Kerala, Gujarat models).',
              'Grassroots Decentralization: Regional aspirations catalyzed the 73rd and 74th Constitutional Amendments and creation of Autonomous District Councils (6th Schedule).'
            ]
          },
          {
            title: '2. Negative Edge: Regionalism as a Centrifugal Threat to National Unity',
            points: [
              'Sons-of-the-Soil Chauvinism: Aggressive identity politics triggering violent backlash against internal migrant workers (violating Article 19(1)(d) and 19(1)(e)).',
              'Inter-State Resource Conflicts: Deep zero-sum friction over river water sharing (Cauvery, Krishna, Sutlej-Yamuna Link) undermining interstate solidarity.',
              'Sub-Nationalism to Secessionist Strains: Historical insurgencies in Punjab, Nagaland, and Mizoram where extreme alienation challenged national territorial integrity.'
            ]
          },
          {
            title: '3. Institutional Mechanisms for Harmonizing Regional Aspirations',
            points: [
              'Asymmetrical Constitutional Federalism: Special provisions under Article 371A-J accommodating unique cultural and historical treaties.',
              'Inter-State Coordination Bodies: Revitalizing the Inter-State Council (Article 263) and Zonal Councils to negotiate regional friction peacefully.'
            ]
          }
        ],
        diagramTitle: 'The Dual-Balance Scale of Regionalism in India',
        diagramSketchInstructions: '1. Draw central fulcrum labeled "Constitution of India". 2. Draw balance beam. 3. Left pan: Democratic Decentralization, Cultural Pride, Federal Competition. 4. Right pan: Sons-of-Soil Violence, Water Wars, Secessionist Friction.',
        diagramVisual: `                     ┌────────────────────────┐
                     │  REGIONALISM IN INDIA  │
                     └───────────┬────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 ▼                               ▼
       [ POSITIVE MANIFESTATION ]     [ CENTRIFUGAL THREATS ]
       • Democratic voice to diverse  • "Sons of the Soil" xenophobia
         linguistic/ethnic groups       (Attacks on internal migrants)
       • Competitive socio-economic   • Inter-state river water disputes
         development models             (Cauvery, SYL Canal)
       • Asymmetrical Federalism      • Threat to national unity &
         (Article 371 provisions)       secessionist insurgencies
                 │                               │
                 └───────────────┬───────────────┘
                                 ▼
         [ INSTITUTIONAL EQUILIBRIUM: Inter-State Council & Co-operative Federalism ]`,
        valueAdds: [
          'Constitutional Balance: Asymmetrical Federalism under Article 371A to 371J protecting tribal customary laws and regional development boards.',
          'Statutory Instruments: Inter-State Council (Article 263), Zonal Councils (States Reorganisation Act 1956), and Finance Commission horizontal devolution.',
          'Sociological Thinker: Rasheeduddin Khan\'s thesis on India as a "geo-cultural confederation" requiring federal pluralism.'
        ],
        conclusion: 'Regionalism is not the antithesis of nationalism, but its indispensable building block. Indian unity thrives not by erasing regional identities, but by weaving them into a vibrant federal mosaic.'
      };
    }

    // ---------------------------------------------------------
    // 8. HISTORY: BISMARCK'S ALLIANCES & WORLD WAR I
    // ---------------------------------------------------------
    if (qLower.includes('bismarck') || (qLower.includes('alliances') && qLower.includes('war'))) {
      return {
        domainLabel: 'World History • 19th-Century Diplomacy & Origins of World War I',
        directive,
        directiveMeaning,
        targetWords,
        suggestedTime,
        marksNum,
        intros: [
          {
            type: 'Option 1: Historiographical Balance Hook',
            text: 'Between 1871 and 1890, Chancellor Otto von Bismarck constructed an intricate diplomatic web designed to preserve a unified Germany, maintain European peace, and isolate France following the Franco-Prussian War.'
          },
          {
            type: 'Option 2: Direct Analytical Hook',
            text: 'While Bismarck\'s system of alliances successfully prevented a continental war for two decades, its reliance on secret diplomacy, militarized treaties, and mutual antagonisms created an inflexible, bipolar powder keg that exploded into World War I under his successors.'
          },
          {
            type: 'Option 3: Structural Shift Hook',
            text: 'Bismarck transitioned from "Blood and Iron" domestic unification to becoming the "Honest Broker" of European balance of power, creating an alliance network that masked deep-seated imperialist rivalries.'
          }
        ],
        headings: [
          {
            title: '1. Architecture of Bismarck\'s Diplomatic System (1871–1890)',
            points: [
              'Absolute Isolation of France: Bismarck viewed revenge-seeking France as Germany\'s existential threat; his diplomacy focused on preventing any Franco-Russian or Franco-British coalition.',
              'Three Emperors\' League (Dreikaiserbund, 1873 & 1881): Allied Germany, Austria-Hungary, and Russia on conservative monarchical solidarity and neutrality in the Balkans.',
              'Dual Alliance (1879) & Triple Alliance (1882): Mutual defense pact with Austria-Hungary against Russia, later expanded to include Italy to secure the southern flank.',
              'Reinsurance Treaty (1887): Bismarck\'s diplomatic masterpiece—a secret agreement ensuring Russian neutrality if France attacked Germany, and German neutrality if Austria attacked Russia.'
            ]
          },
          {
            title: '2. Inherent Flaws that Paved the Path to World War I',
            points: [
              'Juggling Contradictory Commitments: Bismarck simultaneously backed Austrian interests in the Balkans while assuring Russia of support, a contradiction sustainable only by his personal diplomatic genius.',
              'Culture of Secret Diplomacy: Clandestine pacts generated pervasive paranoia across European chancelleries, leading rival powers to form counter-alliances.',
              'Post-Bismarckian Collapse (1890): Kaiser Wilhelm II\'s refusal to renew the Reinsurance Treaty drove Russia into the arms of France (Dual Entente 1894), culminating in the Triple Entente (1907).'
            ]
          },
          {
            title: '3. Broader Imperialist & Militaristic Triggers of 1914',
            points: [
              'Beyond Bismarck: World War I was not caused by diplomacy alone, but by German "Weltpolitik", Anglo-German naval rivalry, Balkan pan-Slavism, and the blank-check crisis of July 1914.'
            ]
          }
        ],
        diagramTitle: 'Bismarck\'s Alliance Network vs Post-1890 Bipolar Polarization',
        diagramSketchInstructions: '1. Draw central box for Germany (Bismarck). 2. Draw lines connecting Germany to Austria (Dual Alliance), Russia (Reinsurance Treaty), and Italy (Triple Alliance). 3. Show France completely isolated in a corner. 4. Draw dotted red rupture showing post-1890 Franco-Russian alliance leading to Triple Entente.',
        diagramVisual: `   BISMARCKIAN SYSTEM (1871–1890)          POST-1890 BIPOLAR RUPTURE (WWI)
   ══════════════════════════════          ═════════════════════════════════
          [ Russia ]                              [ TRIPLE ENTENTE ]
             ▲                                    Britain ── France ── Russia
       Secret│ Reinsurance Treaty (1887)                 │         │
             ▼                                           ▼         ▼
     ┌───────────────┐                            ═════════ VS ═════════
     │   GERMANY     ├────► [ Austria-Hungary ]          ▲         ▲
     │  (Bismarck)   │      (Dual Alliance 1879)         │         │
     └───────┬───────┘                            [ TRIPLE ALLIANCE ]
             │                                    Germany ── Austria-Hungary
             ▼ Triple Alliance (1882)                     ── Italy
         [ Italy ]
             
    [ France: Completely Isolated ]        "Europe divided into two armed camps"`,
        valueAdds: [
          'Key Treaties & Dates: Dual Alliance (1879), Triple Alliance (1882), Mediterranean Agreement (1887), Reinsurance Treaty (1887).',
          'Historiographical View: A.J.P. Taylor\'s analysis of "War by Timetable" and Fritz Fischer\'s thesis on German aggressive expansionism.',
          'Critical Turning Point: The dismissal of Bismarck by Kaiser Wilhelm II in 1890 ("Dropping the Pilot") and abandonment of the Reinsurance Treaty.'
        ],
        conclusion: 'Bismarck\'s alliances preserved peace only so long as the master puppeteer held the strings. Once rigidified into military mobilization schedules, alliances converted a localized Balkan assassination into a catastrophic global war.'
      };
    }

    // ---------------------------------------------------------
    // DOMAIN-CALIBRATED SMART FALLBACK ENGINES
    // ---------------------------------------------------------
    const cleanWords = qText.replace(/[^a-zA-Z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3 && !['what', 'explain', 'discuss', 'examine', 'critically', 'comment', 'analyse', 'analyze', 'their', 'which', 'about', 'under'].includes(w.toLowerCase()));
    const keyTopicTitle = (window.TOPPER_ENGINE && window.TOPPER_ENGINE.extractCleanTopicTitle)
      ? window.TOPPER_ENGINE.extractCleanTopicTitle(qText)
      : (cleanWords.slice(0, 4).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'Core Subject Matter');

    // FALLBACK 1: GEOGRAPHY (Climatology / Physical / Environmental)
    if (domain.startsWith('GEOGRAPHY')) {
      return {
        domainLabel: 'Physical Geography & Earth System Dynamics',
        directive,
        directiveMeaning,
        targetWords,
        suggestedTime,
        marksNum,
        intros: [
          {
            type: 'Option 1: Scientific / Geomorphic Definition Hook',
            text: `${keyTopicTitle} represents a fundamental Earth system phenomenon governed by physical thermodynamics, pressure gradients, and endogenous or exogenous geomorphic processes.`
          },
          {
            type: 'Option 2: Spatial & Energy Equilibrium Hook',
            text: `Across planetary spatial scales, ${keyTopicTitle} functions as a vital mechanism for heat, mass, or moisture redistribution within the lithosphere, atmosphere, or hydrosphere.`
          },
          {
            type: 'Option 3: Contemporary Climatic Context Hook',
            text: `In the era of the Anthropocene, the spatial dynamics and intensity of ${keyTopicTitle} are undergoing rapid destabilization, influencing global weather extremes and environmental resilience.`
          }
        ],
        headings: [
          {
            title: `1. Physical Drivers, Energy Mechanisms & Thermodynamic Principles of ${keyTopicTitle}`,
            points: [
              `Governing Physical Laws: Driven by solar insolation differentials, gravitational forces, and geostrophic or tectonic stresses.`,
              `Thermodynamic Phase Transitions: Involves latent heat transfers, adiabatic cooling/heating cycles, or geomorphic mass-energy balance.`,
              `Spatial Variability: Expresses distinct geographic distributions across tropical, temperate, continental, and oceanic zones.`
            ]
          },
          {
            title: `2. Geomorphic, Climatological & Ecological Impacts`,
            points: [
              `Landscape & Regional Modifications: Shapes terrestrial relief, drainage morphology, or regional meso-climates.`,
              `Anthropogenic Destabilization: Escalated by land-use changes, greenhouse warming, or unscientific resource extraction (IPCC AR6).`,
              `Disaster Vulnerability: Direct linkage to extreme weather anomalies, hazards, and regional ecological distress.`
            ]
          },
          {
            title: `3. Sustainable Environmental Management & Mitigation Framework`,
            points: [
              `Scientific Monitoring: Utilization of remote sensing (ISRO INSAT-3DR), Doppler radars, and GIS hazard mapping.`,
              `Ecosystem-Based Adaptation: Implementing Nature-based Solutions (NbS) and Sendai Framework guidelines.`
            ]
          }
        ],
        diagramTitle: `Spatial / Cross-Sectional Profile: ${keyTopicTitle}`,
        diagramSketchInstructions: `1. Draw horizontal surface profile. 2. Show vertical elevation or atmospheric gradient. 3. Add directional process arrows indicating heat/mass transfers and energy balance.`,
        diagramVisual: `  Elevation / Altitude
      ▲
      │           [ Upper Boundary / Dynamic Ceiling ]
      │             ▲                ▲
      │            /  Energy Transfer \\
      │           /  or Mass Movement  \\
      │          /                      \\
      │    [ Primary Mechanism ] ──► [ Secondary Impact ]
      │           ▲                        │
      │           │ Driven by Heat/Force   │
      └───────────┴────────────────────────┴────────► Horizontal Space / Gradient`,
        valueAdds: [
          'Governing Science: Physical principles of fluid dynamics, adiabatic processes, or tectonic plate motions.',
          'Scientific Benchmark: IPCC AR6 (Physical Science Basis) and India Meteorological Department (IMD) observational data.',
          'Inter-Paper Linkage: Physical Geography processes directly influencing GS-3 Disaster Management and agricultural cropping patterns.'
        ],
        conclusion: `Understanding ${keyTopicTitle} through empirical physical geography is vital for climate adaptation, ecosystem restoration, and sustainable spatial planning.`
      };
    }

    // FALLBACK 2: INDIAN SOCIETY & SOCIAL JUSTICE
    if (domain === 'INDIAN_SOCIETY') {
      return {
        domainLabel: 'Indian Society • Social Stratification & Inclusive Development',
        directive,
        directiveMeaning,
        targetWords,
        suggestedTime,
        marksNum,
        intros: [
          {
            type: 'Option 1: Sociological Structural Hook',
            text: `${keyTopicTitle} reflects the complex interplay of traditional social structures, historical inequalities, and the transformative pressures of modern democratization and globalization in India.`
          },
          {
            type: 'Option 2: Demographic & Empirical Hook',
            text: `Recent national survey findings (NFHS-5, PLFS) highlight that ${keyTopicTitle} remains a critical determinant of human capital development, social mobility, and inclusive citizenship.`
          },
          {
            type: 'Option 3: Constitutional & Rights Hook',
            text: `Grounded in constitutional guarantees of equality (Article 14) and human dignity (Article 21), addressing ${keyTopicTitle} is essential to realizing substantive justice and constitutional morality.`
          }
        ],
        headings: [
          {
            title: `1. Structural Drivers & Social Determinants of ${keyTopicTitle}`,
            points: [
              `Historical & Cultural Conditioning: Entrenched societal hierarchies, patriarchal norms, or identity cleavages shaping lived experiences.`,
              `Intersectionality of Vulnerabilities: Compounded impact across caste, gender, class, and regional marginalization.`,
              `Economic Precarity: Unequal access to assets, informal employment traps, and low social protection coverage.`
            ]
          },
          {
            title: `2. Critical Institutional Faultlines & Implementation Bottlenecks`,
            points: [
              `Policy Execution Gaps: Divergence between progressive legislative frameworks and grassroots administrative delivery.`,
              `Societal Stigma & Under-Reporting: Cultural barriers impeding marginalized communities from accessing legal remedies.`
            ]
          },
          {
            title: `3. Strategic Roadmap for Substantive Empowerment`,
            points: [
              `Targeted Affirmative Interventions: Expanding institutional capacity, decentralized shelter/support systems, and economic safety nets.`,
              `Community & Civil Society Mobilization: Empowering self-help groups, grassroots collectives, and local governance bodies.`
            ]
          }
        ],
        diagramTitle: `Multi-Dimensional Vulnerability & Structural Reform Matrix`,
        diagramSketchInstructions: '1. Draw central box for the Core Issue. 2. Branch out to Social, Economic, Legal, and Cultural dimensions. 3. Show arrows converging on Substantive Social Justice.',
        diagramVisual: `        ┌─────────────────────────────────────────────────────────┐
        │            Core Sociological Issue: ${keyTopicTitle}     │
        └────────────────────────────┬────────────────────────────┘
                                     │
         ┌───────────────────────────┼───────────────────────────┐
         ▼                           ▼                           ▼
  [ Social Hierarchy ]       [ Economic Barriers ]       [ Institutional Gaps ]
  Caste, Gender, Identity    Informal Precarity          Enforcement Gaps
         │                           │                           │
         └───────────────────────────┼───────────────────────────┘
                                     ▼
        [ GOAL: Substantive Equality & Dignity under Articles 14 & 21 ]`,
        valueAdds: [
          'Constitutional Foundations: Fundamental Rights under Part III and Directive Principles under Part IV.',
          'Empirical Surveys: National Family Health Survey (NFHS-5) and Periodic Labour Force Survey (PLFS) metrics.',
          'Sociological Thinkers: Dr. B.R. Ambedkar\'s perspective on social democracy and M.N. Srinivas on social mobility.'
        ],
        conclusion: `Bridging the gap between de jure constitutional promises and de facto social realities regarding ${keyTopicTitle} is essential for building an inclusive and just democratic society.`
      };
    }

    // FALLBACK 3: HISTORY & ART CULTURE
    if (domain === 'HISTORY_CULTURE') {
      return {
        domainLabel: 'History & Culture • Historical Trajectories & Heritage',
        directive,
        directiveMeaning,
        targetWords,
        suggestedTime,
        marksNum,
        intros: [
          {
            type: 'Option 1: Historiographical Context Hook',
            text: `${keyTopicTitle} represents a pivotal watershed in historical transformation, reflecting the convergence of socio-economic catalysts, ideological shifts, and strategic mobilizations.`
          },
          {
            type: 'Option 2: Chronological Evolution Hook',
            text: `Emerging in response to structural crises and socio-political tensions, ${keyTopicTitle} reshaped institutional power balances and left an enduring imprint on subsequent historical developments.`
          }
        ],
        headings: [
          {
            title: `1. Catalytic Forces, Underlying Pre-Conditions & Strategic Triggers of ${keyTopicTitle}`,
            points: [
              `Socio-Economic Undercurrents: Evolving agrarian/industrial relations, trade patterns, or institutional exploitation.`,
              `Ideological & Intellectual Ferment: Dissemination of progressive philosophies, religious reform movements, or political consciousness.`,
              `Immediate Catalysts: Critical administrative or diplomatic triggers that mobilized collective action.`
            ]
          },
          {
            title: `2. Evolutionary Trajectory, Phases & Structural Transformations`,
            points: [
              `Mass Mobilization & Alliances: Coalition of diverse social classes, regions, and strategic leadership.`,
              `Institutional & Geo-Political Impact: Redefining constitutional governance, state borders, or cultural architecture.`
            ]
          },
          {
            title: `3. Historical Significance & Enduring Contemporary Resonance`,
            points: [
              `Legacy in Nation-Building: Informing contemporary constitutional values, cultural identity, and institutional traditions.`
            ]
          }
        ],
        diagramTitle: `Historical Evolution Timeline & Causality Matrix`,
        diagramSketchInstructions: '1. Draw vertical timeline arrow. 2. Mark Phase 1 (Catalyst), Phase 2 (Mobilization/Conflict), Phase 3 (Structural Legacy).',
        diagramVisual: `  Chronological Progression
      │
      ├─► [ Catalytic Triggers ]: Socio-Economic Stresses & Ideological Sparks
      │
      ├─► [ Mobilization Phase ]: Strategic Leadership & Multi-Class Participation
      │
      ├─► [ Structural Impact ]: Institutional Transformation & Power Shift
      │
      ▼
  [ Historical Legacy & Contemporary Democratic Resonance ]`,
        valueAdds: [
          'Historiographical Perspectives: Contemporary archival evidence and landmark historical analyses.',
          'Socio-Cultural Legacy: Enduring impact on Indian pluralism, composite culture, and institutional development.'
        ],
        conclusion: `${keyTopicTitle} underscores how historical movements are driven by structural contradictions and popular agency, offering vital lessons for contemporary nation-building.`
      };
    }

    // FALLBACK 4: POLITY, CONSTITUTION & GS-3/GENERAL
    return {
      domainLabel: subject || 'Polity & Constitutional Governance',
      directive,
      directiveMeaning,
      targetWords,
      suggestedTime,
      marksNum,
      intros: [
        {
          type: 'Option 1: Constitutional & Legal Hook',
          text: `${keyTopicTitle} is rooted in the constitutional architecture of India, balancing state authority with fundamental rights and democratic accountability.`
        },
        {
          type: 'Option 2: Institutional Governance Hook',
          text: `In contemporary governance, ${keyTopicTitle} serves as a litmus test for executive efficacy, rule of law, and cooperative federalism.`
        }
      ],
      headings: [
        {
          title: `1. Governing Constitutional & Statutory Architecture of ${keyTopicTitle}`,
          points: [
            `Constitutional Provisions: Anchored in Part III (Fundamental Rights), Part IV (DPSP), and governing statutory mandates.`,
            `Institutional Balance of Power: Interplay between Executive implementation, Legislative oversight, and Judicial review.`
          ]
        },
        {
          title: `2. Critical Structural Challenges & Administrative Faultlines`,
          points: [
            `Implementation Bottlenecks: Administrative delays, coordination deficits between Centre and States, and resource constraints.`,
            `Accountability Gaps: Deficits in transparency, public feedback mechanisms, and statutory grievance redressal.`
          ]
        },
        {
          title: `3. Forward-Looking Policy Roadmap & Democratic Reforms`,
          points: [
            `Administrative Reforms: Implementing 2nd ARC recommendations and digitizing service delivery portals.`,
            `Democratic Deepening: Strengthening institutional autonomy, stakeholder consultation, and social audits.`
          ]
        }
      ],
      diagramTitle: `Constitutional Checks & Balances Flow Matrix`,
      diagramSketchInstructions: '1. Draw Triangle of Powers: Legislature, Executive, Judiciary. 2. Show arrows of checks and accountability converging on Citizen Rights.',
      diagramVisual: `                     ┌───────────────────────────┐
                     │   Constitution of India   │
                     └─────────────┬─────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         ▼                         ▼                         ▼
  [ Legislature ]           [ Executive ]             [ Judiciary ]
  Policy Formulation        Ground Execution          Judicial Review
         │                         │                         │
         └─────────────────────────┼─────────────────────────┘
                                   ▼
         [ CITIZEN-CENTRIC GOVERNANCE: Accountability & Dignity ]`,
      valueAdds: [
        'Constitutional Precedents: Landmark Supreme Court benches affirming Basic Structure and Rule of Law.',
        'Committee Benchmarks: Recommendations of the 2nd Administrative Reforms Commission (ARC) and Law Commission.'
      ],
      conclusion: `Strengthening institutional integrity and constitutional morality around ${keyTopicTitle} is essential for sustaining a robust, citizen-centric democracy.`
    };
  }

  // -------------------------------------------------------------
  // Dynamic Markdown Outline Generator for Answer Pad
  // -------------------------------------------------------------
  function getComprehensiveOutlineText(qText, marks, subject) {
    const bp = generateComprehensiveBlueprint(qText, marks, subject);
    let md = `### Introduction (${bp.intros[0].type})\n`;
    md += `${bp.intros[0].text}\n\n`;

    bp.headings.forEach(h => {
      md += `### ${h.title}\n`;
      h.points.forEach((p, idx) => {
        md += `${idx + 1}) ${p}\n`;
      });
      md += `\n`;
    });

    md += `### Diagram / Hand-Drawn Copy Visual: [ ${bp.diagramTitle} ]\n`;
    md += `\`\`\`\n${bp.diagramVisual}\n\`\`\`\n`;
    md += `*Sketch Guide: ${bp.diagramSketchInstructions}*\n\n`;

    md += `### High-Yield Value Additions\n`;
    bp.valueAdds.forEach(va => {
      md += `- ${va}\n`;
    });
    md += `\n`;

    md += `### Conclusion & Way Forward\n`;
    md += `${bp.conclusion}\n\n`;

    if (bp.evaluation) {
      md += `### Critical Evaluation & Modern India Linkage\n`;
      md += `${bp.evaluation}\n`;
    }

    return md;
  }

  function getMainsOutlineText(qText, marks, approach) {
    return getComprehensiveOutlineText(qText, marks, '');
  }

  // -------------------------------------------------------------
  // UPSC GS-1 Topper Archetype Engine
  // -------------------------------------------------------------
  const TOPPER_ARCHETYPES_DB = {
    aditya: {
      id: 'aditya',
      name: 'Aditya Srivastava',
      rank: 'IAS, AIR 1 (2023)',
      pillLabel: '👑 Aditya (AIR 1)',
      badge: '👑 AIR 1 • Causal Geopolitics & Policy Rigor',
      theme: '#f59e0b',
      quote: 'Enclose demands in boxes, chain every point with causality (Premise => Mechanism => Consequence), and conclude with philosophical vision.'
    },
    ruhani: {
      id: 'ruhani',
      name: 'Ruhani',
      rank: 'IAS, AIR 5 (2023)',
      pillLabel: '🎨 Ruhani (AIR 5)',
      badge: '🎨 AIR 5 • Spatial Maps & Parallel Schematics',
      theme: '#3b82f6',
      quote: 'Split the page for comparative mechanisms, label figures clearly (Fig 1, Fig 2), and ground geographical concepts in hand-drawn sketches.'
    },
    ishita: {
      id: 'ishita',
      name: 'Ishita Kishore',
      rank: 'IAS, AIR 1 (2022)',
      pillLabel: '🎯 Ishita (AIR 1)',
      badge: '🎯 AIR 1 • Central Hubs & Sociological Frameworks',
      theme: '#8b5cf6',
      quote: 'Anchor the answer with a central multi-spoke hub diagram, link social structures to ground reality, and emphasize human-centric impact.'
    },
    umaharathi: {
      id: 'umaharathi',
      name: 'Umaharathi N',
      rank: 'IAS, AIR 3 (2022)',
      pillLabel: '⚖️ Umaharathi (AIR 3)',
      badge: '⚖️ AIR 3 • Dialectical Balance & 2-Way Bifurcations',
      theme: '#10b981',
      quote: 'Bifurcate intro into positive strides vs critical gaps, balance physical laws with human impact, and ground in cooperative governance.'
    },
    medha: {
      id: 'medha',
      name: 'Medha Anand',
      rank: 'IAS, AIR 13 (2023)',
      pillLabel: '🔬 Medha (AIR 13)',
      badge: '🔬 AIR 13 • Thermodynamic Profiles & Spatial Zoning',
      theme: '#ec4899',
      quote: 'Draw precise vertical lapse-rate curves and micro-climatic profiles to provide immediate scientific credibility in Geography answers.'
    },
    anmol: {
      id: 'anmol',
      name: 'Anmol Rathore',
      rank: 'IAS, AIR 7 (2023)',
      pillLabel: '📐 Anmol (AIR 7)',
      badge: '📐 AIR 7 • Boxed Formulas & Generational Wheels',
      theme: '#06b6d4',
      quote: 'Highlight scientific equations or statutory articles in distinct boxed formulas and structure multi-generational evolutionary timelines.'
    }
  };

  const activeTopperByMKey = {};

  function getRecommendedTopperKey(qText, subject) {
    if (window.TOPPER_ENGINE && (window.TOPPER_ENGINE.getRecommendedTopperKey || window.TOPPER_ENGINE.getRecommendedKey)) {
      const fn = window.TOPPER_ENGINE.getRecommendedTopperKey || window.TOPPER_ENGINE.getRecommendedKey;
      return fn(qText, subject);
    }
    const domain = detectQuestionDomain(qText, subject);
    if (domain === 'GEOGRAPHY_CLIMATOLOGY') return 'medha';
    if (domain === 'GEOGRAPHY_PHYSICAL') return 'ruhani';
    if (domain === 'INDIAN_SOCIETY') return 'ishita';
    if (domain === 'HISTORY_CULTURE') return 'aditya';
    return 'aditya';
  }

  function getDynamicTopperProfile(topperKey, qText, marks, subject) {
    if (window.TOPPER_ENGINE && window.TOPPER_ENGINE.generateBlueprint) {
      return window.TOPPER_ENGINE.generateBlueprint(topperKey, qText, marks, subject);
    }
    const bp = generateComprehensiveBlueprint(qText, marks, subject);
    const baseTopper = TOPPER_ARCHETYPES_DB[topperKey] || TOPPER_ARCHETYPES_DB['aditya'];

    // Calibrated Topper Strategies
    if (topperKey === 'aditya') {
      return {
        ...baseTopper,
        introFormula: bp.intros[0].text,
        bodyStyle: 'Boxed Headings directly addressing prompt demands + Causal flow arrows (=>) + Empirical constants.',
        diagramTitle: bp.diagramTitle,
        diagramAscii: bp.diagramVisual,
        valueAdds: bp.valueAdds,
        interPaper: 'Inter-Disciplinary Multi-Dimensionality: Connects underlying core mechanism to broader socio-economic and sustainable policy resilience.',
        conclusionFormula: bp.conclusion
      };
    }

    if (topperKey === 'ruhani') {
      return {
        ...baseTopper,
        introFormula: bp.intros[1] ? bp.intros[1].text : bp.intros[0].text,
        bodyStyle: 'Two-Column Comparative Split with Parallel Cross-Sections + Labeled Figures (Fig 1, Fig 2).',
        diagramTitle: `Spatial Cross-Section & Comparative Flow: ${bp.diagramTitle}`,
        diagramAscii: bp.diagramVisual,
        valueAdds: bp.valueAdds,
        interPaper: 'Spatial / Micro-Regional Linkage: Translates physical and institutional processes into regional map zoning and local livelihoods.',
        conclusionFormula: bp.conclusion
      };
    }

    if (topperKey === 'ishita') {
      return {
        ...baseTopper,
        introFormula: bp.intros[0].text,
        bodyStyle: 'Central Multi-Spoke Hub Diagram + Human-Centric Roman Numerals (-i-, -ii-, -iii-) with Field Case Studies.',
        diagramTitle: `Central Multi-Dimensional Impact Hub: ${bp.diagramTitle}`,
        diagramAscii: bp.diagramVisual,
        valueAdds: bp.valueAdds,
        interPaper: 'Sociological Lens: Connects technical mechanisms directly to vulnerable demographic welfare and grassroots community resilience.',
        conclusionFormula: bp.conclusion
      };
    }

    if (topperKey === 'umaharathi') {
      return {
        ...baseTopper,
        introFormula: bp.intros[2] ? bp.intros[2].text : bp.intros[0].text,
        bodyStyle: '2-Way Bifurcation Branching Tree (Progressive Potential vs Gaps/Vulnerabilities).',
        diagramTitle: `2-Way Bifurcation Tree: ${bp.diagramTitle}`,
        diagramAscii: bp.diagramVisual,
        valueAdds: bp.valueAdds,
        interPaper: 'Cooperative Governance: Harmonizes state capacity, technological adoption, and community equity.',
        conclusionFormula: bp.conclusion
      };
    }

    if (topperKey === 'medha') {
      return {
        ...baseTopper,
        introFormula: bp.intros[1] ? bp.intros[1].text : bp.intros[0].text,
        bodyStyle: 'Vertical Thermodynamic Profile / Physical Cross-Section + Micro-Climatic Spatial Zoning.',
        diagramTitle: `Thermodynamic Cross-Section: ${bp.diagramTitle}`,
        diagramAscii: bp.diagramVisual,
        valueAdds: bp.valueAdds,
        interPaper: 'Physical Science into Climate Adaptation: Uses physical gradients to guide spatial planning and extreme weather early warning.',
        conclusionFormula: bp.conclusion
      };
    }

    if (topperKey === 'anmol') {
      return {
        ...baseTopper,
        introFormula: bp.intros[0].text,
        bodyStyle: 'Distinct Boxed Formulas / Scientific Constants + Multi-Generational Timeline Progression.',
        diagramTitle: `Generational Evolution & Systematic Matrix: ${bp.diagramTitle}`,
        diagramAscii: bp.diagramVisual,
        valueAdds: bp.valueAdds,
        interPaper: 'Systemic Evolution: Traces long-term structural shifts into contemporary sustainable development goals.',
        conclusionFormula: bp.conclusion
      };
    }

    return {
      ...baseTopper,
      introFormula: bp.intros[0].text,
      bodyStyle: 'Boxed Subheadings addressing the explicit demands + Causal flow (=>).',
      diagramTitle: bp.diagramTitle,
      diagramAscii: bp.diagramVisual,
      valueAdds: bp.valueAdds,
      interPaper: 'Inter-Disciplinary Multi-Dimensionality connecting subject mechanisms to broader policy outcomes.',
      conclusionFormula: bp.conclusion
    };
  }

  function renderTopperContentHtml(mKey, topperKey, qText, marks, subject) {
    if (window.TOPPER_ENGINE && window.TOPPER_ENGINE.renderContentHtml) {
      return window.TOPPER_ENGINE.renderContentHtml(mKey, topperKey, qText, marks, subject);
    }

    const topper = getDynamicTopperProfile(topperKey, qText, marks, subject);
    const esc = escapeHtml;

    return `
      <div class="topper-profile-banner" style="border-left: 4px solid ${topper.theme};">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px;">
          <div>
            <h4 style="margin: 0; color: var(--text-primary); font-size: 1.02rem; display: flex; align-items: center; gap: 6px;">
              <span>${topper.name}</span>
              <span class="badge" style="background: rgba(99, 102, 241, 0.15); color: #818cf8; font-size: 0.76rem;">${topper.rank}</span>
            </h4>
            <div style="font-size: 0.82rem; color: ${topper.theme}; font-weight: 700; margin-top: 2px;">
              ${topper.badge}
            </div>
          </div>
          <button type="button" class="btn btn-primary btn-sm" onclick="AWFG_APP.insertTopperOutline('${mKey}', '${topper.id}', ${marks})" style="background: ${topper.theme}; font-weight: 700; font-size: 0.8rem; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
            📥 Pre-fill Pad with ${topper.name.split(' ')[0]}'s Outline
          </button>
        </div>

        <div class="topper-quote-box">
          <em>"${esc(topper.quote)}"</em>
        </div>

        <div class="topper-strategy-grid">
          <div class="topper-strategy-col">
            <span class="topper-strategy-label">🎯 Introduction Formula for this Question:</span>
            <p style="margin: 4px 0 0; font-size: 0.84rem; color: var(--text-primary); line-height: 1.5;">${esc(topper.introFormula)}</p>
          </div>
          <div class="topper-strategy-col">
            <span class="topper-strategy-label">🏗️ Body Deconstruction & Headings:</span>
            <p style="margin: 4px 0 0; font-size: 0.84rem; color: var(--text-primary); line-height: 1.5;">${esc(topper.bodyStyle)}</p>
          </div>
        </div>

        <!-- Hand-Drawn Blueprint Schematic Box -->
        <div class="topper-diagram-box">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <strong style="color: #818cf8; font-size: 0.84rem;">📐 Topper's Copy Diagram for this Question:</strong>
            <span style="font-size: 0.74rem; color: var(--text-muted);">${esc(topper.diagramTitle)}</span>
          </div>
          <pre class="topper-diagram-ascii">${esc(topper.diagramAscii)}</pre>
        </div>

        <!-- High-Yield Evidence & Inter-Paper Cross-Pollination -->
        <div style="margin-top: 10px;">
          <strong style="color: var(--text-primary); font-size: 0.84rem;">💡 Value Additions Embedded by ${esc(topper.name)}:</strong>
          <ul style="margin: 4px 0 0 18px; padding: 0; font-size: 0.82rem; color: var(--text-secondary); line-height: 1.5;">
            ${topper.valueAdds.map(va => `<li>${esc(va)}</li>`).join('')}
          </ul>
        </div>

        <div class="topper-interpaper-box" style="margin-top: 8px;">
          <span style="font-weight: 700; color: #10b981;">🌐 Multi-Dimensionality:</span>
          <span style="color: var(--text-primary); margin-left: 6px;">${esc(topper.interPaper)}</span>
        </div>

        <div style="margin-top: 8px; font-size: 0.82rem;">
          <strong style="color: #f59e0b;">🏁 Model Concluding Hook:</strong>
          <span style="color: var(--text-secondary); margin-left: 6px;">${esc(topper.conclusionFormula)}</span>
        </div>
      </div>
    `;
  }

  function renderTopperSectionHtml(mKey, qText, marks, subject) {
    const recKey = getRecommendedTopperKey(qText, subject);
    const activeKey = activeTopperByMKey[mKey] || recKey;
    activeTopperByMKey[mKey] = activeKey;

    const topperKeys = ['aditya', 'ruhani', 'ishita', 'umaharathi', 'medha', 'anmol'];
    let paperBadge = 'Subject-Calibrated';
    if (window.TOPPER_ENGINE && window.TOPPER_ENGINE.generateBlueprint) {
      const bp = window.TOPPER_ENGINE.generateBlueprint(activeKey, qText, marks, subject);
      if (bp && bp.paperLabel) paperBadge = bp.paperLabel.split('•')[0].trim();
    }

    return `
      <div class="topper-archetype-card">
        <div class="topper-archetype-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.25rem;">🏆</span>
            <div>
              <strong style="color: #f59e0b; font-size: 0.94rem;">UPSC Topper's Framing Engine (${escapeHtml(paperBadge)})</strong>
              <div style="font-size: 0.76rem; color: var(--text-secondary);">Directly calibrated from UPSC MGP Topper Copies (AIR 1–13)</div>
            </div>
          </div>
          <span class="badge" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; font-weight: 700; font-size: 0.76rem;">
            Recommended: ${TOPPER_ARCHETYPES_DB[recKey].name}
          </span>
        </div>

        <!-- Interactive Topper Selection Pill Bar -->
        <div class="topper-pill-bar" id="topper-pills-${mKey}">
          ${topperKeys.map(k => {
            const t = TOPPER_ARCHETYPES_DB[k];
            const isAct = (k === activeKey);
            return `
              <button type="button" class="topper-pill-btn ${isAct ? 'active' : ''}" onclick="AWFG_APP.selectTopperLens('${mKey}', '${k}')" style="${isAct ? `border-color: ${t.theme}; background: ${t.theme}22; color: ${t.theme};` : ''}">
                ${t.pillLabel}
              </button>
            `;
          }).join('')}
        </div>

        <!-- Dynamic Content Container -->
        <div id="topper-content-${mKey}">
          ${renderTopperContentHtml(mKey, activeKey, qText, marks, subject)}
        </div>
      </div>
    `;
  }

  function selectTopperLens(mKey, topperKey) {
    const card = document.getElementById(`mcard-${mKey}`);
    const stemEl = card ? card.querySelector('.pyq-stem-text') : null;
    const qText = stemEl ? stemEl.textContent : '';
    const marksBadge = card ? card.querySelector('.pyq-marks-badge') : null;
    const marksMatch = marksBadge ? marksBadge.textContent.match(/(\d+(?:\.\d+)?)\s*Marks/) : null;
    const marks = marksMatch ? parseFloat(marksMatch[1]) : 10;
    const subject = (currentPyqData && currentPyqData.name) ? currentPyqData.name : '';

    activeTopperByMKey[mKey] = topperKey;

    const cont = document.getElementById(`topper-content-${mKey}`);
    if (cont) {
      cont.innerHTML = renderTopperContentHtml(mKey, topperKey, qText, marks, subject);
    }

    const pillBar = document.getElementById(`topper-pills-${mKey}`);
    if (pillBar) {
      const btns = pillBar.querySelectorAll('.topper-pill-btn');
      const topperKeys = ['aditya', 'ruhani', 'ishita', 'umaharathi', 'medha', 'anmol'];
      btns.forEach((btn, idx) => {
        const k = topperKeys[idx];
        const t = TOPPER_ARCHETYPES_DB[k];
        if (k === topperKey) {
          btn.classList.add('active');
          btn.style.borderColor = t.theme;
          btn.style.background = t.theme + '22';
          btn.style.color = t.theme;
        } else {
          btn.classList.remove('active');
          btn.style.borderColor = '';
          btn.style.background = '';
          btn.style.color = '';
        }
      });
    }
  }

  function insertTopperOutline(mKey, topperKey, marks) {
    const pad = document.getElementById(`pad-${mKey}`);
    const ta = document.getElementById(`ta-${mKey}`);
    if (!pad || !ta) return;

    pad.classList.remove('hidden');

    const card = document.getElementById(`mcard-${mKey}`);
    const stemEl = card ? card.querySelector('.pyq-stem-text') : null;
    const qText = stemEl ? stemEl.textContent : '';
    const subject = (currentPyqData && currentPyqData.name) ? currentPyqData.name : '';

    let outline = '';
    let topperName = 'Topper';

    if (window.TOPPER_ENGINE && window.TOPPER_ENGINE.getMarkdownOutline) {
      outline = window.TOPPER_ENGINE.getMarkdownOutline(topperKey, qText, marks, subject);
      const t = window.TOPPER_ENGINE.ARCHETYPES[topperKey];
      if (t) topperName = t.name;
    } else {
      const topper = getDynamicTopperProfile(topperKey, qText, marks, subject);
      outline = getComprehensiveOutlineText(qText, marks, subject);
      if (topper) topperName = topper.name;
    }

    if (ta.value.trim().length > 0) {
      if (confirm(`Your answer pad already has some text. Do you want to append ${topperName}'s outline at the bottom?`)) {
        ta.value = ta.value + '\n\n' + outline;
      }
    } else {
      ta.value = outline;
    }

    const targetWords = (parseFloat(marks) >= 15) ? 250 : 150;
    handleMainsWordCount(mKey, targetWords);

    ta.scrollIntoView({ behavior: 'smooth', block: 'center' });
    ta.focus();
    showToast(`${topperName}'s structure inserted into Answer Pad!`, '🏆');
  }

  // -------------------------------------------------------------
  // Master Comprehensive Blueprint HTML View
  // -------------------------------------------------------------
  function renderComprehensiveBlueprintHtml(mKey, qText, marks, subject) {
    const bp = generateComprehensiveBlueprint(qText, marks, subject);
    const esc = escapeHtml;

    return `
      <div class="bp-master-card">
        <!-- Top Blueprint Header Banner -->
        <div class="bp-header">
          <div>
            <div style="font-size: 0.74rem; text-transform: uppercase; font-weight: 700; color: #818cf8; letter-spacing: 0.5px;">
              ${esc(bp.domainLabel)}
            </div>
            <h3 style="margin: 2px 0 0; color: var(--text-primary); font-size: 1.12rem; display: flex; align-items: center; gap: 8px;">
              <span>📐</span> GS-1 Answer Blueprint (5-Point UPSC Framework)
            </h3>
          </div>
          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <span class="approach-directive-badge">🎯 Directive: ${esc(bp.directive)}</span>
            <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; font-weight: 700; font-size: 0.8rem;">
              ⏱️ ${bp.suggestedTime} Mins • ~${bp.targetWords} Words
            </span>
          </div>
        </div>

        <!-- Point 1: Simplify the Question (Demand Deconstruction) -->
        <div style="margin-top: 12px; padding: 12px 14px; background: rgba(99, 102, 241, 0.06); border-radius: var(--radius-sm); border: 1px solid rgba(99, 102, 241, 0.2);">
          <div style="font-size: 0.86rem; font-weight: 700; color: #818cf8; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
            <span>1️⃣</span> Simplify the Question & Demand Deconstruction
          </div>
          <div style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.55;">
            <div><strong>🎯 Directive Guidance (${esc(bp.directive)}):</strong> ${esc(bp.directiveMeaning)}</div>
            ${bp.explicitDemands ? `<div style="margin-top: 4px;"><strong>📌 Explicit Demands:</strong> ${esc(bp.explicitDemands)}</div>` : ''}
            ${bp.implicitDemands ? `<div style="margin-top: 4px;"><strong>🔍 Implicit Demands:</strong> ${esc(bp.implicitDemands)}</div>` : ''}
          </div>
        </div>

        <!-- Point 2: Approach Framework -->
        <div style="margin-top: 16px;">
          <div style="font-size: 0.88rem; font-weight: 700; color: #f59e0b; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
            <span>2️⃣</span> Approach: Structured Framework (Intro, Body & Visual)
          </div>

          <!-- Section 2A: Ready-to-Write Introductions -->
          <div style="margin-top: 6px;">
            <div style="font-size: 0.82rem; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">
              ✍️ Ready-to-Write Introductions (${bp.intros.length} High-Scoring Approaches):
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${bp.intros.map(intro => `
                <div class="bp-intro-card">
                  <div class="bp-intro-tag">${esc(intro.type)}</div>
                  <div class="bp-intro-text">${esc(intro.text)}</div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Section 2B: Real Hand-Drawable Copy Diagram & Sketch Guide -->
          <div style="margin-top: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 6px;">
              <span style="font-size: 0.82rem; font-weight: 700; color: #38bdf8;">📊 Real Hand-Drawable Copy Diagram (Smart Art):</span>
              <span style="font-size: 0.76rem; color: var(--text-muted);">${esc(bp.diagramTitle)}</span>
            </div>
            <div class="bp-diagram-canvas">
              <pre class="bp-diagram-pre">${esc(bp.diagramVisual)}</pre>
            </div>
            <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 6px; padding: 6px 10px; background: rgba(56, 189, 248, 0.08); border-radius: var(--radius-sm); border-left: 3px solid #38bdf8;">
              <strong style="color: #38bdf8;">📝 1-Minute Copy Sketch Guide:</strong> ${esc(bp.diagramSketchInstructions)}
            </div>
          </div>

          <!-- Section 2C: Exact Body Subheadings & Comprehensive Points -->
          <div style="margin-top: 14px;">
            <div style="font-size: 0.82rem; font-weight: 700; color: #10b981; margin-bottom: 8px;">
              🏗️ Main Body Subheadings & Evidence-Backed Points:
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px;">
              ${bp.headings.map(h => `
                <div class="bp-heading-card">
                  <div class="bp-heading-title">${esc(h.title)}</div>
                  <ul class="bp-heading-list">
                    ${h.points.map(pt => `<li>${esc(pt)}</li>`).join('')}
                  </ul>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Section 2D: Balanced Model Concluding Synthesis -->
          <div style="margin-top: 12px; padding: 10px 14px; background: rgba(245, 158, 11, 0.08); border-radius: var(--radius-sm); border-left: 3px solid #f59e0b;">
            <strong style="color: #f59e0b; font-size: 0.84rem;">🏁 Balanced Concluding Perspective:</strong>
            <span style="color: var(--text-primary); margin-left: 6px; font-size: 0.84rem; line-height: 1.5;">${esc(bp.conclusion)}</span>
          </div>
        </div>

        <!-- Point 3: Value Additions -->
        <div style="margin-top: 16px; padding: 12px 14px; background: var(--bg-secondary); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
          <div style="font-size: 0.86rem; font-weight: 700; color: #10b981; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
            <span>3️⃣</span> Value Additions (Standard Texts, Archaeological/Empirical Benchmarks & Cultural Ethos)
          </div>
          <ul style="margin: 4px 0 0 18px; padding: 0; font-size: 0.82rem; color: var(--text-secondary); line-height: 1.55;">
            ${bp.valueAdds.map(va => `<li>${esc(va)}</li>`).join('')}
          </ul>
        </div>

        <!-- Point 4: Model Answer via UPSC Topper Archetype Engine Integration -->
        <div style="margin-top: 18px;">
          <div style="font-size: 0.88rem; font-weight: 700; color: #8b5cf6; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
            <span>4️⃣</span> Model Topper Answers (Directly calibrated from AIR 1–13 copies)
          </div>
          ${renderTopperSectionHtml(mKey, qText, marks, subject)}
        </div>

        <!-- Point 5: Critical Evaluation & Modern India Linkage -->
        ${bp.evaluation ? `
          <div style="margin-top: 14px; padding: 12px 14px; background: rgba(56, 189, 248, 0.08); border-radius: var(--radius-sm); border-left: 3px solid #38bdf8;">
            <strong style="color: #38bdf8; font-size: 0.84rem;">5️⃣ Critical Evaluation & Modern India Linkage:</strong>
            <p style="margin: 4px 0 0; font-size: 0.84rem; color: var(--text-primary); line-height: 1.5;">
              ${esc(bp.evaluation)}
            </p>
          </div>
        ` : ''}

        <!-- Quick Outline Actions -->
        <div class="approach-actions" style="margin-top: 16px;">
          <button class="btn btn-subtle btn-sm" onclick="AWFG_APP.copyMainsOutline('${mKey}', this)">
            📋 Copy Complete 5-Point Structure
          </button>
          <button class="btn btn-primary btn-sm" onclick="AWFG_APP.insertTemplateToPad('${mKey}', ${marks})">
            📥 Insert Comprehensive Structure into Answer Pad
          </button>
        </div>
      </div>
    `;
  }

  function renderMainsApproachHtml(mKey, qText, marks, subject) {
    return renderComprehensiveBlueprintHtml(mKey, qText, marks, subject);
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
    const subject = (currentPyqData && currentPyqData.name) ? currentPyqData.name : '';

    const approach = generateMainsApproach(qText, marks, subject);
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
    const subject = (currentPyqData && currentPyqData.name) ? currentPyqData.name : '';

    const approach = generateMainsApproach(qText, marks, subject);
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
    STATE.paperFilter = paper;
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
    selectTopperLens: selectTopperLens,
    insertTopperOutline: insertTopperOutline,
    detectQuestionDomain: detectQuestionDomain,
    generateComprehensiveBlueprint: generateComprehensiveBlueprint,
    renderComprehensiveBlueprintHtml: renderComprehensiveBlueprintHtml,
    getState: () => STATE,
    showToast: showToast,
    setFilterPaper: (paper) => { STATE.paperFilter = paper; STATE.wyskPaper = paper; STATE.wyskTopic = 'ALL'; renderView(); }
  };

  // Bootstrap when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    loadStorage();
    initUI();
  });

})();
