// js/components/GeminiModal.js
// Page Object Component: Gemini AI Configuration & Testing Modal

(function() {
  'use strict';

  const Utils = window.AWFG_UTILS;
  const GeminiService = window.AWFG_GEMINI_SERVICE;

  const GeminiModal = {
    open(noticeMsg) {
      const modal = document.getElementById('gemini-modal');
      if (!modal) return;

      const inp = document.getElementById('gemini-api-key-inp');
      if (inp) {
        inp.value = GeminiService.getApiKey() || '';
        if (!inp._hasListener) {
          inp.addEventListener('input', () => GeminiModal.updateStatusDisplay());
          inp._hasListener = true;
        }
      }

      const modelSel = document.getElementById('gemini-model-select');
      if (modelSel) {
        modelSel.value = GeminiService.getModel();
      }

      const noticeEl = document.getElementById('gemini-modal-notice');
      if (noticeEl) {
        if (noticeMsg) {
          noticeEl.textContent = noticeMsg;
          noticeEl.classList.remove('hidden');
        } else {
          noticeEl.classList.add('hidden');
        }
      }

      GeminiModal.updateStatusDisplay();
      modal.classList.remove('hidden');
      if (inp) inp.focus();
    },

    close() {
      const modal = document.getElementById('gemini-modal');
      if (modal) modal.classList.add('hidden');
    },

    updateStatusDisplay() {
      const inp = document.getElementById('gemini-api-key-inp');
      const keyVal = inp ? inp.value.trim() : GeminiService.getApiKey();
      const statusEl = document.getElementById('gemini-key-status');
      if (!statusEl) return;

      if (!keyVal) {
        statusEl.innerHTML = `<span style="color: #f59e0b; font-weight: 600;">⚠️ No Key Configured (Get a free key from Google AI Studio)</span>`;
      } else if (keyVal.startsWith('AQ.')) {
        statusEl.innerHTML = `<span style="color: #ef4444; font-weight: 600;">⚠️ OAuth token ("AQ.") detected. AI Studio keys start with "AIzaSy..."</span>`;
      } else if (keyVal.startsWith('AIzaSy')) {
        statusEl.innerHTML = `<span style="color: #10b981; font-weight: 700;">✅ Valid AI Studio Key format</span> (${GeminiService.getModel()})`;
      } else {
        statusEl.innerHTML = `<span style="color: #10b981; font-weight: 700;">✅ Active Key Configured</span> (${GeminiService.getModel()})`;
      }
    },

    async testConnection() {
      const inp = document.getElementById('gemini-api-key-inp');
      const key = inp ? inp.value.trim() : GeminiService.getApiKey();
      const modelSel = document.getElementById('gemini-model-select');
      const model = modelSel ? modelSel.value : GeminiService.getModel();
      const statusEl = document.getElementById('gemini-test-result');
      
      if (!key) {
        if (statusEl) {
          statusEl.innerHTML = `<span style="color: #ef4444;">Please paste an API key first.</span>`;
        }
        return;
      }

      if (key.startsWith('AQ.')) {
        if (statusEl) {
          statusEl.innerHTML = `
            <div style="padding: 10px 12px; background: rgba(245, 158, 11, 0.15); border: 1px solid #f59e0b; border-radius: 6px; color: #f59e0b; font-size: 0.8rem; line-height: 1.45;">
              <strong>⚠️ Notice on API Key Format:</strong><br>
              The key entered starts with <code>AQ.</code> which is typically a Google Cloud OAuth token, not a Gemini API key.<br>
              Please go to <a href="https://aistudio.google.com/apikey" target="_blank" style="color: #818cf8; font-weight: 700; text-decoration: underline;">Google AI Studio</a>, click <strong>"Create API key"</strong>, and copy the key starting with <code>AIzaSy...</code>.
            </div>
          `;
        }
        return;
      }

      if (statusEl) {
        statusEl.innerHTML = `<span style="color: #818cf8;">⏳ Testing connection to Google Gemini API (${Utils.escapeHtml(model)})...</span>`;
      }

      try {
        await GeminiService.testApiKey(key, model);
        if (statusEl) {
          statusEl.innerHTML = `<span style="color: #10b981; font-weight: 700;">✅ Success! Google Gemini connected successfully using ${Utils.escapeHtml(model)}.</span>`;
        }
        Utils.showToast('Gemini API Connection Verified!', '✨');
      } catch (err) {
        if (statusEl) {
          statusEl.innerHTML = `<span style="color: #ef4444; font-weight: 600;">❌ Connection Failed: ${Utils.escapeHtml(err.message)}</span>`;
        }
        Utils.showToast('Gemini Connection Failed', '⚠️');
      }
    },

    saveSettings() {
      const inp = document.getElementById('gemini-api-key-inp');
      const key = inp ? inp.value.trim() : '';
      
      const modelSel = document.getElementById('gemini-model-select');
      const model = modelSel ? modelSel.value : 'gemini-1.5-flash';

      GeminiService.setApiKey(key);
      GeminiService.setModel(model);

      GeminiModal.updateStatusDisplay();
      GeminiModal.updateHeaderBadge();

      Utils.showToast(key ? 'Gemini AI configured successfully!' : 'Gemini API Key removed.', '✨');
      GeminiModal.close();
    },

    clearCache() {
      if (confirm('Clear all cached Gemini AI answers? Any previously generated answers will be fetched afresh.')) {
        const count = GeminiService.clearAllCache();
        Utils.showToast(`Cleared ${count} cached answers!`, '🗑️');
      }
    },

    updateHeaderBadge() {
      const btn = document.getElementById('gemini-config-btn');
      if (btn) {
        const hasKey = GeminiService.hasApiKey();
        if (hasKey) {
          btn.innerHTML = `✨ Gemini AI <span style="display:inline-block; width:7px; height:7px; border-radius:50%; background:#10b981; margin-left:3px;"></span>`;
          btn.style.borderColor = '#10b981';
          btn.style.color = '#10b981';
        } else {
          btn.innerHTML = `✨ Gemini AI`;
          btn.style.borderColor = '';
          btn.style.color = '';
        }
      }
    }
  };

  window.AWFG_GEMINI_MODAL = GeminiModal;
})();
