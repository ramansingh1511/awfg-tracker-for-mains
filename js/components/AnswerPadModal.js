// js/components/AnswerPadModal.js
// Page Object Component: Answer Drafting Pad, Timers & Word Counters

(function() {
  'use strict';

  const Utils = window.AWFG_UTILS;
  const State = window.AWFG_STATE;
  const mainsTimers = {};

  const AnswerPadModal = {
    toggle(mKey) {
      const pad = document.getElementById(`pad-${mKey}`);
      if (pad) {
        pad.classList.toggle('hidden');
        if (!pad.classList.contains('hidden')) {
          const ta = document.getElementById(`ta-${mKey}`);
          if (ta) ta.focus();
        }
      }
    },

    toggleTimer(mKey) {
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
    },

    resetTimer(mKey) {
      if (mainsTimers[mKey]) {
        clearInterval(mainsTimers[mKey].interval);
        mainsTimers[mKey] = { seconds: 0, interval: null, isRunning: false };
        const btn = document.getElementById(`tbtn-${mKey}`);
        const disp = document.getElementById(`tdisp-${mKey}`);
        if (btn) btn.textContent = '▶ Start Timer';
        if (disp) disp.textContent = '00:00';
      }
    },

    handleWordCount(mKey, targetLimit) {
      const ta = document.getElementById(`ta-${mKey}`);
      const countEl = document.getElementById(`wc-${mKey}`);
      if (!ta || !countEl) return;

      const words = (ta.value.trim().match(/\S+/g) || []).length;
      countEl.textContent = `${words} / ${targetLimit} Words`;

      if (words > targetLimit * 1.1) {
        countEl.style.color = '#ef4444';
      } else if (words >= targetLimit * 0.85) {
        countEl.style.color = '#10b981';
      } else {
        countEl.style.color = 'var(--text-muted)';
      }
    },

    saveAnswer(mKey) {
      const state = State.get();
      if (!state.currentUser) State.ensureUser('Aspirant_2027', '');
      if (!state.currentUser.mainsAnswers) state.currentUser.mainsAnswers = {};

      const ta = document.getElementById(`ta-${mKey}`);
      if (!ta) return;

      const text = ta.value;
      const words = (text.trim().match(/\S+/g) || []).length;

      state.currentUser.mainsAnswers[mKey] = {
        text: text,
        wordCount: words,
        savedAt: new Date().toISOString()
      };
      State.saveStorage();
      Utils.showToast(`Draft saved! (${words} words)`, '💾');
    },

    copyAnswer(mKey) {
      const ta = document.getElementById(`ta-${mKey}`);
      if (!ta || !ta.value.trim()) {
        Utils.showToast('Answer pad is empty!', '⚠️');
        return;
      }
      Utils.copyToClipboard(ta.value, null, 'Draft answer copied to clipboard!');
    },

    insertTemplate(mKey, marks) {
      const pad = document.getElementById(`pad-${mKey}`);
      const ta = document.getElementById(`ta-${mKey}`);
      if (!pad || !ta) return;

      pad.classList.remove('hidden');

      const card = document.getElementById(`mcard-${mKey}`);
      const stemEl = card ? card.querySelector('.pyq-stem-text') : null;
      const qText = stemEl ? stemEl.textContent : '';
      const modal = window.AWFG_MICROTHEME_MODAL;
      const subject = (modal && modal.currentData && modal.currentData.name) ? modal.currentData.name : '';

      let outline = '';
      if (window.TOPPER_ENGINE && window.TOPPER_ENGINE.getMarkdownOutline) {
        outline = window.TOPPER_ENGINE.getMarkdownOutline('aditya', qText, marks, subject);
      }

      if (ta.value.trim().length > 0) {
        if (confirm('Your answer pad already has text. Do you want to append the template outline at the bottom?')) {
          ta.value = ta.value + '\n\n' + outline;
        }
      } else {
        ta.value = outline;
      }

      const targetWords = (parseFloat(marks) >= 15) ? 250 : 150;
      AnswerPadModal.handleWordCount(mKey, targetWords);

      ta.scrollIntoView({ behavior: 'smooth', block: 'center' });
      ta.focus();
      Utils.showToast('Outline inserted into your Answer Pad!', '✍️');
    }
  };

  window.AWFG_ANSWER_PAD = AnswerPadModal;
})();
