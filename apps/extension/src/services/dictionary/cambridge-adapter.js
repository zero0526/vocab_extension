import { generateUUID } from "../../utils/text";
export class CambridgeAdapter {
    backendBaseUrl;
    constructor(backendBaseUrl = "http://localhost:8080/api/v1/dictionary") {
        this.backendBaseUrl = backendBaseUrl;
    }
    async lookup(word) {
        const cleanWord = word.trim();
        if (!cleanWord) {
            throw new Error("Word cannot be empty");
        }
        // 1. Try Java / Playwright backend first
        try {
            const backendResult = await this.fetchFromBackend(cleanWord);
            if (backendResult)
                return backendResult;
        }
        catch {
            // Backend not running, proceed to fallback direct fetch
        }
        // 2. Fallback: direct Cambridge Dictionary fetch & client-side DOM parse
        return this.fetchDirectCambridge(cleanWord);
    }
    async fetchFromBackend(word) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000); // 2s timeout for local backend
        try {
            const res = await fetch(`${this.backendBaseUrl}/lookup?word=${encodeURIComponent(word)}`, {
                signal: controller.signal,
            });
            clearTimeout(timeout);
            if (res.ok) {
                return (await res.json());
            }
        }
        catch {
            // ignore and fallback
        }
        finally {
            clearTimeout(timeout);
        }
        return null;
    }
    async fetchDirectCambridge(word) {
        const targetUrl = `https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(word.toLowerCase())}`;
        const res = await fetch(targetUrl, {
            headers: {
                Accept: "text/html",
            },
        });
        if (!res.ok) {
            throw new Error(`Failed to fetch from Cambridge Dictionary (${res.status})`);
        }
        const htmlText = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlText, "text/html");
        const types = [];
        const pronunciations = [];
        const audio = [];
        const meanings = [];
        const examples = [];
        // Extract Part of Speech (POS)
        const posEls = doc.querySelectorAll(".posgram .pos");
        const uniquePos = new Set();
        posEls.forEach((el) => {
            const text = el.textContent?.trim();
            if (text && !uniquePos.has(text)) {
                uniquePos.add(text);
                types.push({ name: text, patterns: [] });
            }
        });
        // Extract Pronunciations & Audios (UK / US)
        const ukIpa = doc.querySelector(".uk .ipa")?.textContent?.trim();
        const usIpa = doc.querySelector(".us .ipa")?.textContent?.trim();
        if (ukIpa) {
            pronunciations.push({
                dialect: "UK",
                variants: [{ type: "standard", ipa: `/${ukIpa}/` }],
            });
        }
        if (usIpa) {
            pronunciations.push({
                dialect: "US",
                variants: [{ type: "standard", ipa: `/${usIpa}/` }],
            });
        }
        const ukAudioSrc = doc.querySelector(".uk audio source[type='audio/mpeg']")?.getAttribute("src");
        const usAudioSrc = doc.querySelector(".us audio source[type='audio/mpeg']")?.getAttribute("src");
        if (ukAudioSrc) {
            const fullUrl = ukAudioSrc.startsWith("http") ? ukAudioSrc : `https://dictionary.cambridge.org${ukAudioSrc}`;
            audio.push({ dialect: "UK", url: fullUrl, source: "Cambridge" });
        }
        if (usAudioSrc) {
            const fullUrl = usAudioSrc.startsWith("http") ? usAudioSrc : `https://dictionary.cambridge.org${usAudioSrc}`;
            audio.push({ dialect: "US", url: fullUrl, source: "Cambridge" });
        }
        // Extract Definitions
        const defEls = doc.querySelectorAll(".def-block");
        defEls.forEach((block, idx) => {
            if (idx > 4)
                return; // Limit to top 5 definitions for capture
            const defText = block.querySelector(".def")?.textContent?.trim();
            if (defText) {
                // Clean trailing colon
                const cleanDef = defText.replace(/:$/, "").trim();
                meanings.push({
                    id: generateUUID(),
                    text: cleanDef,
                    context: "",
                    source: "dictionary",
                });
            }
            // Extract examples inside this definition block
            const exEls = block.querySelectorAll(".examp .eg");
            exEls.forEach((exEl, exIdx) => {
                if (exIdx > 1)
                    return; // top 2 per def
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
}
export const dictionaryClient = new CambridgeAdapter();
