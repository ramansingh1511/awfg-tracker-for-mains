// data/data_loader.js
// Aggregates modular subject data into unified lookup indices

(function() {
  window.AWFG_SUBJECT_DATA = window.AWFG_SUBJECT_DATA || {};

  function compileGlobalIndices() {
    const prelimsDb = {};
    const mainsDb = {};
    const allWysk = [];

    // Iterate through all registered subjects
    for (const [slug, subject] of Object.entries(window.AWFG_SUBJECT_DATA)) {
      if (subject.prelims) {
        for (const [k, v] of Object.entries(subject.prelims)) {
          prelimsDb[k] = v;
        }
      }
      if (subject.mains) {
        for (const [k, v] of Object.entries(subject.mains)) {
          mainsDb[k] = v;
        }
      }
      if (subject.wysk && Array.isArray(subject.wysk)) {
        allWysk.push(...subject.wysk);
      }
    }

    // Attach to window
    window.PRELIMS_QUESTIONS_DB = prelimsDb;
    window.MAINS_QUESTIONS_DB = mainsDb;
    window.ALL_WYSK_QUESTIONS = allWysk;
    window.QUESTIONS_DATA = {
      prelims: prelimsDb,
      mains: mainsDb,
      wysk: allWysk
    };

    return { prelimsDb, mainsDb, allWysk };
  }

  // Compile indices immediately from loaded subjects
  compileGlobalIndices();

  // Topper Answers Master Database Compiler
  window.AWFG_TOPPER_ANSWERS = window.AWFG_TOPPER_ANSWERS || {};
  window.AWFG_TOPPER_ANSWERS_DB = window.AWFG_TOPPER_ANSWERS_DB || {};

  function compileTopperAnswers() {
    window.AWFG_TOPPER_ANSWERS_DB = window.AWFG_TOPPER_ANSWERS_DB || {};
    if (window.AWFG_TOPPER_ANSWERS) {
      for (const [subj, data] of Object.entries(window.AWFG_TOPPER_ANSWERS)) {
        for (const [k, ans] of Object.entries(data)) {
          window.AWFG_TOPPER_ANSWERS_DB[k] = ans;
          if (ans.q) {
            const normQ = ans.q.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 80);
            window.AWFG_TOPPER_ANSWERS_DB[normQ] = ans;
          }
        }
      }
    }
    return window.AWFG_TOPPER_ANSWERS_DB;
  }
  window.compileTopperAnswers = compileTopperAnswers;
  compileTopperAnswers();

  // Microtheme lookup function
  window.getMicrothemeQuestions = function(microthemeName) {
    if (!microthemeName) return { mains: [], prelims: [] };

    // Ensure indices are compiled
    if (!window.PRELIMS_QUESTIONS_DB || Object.keys(window.PRELIMS_QUESTIONS_DB).length === 0) {
      compileGlobalIndices();
    }

    const rawClean = microthemeName.trim();
    const norm = rawClean.toLowerCase().replace(/[^a-z0-9]/g, '');
    const tokens = rawClean.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2 && !['and', 'the', 'for', 'with', 'from', 'under'].includes(t));

    let prelims = [];
    let mains = [];

    // 1. Direct normalized key match
    if (window.PRELIMS_QUESTIONS_DB && window.PRELIMS_QUESTIONS_DB[norm]) {
      prelims = window.PRELIMS_QUESTIONS_DB[norm].questions || [];
    }
    if (window.MAINS_QUESTIONS_DB && window.MAINS_QUESTIONS_DB[norm]) {
      mains = window.MAINS_QUESTIONS_DB[norm].questions || [];
    }

    // 2. Fuzzy Token Overlap Search
    if (prelims.length === 0 && window.PRELIMS_QUESTIONS_DB) {
      let bestScore = 0;
      let bestMatch = [];
      for (const k in window.PRELIMS_QUESTIONS_DB) {
        const entry = window.PRELIMS_QUESTIONS_DB[k];
        const eTokens = entry.tokens || entry.name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/);
        const overlap = tokens.filter(t => eTokens.includes(t));
        const score = overlap.length;
        if (score > bestScore && (score >= 2 || (tokens.length === 1 && score === 1))) {
          bestScore = score;
          bestMatch = entry.questions || [];
        }
      }
      if (bestMatch.length > 0) prelims = bestMatch;
    }

    if (mains.length === 0 && window.MAINS_QUESTIONS_DB) {
      let bestScore = 0;
      let bestMatch = [];
      for (const k in window.MAINS_QUESTIONS_DB) {
        const entry = window.MAINS_QUESTIONS_DB[k];
        const eTokens = entry.tokens || entry.name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/);
        const overlap = tokens.filter(t => eTokens.includes(t));
        const score = overlap.length;
        if (score > bestScore && (score >= 2 || (tokens.length === 1 && score === 1))) {
          bestScore = score;
          bestMatch = entry.questions || [];
        }
      }
      if (bestMatch.length > 0) mains = bestMatch;
    }

    // 3. Fallback: Search question stems / texts directly if still empty
    if (prelims.length === 0 && tokens.length > 0 && window.PRELIMS_QUESTIONS_DB) {
      const hits = [];
      for (const k in window.PRELIMS_QUESTIONS_DB) {
        const qs = window.PRELIMS_QUESTIONS_DB[k].questions || [];
        for (const q of qs) {
          const txt = (q.stem + ' ' + (q.options || []).join(' ')).toLowerCase();
          if (tokens.every(t => txt.includes(t))) {
            hits.push(q);
          }
        }
        if (hits.length >= 10) break;
      }
      if (hits.length > 0) prelims = hits;
    }

    if (mains.length === 0 && tokens.length > 0 && window.MAINS_QUESTIONS_DB) {
      const hits = [];
      for (const k in window.MAINS_QUESTIONS_DB) {
        const qs = window.MAINS_QUESTIONS_DB[k].questions || [];
        for (const q of qs) {
          const txt = (q.text || '').toLowerCase();
          if (tokens.every(t => txt.includes(t))) {
            hits.push(q);
          }
        }
        if (hits.length >= 10) break;
      }
      if (hits.length > 0) mains = hits;
    }

    return { mains, prelims };
  };

  // Helper to recompile on demand
  window.recompileSubjectData = compileGlobalIndices;

})();
