// js/core/State.js
// Central Reactive State Store & LocalStorage Persistence

(function() {
  'use strict';

  const Utils = window.AWFG_UTILS;
  const EventBus = window.AWFG_EVENT_BUS;

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

    if (!STATE.startDate) {
      const today = new Date();
      STATE.startDate = Utils.getISO(today);
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

  function ensureUser(username, password = '') {
    if (!STATE.users[username]) {
      STATE.users[username] = {
        username: username,
        password: password,
        startDate: STATE.startDate || Utils.getISO(new Date()),
        targetDays: STATE.targetDays || 90,
        cadence: 'auto_distribute',
        theme: 'dark',
        testStatus: {},
        mainsChecked: {},
        coincidingChecked: {},
        exclusiveChecked: {},
        wyskChecked: {},
        wyskMasterChecked: {},
        notes: {},
        pyqAttempts: {},
        mainsAnswers: {}
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

  function getTargetDateForTest(test) {
    const baseDate = Utils.parseISO(STATE.currentUser ? STATE.currentUser.startDate : STATE.startDate) || new Date();
    const cadence = STATE.currentUser ? STATE.currentUser.cadence : STATE.cadence;
    const totalDays = getTargetDays();

    const bufferDays = Math.max(2, Math.round(totalDays * 0.12));
    const activeSpan = Math.max(test.id, totalDays - bufferDays);

    let dayOffset = 0;
    if (cadence === 'every_2_days') {
      dayOffset = (test.id - 1) * 2;
    } else if (cadence === 'every_3_days') {
      dayOffset = (test.id - 1) * 3;
    } else if (cadence === 'mon_wed_fri' && totalDays === 90) {
      dayOffset = test.dayOffset;
    } else {
      dayOffset = Math.round((test.id - 1) * (activeSpan / 32));
    }

    return new Date(baseDate.getTime() + dayOffset * 86400000);
  }

  function getTestStatus(test) {
    const user = STATE.currentUser;
    const testData = user && user.testStatus ? user.testStatus[test.id] : null;
    const targetDate = getTargetDateForTest(test);
    const today = new Date();

    if (testData && testData.completed) {
      const actualDate = testData.actualDate ? Utils.parseISO(testData.actualDate) : null;
      if (actualDate) {
        const diff = Utils.daysDiff(actualDate, targetDate);
        if (diff > 0) {
          return {
            type: 'delayed',
            label: `Delayed (+${diff}d)`,
            badgeClass: 'delayed',
            desc: `Target was ${Utils.formatDate(targetDate)}, completed on ${Utils.formatDate(actualDate)}`
          };
        }
      }
      return {
        type: 'completed',
        label: 'Completed',
        badgeClass: 'completed',
        desc: actualDate ? `Completed on ${Utils.formatDate(actualDate)}` : 'Marked Completed'
      };
    }

    const diffFromToday = Utils.daysDiff(targetDate, today);
    if (diffFromToday < 0) {
      const overdueDays = Math.abs(diffFromToday);
      return {
        type: 'overdue',
        label: `Overdue (+${overdueDays}d)`,
        badgeClass: 'overdue',
        desc: `Target date was ${Utils.formatDate(targetDate)} (${overdueDays} days ago)`
      };
    } else {
      return {
        type: 'ontrack',
        label: diffFromToday === 0 ? 'Due Today' : `In ${diffFromToday} days`,
        badgeClass: 'ontrack',
        desc: `Target: ${Utils.formatDate(targetDate)}`
      };
    }
  }

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
    const totalDays = getTargetDays();
    const startDate = Utils.parseISO(user ? user.startDate : STATE.startDate) || new Date();
    const today = new Date();
    const daysElapsed = Math.max(0, Utils.daysDiff(today, startDate));
    const daysRemaining = Math.max(0, totalDays - daysElapsed);

    return {
      totalTests,
      completedTests,
      delayedTests,
      overdueTests,
      ontrackTests,
      overallPct,
      totalMainsMTs,
      doneMainsMTs,
      totalCoinciding,
      doneCoinciding,
      totalExclusive,
      doneExclusive,
      totalWysk,
      doneWysk,
      daysElapsed,
      daysRemaining,
      targetDays: totalDays
    };
  }

  window.AWFG_STATE = {
    get: () => STATE,
    loadStorage,
    saveStorage,
    ensureUser,
    getTargetDays,
    getTargetDateForTest,
    getTestStatus,
    calculateMetrics,
    setPaperFilter: (paper) => {
      STATE.paperFilter = paper;
      STATE.wyskPaper = paper;
      STATE.wyskTopic = 'ALL';
      saveStorage();
      EventBus.emit('state:updated', STATE);
    },
    setActiveView: (view) => {
      STATE.activeView = view;
      saveStorage();
      EventBus.emit('state:updated', STATE);
    },
    setSearchQuery: (query) => {
      STATE.searchQuery = query;
      STATE.wyskSearch = query;
      EventBus.emit('state:updated', STATE);
    }
  };
})();
