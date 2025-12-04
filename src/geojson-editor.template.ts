/**
 * HTML Template for GeoJSON Editor
 */
export function getTemplate(placeholder: string = '', version: string = ''): string {
  return `
    <div class="prefix-wrapper">
      <div class="prefix-gutter"></div>
      <div class="editor-prefix" id="editorPrefix"></div>
      <button class="info-btn" id="infoBtn" title="@softwarity/geojson-editor v${version}" aria-label="About">ⓘ</button>
    </div>
    <div class="editor-wrapper">
      <div class="gutter">
        <div class="gutter-scroll" id="gutterScroll">
          <div class="gutter-scroll-content" id="gutterScrollContent">
            <div class="gutter-content" id="gutterContent"></div>
          </div>
        </div>
      </div>
      <div class="editor-content">
        <div class="placeholder-layer" id="placeholderLayer">${escapeHtml(placeholder)}</div>
        <textarea
          class="hidden-textarea"
          id="hiddenTextarea"
          spellcheck="false"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          tabindex="0"
        ></textarea>
        <div class="viewport" id="viewport">
          <div class="scroll-content" id="scrollContent">
            <div class="lines-container" id="linesContainer"></div>
          </div>
        </div>
      </div>
    </div>
    <div class="suffix-wrapper">
      <div class="suffix-gutter"></div>
      <div class="editor-suffix" id="editorSuffix"></div>
      <div class="error-nav" id="errorNav">
        <button class="error-nav-btn" id="prevErrorBtn" title="Previous error">◀</button>
        <span class="error-count" id="errorCount"></span>
        <button class="error-nav-btn" id="nextErrorBtn" title="Next error">▶</button>
      </div>
      <button class="clear-btn" id="clearBtn" title="Clear editor">✕</button>
    </div>
    <div class="info-popup" id="infoPopup">
      <div class="info-popup-content">
        <div class="info-popup-title">GeoJSON Editor</div>
        <a class="info-popup-version" href="https://www.npmjs.com/package/@softwarity/geojson-editor/v/${version}" target="_blank" rel="noopener">v${version}</a>
        <div class="info-popup-copyright">© ${new Date().getFullYear()} Softwarity</div>
      </div>
    </div>
  `;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
