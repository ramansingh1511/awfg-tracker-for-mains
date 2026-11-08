// js/pages/SchedulePage.js
// Page Object: Test Schedule View & Test Cards Component

(function() {
  'use strict';

  const State = window.AWFG_STATE;
  const Utils = window.AWFG_UTILS;

  const SchedulePage = {
    render() {
      const container = document.getElementById('view-content');
      if (!container) return;

      const schedule = window.AWFG_SCHEDULE || [];
      const state = State.get();
      const user = state.currentUser;

      // Filter by paper, status, search
      let filtered = schedule.filter(t => {
        if (state.paperFilter !== 'ALL' && t.paper !== state.paperFilter) return false;

        const status = State.getTestStatus(t);
        if (state.statusFilter === 'completed' && status.type !== 'completed' && status.type !== 'delayed') return false;
        if (state.statusFilter === 'pending' && (status.type === 'completed' || status.type === 'delayed')) return false;
        if (state.statusFilter === 'overdue' && status.type !== 'overdue') return false;

        if (state.searchQuery) {
          const q = state.searchQuery.toLowerCase();
          const matchTitle = (t.name + ' ' + t.focusTitle + ' ' + (t.syllabusRaw || '')).toLowerCase().includes(q);
          const matchMains = (t.mainsMicrothemes || []).some(m => m.toLowerCase().includes(q));
          const matchPrelims = (t.coincidingPrelims || []).some(p => p.name.toLowerCase().includes(q));
          if (!matchTitle && !matchMains && !matchPrelims) return false;
        }

        return true;
      });

      if (filtered.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
            <div style="font-size: 2.5rem; margin-bottom: 12px;">🔍</div>
            <h3 style="color: var(--text-primary); margin-bottom: 8px;">No Tests Matching Filter</h3>
            <p style="font-size: 0.9rem;">Try adjusting your paper pill filter, status dropdown, or search keyword.</p>
            <button class="btn btn-primary btn-sm" style="margin-top: 14px;" onclick="AWFG_APP.setFilterPaper('ALL')">Show All 33 Tests</button>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div class="test-cards-grid">
          ${filtered.map(t => SchedulePage.renderTestCard(t)).join('')}
        </div>
      `;
    },

    renderTestCard(t) {
      const state = State.get();
      const user = state.currentUser;
      const testInfo = user && user.testStatus && user.testStatus[t.id] ? user.testStatus[t.id] : {};
      const isCompleted = !!testInfo.completed;
      const actualDate = testInfo.actualDate || '';
      const notes = (user && user.notes && user.notes[t.id]) || '';

      const targetDate = State.getTargetDateForTest(t);
      const targetDateStr = Utils.formatDate(targetDate);
      const status = State.getTestStatus(t);

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

      const totalItems = mainsTotal + coincideTotal + exclusiveTotal + wyskTotal;
      const doneItems = mainsDone + coincideDone + exclusiveDone + wyskDone;
      const pct = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;

      return `
        <div class="test-card ${isCompleted ? 'is-completed' : ''}" id="test-card-${t.id}">
          <div class="test-card-header">
            <div>
              <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 4px;">
                <span class="paper-badge paper-${t.paper.toLowerCase()}">${t.paper}</span>
                <span class="test-number">Test #${t.id}</span>
                <span class="test-duration">${t.duration} • ${t.questionCount} Questions</span>
              </div>
              <h3 class="test-focus-title">${Utils.escapeHtml(t.focusTitle)}</h3>
              <div class="test-syllabus-raw">${Utils.escapeHtml(t.syllabusRaw || '')}</div>
            </div>
            <div style="text-align: right;">
              <span class="status-badge ${status.badgeClass}">${status.label}</span>
              <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 4px;">${status.desc}</div>
            </div>
          </div>

          <!-- Microtheme Progress Bar -->
          <div class="test-progress-bar-container">
            <div class="test-progress-bar" style="width: ${pct}%;"></div>
          </div>

          <!-- Section 1: Mains Microthemes -->
          <div class="test-section">
            <div class="test-section-header">
              <span>🎯 Mains Microthemes (${mainsDone}/${mainsTotal})</span>
            </div>
            <div class="microthemes-pills-list">
              ${(t.mainsMicrothemes || []).map((mt, idx) => {
                const isChecked = user && user.mainsChecked && user.mainsChecked[`${t.id}_${idx}`];
                return `
                  <div class="mt-pill ${isChecked ? 'completed' : ''}">
                    <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="AWFG_SCHEDULE_PAGE.toggleCheckbox('mains', '${t.id}_${idx}')">
                    <span class="mt-pill-text" onclick="AWFG_APP.openPyqModal('${Utils.escapeQuotes(mt)}', 'mains')">${Utils.escapeHtml(mt)}</span>
                    <span class="mt-open-btn" onclick="AWFG_APP.openPyqModal('${Utils.escapeQuotes(mt)}', 'mains')" title="Explore PYQs">🔍</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Section 2: Prelims Overlap Microthemes -->
          ${coincideTotal > 0 ? `
            <div class="test-section" style="margin-top: 10px;">
              <div class="test-section-header">
                <span>🔗 Coinciding Prelims Focus (${coincideDone}/${coincideTotal})</span>
              </div>
              <div class="microthemes-pills-list">
                ${(t.coincidingPrelims || []).map((cp, idx) => {
                  const isChecked = user && user.coincidingChecked && user.coincidingChecked[`${t.id}_${idx}`];
                  return `
                    <div class="mt-pill overlap ${isChecked ? 'completed' : ''}">
                      <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="AWFG_SCHEDULE_PAGE.toggleCheckbox('coinciding', '${t.id}_${idx}')">
                      <span class="mt-pill-text" onclick="AWFG_APP.openPyqModal('${Utils.escapeQuotes(cp.name)}', 'prelims')">${Utils.escapeHtml(cp.name)}</span>
                      <span class="mt-badge-overlap">${cp.qs} Qs</span>
                      <span class="mt-open-btn" onclick="AWFG_APP.openPyqModal('${Utils.escapeQuotes(cp.name)}', 'prelims')" title="Practice MCQs">🎯</span>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Test Actions Bar -->
          <div class="test-card-actions">
            <div style="display: flex; gap: 8px; align-items: center;">
              <label style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary);">Status:</label>
              <select class="form-select form-select-sm" onchange="AWFG_SCHEDULE_PAGE.updateTestStatus(${t.id}, this.value)">
                <option value="pending" ${!isCompleted ? 'selected' : ''}>Pending</option>
                <option value="completed" ${isCompleted ? 'selected' : ''}>Mark Completed</option>
              </select>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">
              Target: <strong>${targetDateStr}</strong>
            </div>
          </div>
        </div>
      `;
    },

    jumpToTest(testId) {
      const card = document.getElementById(`test-card-${testId}`);
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('highlight-test-card');
        setTimeout(() => card.classList.remove('highlight-test-card'), 2500);
      }
    },

    updateTestStatus(testId, statusVal) {
      const state = State.get();
      if (!state.currentUser) State.ensureUser('Aspirant_2027', '');
      if (!state.currentUser.testStatus) state.currentUser.testStatus = {};

      if (statusVal === 'completed') {
        state.currentUser.testStatus[testId] = {
          completed: true,
          actualDate: Utils.getISO(new Date())
        };
        Utils.showToast(`Test #${testId} marked Completed!`, '🎉');
      } else {
        delete state.currentUser.testStatus[testId];
        Utils.showToast(`Test #${testId} set to Pending.`, 'ℹ️');
      }

      State.saveStorage();
      if (window.AWFG_DASHBOARD_PAGE) window.AWFG_DASHBOARD_PAGE.render();
      SchedulePage.render();
    },

    toggleCheckbox(type, key) {
      const state = State.get();
      if (!state.currentUser) State.ensureUser('Aspirant_2027', '');
      const propMap = {
        'mains': 'mainsChecked',
        'coinciding': 'coincidingChecked',
        'exclusive': 'exclusiveChecked',
        'wysk': 'wyskChecked'
      };
      const prop = propMap[type];
      if (!prop) return;

      if (!state.currentUser[prop]) state.currentUser[prop] = {};
      state.currentUser[prop][key] = !state.currentUser[prop][key];

      State.saveStorage();
      if (window.AWFG_DASHBOARD_PAGE) window.AWFG_DASHBOARD_PAGE.render();
      SchedulePage.render();
    }
  };

  window.AWFG_SCHEDULE_PAGE = SchedulePage;
})();
