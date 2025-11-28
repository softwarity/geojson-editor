/**
 * HTML Template for GeoJSON Editor
 * @param {string} placeholder - Placeholder text
 * @returns {string} HTML template string
 */
export function getTemplate(placeholder = '') {
  return `
    <div class="prefix-wrapper">
      <div class="prefix-gutter"></div>
      <div class="editor-prefix" id="editorPrefix"></div>
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
      <button class="clear-btn" id="clearBtn" title="Clear editor">✕</button>
    </div>
  `;
}

/**
 * Escape HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
