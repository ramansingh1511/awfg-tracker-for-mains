// js/pages/DashboardPage.js
// Page Object: Top Dashboard KPI Metrics & Target Progress Counters

(function() {
  'use strict';

  const State = window.AWFG_STATE;
  const Utils = window.AWFG_UTILS;

  const DashboardPage = {
    render() {
      const metrics = State.calculateMetrics();
      const state = State.get();
      const user = state.currentUser;

      // Update Header Controls
      const userBtn = document.getElementById('current-user-btn');
      if (userBtn && user) {
        userBtn.textContent = user.username;
      }

      const startInp = document.getElementById('start-date-inp');
      if (startInp) {
        startInp.value = user ? user.startDate : state.startDate;
      }

      const durInp = document.getElementById('target-duration-inp');
      if (durInp) {
        durInp.value = State.getTargetDays();
      }

      const cadSelect = document.getElementById('cadence-select');
      if (cadSelect) {
        cadSelect.value = user ? user.cadence : state.cadence;
      }

      // Update KPI Cards
      const testCard = document.getElementById('kpi-tests-completed');
      if (testCard) {
        testCard.innerHTML = `
          <div class="kpi-val">${metrics.completedTests} / ${metrics.totalTests}</div>
          <div class="kpi-label">Tests Completed (${metrics.overallPct}%)</div>
          <div class="kpi-sub">${metrics.ontrackTests} on track • ${metrics.delayedTests} delayed</div>
        `;
      }

      const mainsCard = document.getElementById('kpi-mains-mts');
      if (mainsCard) {
        const mainsPct = metrics.totalMainsMTs > 0 ? Math.round((metrics.doneMainsMTs / metrics.totalMainsMTs) * 100) : 0;
        mainsCard.innerHTML = `
          <div class="kpi-val">${metrics.doneMainsMTs} / ${metrics.totalMainsMTs}</div>
          <div class="kpi-label">Mains Microthemes (${mainsPct}%)</div>
          <div class="kpi-sub">${metrics.totalMainsMTs - metrics.doneMainsMTs} remaining</div>
        `;
      }

      const prelimsCard = document.getElementById('kpi-prelims-overlap');
      if (prelimsCard) {
        const pPct = metrics.totalCoinciding > 0 ? Math.round((metrics.doneCoinciding / metrics.totalCoinciding) * 100) : 0;
        prelimsCard.innerHTML = `
          <div class="kpi-val">${metrics.doneCoinciding} / ${metrics.totalCoinciding}</div>
          <div class="kpi-label">Prelims Overlap MTs (${pPct}%)</div>
          <div class="kpi-sub">+ ${metrics.doneExclusive} / ${metrics.totalExclusive} Exclusive</div>
        `;
      }

      const overdueCard = document.getElementById('kpi-overdue-tests');
      if (overdueCard) {
        overdueCard.innerHTML = `
          <div class="kpi-val" style="color: ${metrics.overdueTests > 0 ? '#ef4444' : '#10b981'};">${metrics.overdueTests}</div>
          <div class="kpi-label">Overdue Tests</div>
          <div class="kpi-sub">${metrics.overdueTests > 0 ? 'Requires catching up' : 'All scheduled work on track!'}</div>
        `;
      }

      const daysCard = document.getElementById('kpi-target-days');
      if (daysCard) {
        daysCard.innerHTML = `
          <div class="kpi-val">${metrics.daysRemaining}d</div>
          <div class="kpi-label">${metrics.targetDays}-Day Target Remaining</div>
          <div class="kpi-sub">Day ${metrics.daysElapsed} of ${metrics.targetDays} (${(metrics.targetDays / 30).toFixed(1)} Months)</div>
        `;
      }
    },

    bindEvents() {
      const startInp = document.getElementById('start-date-inp');
      if (startInp) {
        startInp.addEventListener('change', (e) => {
          const state = State.get();
          if (state.currentUser) {
            state.currentUser.startDate = e.target.value;
            State.saveStorage();
            DashboardPage.render();
            if (window.AWFG_SCHEDULE_PAGE) window.AWFG_SCHEDULE_PAGE.render();
          }
        });
      }

      const durInp = document.getElementById('target-duration-inp');
      if (durInp) {
        durInp.addEventListener('change', (e) => {
          const val = parseInt(e.target.value, 10);
          if (val && val >= 15 && val <= 365) {
            const state = State.get();
            if (state.currentUser) {
              state.currentUser.targetDays = val;
              State.saveStorage();
              DashboardPage.render();
              if (window.AWFG_SCHEDULE_PAGE) window.AWFG_SCHEDULE_PAGE.render();
            }
          }
        });
      }

      const cadSelect = document.getElementById('cadence-select');
      if (cadSelect) {
        cadSelect.addEventListener('change', (e) => {
          const state = State.get();
          if (state.currentUser) {
            state.currentUser.cadence = e.target.value;
            State.saveStorage();
            DashboardPage.render();
            if (window.AWFG_SCHEDULE_PAGE) window.AWFG_SCHEDULE_PAGE.render();
          }
        });
      }
    }
  };

  window.AWFG_DASHBOARD_PAGE = DashboardPage;
})();
