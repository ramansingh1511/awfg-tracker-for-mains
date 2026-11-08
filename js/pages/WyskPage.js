// js/pages/WyskPage.js
// Page Object: 1,697 "What You Should Know" (WYSK) Question Bank

(function() {
  'use strict';

  const State = window.AWFG_STATE;
  const Utils = window.AWFG_UTILS;

  const WyskPage = {
    render() {
      const container = document.getElementById('view-content');
      if (!container) return;

      const allWysk = window.ALL_WYSK_QUESTIONS || [];
      const state = State.get();
      const user = state.currentUser;
      const userWysk = (user && user.wyskMasterChecked) ? user.wyskMasterChecked : {};

      const totalAll = allWysk.length;
      const totalMastered = allWysk.filter(q => userWysk[q.id]).length;
      const masterPct = totalAll > 0 ? Math.round((totalMastered / totalAll) * 100) : 0;

      const currentPaper = state.paperFilter || state.wyskPaper || 'ALL';
      state.wyskPaper = currentPaper;
      let filtered = currentPaper === 'ALL' ? allWysk : allWysk.filter(q => q.paper === currentPaper);

      const topicSet = new Map();
      filtered.forEach(q => {
        if (!topicSet.has(q.topicNum)) {
          topicSet.set(q.topicNum, { num: q.topicNum, label: q.topicName || q.topic });
        }
      });
      const sortedTopics = Array.from(topicSet.values()).sort((a, b) => a.num - b.num);

      const currentTopic = state.wyskTopic || 'ALL';
      if (currentTopic !== 'ALL') {
        const tNum = parseInt(currentTopic, 10);
        filtered = filtered.filter(q => q.topicNum === tNum);
      }

      const searchVal = (state.wyskSearch || '').trim().toLowerCase();
      if (searchVal) {
        filtered = filtered.filter(q => 
          q.question.toLowerCase().includes(searchVal) || 
          (q.topicName && q.topicName.toLowerCase().includes(searchVal)) ||
          q.topic.toLowerCase().includes(searchVal)
        );
      }

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

      const limit = state.wyskLimit || 60;
      const visibleList = filtered.slice(0, limit);

      container.innerHTML = `
        <div class="question-view" style="max-width: 1200px; margin: 0 auto;">
          <!-- Header & Progress Card -->
          <div style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 20px 24px; margin-bottom: 20px; box-shadow: var(--shadow-sm);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
              <div>
                <h2 style="margin: 0 0 6px; font-size: 1.4rem; display: flex; align-items: center; gap: 8px;">
                  <span>💡</span> "What You Should Know" (WYSK) Question Bank
                </h2>
                <p style="margin: 0; color: var(--text-secondary); font-size: 0.88rem;">
                  Comprehensive pool of <strong>${totalAll}</strong> high-yield syllabus questions across all 4 GS papers from official AWFG curriculum.
                </p>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 1.15rem; font-weight: 700; color: #10b981;">
                  ${totalMastered} / ${totalAll} Mastered (${masterPct}%)
                </div>
                <div style="width: 180px; height: 8px; background: var(--bg-tertiary); border-radius: 999px; overflow: hidden; margin-top: 6px;">
                  <div style="height: 100%; width: ${masterPct}%; background: linear-gradient(90deg, #10b981, #059669); transition: width 0.3s ease;"></div>
                </div>
              </div>
            </div>

            <!-- Paper Selector Tabs -->
            <div style="display: flex; gap: 8px; margin-top: 18px; flex-wrap: wrap;">
              ${['ALL', 'GS-1', 'GS-2', 'GS-3', 'GS-4'].map(p => {
                const isActive = (currentPaper === p);
                const count = paperCounts[p] || 0;
                const mastered = paperMastered[p] || 0;
                return `
                  <button class="btn ${isActive ? 'btn-primary' : 'btn-outline'} btn-sm" 
                          onclick="AWFG_APP.setWyskPaper('${p}')"
                          style="font-size: 0.82rem; font-weight: 600; padding: 6px 14px;">
                    ${p === 'ALL' ? 'All Papers' : p} (${count}) • <span style="opacity: 0.85;">${mastered}✓</span>
                  </button>
                `;
              }).join('')}
            </div>

            <!-- Topic & Keyword Search Toolbar -->
            <div style="display: flex; gap: 12px; margin-top: 16px; flex-wrap: wrap;">
              <div style="flex: 1; min-width: 240px; position: relative;">
                <input type="text" class="form-control" id="wysk-search-input" 
                       placeholder="🔍 Search ${filtered.length} questions by keyword..." 
                       value="${Utils.escapeHtml(state.wyskSearch || '')}"
                       oninput="AWFG_APP.setWyskSearch(this.value)"
                       style="padding-left: 12px; font-size: 0.88rem;">
              </div>
              <div style="min-width: 240px;">
                <select class="form-select" onchange="AWFG_APP.setWyskTopic(this.value)" style="font-size: 0.88rem;">
                  <option value="ALL" ${currentTopic === 'ALL' ? 'selected' : ''}>All Syllabus Topics (${filtered.length})</option>
                  ${sortedTopics.map(t => `
                    <option value="${t.num}" ${currentTopic === String(t.num) ? 'selected' : ''}>
                      Topic ${t.num}: ${Utils.escapeHtml(t.label.length > 55 ? t.label.substring(0, 52) + '...' : t.label)}
                    </option>
                  `).join('')}
                </select>
              </div>
            </div>
          </div>

          <!-- Questions Counter & Bulk Actions -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding: 0 4px; font-size: 0.85rem; color: var(--text-secondary);">
            <span>Showing <strong>${visibleList.length}</strong> of <strong>${filtered.length}</strong> matching questions</span>
            ${filtered.length > limit ? `
              <button class="btn btn-subtle btn-sm" onclick="AWFG_APP.loadAllWysk()">Show All (${filtered.length})</button>
            ` : ''}
          </div>

          <!-- Question Cards List -->
          <div class="wysk-questions-list" style="display: flex; flex-direction: column; gap: 10px;">
            ${visibleList.map(q => {
              const isChecked = !!userWysk[q.id];
              return `
                <div class="wysk-card ${isChecked ? 'is-mastered' : ''}" id="wysk-card-${q.id}"
                     style="background: var(--bg-card); border: 1px solid ${isChecked ? 'rgba(16, 185, 129, 0.4)' : 'var(--border-color)'}; border-radius: var(--radius-sm); padding: 12px 16px; display: flex; align-items: flex-start; gap: 12px; transition: all 0.2s ease;">
                  <input type="checkbox" ${isChecked ? 'checked' : ''} 
                         onchange="AWFG_APP.toggleWyskMaster('${q.id}')"
                         style="margin-top: 4px; cursor: pointer; accent-color: #10b981; transform: scale(1.15);">
                  <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap;">
                      <span class="paper-badge ${q.paper.toLowerCase()}" style="font-size: 0.68rem; padding: 1px 6px;">${q.paper}</span>
                      <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">${q.topic}</span>
                      <span style="font-size: 0.75rem; color: var(--accent-gold);">${Utils.escapeHtml(q.topicName || '')}</span>
                    </div>
                    <div style="font-size: 0.92rem; color: ${isChecked ? 'var(--text-secondary)' : 'var(--text-primary)'}; line-height: 1.5; ${isChecked ? 'text-decoration: line-through; opacity: 0.85;' : ''}">
                      ${Utils.escapeHtml(q.question)}
                    </div>
                  </div>
                  <button class="btn btn-subtle btn-sm" onclick="AWFG_APP.copyQuestion('${Utils.escapeQuotes(q.question)}', this)" title="Copy question" style="padding: 4px 8px; font-size: 0.75rem;">
                    📋 Copy
                  </button>
                </div>
              `;
            }).join('')}
          </div>

          <!-- Load More Trigger -->
          ${filtered.length > limit ? `
            <div style="text-align: center; margin: 24px 0;">
              <button class="btn btn-primary" onclick="AWFG_APP.loadMoreWysk()" style="padding: 10px 24px;">
                Load Next 60 Questions (${filtered.length - limit} Remaining) ➔
              </button>
            </div>
          ` : ''}
        </div>
      `;
    },

    setPaper(paper) {
      State.setPaperFilter(paper);
      WyskPage.render();
    },

    setTopic(topic) {
      const state = State.get();
      state.wyskTopic = topic;
      WyskPage.render();
    },

    setSearch(query) {
      const state = State.get();
      state.wyskSearch = query;
      WyskPage.render();
    },

    loadMore() {
      const state = State.get();
      state.wyskLimit = (state.wyskLimit || 60) + 60;
      WyskPage.render();
    },

    loadAll() {
      const state = State.get();
      state.wyskLimit = 2000;
      WyskPage.render();
    },

    toggleMaster(qId) {
      const state = State.get();
      if (!state.currentUser) State.ensureUser('Aspirant_2027', '');
      if (!state.currentUser.wyskMasterChecked) state.currentUser.wyskMasterChecked = {};

      state.currentUser.wyskMasterChecked[qId] = !state.currentUser.wyskMasterChecked[qId];
      State.saveStorage();
      WyskPage.render();
    }
  };

  window.AWFG_WYSK_PAGE = WyskPage;
})();
