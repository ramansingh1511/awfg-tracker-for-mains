// js/pages/SynergyPage.js
// Page Object: Prelims vs Mains Microthemes Synergy Matrix

(function() {
  'use strict';

  const State = window.AWFG_STATE;
  const Utils = window.AWFG_UTILS;

  const SynergyPage = {
    render() {
      const container = document.getElementById('view-content');
      if (!container) return;

      const prelims = window.MASTER_PRELIMS_CATALOG || {};
      const state = State.get();
      const searchQ = (state.searchQuery || '').toLowerCase();

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
      if (state.paperFilter !== 'ALL') {
        subjectKeys = subjectKeys.filter(sub => SUBJECT_PAPER_MAP[sub] === state.paperFilter);
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
                <span class="microtheme-clickable" onclick="AWFG_APP.openPyqModal('${Utils.escapeQuotes(item.name)}', '${isCoinciding ? 'mains' : 'prelims'}')" title="Click to open all questions">${item.name}</span>
              </td>
              <td><span class="qs-pill">${item.qs} Qs</span></td>
              <td>
                <span class="status-badge ${isCoinciding ? 'completed' : 'delayed'} microtheme-clickable" onclick="AWFG_APP.openPyqModal('${Utils.escapeQuotes(item.name)}', '${isCoinciding ? 'mains' : 'prelims'}')" style="font-size: 0.72rem; cursor: pointer;" title="Click to view ${isCoinciding ? 'Mains' : 'Prelims'} questions">
                  ${isCoinciding ? '🔗 Overlaps with Mains' : '⚡ Prelims-Exclusive'}
                </span>
              </td>
              <td style="color: var(--text-secondary); font-size: 0.82rem;">
                ${isCoinciding ? 
                  'Direct conceptual overlap in GS Mains tests. Use factual details as illustrations in Mains answers.' : 
                  'Distinct factual focus (articles, lists, geographical locations, treaties, definitions). Revise via flashnotes.'}
              </td>
              <td>
                <button class="pyq-pill-trigger" onclick="AWFG_APP.openPyqModal('${Utils.escapeQuotes(item.name)}', '${isCoinciding ? 'mains' : 'prelims'}')">👁️ View PYQs</button>
              </td>
            </tr>
          `;
        });
      });

      container.innerHTML = `
        <div class="matrix-view">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px; margin-bottom: 12px;">
            <div>
              <h2>🔄 Prelims vs Mains Microthemes Synergy Matrix</h2>
              <p style="color: var(--text-secondary); font-size: 0.88rem; margin: 4px 0 0;">
                Filtering by <strong>${state.paperFilter === 'ALL' ? 'All Papers' : state.paperFilter}</strong> • ${totalMatchingItems} Microthemes displayed.
              </p>
            </div>
            <div style="display: flex; gap: 10px; font-size: 0.8rem;">
              <span class="status-badge completed">🔗 Overlaps with Mains (~50-60%)</span>
              <span class="status-badge delayed">⚡ Prelims Exclusive Focus (~40-50%)</span>
            </div>
          </div>

          <div class="table-container">
            <table class="matrix-table">
              <thead>
                <tr>
                  <th style="width: 140px;">Subject & Paper</th>
                  <th style="width: 260px;">Prelims Microtheme</th>
                  <th style="width: 80px;">Weight</th>
                  <th style="width: 170px;">Mains Overlap Status</th>
                  <th>Synergy Rationale & Revision Strategy</th>
                  <th style="width: 110px;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml || `<tr><td colspan="6" style="text-align:center; padding: 30px; color: var(--text-secondary);">No microthemes found matching "${state.searchQuery}".</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }
  };

  window.AWFG_SYNERGY_PAGE = SynergyPage;
})();
