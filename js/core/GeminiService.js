// js/core/GeminiService.js
// Client-Side Google Gemini API Integration for UPSC CSE Mains Answer Generation
// Enforces 5-Point UPSC Framework & Topper Archetype Presentation Filters

(function() {
  'use strict';

  const STORAGE_KEY_API_KEY = 'awfg_gemini_api_key';
  const STORAGE_KEY_MODEL = 'awfg_gemini_model';
  const CACHE_PREFIX = 'awfg_gemini_cache_';
  const DEFAULT_MODEL = 'gemini-1.5-flash';

  const TOPPER_RULES = {
    aditya: {
      name: 'Aditya Srivastava (IAS, AIR 1)',
      style: 'Rectangular boxed subheadings [ 1. Title ], causal chains with arrows (Premise ──► Mechanism ──► Direct Impact), underlined keywords, hard empirical data/stat benchmarks, and ASCII Causal Branching Tree.',
      diagramType: 'Causal Branching Tree or Institutional Flow Matrix'
    },
    ruhani: {
      name: 'Ruhani (IAS, AIR 5)',
      style: 'Two-Column Parallel Comparative Table (Left: Enablers / Strides vs Right: Ground Friction / Structural Gaps), labeled figures (Fig 1, Fig 2), spatial mapping, and administrative decentralization.',
      diagramType: 'Parallel Cross-Section / Comparative Split Flow with Labeled Figures (Fig 1, Fig 2)'
    },
    ishita: {
      name: 'Ishita Kishore (IAS, AIR 1)',
      style: 'Connecting bridge sentences, Roman numeral sub-sections (-i-, -ii-, -iii-), human-centric impact on vulnerable groups, and Sociological Vicious/Virtuous Cycle diagram.',
      diagramType: 'Central Hub-and-Spoke / Sociological Vicious Cycle'
    },
    umaharathi: {
      name: 'Umaharathi N (IAS, AIR 3)',
      style: 'Dialectical 2-way balance, affirmative constitutional strides vs unresolved systemic bottlenecks, cooperative federalism, and institutional checks.',
      diagramType: 'Dialectical Balance / Two-Way Bifurcation Matrix'
    },
    medha: {
      name: 'Medha Anand (IAS, AIR 13)',
      style: 'Scientific constants, thermodynamic / topographic vertical profiles, contour sketches, micro-climatic zoning, and Sendai Framework disaster resilience.',
      diagramType: 'Thermodynamic Vertical Profile / Spatial Cross-Section Contour'
    },
    anmol: {
      name: 'Anmol Rathore (IAS, AIR 7)',
      style: 'Prominent boxed governing equation or constitutional triad, structured through a 3-Phase Generational Evolution Ladder (Phase 1.0 Formative ──► Phase 2.0 Modernization ──► Phase 3.0 Sustainable Synthesis).',
      diagramType: 'Generational Evolution Ladder / 3-Phase Continuum Flow'
    }
  };

  const GeminiService = {
    getApiKey() {
      return localStorage.getItem(STORAGE_KEY_API_KEY) || '';
    },

    setApiKey(key) {
      if (!key) {
        localStorage.removeItem(STORAGE_KEY_API_KEY);
      } else {
        localStorage.setItem(STORAGE_KEY_API_KEY, key.trim());
      }
    },

    hasApiKey() {
      const k = this.getApiKey();
      return k && k.length > 10;
    },

    getModel() {
      const stored = localStorage.getItem(STORAGE_KEY_MODEL);
      if (!stored || stored === 'gemini-2.0-flash') {
        localStorage.setItem(STORAGE_KEY_MODEL, DEFAULT_MODEL);
        return DEFAULT_MODEL;
      }
      return stored;
    },

    setModel(model) {
      const val = (!model || model === 'gemini-2.0-flash') ? DEFAULT_MODEL : model;
      localStorage.setItem(STORAGE_KEY_MODEL, val);
    },

    getCacheKey(qText, topperKey) {
      const clean = (qText || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60);
      return `${CACHE_PREFIX}${clean}_${topperKey || 'aditya'}`;
    },

    getCachedAnswer(qText, topperKey) {
      try {
        const key = this.getCacheKey(qText, topperKey);
        const item = localStorage.getItem(key);
        if (item) return JSON.parse(item);
      } catch (e) {
        console.warn('Gemini cache read error:', e);
      }
      return null;
    },

    saveCachedAnswer(qText, topperKey, data) {
      try {
        const key = this.getCacheKey(qText, topperKey);
        localStorage.setItem(key, JSON.stringify(data));
      } catch (e) {
        console.warn('Gemini cache write error:', e);
      }
    },

    clearAllCache() {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(CACHE_PREFIX)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      return keysToRemove.length;
    },

    async testApiKey(key, modelOverride) {
      const testKey = key || this.getApiKey();
      if (!testKey) throw new Error('No API Key provided');

      if (testKey.startsWith('AQ.')) {
        throw new Error("The key you pasted starts with 'AQ.' which appears to be a Google Cloud access token rather than a Gemini API Key. Google AI Studio API Keys start with 'AIzaSy...'. Please copy your key from aistudio.google.com/apikey");
      }

      let model = modelOverride || this.getModel() || DEFAULT_MODEL;
      if (model === 'gemini-2.0-flash') {
        model = 'gemini-1.5-flash';
      }

      const callEndpoint = async (targetModel) => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${encodeURIComponent(testKey)}`;
        const payload = {
          contents: [{ parts: [{ text: 'Respond with OK' }] }],
          generationConfig: { maxOutputTokens: 10, temperature: 0.1 }
        };
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!resp.ok) {
          const errJson = await resp.json().catch(() => ({}));
          const msg = errJson.error ? errJson.error.message : `HTTP ${resp.status}: ${resp.statusText}`;
          throw new Error(msg);
        }
        const resJson = await resp.json();
        return !!(resJson.candidates && resJson.candidates.length > 0);
      };

      try {
        return await callEndpoint(model);
      } catch (err) {
        if (model !== 'gemini-1.5-flash' && (err.message.includes('not found') || err.message.includes('no longer available'))) {
          // Automatic fallback to gemini-1.5-flash
          const success = await callEndpoint('gemini-1.5-flash');
          this.setModel('gemini-1.5-flash');
          return success;
        }
        throw err;
      }
    },

    buildPrompt(qText, marks, subject, topperKey) {
      const topper = TOPPER_RULES[topperKey] || TOPPER_RULES.aditya;
      const targetWords = (parseFloat(marks) >= 15) ? 250 : 150;
      const suggestedMins = (parseFloat(marks) >= 15) ? 11 : 7;

      return `
You are an expert UPSC Civil Services Examination (Mains) Evaluator and Topper Copy Calibrator.

Analyze the following UPSC Mains Question from the perspective of high-scoring CSE Mains evaluation:
QUESTION: "${qText}"
MARKS: ${marks} Marks (${targetWords} words, ${suggestedMins} minutes)
SUBJECT DOMAIN: ${subject || 'UPSC General Studies'}
ACTIVE TOPPER ARCHETYPE: ${topper.name}
PRESENTATION FILTER: ${topper.style}

Craft a comprehensive, analytical, highly scoring response strictly adhering to the 5-Point UPSC Framework and presentation filtered through ${topper.name}'s copy style.

REQUIREMENTS:
1. Simplify the Question: Clarify directive (e.g. Examine, Discuss, Critically Analyze), breakdown explicit and implicit demands.
2. Approach Framework:
   - 3 Ready-to-write Intros (Option 1: Disciplinary/Definition, Option 2: Comparative/Structural, Option 3: Contemporary/Policy).
   - Hand-drawable Smart Art Copy Diagram (clean text ASCII diagram with boxes and arrows) suitable for direct hand drawing on an answer sheet, with 1-Minute Copy Sketch Guide.
   - Exact Body Subheadings with rigorous causal chains (Premise ──► Mechanism ──► Direct Impact) and specific empirical/case evidence.
   - Balanced Concluding Synthesis.
3. High-Yield Value Additions:
   - Standard sources (NCERTs, standard disciplinary books).
   - Authoritative data, government reports (NITI Aayog, IMD, IPCC, RBI, Law Commission, etc.).
   - Landmark Supreme Court cases or statutory provisions where applicable.
4. Model Topper Answer:
   - Present the answer exactly in ${topper.name}'s signature presentation archetype (${topper.style}).
5. Critical Evaluation & Modern India Linkage:
   - Linking historical, cultural, or societal relevance to 21st-century India's modern challenges and policy roadmap.

Return ONLY a valid JSON object matching this schema (no markdown fences, no conversational prose):
{
  "paperLabel": "GS-1 / GS-2 / GS-3 / GS-4 Disciplinary Domain",
  "directive": "Examine / Discuss / etc.",
  "directiveGuidance": "Detailed directive explanation",
  "explicitDemands": "Explicit demands deconstructed",
  "implicitDemands": "Implicit demands deconstructed",
  "intros": [
    { "type": "Option 1: Foundational / Disciplinary Hook", "text": "..." },
    { "type": "Option 2: Comparative / Structural Hook", "text": "..." },
    { "type": "Option 3: Contemporary Policy Hook", "text": "..." }
  ],
  "diagramTitle": "${topper.diagramType}: ...",
  "diagramVisual": "Plain text ASCII diagram with boxes (┌──┐) and arrows (──►)",
  "diagramSketchInstructions": "Step 1... Step 2... Step 3...",
  "headings": [
    {
      "title": "1. Subheading formatted in ${topper.name}'s style",
      "points": [
        "Causal Chain ──► Mechanism ──► Direct Impact (Evidence: ...)",
        "..."
      ]
    },
    {
      "title": "2. Subheading...",
      "points": ["..."]
    },
    {
      "title": "3. Subheading...",
      "points": ["..."]
    }
  ],
  "valueAdds": [
    "Source 1: ...",
    "Empirical Metric: ...",
    "Statutory/Case Precedent: ..."
  ],
  "interPaper": {
    "gs1": "Linkage to GS-1...",
    "gs2": "Linkage to GS-2...",
    "gs3": "Linkage to GS-3...",
    "gs4": "Linkage to GS-4..."
  },
  "signatureConclusion": "Balanced concluding synthesis...",
  "evaluation": "Critical evaluation & Modern India linkage..."
}
`;
    },

    async generateTopperAnswer(qText, marks, subject, topperKey) {
      const apiKey = this.getApiKey();
      if (!apiKey) {
        throw new Error('NO_API_KEY');
      }

      // 1. Check local cache first
      const cached = this.getCachedAnswer(qText, topperKey);
      if (cached) {
        return { data: cached, isFromCache: true };
      }

      let model = this.getModel();
      if (model === 'gemini-2.0-flash') {
        model = 'gemini-1.5-flash';
      }

      const prompt = this.buildPrompt(qText, marks, subject, topperKey);
      const executeCall = async (targetModel) => {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const payload = {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2500,
            responseMimeType: 'application/json'
          }
        };

        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!resp.ok) {
          const errJson = await resp.json().catch(() => ({}));
          const msg = (errJson.error && errJson.error.message) ? errJson.error.message : `HTTP error ${resp.status}`;
          throw new Error(msg);
        }
        return await resp.json();
      };

      let resJson;
      try {
        resJson = await executeCall(model);
      } catch (err) {
        if (model !== 'gemini-1.5-flash' && (err.message.includes('not found') || err.message.includes('no longer available'))) {
          resJson = await executeCall('gemini-1.5-flash');
          model = 'gemini-1.5-flash';
          this.setModel('gemini-1.5-flash');
        } else {
          throw err;
        }
      }
      const candidate = resJson.candidates && resJson.candidates[0];
      if (!candidate || !candidate.content || !candidate.content.parts || !candidate.content.parts[0]) {
        throw new Error('Gemini API returned an empty candidate response.');
      }

      let rawText = candidate.content.parts[0].text || '';
      rawText = rawText.trim();
      
      // Clean possible markdown code fences if responseMimeType wasn't respected
      if (rawText.startsWith('```json')) {
        rawText = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      } else if (rawText.startsWith('```')) {
        rawText = rawText.replace(/^```\s*/i, '').replace(/```\s*$/, '').trim();
      }

      let parsed;
      try {
        parsed = JSON.parse(rawText);
      } catch (err) {
        console.error('Failed to parse Gemini JSON output:', rawText);
        throw new Error('Gemini response could not be parsed as structured JSON. Please try again.');
      }

      // Normalize fields
      parsed.targetWords = (parseFloat(marks) >= 15) ? 250 : 150;
      parsed.suggestedTime = (parseFloat(marks) >= 15) ? 11 : 7;
      parsed.topperKey = topperKey || 'aditya';
      parsed.generatedAt = new Date().toISOString();
      parsed.modelUsed = model;

      // Save to cache
      this.saveCachedAnswer(qText, topperKey, parsed);

      return { data: parsed, isFromCache: false };
    }
  };

  window.AWFG_GEMINI_SERVICE = GeminiService;
})();
