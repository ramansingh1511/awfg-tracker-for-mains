// js/app.js - Master Application Orchestrator & Page Object Model Controller
// Connects State, Storage, Page Objects, and Components

(function() {
  'use strict';

  const Utils = window.AWFG_UTILS;
  const EventBus = window.AWFG_EVENT_BUS;
  const State = window.AWFG_STATE;
  const Storage = window.AWFG_STORAGE;
  const DashboardPage = window.AWFG_DASHBOARD_PAGE;
  const SchedulePage = window.AWFG_SCHEDULE_PAGE;
  const RoadmapPage = window.AWFG_ROADMAP_PAGE;
  const SynergyPage = window.AWFG_SYNERGY_PAGE;
  const WyskPage = window.AWFG_WYSK_PAGE;
  const MicrothemeModal = window.AWFG_MICROTHEME_MODAL;
  const TopperEngineView = window.AWFG_TOPPER_VIEW;
  const AnswerPadModal = window.AWFG_ANSWER_PAD;

  function renderView() {
    const state = State.get();

    // 1. Always update Dashboard KPI metrics
    if (DashboardPage) DashboardPage.render();

    // 2. Render active page object into #view-content
    const view = state.activeView;
    if (view === 'schedule') {
      if (SchedulePage) SchedulePage.render();
    } else if (view === 'roadmap') {
      if (RoadmapPage) RoadmapPage.render();
    } else if (view === 'matrix' || view === 'synergy') {
      if (SynergyPage) SynergyPage.render();
    } else if (view === 'wysk') {
      if (WyskPage) WyskPage.render();
    }
  }

  function initUI() {
    const state = State.get();

    // 1. Dashboard Events
    if (DashboardPage) DashboardPage.bindEvents();

    // 2. View Switcher Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.activeView = btn.dataset.view;
        State.saveStorage();
        renderView();
      });
    });

    // 3. Paper Filter Pills (Synced across all views including WYSK)
    document.querySelectorAll('.pill-btn[data-paper]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.pill-btn[data-paper]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const paper = btn.dataset.paper;
        State.setPaperFilter(paper);
        renderView();
      });
    });

    // 4. Status Filter Selector
    const statusSel = document.getElementById('status-filter-select');
    if (statusSel) {
      statusSel.addEventListener('change', (e) => {
        state.statusFilter = e.target.value;
        renderView();
      });
    }

    // 5. Live Search Input
    const searchInp = document.getElementById('search-query-input');
    if (searchInp) {
      searchInp.addEventListener('input', (e) => {
        State.setSearchQuery(e.target.value);
        renderView();
      });
    }

    // 6. Cadence Selector
    const cadenceSel = document.getElementById('cadence-selector');
    if (cadenceSel) {
      cadenceSel.value = state.currentUser ? state.currentUser.cadence : state.cadence;
      cadenceSel.addEventListener('change', (e) => {
        state.cadence = e.target.value;
        if (state.currentUser) {
          state.currentUser.cadence = e.target.value;
          State.saveStorage();
        }
        renderView();
        Utils.showToast(`Schedule cadence updated!`);
      });
    }

    // 7. Modals and Back to top
    initAuthModal();
    initBackupControls();
    initPyqModalEvents();
    initBackToTop();

    // 8. Render user badge and initial view
    renderUserBadge();
    renderView();
  }

  function renderUserBadge() {
    const badge = document.getElementById('user-badge-container');
    if (!badge) return;
    const state = State.get();
    if (state.currentUser) {
      const u = state.currentUser.username;
      badge.innerHTML = `
        <div class="user-badge">
          <div class="user-avatar">${u.charAt(0).toUpperCase()}</div>
          <span>${u}</span>
          <button class="btn btn-subtle btn-sm" id="auth-switch-btn" title="Switch account or logout">Switch</button>
        </div>
      `;
      const btn = document.getElementById('auth-switch-btn');
      if (btn) btn.addEventListener('click', openAuthModal);
    } else {
      badge.innerHTML = `
        <button class="btn btn-primary btn-sm" id="auth-login-btn">Sign In / Register</button>
      `;
      const btn = document.getElementById('auth-login-btn');
      if (btn) btn.addEventListener('click', openAuthModal);
    }
  }

  function openAuthModal() {
    const m = document.getElementById('auth-modal');
    if (m) m.classList.remove('hidden');
  }

  function closeAuthModal() {
    const m = document.getElementById('auth-modal');
    if (m) m.classList.add('hidden');
  }

  function initAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (!modal) return;

    const loginBtn = document.getElementById('modal-login-btn');
    const guestBtn = document.getElementById('modal-guest-btn');
    const closeBtn = document.getElementById('modal-close-btn');
    const usernameInp = document.getElementById('modal-username');
    const passwordInp = document.getElementById('modal-password');

    function handleLogin() {
      const u = (usernameInp ? usernameInp.value : '').trim();
      const p = passwordInp ? passwordInp.value : '';
      if (!u) {
        alert('Please enter an ID or Username');
        return;
      }
      State.ensureUser(u, p);
      closeAuthModal();
      renderUserBadge();
      renderView();
      Utils.showToast(`Welcome back, ${u}!`);
    }

    if (loginBtn) loginBtn.addEventListener('click', handleLogin);
    if (usernameInp) {
      usernameInp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleLogin();
      });
    }

    if (closeBtn) closeBtn.addEventListener('click', closeAuthModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeAuthModal();
    });

    if (guestBtn) {
      guestBtn.addEventListener('click', () => {
        State.ensureUser('Aspirant_2027', '');
        closeAuthModal();
        renderUserBadge();
        renderView();
        Utils.showToast('Logged in as Aspirant_2027!');
      });
    }

    // Default guest session if empty
    const state = State.get();
    if (!state.currentUser) {
      State.ensureUser('Aspirant_2027', '');
    }
  }

  function initBackupControls() {
    const exportBtn = document.getElementById('export-data-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => Storage.exportData());
    }

    const restoreInp = document.getElementById('restore-file-input');
    if (restoreInp) {
      restoreInp.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          Storage.restoreData(file, () => {
            renderUserBadge();
            renderView();
          });
        }
      });
    }

    const restoreBtn = document.getElementById('restore-data-btn');
    if (restoreBtn && restoreInp) {
      restoreBtn.addEventListener('click', () => restoreInp.click());
    }
  }

  function initPyqModalEvents() {
    const closeBtn = document.getElementById('pyq-modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => MicrothemeModal.close());
    }

    const modal = document.getElementById('pyq-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) MicrothemeModal.close();
      });
    }

    const mTabBtn = document.getElementById('pyq-tab-mains-btn');
    if (mTabBtn) {
      mTabBtn.addEventListener('click', () => MicrothemeModal.switchTab('mains'));
    }

    const pTabBtn = document.getElementById('pyq-tab-prelims-btn');
    if (pTabBtn) {
      pTabBtn.addEventListener('click', () => MicrothemeModal.switchTab('prelims'));
    }

    const searchInp = document.getElementById('pyq-search-inp');
    if (searchInp) {
      searchInp.addEventListener('input', (e) => {
        MicrothemeModal.setSearchFilter(e.target.value);
      });
    }
  }

  function initBackToTop() {
    const btn = document.getElementById('back-to-top-btn');
    if (!btn) return;

    window.addEventListener('scroll', () => {
      if (window.scrollY > 250) {
        btn.classList.remove('hidden');
      } else {
        btn.classList.add('hidden');
      }
    }, { passive: true });

    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Subscribe to EventBus updates
  EventBus.on('state:updated', () => renderView());

  // -------------------------------------------------------------
  // Public Global Facade (window.AWFG_APP) for Page Object Model
  // -------------------------------------------------------------
  window.AWFG_APP = {
    // Page Navigation & Views
    renderView: renderView,
    setFilterPaper: (paper) => State.setPaperFilter(paper),
    jumpToTest: (id) => SchedulePage.jumpToTest(id),

    // Microtheme Explorer Modal
    openPyqModal: (name, tab) => MicrothemeModal.open(name, tab),
    closePyqModal: () => MicrothemeModal.close(),
    switchPyqTab: (tab) => MicrothemeModal.switchTab(tab),

    // Topper Framing Engine & GS-1 Blueprints
    selectTopperLens: (mKey, id) => TopperEngineView.selectLens(mKey, id),
    insertTopperOutline: (mKey, id, marks) => TopperEngineView.insertOutline(mKey, id, marks),
    copyMainsOutline: (mKey, btn) => TopperEngineView.copyOutline(mKey, btn),
    toggleMainsApproach: (mKey) => TopperEngineView.toggle(mKey),
    renderComprehensiveBlueprintHtml: (mKey, q, marks, s) => TopperEngineView.renderBlueprintHtml(mKey, q, marks, s),

    // Answer Drafting Pad & Timers
    toggleAnswerPad: (mKey) => AnswerPadModal.toggle(mKey),
    toggleTimer: (mKey) => AnswerPadModal.toggleTimer(mKey),
    resetTimer: (mKey) => AnswerPadModal.resetTimer(mKey),
    handleMainsWordCount: (mKey, limit) => AnswerPadModal.handleWordCount(mKey, limit),
    saveMainsAnswer: (mKey) => AnswerPadModal.saveAnswer(mKey),
    copyMainsAnswer: (mKey) => AnswerPadModal.copyAnswer(mKey),
    insertTemplateToPad: (mKey, marks) => AnswerPadModal.insertTemplate(mKey, marks),

    // WYSK Question Bank Page
    setWyskPaper: (paper) => WyskPage.setPaper(paper),
    setWyskTopic: (topic) => WyskPage.setTopic(topic),
    setWyskSearch: (q) => WyskPage.setSearch(q),
    loadMoreWysk: () => WyskPage.loadMore(),
    loadAllWysk: () => WyskPage.loadAll(),
    toggleWyskMaster: (id) => WyskPage.toggleMaster(id),

    // Prelims Interactive Quiz
    attemptPrelims: (qKey, choice, correct) => MicrothemeModal.attemptPrelims(qKey, choice, correct),
    resetMicrothemeQuiz: () => MicrothemeModal.resetQuiz(),
    resetQuestionAttempt: (qKey) => MicrothemeModal.resetAttempt(qKey),

    // Common Utilities
    copyQuestion: (text, btn) => Utils.copyQuestion(text, btn),
    showToast: (msg, icon) => Utils.showToast(msg, icon),
    exportData: () => Storage.exportData(),
    restoreData: (file) => Storage.restoreData(file, renderView),
    getState: () => State.get()
  };

  // Bootstrap when DOM is loaded
  document.addEventListener('DOMContentLoaded', () => {
    State.loadStorage();
    initUI();
  });

})();
