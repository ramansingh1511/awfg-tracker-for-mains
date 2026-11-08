// js/components/TopperEngineView.js
// Page Object Component: 5-Point UPSC Blueprint & Topper Framing Engine with Live Gemini Integration

(function() {
  'use strict';

  const Utils = window.AWFG_UTILS;
  const activeTopperByMKey = {};

  const TopperEngineView = {
    toggle(mKey) {
      const el = document.getElementById(`approach-${mKey}`);
      if (el) {
        el.classList.toggle('hidden');
      }
    },

    getActiveTopperKey(mKey) {
      return activeTopperByMKey[mKey] || 'aditya';
    },

    selectLens(mKey, topperKey) {
      const card = document.getElementById(`mcard-${mKey}`);
      const stemEl = card ? card.querySelector('.pyq-stem-text') : null;
      const qText = stemEl ? stemEl.textContent : '';
      const marksBadge = card ? card.querySelector('.pyq-marks-badge') : null;
      const marksMatch = marksBadge ? marksBadge.textContent.match(/(\d+(?:\.\d+)?)\s*Marks/) : null;
      const marks = marksMatch ? parseFloat(marksMatch[1]) : 10;
      const modal = window.AWFG_MICROTHEME_MODAL;
      const subject = (card && card.dataset.subject) 
        ? card.dataset.subject 
        : ((modal && modal.currentData && modal.currentData.name) ? modal.currentData.name : '');

      activeTopperByMKey[mKey] = topperKey;

      // Re-render the full blueprint to update Gemini presentation filter & Archetype view
      const approachBox = document.getElementById(`approach-${mKey}`);
      if (approachBox && !approachBox.classList.contains('hidden')) {
        approachBox.innerHTML = TopperEngineView.renderBlueprintHtml(mKey, qText, marks, subject);
      }
    },

    formatGeminiMarkdown(data, topperName) {
      let md = `## UPSC CSE Mains Answer [Calibrated by Gemini 2.0 Flash via ${topperName}'s Archetype]\n\n`;
      md += `### 1. Demand Deconstruction\n`;
      md += `- **Directive:** ${data.directive} (${data.directiveGuidance || data.directiveMeaning})\n`;
      if (data.explicitDemands) md += `- **Explicit Demands:** ${data.explicitDemands}\n`;
      if (data.implicitDemands) md += `- **Implicit Demands:** ${data.implicitDemands}\n\n`;

      if (data.intros && data.intros.length > 0) {
        md += `### 2. Introduction (${data.intros[0].type})\n`;
        md += `${data.intros[0].text}\n\n`;
      }

      if (data.diagramVisual) {
        md += `### 3. Smart Art Diagram: ${data.diagramTitle || 'Hand-Drawn Visual'}\n`;
        md += `\`\`\`\n${data.diagramVisual}\n\`\`\`\n`;
        if (data.diagramSketchInstructions) {
          md += `*Sketch Guide: ${data.diagramSketchInstructions}*\n\n`;
        }
      }

      if (data.headings && data.headings.length > 0) {
        md += `### 4. Main Body Subheadings & Evidence\n`;
        data.headings.forEach(h => {
          md += `#### ${h.title}\n`;
          (h.points || []).forEach(p => {
            const pText = typeof p === 'string' ? p : `${p.causalChain} (Evidence: ${p.evidence})`;
            md += `- ${pText}\n`;
          });
          md += `\n`;
        });
      }

      if (data.valueAdds && data.valueAdds.length > 0) {
        md += `### 5. High-Yield Value Additions\n`;
        data.valueAdds.forEach(va => {
          md += `- ${va}\n`;
        });
        md += `\n`;
      }

      if (data.signatureConclusion || data.conclusion) {
        md += `### 6. Signature Concluding Synthesis\n`;
        md += `${data.signatureConclusion || data.conclusion}\n\n`;
      }

      if (data.evaluation) {
        md += `### 7. Critical Evaluation & Modern India Linkage\n`;
        md += `${data.evaluation}\n`;
      }

      return md;
    },

    insertOutline(mKey, topperKey, marks) {
      const pad = document.getElementById(`pad-${mKey}`);
      const ta = document.getElementById(`ta-${mKey}`);
      if (!pad || !ta) return;

      pad.classList.remove('hidden');

      const card = document.getElementById(`mcard-${mKey}`);
      const stemEl = card ? card.querySelector('.pyq-stem-text') : null;
      const qText = stemEl ? stemEl.textContent : '';
      const modal = window.AWFG_MICROTHEME_MODAL;
      const subject = (card && card.dataset.subject) 
        ? card.dataset.subject 
        : ((modal && modal.currentData && modal.currentData.name) ? modal.currentData.name : '');

      const GeminiService = window.AWFG_GEMINI_SERVICE;
      const cachedGemini = GeminiService ? GeminiService.getCachedAnswer(qText, topperKey) : null;
      let outline = '';
      let topperName = 'Topper';

      if (cachedGemini) {
        topperName = (window.TOPPER_ENGINE && window.TOPPER_ENGINE.ARCHETYPES && window.TOPPER_ENGINE.ARCHETYPES[topperKey])
          ? window.TOPPER_ENGINE.ARCHETYPES[topperKey].name
          : 'Gemini AI';
        outline = TopperEngineView.formatGeminiMarkdown(cachedGemini, topperName);
      } else if (window.TOPPER_ENGINE && window.TOPPER_ENGINE.getMarkdownOutline) {
        outline = window.TOPPER_ENGINE.getMarkdownOutline(topperKey, qText, marks, subject);
        const t = window.TOPPER_ENGINE.ARCHETYPES[topperKey];
        if (t) topperName = t.name;
      }

      if (ta.value.trim().length > 0) {
        if (confirm(`Your answer pad already has text. Do you want to append ${topperName}'s outline at the bottom?`)) {
          ta.value = ta.value + '\n\n' + outline;
        }
      } else {
        ta.value = outline;
      }

      const targetWords = (parseFloat(marks) >= 15) ? 250 : 150;
      if (window.AWFG_ANSWER_PAD) {
        window.AWFG_ANSWER_PAD.handleWordCount(mKey, targetWords);
      }

      ta.scrollIntoView({ behavior: 'smooth', block: 'center' });
      ta.focus();
      Utils.showToast(`${topperName}'s answer structure inserted into Answer Pad!`, '🏆');
    },

    copyOutline(mKey, btn) {
      const card = document.getElementById(`mcard-${mKey}`);
      const stemEl = card ? card.querySelector('.pyq-stem-text') : null;
      const qText = stemEl ? stemEl.textContent : '';
      const marksBadge = card ? card.querySelector('.pyq-marks-badge') : null;
      const marksMatch = marksBadge ? marksBadge.textContent.match(/(\d+(?:\.\d+)?)\s*Marks/) : null;
      const marks = marksMatch ? parseFloat(marksMatch[1]) : 10;
      const modal = window.AWFG_MICROTHEME_MODAL;
      const subject = (card && card.dataset.subject) 
        ? card.dataset.subject 
        : ((modal && modal.currentData && modal.currentData.name) ? modal.currentData.name : '');

      const GeminiService = window.AWFG_GEMINI_SERVICE;
      const topperKey = activeTopperByMKey[mKey] || 'aditya';
      const cachedGemini = GeminiService ? GeminiService.getCachedAnswer(qText, topperKey) : null;
      let outline = '';

      if (cachedGemini) {
        const topperName = (window.TOPPER_ENGINE && window.TOPPER_ENGINE.ARCHETYPES && window.TOPPER_ENGINE.ARCHETYPES[topperKey])
          ? window.TOPPER_ENGINE.ARCHETYPES[topperKey].name
          : 'Gemini AI';
        outline = TopperEngineView.formatGeminiMarkdown(cachedGemini, topperName);
      } else if (window.TOPPER_ENGINE && window.TOPPER_ENGINE.getMarkdownOutline) {
        outline = window.TOPPER_ENGINE.getMarkdownOutline(topperKey, qText, marks, subject);
      }

      if (outline) {
        Utils.copyToClipboard(outline, btn, 'Complete 5-Point Outline copied!');
      }
    },

    async generateGemini(mKey, marks) {
      const card = document.getElementById(`mcard-${mKey}`);
      const stemEl = card ? card.querySelector('.pyq-stem-text') : null;
      const qText = stemEl ? stemEl.textContent : '';
      const modal = window.AWFG_MICROTHEME_MODAL;
      const subject = (card && card.dataset.subject) 
        ? card.dataset.subject 
        : ((modal && modal.currentData && modal.currentData.name) ? modal.currentData.name : '');

      const topperKey = activeTopperByMKey[mKey] || 'aditya';
      const topperObj = (window.TOPPER_ENGINE && window.TOPPER_ENGINE.ARCHETYPES) ? window.TOPPER_ENGINE.ARCHETYPES[topperKey] : null;
      const topperName = topperObj ? topperObj.name : 'Topper';

      const GeminiService = window.AWFG_GEMINI_SERVICE;
      if (!GeminiService || !GeminiService.hasApiKey()) {
        if (window.AWFG_GEMINI_MODAL) {
          window.AWFG_GEMINI_MODAL.open('Paste your free Google Gemini API key to generate live Topper-filtered answers.');
        } else {
          alert('Please configure your Gemini API Key in settings first.');
        }
        return;
      }

      const approachBox = document.getElementById(`approach-${mKey}`);
      if (approachBox) {
        approachBox.innerHTML = `
          <div class="gemini-generating-banner">
            <div class="gemini-ai-pulse" style="font-size: 2.4rem; margin-bottom: 12px;">✨🤖</div>
            <h4 style="margin: 0 0 6px; color: var(--text-primary); font-size: 1.15rem;">Gemini is crafting this answer live...</h4>
            <p style="margin: 0 0 12px; font-size: 0.84rem; color: var(--text-secondary); max-width: 580px; margin-left: auto; margin-right: auto; line-height: 1.55;">
              Deconstructing prompt demands, verifying empirical data & standard citations (NCERTs/Case Laws), drawing hand-drawable ASCII diagrams, and filtering presentation through <strong>${Utils.escapeHtml(topperName)}'s signature archetype</strong>.
            </p>
            <div style="font-size: 0.78rem; color: #818cf8; font-weight: 600;">Connecting to model: <code>${GeminiService.getModel()}</code></div>
          </div>
        `;
      }

      try {
        await GeminiService.generateTopperAnswer(qText, marks, subject, topperKey);
        if (approachBox) {
          approachBox.innerHTML = TopperEngineView.renderBlueprintHtml(mKey, qText, marks, subject);
        }
        Utils.showToast(`✨ ${topperName}'s answer generated by Gemini!`, '🏆');
      } catch (err) {
        if (approachBox) {
          approachBox.innerHTML = `
            <div style="padding: 24px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: var(--radius-md); text-align: center;">
              <div style="font-size: 2rem; margin-bottom: 8px;">⚠️</div>
              <h4 style="margin: 0 0 6px; color: #ef4444;">Gemini Generation Failed</h4>
              <p style="margin: 0 0 12px; font-size: 0.84rem; color: var(--text-secondary);">${Utils.escapeHtml(err.message)}</p>
              <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
                <button class="btn btn-outline btn-sm" onclick="AWFG_APP.openGeminiModal()">⚙️ Check API Key</button>
                <button class="btn btn-primary btn-sm" onclick="AWFG_APP.generateGeminiAnswer('${mKey}', ${marks})">🔄 Try Again</button>
              </div>
            </div>
          `;
        }
        Utils.showToast('Generation failed: ' + err.message, '⚠️');
      }
    },

    renderBlueprintHtml(mKey, qText, marks, subject) {
      const GeminiService = window.AWFG_GEMINI_SERVICE;
      const topperKey = activeTopperByMKey[mKey] || 'aditya';
      const topperObj = (window.TOPPER_ENGINE && window.TOPPER_ENGINE.ARCHETYPES) ? window.TOPPER_ENGINE.ARCHETYPES[topperKey] : null;
      const topperName = topperObj ? topperObj.name : 'Topper';

      const cachedGemini = GeminiService ? GeminiService.getCachedAnswer(qText, topperKey) : null;
      const bp = cachedGemini || (window.TOPPER_ENGINE && window.TOPPER_ENGINE.getComprehensiveBlueprint ? window.TOPPER_ENGINE.getComprehensiveBlueprint(qText, marks, subject) : null);

      if (!bp) {
        return `<div class="p-4 text-muted">Topper Engine loading...</div>`;
      }

      const esc = Utils.escapeHtml;
      const isAi = !!cachedGemini;
      const directiveMeaning = bp.directiveGuidance || bp.directiveMeaning || 'Analyze the core facts, underlying mechanisms, and practical implications of the issue with empirical evidence.';
      const paperTag = bp.paperLabel ? bp.paperLabel.split('•')[0].trim() : (bp.domainLabel ? bp.domainLabel.split('•')[0].trim() : 'GS-1');
      const topperKeys = ['aditya', 'ruhani', 'ishita', 'umaharathi', 'medha', 'anmol'];

      return `
        <div class="bp-master-card">
          <!-- Top Blueprint Header Banner -->
          <div class="bp-header">
            <div>
              <div style="font-size: 0.74rem; text-transform: uppercase; font-weight: 700; color: #818cf8; letter-spacing: 0.5px;">
                ${esc(bp.paperLabel || bp.domainLabel || 'UPSC CSE Mains Disciplinary Domain')}
              </div>
              <h3 style="margin: 2px 0 0; color: var(--text-primary); font-size: 1.12rem; display: flex; align-items: center; gap: 8px;">
                <span>📐</span> ${esc(paperTag)} Answer Blueprint (5-Point UPSC Framework)
              </h3>
            </div>
            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
              <span class="approach-directive-badge">🎯 Directive: ${esc(bp.directive || 'Examine')}</span>
              <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; font-weight: 700; font-size: 0.8rem;">
                ⏱️ ${bp.suggestedTime || 7} Mins • ~${bp.targetWords || 150} Words
              </span>
            </div>
          </div>

          <!-- Live Gemini AI Action Bar -->
          <div class="bp-gemini-toolbar">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 1.25rem;">${isAi ? '✨' : '🤖'}</span>
              <div>
                <div style="font-size: 0.84rem; font-weight: 700; color: ${isAi ? '#10b981' : '#818cf8'};">
                  ${isAi ? `AI Topper Answer (Verified by Gemini 2.0 Flash via ${esc(topperName)})` : 'Google Gemini AI Topper Engine'}
                </div>
                <div style="font-size: 0.74rem; color: var(--text-secondary);">
                  ${isAi ? `Model: ${cachedGemini.modelUsed || 'gemini-2.0-flash'} • 100% question-specific curation & topper formatting` : `Generate live answer with authentic facts, diagrams & ${esc(topperName)}'s styling`}
                </div>
              </div>
            </div>
            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
              <button class="btn btn-outline btn-sm" onclick="AWFG_APP.openGeminiModal()" title="Gemini API Key Settings" style="font-size: 0.76rem;">
                ⚙️ API Key
              </button>
              ${isAi ? `
                <button class="btn btn-subtle btn-sm" onclick="AWFG_APP.generateGeminiAnswer('${mKey}', ${marks})" title="Regenerate with Gemini">
                  🔄 Regenerate
                </button>
              ` : `
                <button class="btn btn-primary btn-sm gemini-gen-btn" onclick="AWFG_APP.generateGeminiAnswer('${mKey}', ${marks})">
                  ✨ Generate Live with Gemini (${esc(topperName)} Style)
                </button>
              `}
            </div>
          </div>

          <!-- Point 1: Simplify the Question (Demand Deconstruction) -->
          <div style="margin-top: 12px; padding: 12px 14px; background: rgba(99, 102, 241, 0.06); border-radius: var(--radius-sm); border: 1px solid rgba(99, 102, 241, 0.2);">
            <div style="font-size: 0.86rem; font-weight: 700; color: #818cf8; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
              <span>1️⃣</span> Simplify the Question & Demand Deconstruction
            </div>
            <div style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.55;">
              <div><strong>🎯 Directive Guidance (${esc(bp.directive || 'Examine')}):</strong> ${esc(directiveMeaning)}</div>
              ${bp.explicitDemands ? `<div style="margin-top: 4px;"><strong>📌 Explicit Demands:</strong> ${esc(bp.explicitDemands)}</div>` : ''}
              ${bp.implicitDemands ? `<div style="margin-top: 4px;"><strong>🔍 Implicit Demands:</strong> ${esc(bp.implicitDemands)}</div>` : ''}
            </div>
          </div>

          <!-- Point 2: Approach Framework -->
          <div style="margin-top: 16px;">
            <div style="font-size: 0.88rem; font-weight: 700; color: #f59e0b; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
              <span>2️⃣</span> Approach: Structured Framework (Intro, Body & Visual)
            </div>

            <!-- Section 2A: Ready-to-Write Introductions -->
            <div style="margin-top: 6px;">
              <div style="font-size: 0.82rem; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">
                ✍️ Ready-to-Write Introductions (${(bp.intros || []).length} High-Scoring Approaches):
              </div>
              <div style="display: flex; flex-direction: column; gap: 8px;">
                ${(bp.intros || []).map(intro => `
                  <div class="bp-intro-card">
                    <div class="bp-intro-tag">${esc(intro.type)}</div>
                    <div class="bp-intro-text">${esc(intro.text)}</div>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Section 2B: Real Hand-Drawable Copy Diagram & Sketch Guide -->
            <div style="margin-top: 14px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; flex-wrap: wrap; gap: 6px;">
                <span style="font-size: 0.82rem; font-weight: 700; color: #38bdf8;">📊 Real Hand-Drawable Copy Diagram (Smart Art):</span>
                <span style="font-size: 0.76rem; color: var(--text-muted);">${esc(bp.diagramTitle || 'Schematic Diagram')}</span>
              </div>
              <div class="bp-diagram-canvas">
                <pre class="bp-diagram-pre">${esc(bp.diagramVisual || '')}</pre>
              </div>
              <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 6px; padding: 6px 10px; background: rgba(56, 189, 248, 0.08); border-radius: var(--radius-sm); border-left: 3px solid #38bdf8;">
                <strong style="color: #38bdf8;">📝 1-Minute Copy Sketch Guide:</strong> ${esc(bp.diagramSketchInstructions || 'Sketch central boxes and connect with directional flow arrows.')}
              </div>
            </div>

            <!-- Section 2C: Exact Body Subheadings & Comprehensive Points -->
            <div style="margin-top: 14px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
                <span style="font-size: 0.82rem; font-weight: 700; color: #10b981;">
                  🏗️ Main Body Subheadings & Evidence-Backed Points:
                </span>
                <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; font-size: 0.74rem;">
                  Filtered by ${esc(topperName)} Style
                </span>
              </div>
              <div style="display: flex; flex-direction: column; gap: 10px;">
                ${(bp.headings || []).map(h => `
                  <div class="bp-heading-card">
                    <div class="bp-heading-title">${esc(h.title)}</div>
                    <ul class="bp-heading-list">
                      ${(h.points || []).map(pt => {
                        const ptText = typeof pt === 'string' ? pt : `${pt.causalChain} (Evidence: ${pt.evidence})`;
                        return `<li>${esc(ptText)}</li>`;
                      }).join('')}
                    </ul>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Section 2D: Balanced Model Concluding Synthesis -->
            <div style="margin-top: 12px; padding: 10px 14px; background: rgba(245, 158, 11, 0.08); border-radius: var(--radius-sm); border-left: 3px solid #f59e0b;">
              <strong style="color: #f59e0b; font-size: 0.84rem;">🏁 Balanced Concluding Perspective:</strong>
              <span style="color: var(--text-primary); margin-left: 6px; font-size: 0.84rem; line-height: 1.5;">${esc(bp.signatureConclusion || bp.conclusion || '')}</span>
            </div>
          </div>

          <!-- Point 3: Value Additions -->
          <div style="margin-top: 16px; padding: 12px 14px; background: var(--bg-secondary); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
            <div style="font-size: 0.86rem; font-weight: 700; color: #10b981; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
              <span>3️⃣</span> Value Additions (Standard Texts, Empirical Benchmarks & Cultural/Statutory Ethos)
            </div>
            <ul style="margin: 4px 0 0 18px; padding: 0; font-size: 0.82rem; color: var(--text-secondary); line-height: 1.55;">
              ${(bp.valueAdds || []).map(va => `<li>${esc(va)}</li>`).join('')}
            </ul>
          </div>

          <!-- Point 4: Model Answer via UPSC Topper Archetype Engine Integration -->
          <div style="margin-top: 18px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 6px;">
              <div style="font-size: 0.88rem; font-weight: 700; color: #8b5cf6; display: flex; align-items: center; gap: 6px;">
                <span>4️⃣</span> Model Topper Answers (Calibrated AIR 1–13 Archetypes)
              </div>
              <span class="badge" style="background: rgba(139, 92, 246, 0.15); color: #8b5cf6; font-size: 0.74rem;">
                Click any Topper to filter presentation
              </span>
            </div>

            <!-- Interactive Topper Selection Pill Bar -->
            <div class="topper-pill-bar" id="topper-pills-${mKey}">
              ${topperKeys.map(k => {
                const t = window.TOPPER_ENGINE && window.TOPPER_ENGINE.ARCHETYPES ? window.TOPPER_ENGINE.ARCHETYPES[k] : null;
                const isAct = (k === topperKey);
                return `
                  <button type="button" class="topper-pill-btn ${isAct ? 'active' : ''}" onclick="AWFG_APP.selectTopperLens('${mKey}', '${k}')" style="${isAct && t ? `border-color: ${t.theme}; background: ${t.theme}22; color: ${t.theme};` : ''}">
                    ${t ? t.pillLabel : k}
                  </button>
                `;
              }).join('')}
            </div>

            <!-- Topper Archetype Content Box -->
            <div id="topper-content-${mKey}" style="margin-top: 10px;">
              ${window.TOPPER_ENGINE && window.TOPPER_ENGINE.renderContentHtml ? window.TOPPER_ENGINE.renderContentHtml(mKey, topperKey, qText, marks, subject) : ''}
            </div>
          </div>

          <!-- Point 5: Critical Evaluation & Modern India Linkage -->
          ${bp.evaluation ? `
            <div style="margin-top: 14px; padding: 12px 14px; background: rgba(56, 189, 248, 0.08); border-radius: var(--radius-sm); border-left: 3px solid #38bdf8;">
              <strong style="color: #38bdf8; font-size: 0.84rem;">5️⃣ Critical Evaluation & Modern India Linkage:</strong>
              <p style="margin: 4px 0 0; font-size: 0.84rem; color: var(--text-primary); line-height: 1.5;">
                ${esc(bp.evaluation)}
              </p>
            </div>
          ` : ''}

          <!-- Quick Outline Actions -->
          <div class="approach-actions" style="margin-top: 16px;">
            <button class="btn btn-subtle btn-sm" onclick="AWFG_APP.copyMainsOutline('${mKey}', this)">
              📋 Copy Complete 5-Point Structure
            </button>
            <button class="btn btn-primary btn-sm" onclick="AWFG_APP.insertTemplateToPad('${mKey}', ${marks})">
              📥 Insert Structure into Answer Pad
            </button>
          </div>
        </div>
      `;
    }
  };

  window.AWFG_TOPPER_VIEW = TopperEngineView;
})();
