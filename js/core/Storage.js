// js/core/Storage.js
// Export and Restore Backup Engine

(function() {
  'use strict';

  const State = window.AWFG_STATE;
  const Utils = window.AWFG_UTILS;
  const EventBus = window.AWFG_EVENT_BUS;

  const Storage = {
    exportData() {
      const state = State.get();
      const backup = {
        version: '3.2',
        exportedAt: new Date().toISOString(),
        users: state.users,
        currentUser: state.currentUser ? state.currentUser.username : 'default'
      };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `awfg_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      Utils.showToast('Progress exported successfully!', '💾');
    },

    restoreData(file, callback) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          if (data && data.users) {
            const state = State.get();
            state.users = data.users;
            if (data.currentUser && state.users[data.currentUser]) {
              state.currentUser = state.users[data.currentUser];
            } else {
              const first = Object.keys(state.users)[0];
              if (first) state.currentUser = state.users[first];
            }
            State.saveStorage();
            Utils.showToast('Progress restored successfully!', '✅');
            if (callback) callback();
            EventBus.emit('state:updated', state);
          } else {
            Utils.showToast('Invalid backup file format.', '⚠️');
          }
        } catch (err) {
          console.error('Restore failed:', err);
          Utils.showToast('Error parsing backup file.', '❌');
        }
      };
      reader.readAsText(file);
    }
  };

  window.AWFG_STORAGE = Storage;
})();
