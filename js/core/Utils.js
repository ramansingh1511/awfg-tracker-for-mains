// js/core/Utils.js
// Common utility functions: DOM helpers, string escaping, formatting, toasts

(function() {
  'use strict';

  const Utils = {
    escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    },

    escapeQuotes(str) {
      if (!str) return '';
      return String(str)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '&quot;');
    },

    formatDate(d) {
      if (!d || isNaN(d.getTime())) return 'N/A';
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    },

    getISO(d) {
      if (!d || isNaN(d.getTime())) return '';
      return d.toISOString().split('T')[0];
    },

    parseISO(str) {
      if (!str) return null;
      const parts = str.split('-');
      if (parts.length !== 3) return null;
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    },

    daysDiff(d1, d2) {
      const t1 = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate()).getTime();
      const t2 = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate()).getTime();
      return Math.round((t1 - t2) / 86400000);
    },

    showToast(message, icon = '✓') {
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
    },

    copyToClipboard(text, btnEl, successMsg = 'Copied to clipboard!') {
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
        Utils.showToast(successMsg, '📋');
        if (btnEl) {
          const original = btnEl.innerHTML;
          btnEl.innerHTML = '✓ Copied!';
          btnEl.classList.add('btn-copied');
          setTimeout(() => {
            btnEl.innerHTML = original;
            btnEl.classList.remove('btn-copied');
          }, 2000);
        }
      }).catch(err => {
        console.error('Clipboard copy failed:', err);
        Utils.showToast('Failed to copy to clipboard', '⚠️');
      });
    },

    copyQuestion(text, btnEl) {
      Utils.copyToClipboard(text, btnEl, 'Question text copied!');
    }
  };

  window.AWFG_UTILS = Utils;
})();
