// js/components/TopperEngineView.js
// Page Object Component: 5-Point UPSC GS-1 Blueprint & Topper Framing Engine

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

      const cont = document.getElementById(`topper-content-${mKey}`);
      if (cont && window.TOPPER_ENGINE && window.TOPPER_ENGINE.renderContentHtml) {
        cont.innerHTML = window.TOPPER_ENGINE.renderContentHtml(mKey, topperKey, qText, marks, subject);
      }

      const pillBar = document.getElementById(`topper-pills-${mKey}`);
      if (pillBar && window.TOPPER_ENGINE) {
        const btns = pillBar.querySelectorAll('.topper-pill-btn');
        const topperKeys = ['aditya', 'ruhani', 'ishita', 'umaharathi', 'medha', 'anmol'];
        btns.forEach((btn, idx) => {
          const k = topperKeys[idx];
          const t = window.TOPPER_ENGINE.ARCHETYPES ? window.TOPPER_ENGINE.ARCHETYPES[k] : null;
          if (k === topperKey) {
            btn.classList.add('active');
            if (t) {
              btn.style.borderColor = t.theme;
              btn.style.background = t.theme + '22';
              btn.style.color = t.theme;
            }
          } else {
            btn.classList.remove('active');
            btn.style.borderColor = '';
            btn.style.background = '';
            btn.style.color = '';
          }
        });
      }
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

      let outline = '';
      let topperName = 'Topper';

      if (window.TOPPER_ENGINE && window.TOPPER_ENGINE.getMarkdownOutline) {
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
      Utils.showToast(`${topperName}'s structure inserted into Answer Pad!`, '🏆');
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

      let outline = '';
      if (window.TOPPER_ENGINE && window.TOPPER_ENGINE.getMarkdownOutline) {
        const topperKey = activeTopperByMKey[mKey] || 'aditya';
        outline = window.TOPPER_ENGINE.getMarkdownOutline(topperKey, qText, marks, subject);
      }

      if (outline) {
        Utils.copyToClipboard(outline, btn, 'Complete 5-Point Outline copied!');
      }
    },

    renderBlueprintHtml(mKey, qText, marks, subject) {
      if (!window.TOPPER_ENGINE || !window.TOPPER_ENGINE.getComprehensiveBlueprint) {
        return `<div class="p-4 text-muted">Topper Engine loading...</div>`;
      }

      const bp = window.TOPPER_ENGINE.getComprehensiveBlueprint(qText, marks, subject);
      const esc = Utils.escapeHtml;

      return `
        <div class="bp-master-card">
          <!-- Top Blueprint Header Banner -->
          <div class="bp-header">
            <div>
              <div style="font-size: 0.74rem; text-transform: uppercase; font-weight: 700; color: #818cf8; letter-spacing: 0.5px;">
                ${esc(bp.domainLabel)}
              </div>
              <h3 style="margin: 2px 0 0; color: var(--text-primary); font-size: 1.12rem; display: flex; align-items: center; gap: 8px;">
                <span>📐</span> ${esc(bp.paperLabel ? bp.paperLabel.split('•')[0].trim() : (bp.domainLabel ? bp.domainLabel.split('•')[0].trim() : 'GS-1'))} Answer Blueprint (5-Point UPSC Framework)
              </h3>
            </div>
            <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
              <span class="approach-directive-badge">🎯 Directive: ${esc(bp.directive)}</span>
              <span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; font-weight: 700; font-size: 0.8rem;">
                ⏱️ ${bp.suggestedTime} Mins • ~${bp.targetWords} Words
              </span>
            </div>
          </div>

          <!-- Point 1: Simplify the Question (Demand Deconstruction) -->
          <div style="margin-top: 12px; padding: 12px 14px; background: rgba(99, 102, 241, 0.06); border-radius: var(--radius-sm); border: 1px solid rgba(99, 102, 241, 0.2);">
            <div style="font-size: 0.86rem; font-weight: 700; color: #818cf8; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
              <span>1️⃣</span> Simplify the Question & Demand Deconstruction
            </div>
            <div style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.55;">
              <div><strong>🎯 Directive Guidance (${esc(bp.directive)}):</strong> ${esc(bp.directiveMeaning)}</div>
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
                ✍️ Ready-to-Write Introductions (${bp.intros.length} High-Scoring Approaches):
              </div>
              <div style="display: flex; flex-direction: column; gap: 8px;">
                ${bp.intros.map(intro => `
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
                <span style="font-size: 0.76rem; color: var(--text-muted);">${esc(bp.diagramTitle)}</span>
              </div>
              <div class="bp-diagram-canvas">
                <pre class="bp-diagram-pre">${esc(bp.diagramVisual)}</pre>
              </div>
              <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 6px; padding: 6px 10px; background: rgba(56, 189, 248, 0.08); border-radius: var(--radius-sm); border-left: 3px solid #38bdf8;">
                <strong style="color: #38bdf8;">📝 1-Minute Copy Sketch Guide:</strong> ${esc(bp.diagramSketchInstructions)}
              </div>
            </div>

            <!-- Section 2C: Exact Body Subheadings & Comprehensive Points -->
            <div style="margin-top: 14px;">
              <div style="font-size: 0.82rem; font-weight: 700; color: #10b981; margin-bottom: 8px;">
                🏗️ Main Body Subheadings & Evidence-Backed Points:
              </div>
              <div style="display: flex; flex-direction: column; gap: 10px;">
                ${bp.headings.map(h => `
                  <div class="bp-heading-card">
                    <div class="bp-heading-title">${esc(h.title)}</div>
                    <ul class="bp-heading-list">
                      ${h.points.map(pt => `<li>${esc(pt)}</li>`).join('')}
                    </ul>
                  </div>
                `).join('')}
              </div>
            </div>

            <!-- Section 2D: Balanced Model Concluding Synthesis -->
            <div style="margin-top: 12px; padding: 10px 14px; background: rgba(245, 158, 11, 0.08); border-radius: var(--radius-sm); border-left: 3px solid #f59e0b;">
              <strong style="color: #f59e0b; font-size: 0.84rem;">🏁 Balanced Concluding Perspective:</strong>
              <span style="color: var(--text-primary); margin-left: 6px; font-size: 0.84rem; line-height: 1.5;">${esc(bp.conclusion)}</span>
            </div>
          </div>

          <!-- Point 3: Value Additions -->
          <div style="margin-top: 16px; padding: 12px 14px; background: var(--bg-secondary); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
            <div style="font-size: 0.86rem; font-weight: 700; color: #10b981; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
              <span>3️⃣</span> Value Additions (Standard Texts, Archaeological/Empirical Benchmarks & Cultural Ethos)
            </div>
            <ul style="margin: 4px 0 0 18px; padding: 0; font-size: 0.82rem; color: var(--text-secondary); line-height: 1.55;">
              ${bp.valueAdds.map(va => `<li>${esc(va)}</li>`).join('')}
            </ul>
          </div>

          <!-- Point 4: Model Answer via UPSC Topper Archetype Engine Integration -->
          <div style="margin-top: 18px;">
            <div style="font-size: 0.88rem; font-weight: 700; color: #8b5cf6; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
              <span>4️⃣</span> Model Topper Answers (Directly calibrated from AIR 1–13 copies)
            </div>
            ${window.TOPPER_ENGINE && window.TOPPER_ENGINE.renderSectionHtml ? window.TOPPER_ENGINE.renderSectionHtml(mKey, qText, marks, subject) : ''}
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
              📥 Insert Comprehensive Structure into Answer Pad
            </button>
          </div>
        </div>
      `;
    }
  };

  window.AWFG_TOPPER_VIEW = TopperEngineView;
})();
