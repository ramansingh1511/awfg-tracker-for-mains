// js/pages/RoadmapPage.js
// Page Object: 13-Week Dynamic Syllabus Roadmap

(function() {
  'use strict';

  const State = window.AWFG_STATE;
  const Utils = window.AWFG_UTILS;

  const RoadmapPage = {
    render() {
      const container = document.getElementById('view-content');
      if (!container) return;

      const baseSchedule = window.AWFG_SCHEDULE || [];
      const state = State.get();
      const schedule = (state.paperFilter === 'ALL')
        ? baseSchedule
        : baseSchedule.filter(t => t.paper === state.paperFilter);

      const totalDays = State.getTargetDays();
      const totalWeeks = Math.max(3, Math.ceil(totalDays / 7));
      const baseDate = Utils.parseISO(state.currentUser ? state.currentUser.startDate : state.startDate) || new Date();

      const weeksMap = {};
      for (let w = 1; w <= totalWeeks; w++) weeksMap[w] = [];

      schedule.forEach(t => {
        const target = State.getTargetDateForTest(t);
        const diffDays = Math.max(0, Utils.daysDiff(target, baseDate));
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
                const status = State.getTestStatus(t);
                const target = State.getTargetDateForTest(t);
                const isDone = status.type === 'completed' || status.type === 'delayed';
                return `
                  <div class="roadmap-test-card ${isDone ? 'done' : (status.type === 'overdue' ? 'late' : '')}" onclick="window.AWFG_APP.jumpToTest(${t.id})">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <span class="paper-badge ${t.paper}" style="font-size: 0.65rem; padding: 2px 6px;">${t.paper}</span>
                      <span class="status-badge ${status.badgeClass}" style="font-size: 0.68rem; padding: 1px 6px;">${status.label}</span>
                    </div>
                    <div style="font-weight: 700; font-size: 0.86rem; margin: 4px 0 2px;">${t.name.split('(')[0]}</div>
                    <div style="font-size: 0.74rem; color: var(--accent-gold); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${t.focusTitle}</div>
                    <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px;">📅 ${Utils.formatDate(target)}</div>
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
  };

  window.AWFG_ROADMAP_PAGE = RoadmapPage;
})();
