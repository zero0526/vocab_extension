import type { DictionaryLookupResult } from "./types";
import type { WordType, Pronunciation, AudioResource, Meaning, Example } from "@vocab-extend/shared";
import { generateUUID } from "../../utils/text";

const BASE_URL = "https://dictionary.cambridge.org";

export function cleanIpa(text: string): string {
  const cleaned = text.replace(/^(US|UK)\s*/i, "").trim();
  if (!cleaned) return "";
  if (cleaned.startsWith("/") && cleaned.endsWith("/")) {
    return cleaned;
  }
  return `/${cleaned.replace(/^\/+|\/+$/g, "")}/`;
}

export function resolveAudioUrl(rawUrl: string | null | undefined): string | undefined {
  if (!rawUrl) return undefined;
  try {
    return new URL(rawUrl, BASE_URL).href;
  } catch {
    return rawUrl.startsWith("http") ? rawUrl : `${BASE_URL}${rawUrl}`;
  }
}

/**
 * Pure parser for Cambridge Dictionary HTML markup.
 * Uses DOMParser in browser environment.
 */
export function parseCambridgeHtml(html: string, fallbackWord: string): DictionaryLookupResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const targetUrl = `${BASE_URL}/dictionary/english/${encodeURIComponent(fallbackWord.toLowerCase())}`;

  // 1. Headword
  const hwEl = doc.querySelector("h2.headword .hw") || doc.querySelector(".hw");
  const word = hwEl?.textContent?.trim() || fallbackWord;

  // 2. Types (POS - Part of speech)
  // Each .pr.dictionary block represents an entry by word type (e.g. try: verb, noun)
  const blocks = Array.from(doc.querySelectorAll(".pr.dictionary"));
  const entryBlocks = blocks.length > 0 ? blocks : [doc.body || doc];

  const types: WordType[] = [];
  const seenTypes = new Set<string>();

  for (const block of entryBlocks) {
    const posEl = block.querySelector("span.pos");
    if (posEl) {
      const name = posEl.textContent?.trim().toLowerCase();
      if (name && !seenTypes.has(name)) {
        seenTypes.add(name);
        types.push({ name, patterns: [] });
      }
    }
  }

  // Fallback for types if none found in blocks
  if (types.length === 0) {
    doc.querySelectorAll("span.pos").forEach((el) => {
      const name = el.textContent?.trim().toLowerCase();
      if (name && !seenTypes.has(name)) {
        seenTypes.add(name);
        types.push({ name, patterns: [] });
      }
    });
  }

  // 3. Pronunciations & Audio
  // Cambridge uses .pron-block with .region (UK/US), .ipa, and audio[data-src-mp3]
  const pronMap = new Map<string, string[]>(); // dialect -> ipas
  const audioMap = new Map<string, string>(); // dialect -> url

  const pronBlocks = Array.from(doc.querySelectorAll(".pron-block"));

  for (const pb of pronBlocks) {
    const regionEl = pb.querySelector(".region");
    if (!regionEl) continue;
    const dialect = regionEl.textContent?.trim().toUpperCase(); // UK or US
    if (!dialect || (dialect !== "UK" && dialect !== "US" && dialect !== "AU")) continue;

    // IPA
    const ipaEl = pb.querySelector(".ipa");
    if (ipaEl) {
      const ipa = cleanIpa(ipaEl.textContent || "");
      if (ipa && ipa !== "//") {
        const list = pronMap.get(dialect) || [];
        if (!list.includes(ipa)) {
          list.push(ipa);
          pronMap.set(dialect, list);
        }
      }
    }

    // Audio - Note: Cambridge preloads with 'data-src-mp3' attribute, 'src' is usually empty!
    const audioEl = pb.querySelector("audio");
    if (audioEl && !audioMap.has(dialect)) {
      const rawUrl =
        audioEl.getAttribute("data-src-mp3") ||
        audioEl.getAttribute("src") ||
        audioEl.querySelector("source[type='audio/mpeg']")?.getAttribute("src") ||
        audioEl.querySelector("source")?.getAttribute("src");

      const fullUrl = resolveAudioUrl(rawUrl);
      if (fullUrl) {
        audioMap.set(dialect, fullUrl);
      }
    }
  }

  // Fallback layout (dpron-i / .region.uk / .region.us) for older or variant page layouts
  if (pronMap.size === 0 && audioMap.size === 0) {
    const legacyBlocks = Array.from(doc.querySelectorAll(".pos-header .dpron-i, .dpron"));
    for (const lb of legacyBlocks) {
      const isUk = lb.querySelector(".uk") || lb.matches(".uk") || lb.querySelector(".region.uk");
      const isUs = lb.querySelector(".us") || lb.matches(".us") || lb.querySelector(".region.us");
      const dialect = isUk ? "UK" : isUs ? "US" : undefined;
      if (!dialect) continue;

      const ipaEl = lb.querySelector(".ipa");
      if (ipaEl) {
        const ipa = cleanIpa(ipaEl.textContent || "");
        if (ipa && ipa !== "//") {
          const list = pronMap.get(dialect) || [];
          if (!list.includes(ipa)) {
            list.push(ipa);
            pronMap.set(dialect, list);
          }
        }
      }

      const audioEl = lb.querySelector("audio");
      if (audioEl && !audioMap.has(dialect)) {
        const rawUrl =
          audioEl.getAttribute("data-src-mp3") ||
          audioEl.getAttribute("src") ||
          audioEl.querySelector("source[type='audio/mpeg']")?.getAttribute("src");
        const fullUrl = resolveAudioUrl(rawUrl);
        if (fullUrl) {
          audioMap.set(dialect, fullUrl);
        }
      }
    }
  }

  // Standardize UK & US entries
  const pronunciations: Pronunciation[] = [];
  const audio: AudioResource[] = [];

  for (const d of ["UK", "US"] as const) {
    const ipas = pronMap.get(d) || [];
    pronunciations.push({
      dialect: d,
      variants: ipas.map((ipa) => ({ type: "standard", ipa })),
    });

    const url = audioMap.get(d);
    if (url) {
      audio.push({
        dialect: d,
        url,
        source: "Cambridge",
      });
    }
  }

  // 4. Meanings & Examples (from .def-block)
  const defBlocks = Array.from(doc.querySelectorAll(".def-block"));
  const meanings: Meaning[] = [];
  const examples: Example[] = [];

  defBlocks.forEach((block, idx) => {
    if (idx >= 6) return; // Keep top 6 definitions
    const defEl = block.querySelector(".def");
    if (!defEl) return;
    const defText = defEl.textContent?.trim().replace(/:$/, "").trim();
    if (defText) {
      const contextEl = block.querySelector(".def-info, .gram");
      const context = contextEl?.textContent?.trim() || "";

      meanings.push({
        id: generateUUID(),
        text: defText,
        context,
        source: "dictionary",
      });
    }

    // Extract example sentences inside this definition block
    const exEls = block.querySelectorAll(".examp .eg");
    exEls.forEach((exEl, exIdx) => {
      if (exIdx >= 2) return; // Top 2 per definition
      const sentence = exEl.textContent?.trim();
      if (sentence) {
        examples.push({
          id: generateUUID(),
          sentence,
          source: "Cambridge Dictionary",
          sourceUrl: targetUrl,
          sourceType: "dictionary",
        });
      }
    });
  });

  return {
    word,
    types,
    pronunciations,
    audio,
    meanings,
    examples,
    source: {
      dictionary: "Cambridge",
      url: targetUrl,
    },
  };
}
