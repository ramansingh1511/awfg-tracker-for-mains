// js/components/MicrothemeModal.js
// Page Object Component: Microtheme PYQ Explorer Modal (Mains & Prelims Tabs)

(function() {
  'use strict';

  const Utils = window.AWFG_UTILS;
  const State = window.AWFG_STATE;

  const currentPyqData = {
    name: '',
    mains: [],
    prelims: [],
    activeTab: 'mains',
    filterText: ''
  };

  const MicrothemeModal = {
    get currentData() {
      return currentPyqData;
    },

    open(microthemeName, preferredTab, context) {
      if (!microthemeName) return;

      const qData = (window.getMicrothemeQuestions && typeof window.getMicrothemeQuestions === 'function')
        ? window.getMicrothemeQuestions(microthemeName, context)
        : { mains: [], prelims: [] };

      currentPyqData.name = microthemeName;
      currentPyqData.mains = qData.mains || [];
      currentPyqData.prelims = qData.prelims || [];
      currentPyqData.filterText = '';

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

      MicrothemeModal.updateTabsUI();
      MicrothemeModal.renderBody();

      const modal = document.getElementById('pyq-modal');
      if (modal) modal.classList.remove('hidden');
    },

    close() {
      const modal = document.getElementById('pyq-modal');
      if (modal) modal.classList.add('hidden');
    },

    switchTab(tab) {
      currentPyqData.activeTab = tab;
      MicrothemeModal.updateTabsUI();
      MicrothemeModal.renderBody();
    },

    updateTabsUI() {
      document.querySelectorAll('.pyq-tab-btn').forEach(btn => {
        if (btn.dataset.pyqTab === currentPyqData.activeTab) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    },

    setSearchFilter(text) {
      currentPyqData.filterText = (text || '').toLowerCase().trim();
      MicrothemeModal.renderBody();
    },

    renderBody() {
      const body = document.getElementById('pyq-modal-body');
      if (!body) return;

      const normMt = currentPyqData.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const filter = currentPyqData.filterText;
      const state = State.get();
      const userAttempts = (state.currentUser && state.currentUser.pyqAttempts) || {};
      const userMains = (state.currentUser && state.currentUser.mainsAnswers) || {};

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

          return `
            <div class="pyq-question-card mains" id="mcard-${mKey}" data-subject="${Utils.escapeHtml(q.subject || '')}">
              <div class="pyq-card-top">
                <div class="pyq-meta-badges">
                  <span class="pyq-year-badge">UPSC Mains ${q.year}</span>
                  <span class="pyq-marks-badge">${q.marks} Marks • ~${targetWords} words (${suggestedMinutes} mins)</span>
                  ${isAttempted ? `<span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #10b981; font-weight: 700;">✓ Answer Saved (${savedWords} words)</span>` : ''}
                </div>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                  <button class="btn btn-primary btn-sm" onclick="AWFG_APP.toggleMainsApproach('${mKey}')" style="background: linear-gradient(135deg, #4f46e5, #7c3aed); border: none; font-weight: 700; color: #fff;">
                    👑 Topper Answer
                  </button>
                  <button class="btn ${isAttempted ? 'btn-subtle' : 'btn-outline'} btn-sm" onclick="AWFG_APP.toggleAnswerPad('${mKey}')">
                    ✍️ ${isAttempted ? 'Edit Draft' : 'Draft Answer'}
                  </button>
                  <button class="btn btn-subtle btn-sm" onclick="AWFG_APP.copyQuestion('${Utils.escapeQuotes(q.text)}', this)" title="Copy question text">📋 Copy</button>
                </div>
              </div>
              <div class="pyq-stem-text" onclick="AWFG_APP.toggleMainsApproach('${mKey}')" style="cursor: pointer;" title="Click to view Topper Model Answer & Blueprint">${Utils.escapeHtml(q.text)}</div>

              <!-- Dynamic 5-Point GS-1 Blueprint & Topper Framing Engine -->
              <div id="approach-${mKey}" class="pyq-approach-box ${idx === 0 ? '' : 'hidden'}">
                ${window.AWFG_TOPPER_VIEW ? window.AWFG_TOPPER_VIEW.renderBlueprintHtml(mKey, q.text, q.marks, q.subject) : ''}
              </div>

              <!-- Expandable Answer Writing Pad -->
              <div id="pad-${mKey}" class="pyq-answer-pad ${isAttempted ? '' : 'hidden'}">
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

                <textarea id="ta-${mKey}" class="pyq-textarea" placeholder="Write your structured answer here (Introduction ➔ Body arguments, case laws, data ➔ Conclusion)..." oninput="AWFG_APP.handleMainsWordCount('${mKey}', ${targetWords})">${draft ? Utils.escapeHtml(draft.text) : ''}</textarea>

                <div class="pyq-pad-actions">
                  <div style="font-size: 0.78rem; color: var(--text-muted);">
                    ${draft ? `Saved on: ${draft.savedAt}` : 'Not saved yet'}
                  </div>
                  <div style="display: flex; gap: 8px;">
                    <button class="btn btn-subtle btn-sm" onclick="AWFG_APP.copyMainsAnswer('${mKey}')">📋 Copy Draft</button>
                    <button class="btn btn-primary btn-sm" onclick="AWFG_APP.saveMainsAnswer('${mKey}')">💾 Save Progress</button>
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
          const optList = q.options && q.options.length > 0 ? q.options : [];
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

              <div class="pyq-stem-text">${Utils.escapeHtml(q.stem || q.fullText)}</div>

              <div class="pyq-options-list">
                ${hasStructuredOpts ? optList.map((opt, optIdx) => {
                  const letterMatch = opt.match(/^\(([a-d])\)/i);
                  const optLetter = letterMatch ? letterMatch[1].toUpperCase() : ['A', 'B', 'C', 'D'][optIdx];
                  const optText = opt.replace(/^\([a-d]\)\s*/i, '');

                  let optClass = 'pyq-option-item';
                  if (isAttempted) {
                    if (optLetter === correctAns) optClass += ' option-correct';
                    else if (optLetter === att.selected) optClass += ' option-wrong';
                  }

                  return `
                    <div class="${optClass}" onclick="AWFG_APP.attemptPrelims('${qKey}', '${optLetter}', '${correctAns}')">
                      <span class="opt-letter">${optLetter}</span>
                      <span class="opt-text">${Utils.escapeHtml(optText)}</span>
                    </div>
                  `;
                }).join('') : `
                  <div style="display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap;">
                    ${['A', 'B', 'C', 'D'].map(letter => {
                      let btnClass = 'btn btn-outline btn-sm';
                      if (isAttempted) {
                        if (letter === correctAns) btnClass = 'btn btn-primary btn-sm';
                        else if (letter === att.selected) btnClass = 'btn btn-danger btn-sm';
                      }
                      return `
                        <button class="${btnClass}" onclick="AWFG_APP.attemptPrelims('${qKey}', '${letter}', '${correctAns}')">
                          Option (${letter})
                        </button>
                      `;
                    }).join('')}
                  </div>
                `}
              </div>

              ${isAttempted ? `
                <div class="pyq-explanation-box">
                  <strong>Official Key: Option (${correctAns})</strong>
                  <div style="margin-top: 4px; font-size: 0.82rem; color: var(--text-secondary);">
                    ${att.isCorrect ? '✅ Well done! You answered correctly.' : `⚠️ You selected Option (${att.selected}). Review official key rationale.`}
                  </div>
                  <button class="btn btn-subtle btn-sm" style="margin-top: 8px; font-size: 0.76rem;" onclick="AWFG_APP.resetQuestionAttempt('${qKey}')">
                    🔄 Re-attempt Question
                  </button>
                </div>
              ` : ''}
            </div>
          `;
        }).join('');

        body.innerHTML = scoreboardHtml + questionsHtml;
      }
    },

    attemptPrelims(qKey, choiceLetter, correctLetter) {
      const state = State.get();
      if (!state.currentUser) State.ensureUser('Aspirant_2027', '');
      if (!state.currentUser.pyqAttempts) state.currentUser.pyqAttempts = {};

      choiceLetter = choiceLetter.toUpperCase();
      correctLetter = (correctLetter || '').toUpperCase();
      const isCorrect = choiceLetter === correctLetter;
      const score = isCorrect ? 2.0 : -0.66;

      state.currentUser.pyqAttempts[qKey] = {
        selected: choiceLetter,
        correct: correctLetter,
        isCorrect: isCorrect,
        score: score,
        timestamp: Date.now()
      };
      State.saveStorage();

      if (isCorrect) {
        Utils.showToast(`✅ Correct! +2.00 Marks (Option ${choiceLetter})`, '🎉');
      } else {
        Utils.showToast(`❌ Incorrect (-0.66). Official Key is (${correctLetter})`, '⚠️');
      }

      MicrothemeModal.renderBody();
    },

    resetQuiz() {
      const state = State.get();
      if (!state.currentUser || !state.currentUser.pyqAttempts) return;
      const norm = currentPyqData.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const prefix = `p_${norm}_`;
      let count = 0;
      for (const k in state.currentUser.pyqAttempts) {
        if (k.startsWith(prefix)) {
          delete state.currentUser.pyqAttempts[k];
          count++;
        }
      }
      State.saveStorage();
      MicrothemeModal.renderBody();
      Utils.showToast(`Quiz reset! ${count} question attempts cleared.`);
    },

    resetAttempt(qKey) {
      const state = State.get();
      if (!state.currentUser || !state.currentUser.pyqAttempts) return;
      delete state.currentUser.pyqAttempts[qKey];
      State.saveStorage();
      MicrothemeModal.renderBody();
    }
  };

  window.AWFG_MICROTHEME_MODAL = MicrothemeModal;
})();
