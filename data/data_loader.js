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

  // Subject-to-Paper mapping
  const SUBJECT_PAPER_MAP = {
    'art_and_culture': 'GS-1',
    'modern_history': 'GS-1',
    'world_history': 'GS-1',
    'post_independence': 'GS-1',
    'geography': 'GS-1',
    'society': 'GS-1',
    'polity': 'GS-2',
    'governance': 'GS-2',
    'social_justice': 'GS-2',
    'international_relations': 'GS-2',
    'economy': 'GS-3',
    'agriculture': 'GS-3',
    'science_technology': 'GS-3',
    'environment': 'GS-3',
    'disaster_management': 'GS-3',
    'internal_security': 'GS-3',
    'ethics': 'GS-4',
    'essay': 'Essay'
  };

  const PAPER_SUBJECTS_MAP = {
    'GS-1': ['art_and_culture', 'modern_history', 'world_history', 'post_independence', 'geography', 'society'],
    'GS-2': ['polity', 'governance', 'social_justice', 'international_relations'],
    'GS-3': ['economy', 'agriculture', 'science_technology', 'environment', 'disaster_management', 'internal_security'],
    'GS-4': ['ethics'],
    'Essay': ['essay']
  };

  const CONTEXT_TO_SLUGS = {
    'art_and_culture': ['art_and_culture'],
    'art and culture': ['art_and_culture'],
    'arts & culture': ['art_and_culture'],
    'modern_history': ['modern_history'],
    'modern history': ['modern_history'],
    'world_history': ['world_history'],
    'world history': ['world_history'],
    'post_independence': ['post_independence'],
    'post independence': ['post_independence'],
    'geography': ['geography'],
    'society': ['society'],
    'indian society': ['society'],
    'polity': ['polity'],
    'indian polity': ['polity'],
    'governance': ['governance'],
    'social_justice': ['social_justice'],
    'social justice': ['social_justice'],
    'international_relations': ['international_relations'],
    'international relations': ['international_relations'],
    'ir': ['international_relations'],
    'economy': ['economy'],
    'economics': ['economy'],
    'economic development': ['economy'],
    'agriculture': ['agriculture'],
    'science_technology': ['science_technology'],
    'science & technology': ['science_technology'],
    'science and technology': ['science_technology'],
    'environment': ['environment'],
    'disaster_management': ['disaster_management'],
    'disaster management': ['disaster_management'],
    'internal_security': ['internal_security'],
    'internal security': ['internal_security'],
    'security': ['internal_security'],
    'ethics': ['ethics'],
    'essay': ['essay'],
    'gs-1': PAPER_SUBJECTS_MAP['GS-1'],
    'gs-2': PAPER_SUBJECTS_MAP['GS-2'],
    'gs-3': PAPER_SUBJECTS_MAP['GS-3'],
    'gs-4': PAPER_SUBJECTS_MAP['GS-4']
  };

  function resolveTargetSlugs(context) {
    if (!context) return Object.keys(SUBJECT_PAPER_MAP);
    const cNorm = String(context).toLowerCase().trim();
    if (CONTEXT_TO_SLUGS[cNorm]) return CONTEXT_TO_SLUGS[cNorm];

    const clean = cNorm.replace(/[^a-z0-9]/g, '');
    if (clean.includes('gs1') || clean.includes('paper1')) return PAPER_SUBJECTS_MAP['GS-1'];
    if (clean.includes('gs2') || clean.includes('paper2')) return PAPER_SUBJECTS_MAP['GS-2'];
    if (clean.includes('gs3') || clean.includes('paper3')) return PAPER_SUBJECTS_MAP['GS-3'];
    if (clean.includes('gs4') || clean.includes('paper4')) return PAPER_SUBJECTS_MAP['GS-4'];

    for (const k in CONTEXT_TO_SLUGS) {
      if (cNorm.includes(k) || k.includes(cNorm)) return CONTEXT_TO_SLUGS[k];
    }
    return Object.keys(SUBJECT_PAPER_MAP);
  }

  const STOP_WORDS = {
    'and': 1, 'the': 1, 'for': 1, 'with': 1, 'from': 1, 'under': 1,
    'which': 1, 'that': 1, 'this': 1, 'their': 1, 'other': 1, 'into': 1,
    'system': 1, 'issues': 1, 'india': 1, 'indian': 1, 'sector': 1,
    'development': 1, 'reforms': 1, 'structure': 1, 'framework': 1,
    'overview': 1, 'basis': 1, 'focus': 1, 'analysis': 1, 'between': 1
  };

  function getCleanTokens(str) {
    return (str || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length >= 3 && !STOP_WORDS[t]);
  }

  // Microtheme lookup function with Paper & Subject Scoping
  window.getMicrothemeQuestions = function(microthemeName, context) {
    if (!microthemeName) return { mains: [], prelims: [] };

    // Ensure indices are compiled
    if (!window.PRELIMS_QUESTIONS_DB || Object.keys(window.PRELIMS_QUESTIONS_DB).length === 0) {
      compileGlobalIndices();
    }

    const targetSlugs = resolveTargetSlugs(context);
    const isRestricted = context && targetSlugs.length < Object.keys(SUBJECT_PAPER_MAP).length;

    const rawClean = microthemeName.trim();
    const norm = rawClean.toLowerCase().replace(/[^a-z0-9]/g, '');
    const tokens = getCleanTokens(rawClean);

    function searchForQuestions(isPrelims) {
      const prop = isPrelims ? 'prelims' : 'mains';

      function searchInSlugs(slugs) {
        const candidates = [];
        for (const slug of slugs) {
          const sData = window.AWFG_SUBJECT_DATA[slug];
          if (!sData || !sData[prop]) continue;
          const db = sData[prop];

          for (const k in db) {
            const entry = db[k];
            const qs = entry.questions || [];
            if (qs.length === 0) continue;

            const eName = entry.name || '';
            const eNorm = eName.toLowerCase().replace(/[^a-z0-9]/g, '');
            const kNorm = k.toLowerCase().replace(/[^a-z0-9]/g, '');

            let score = 0;
            if (norm === kNorm || norm === eNorm) {
              score += 300;
            } else if (norm.length >= 10 && kNorm.length >= 10 && (norm.includes(kNorm) || kNorm.includes(norm))) {
              score += 100;
            }

            const eTokens = entry.tokens || getCleanTokens(eName);
            let tMatches = 0;
            for (let i = 0; i < tokens.length; i++) {
              const t = tokens[i];
              for (let j = 0; j < eTokens.length; j++) {
                const et = eTokens[j];
                if (t === et) {
                  tMatches += 3;
                  break;
                } else if (t.length >= 5 && et.length >= 5 && (t.slice(0, 5) === et.slice(0, 5) || t.includes(et) || et.includes(t))) {
                  tMatches += 2;
                  break;
                }
              }
            }
            score += tMatches * 10;

            if (score > 0) {
              candidates.push({ entry, score, slug });
            }
          }
        }

        candidates.sort((a, b) => b.score - a.score);
        if (candidates.length > 0 && candidates[0].score >= 20) {
          return candidates[0].entry.questions || [];
        }

        // Stem / text search WITHIN candidate slugs
        const scoredQs = [];
        const seen = new Set();
        for (const slug of slugs) {
          const sData = window.AWFG_SUBJECT_DATA[slug];
          if (!sData || !sData[prop]) continue;
          const db = sData[prop];

          for (const k in db) {
            const qs = db[k].questions || [];
            for (const q of qs) {
              const id = q.text || q.stem || '';
              if (!id || seen.has(id)) continue;
              seen.add(id);

              const txt = (isPrelims ? (q.stem + ' ' + (q.options || []).join(' ')) : (q.text || '')).toLowerCase();
              let qScore = 0;
              for (let t = 0; t < tokens.length; t++) {
                const tok = tokens[t];
                if (txt.includes(tok)) {
                  qScore += 3;
                } else if (tok.length >= 5 && txt.includes(tok.slice(0, 5))) {
                  qScore += 2;
                }
              }
              if (qScore > 0) {
                scoredQs.push({ q, score: qScore });
              }
            }
          }
        }

        scoredQs.sort((a, b) => b.score - a.score);
        if (scoredQs.length > 0 && scoredQs[0].score >= 3) {
          const top = scoredQs[0].score;
          return scoredQs.filter(sq => sq.score >= Math.max(3, top - 3)).slice(0, 15).map(sq => sq.q);
        }

        return [];
      }

      const hits = searchInSlugs(slugsForSearch(targetSlugs));
      if (hits.length > 0) return hits;
      if (!isRestricted) {
        return searchInSlugs(Object.keys(SUBJECT_PAPER_MAP));
      }
      return [];
    }

    function slugsForSearch(target) {
      return target;
    }

    const mains = searchForQuestions(false);
    const prelims = searchForQuestions(true);

    return { mains, prelims };
  };

  // Helper to recompile on demand
  window.recompileSubjectData = compileGlobalIndices;

})();
