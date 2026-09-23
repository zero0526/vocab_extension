import type { VocabularyEntry, Pronunciation, WordType, Meaning, Example } from "@vocab-extend/shared";

/**
 * Escape HTML special characters to prevent broken tags or XSS
 */
export function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Format Part of Speech badges (e.g., VERB, NOUN, ADJ)
 */
export function formatWordTypesHtml(types: WordType[]): string {
  if (!types || types.length === 0) return "";
  return types
    .map(
      (t) =>
        `<span class="vocab-badge-pos" style="display: inline-block; padding: 2px 7px; border-radius: 5px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; background-color: #f1f5f9; color: #475569; border: 1px solid #e2e8f0;">${escapeHtml(
          t.name.toUpperCase()
        )}</span>`
    )
    .join(" ");
}

/**
 * Format Pronunciation pills (UK / US with flags and styled IPA)
 */
export function formatPronunciationsHtml(
  pronunciations: Pronunciation[],
  soundTags: string[] = []
): string {
  if (!pronunciations || pronunciations.length === 0) return "";

  const pills = pronunciations
    .map((p) => {
      const dialect = (p.dialect || "").toUpperCase();
      const flag = dialect === "UK" ? "🇬🇧" : dialect === "US" ? "🇺🇸" : "🌐";
      const isUk = dialect === "UK";
      const badgeClass = isUk ? "vocab-badge-ipa-uk" : "vocab-badge-ipa-us";
      const bg = isUk ? "#eff6ff" : "#faf5ff";
      const color = isUk ? "#1d4ed8" : "#7e22ce";
      const border = isUk ? "#bfdbfe" : "#e9d5ff";
      const ipaText = p.variants.map((v) => v.ipa).join(" ");

      return `<span class="${badgeClass}" style="display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 6px; font-size: 13px; font-weight: 500; background-color: ${bg}; color: ${color}; border: 1px solid ${border}; font-family: 'Lucida Sans Unicode', 'DejaVu Sans', Arial, sans-serif;"><span>${flag} ${escapeHtml(
        dialect || "IPA"
      )}</span> <b style="font-weight: 600;">${escapeHtml(ipaText)}</b></span>`;
    })
    .join(" ");

  const soundHtml =
    soundTags.length > 0
      ? `<span class="vocab-sound-tags" style="margin-left: 4px; display: inline-flex; gap: 4px; align-items: center;">${soundTags.join(
          " "
        )}</span>`
      : "";

  return `<div class="vocab-phonetics-row" style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">${pills}${soundHtml}</div>`;
}

/**
 * Format Meanings list with circular numbers and context badges
 */
export function formatMeaningsHtml(meanings: Meaning[]): string {
  if (!meanings || meanings.length === 0) return "";

  const items = meanings
    .map(
      (m, i) => `
    <div class="vocab-meaning-item" style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 8px; line-height: 1.5;">
      <span class="vocab-meaning-index" style="display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 20px; border-radius: 50%; font-size: 11px; font-weight: 700; background-color: #4f46e5; color: #ffffff; margin-top: 2px; flex-shrink: 0;">${
        i + 1
      }</span>
      <div style="flex: 1;">
        <span class="vocab-meaning-text" style="font-size: 14.5px; font-weight: 600; color: #0f172a;">${escapeHtml(
          m.text
        )}</span>
        ${
          m.context
            ? `<span class="vocab-badge-context" style="display: inline-block; margin-left: 6px; padding: 1px 6px; border-radius: 4px; font-size: 11px; font-weight: 600; background-color: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; vertical-align: middle;">${escapeHtml(
                m.context
              )}</span>`
            : ""
        }
        ${
          m.translation
            ? `<div class="vocab-meaning-vi" style="font-size: 13px; color: #166534; background-color: #f0fdf4; border-left: 2px solid #22c55e; padding: 3px 8px; border-radius: 0 4px 4px 0; margin-top: 4px; font-weight: 500;">🇻🇳 ${escapeHtml(
                m.translation
              )}</div>`
            : ""
        }
      </div>
    </div>`
    )
    .join("");

  return `
    <div class="vocab-meanings-section" style="margin-top: 10px;">
      <div class="vocab-section-title" style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-bottom: 8px;">Định nghĩa / Meanings</div>
      <div>${items}</div>
    </div>
  `;
}

/**
 * Format Examples with styled callout quote blocks
 */
export function formatExamplesHtml(examples: Example[]): string {
  if (!examples || examples.length === 0) return "";

  const items = examples
    .map(
      (e) => `
    <div class="vocab-example-card" style="background-color: #f8fafc; border-left: 3px solid #3b82f6; border-radius: 0 8px 8px 0; padding: 8px 12px; margin-bottom: 6px; font-size: 13.5px; color: #334155; line-height: 1.5; font-style: italic;">
      “${escapeHtml(e.sentence)}”
      ${
        e.source
          ? `<div class="vocab-example-source" style="font-size: 11px; color: #94a3b8; font-style: normal; margin-top: 3px;">— ${escapeHtml(
              e.source
            )}</div>`
          : ""
      }
    </div>`
    )
    .join("");

  return `
    <div class="vocab-examples-section" style="margin-top: 12px;">
      <div class="vocab-section-title" style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; margin-bottom: 8px;">Ví dụ / Examples</div>
      <div>${items}</div>
    </div>
  `;
}

/**
 * Format Memory tip with amber highlight card
 */
export function formatMemoryHtml(memory?: string): string {
  if (!memory || !memory.trim()) return "";

  return `
    <div class="vocab-memory-card" style="margin-top: 12px; background-color: #fffbeb; border: 1px solid #fef3c7; border-left: 3px solid #f59e0b; border-radius: 0 8px 8px 0; padding: 8px 12px; font-size: 13px; color: #92400e; line-height: 1.5;">
      <div style="font-weight: 700; display: flex; align-items: center; gap: 4px; margin-bottom: 2px;">
        <span>💡</span> <span>Mẹo ghi nhớ</span>
      </div>
      <div>${escapeHtml(memory)}</div>
    </div>
  `;
}

/**
 * Generate full HTML Back card with responsive layout, styling, and dark mode support
 */
export function buildCardHtml(
  entry: VocabularyEntry,
  soundTags: string[] = []
): string {
  const posBadges = formatWordTypesHtml(entry.types);
  const pronunciationsHtml = formatPronunciationsHtml(entry.pronunciations, soundTags);
  const meaningsHtml = formatMeaningsHtml(entry.meanings);
  const examplesHtml = formatExamplesHtml(entry.examples);
  const memoryHtml = formatMemoryHtml(entry.memory);

  const sourceTitle = entry.capture?.sourceTitle || entry.source?.dictionary || "Cambridge";
  const formattedDate = new Date().toLocaleDateString("vi-VN");

  return `
<style>
.vocab-anki-card {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  max-width: 540px;
  margin: 0 auto;
  padding: 18px 20px;
  background-color: #ffffff;
  color: #1e293b;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.04);
  text-align: left;
}
.vocab-anki-card * { box-sizing: border-box; }
.nightMode .vocab-anki-card,
.night_mode .vocab-anki-card,
@media (prefers-color-scheme: dark) {
  .vocab-anki-card {
    background-color: #1e1e2e !important;
    color: #cdd6f4 !important;
    border-color: #313244 !important;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3) !important;
  }
  .vocab-anki-card .vocab-word-title { color: #f8fafc !important; }
  .vocab-anki-card .vocab-badge-pos { background-color: #313244 !important; color: #bac2de !important; border-color: #45475a !important; }
  .vocab-anki-card .vocab-badge-ipa-uk { background-color: #1e293b !important; color: #93c5fd !important; border-color: #3b82f6 !important; }
  .vocab-anki-card .vocab-badge-ipa-us { background-color: #2b173b !important; color: #d8b4fe !important; border-color: #7e22ce !important; }
  .vocab-anki-card .vocab-divider { background-color: #313244 !important; }
  .vocab-anki-card .vocab-section-title { color: #89b4fa !important; }
  .vocab-anki-card .vocab-meaning-index { background-color: #6366f1 !important; color: #ffffff !important; }
  .vocab-anki-card .vocab-meaning-text { color: #f1f5f9 !important; }
  .vocab-anki-card .vocab-meaning-vi { background-color: #142e1d !important; color: #86efac !important; border-left-color: #22c55e !important; }
  .vocab-anki-card .vocab-badge-context { background-color: #064e3b !important; color: #6ee7b7 !important; border-color: #047857 !important; }
  .vocab-anki-card .vocab-example-card { background-color: #181825 !important; color: #bac2de !important; border-left-color: #60a5fa !important; }
  .vocab-anki-card .vocab-example-source { color: #6c7086 !important; }
  .vocab-anki-card .vocab-memory-card { background-color: #2a1f14 !important; border-color: #45331f !important; border-left-color: #f59e0b !important; color: #fde68a !important; }
  .vocab-anki-card .vocab-footer { border-top-color: #313244 !important; color: #6c7086 !important; }
}
</style>

<div class="vocab-anki-card">
  <!-- Header: Word & Part of Speech -->
  <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 6px;">
    <div>
      <div class="vocab-word-title" style="font-size: 26px; font-weight: 700; color: #0f172a; line-height: 1.2; letter-spacing: -0.01em;">${escapeHtml(
        entry.word
      )}</div>
    </div>
    ${posBadges ? `<div style="display: flex; gap: 4px; flex-wrap: wrap; align-items: center;">${posBadges}</div>` : ""}
  </div>

  <!-- Pronunciation row (UK / US + Audio) -->
  ${pronunciationsHtml ? `<div style="margin-bottom: 10px;">${pronunciationsHtml}</div>` : ""}

  <!-- Divider line -->
  <div class="vocab-divider" style="height: 1px; background-color: #e2e8f0; margin: 12px 0;"></div>

  <!-- Meanings & Examples & Memory -->
  ${meaningsHtml}
  ${examplesHtml}
  ${memoryHtml}

  <!-- Card Footer -->
  <div class="vocab-footer" style="margin-top: 14px; padding-top: 8px; border-top: 1px dashed #e2e8f0; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; align-items: center;">
    <span>VocabExtend · Cambridge</span>
    <span>${escapeHtml(sourceTitle.slice(0, 35))} · ${formattedDate}</span>
  </div>
</div>
`.trim();
}
