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

    // 2. Substring match on key
    if (prelims.length === 0 && window.PRELIMS_QUESTIONS_DB) {
      for (const k in window.PRELIMS_QUESTIONS_DB) {
        if (k.length >= 6 && (norm.includes(k) || k.includes(norm))) {
          prelims = window.PRELIMS_QUESTIONS_DB[k].questions || [];
          break;
        }
      }
    }
    if (mains.length === 0 && window.MAINS_QUESTIONS_DB) {
      for (const k in window.MAINS_QUESTIONS_DB) {
        if (k.length >= 6 && (norm.includes(k) || k.includes(norm))) {
          mains = window.MAINS_QUESTIONS_DB[k].questions || [];
          break;
        }
      }
    }

    // 3. Fuzzy Stemming Overlap Search
    function findBestOverlap(db) {
      let bestScore = 0;
      let bestMatch = [];
      for (const k in db) {
        const entry = db[k];
        const eTokens = entry.tokens || (entry.name || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/);
        let score = 0;
        for (let i = 0; i < tokens.length; i++) {
          const t = tokens[i];
          for (let j = 0; j < eTokens.length; j++) {
            const et = eTokens[j];
            if (t === et || (t.length >= 5 && et.length >= 5 && (t.slice(0, 5) === et.slice(0, 5) || t.includes(et) || et.includes(t)))) {
              score++;
              break;
            }
          }
        }
        if (score > bestScore) {
          bestScore = score;
          bestMatch = entry.questions || [];
        }
      }
      return bestMatch;
    }

    if (prelims.length === 0 && window.PRELIMS_QUESTIONS_DB) {
      prelims = findBestOverlap(window.PRELIMS_QUESTIONS_DB);
    }
    if (mains.length === 0 && window.MAINS_QUESTIONS_DB) {
      mains = findBestOverlap(window.MAINS_QUESTIONS_DB);
    }

    // 4. Token Scoring Search in question texts/stems (ensures 100% microthemes hit)
    function searchByStemTokens(db, isPrelims) {
      if (!db || tokens.length === 0) return [];
      const scored = [];
      const seen = new Set();
      for (const k in db) {
        const qs = db[k].questions || [];
        for (const q of qs) {
          const id = q.text || q.stem || '';
          if (seen.has(id)) continue;
          seen.add(id);
          const txt = (isPrelims ? (q.stem + ' ' + (q.options || []).join(' ')) : (q.text || '')).toLowerCase();
          let count = 0;
          for (let i = 0; i < tokens.length; i++) {
            const tok = tokens[i];
            if (txt.includes(tok) || (tok.length >= 5 && txt.includes(tok.slice(0, 5)))) {
              count++;
            }
          }
          if (count > 0) {
            scored.push({ q, count });
          }
        }
      }
      scored.sort((a, b) => b.count - a.count);
      if (scored.length > 0) {
        const minCount = tokens.length <= 1 ? 1 : Math.min(2, scored[0].count);
        return scored.filter(s => s.count >= minCount).slice(0, 20).map(s => s.q);
      }
      return [];
    }

    if (prelims.length === 0 && window.PRELIMS_QUESTIONS_DB) {
      prelims = searchByStemTokens(window.PRELIMS_QUESTIONS_DB, true);
    }
    if (mains.length === 0 && window.MAINS_QUESTIONS_DB) {
      mains = searchByStemTokens(window.MAINS_QUESTIONS_DB, false);
    }

    return { mains, prelims };
  };

  // Helper to recompile on demand
  window.recompileSubjectData = compileGlobalIndices;

})();
