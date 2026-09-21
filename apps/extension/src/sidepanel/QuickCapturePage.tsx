import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { vocabularyFormSchema, type VocabularyFormData } from "@vocab-extend/shared";
import { MeaningEditor } from "../components/capture/MeaningEditor";
import { ExampleEditor } from "../components/capture/ExampleEditor";
import { saveVocabulary, createInitialFormData } from "../services/vocabulary.service";
import { dictionaryClient } from "../services/dictionary/cambridge-adapter";
import { generateUUID } from "../utils/text";

export const QuickCapturePage: React.FC = () => {
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const form = useForm<VocabularyFormData>({
    resolver: zodResolver(vocabularyFormSchema),
    defaultValues: createInitialFormData(""),
  });

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = form;

  const currentWord = watch("word");
  const pronunciations = watch("pronunciations");
  const types = watch("types");

  // Load pending capture from storage or listener
  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.get(["pendingCapture"], (res) => {
        if (res.pendingCapture?.word) {
          handleNewCapture(res.pendingCapture);
        }
      });

      const messageListener = (msg: { type: string; payload: { word: string; sourceUrl?: string; sourceTitle?: string } }) => {
        if (msg.type === "NEW_SELECTION_CAPTURE" && msg.payload?.word) {
          handleNewCapture(msg.payload);
        }
      };

      chrome.runtime.onMessage.addListener(messageListener);
      return () => {
        chrome.runtime.onMessage.removeListener(messageListener);
      };
    }
  }, []);

  const handleNewCapture = async (payload: { word: string; sourceUrl?: string; sourceTitle?: string }) => {
    setSaveSuccess(false);
    setErrorMessage(null);
    const initial = createInitialFormData(payload.word, payload.sourceUrl, payload.sourceTitle);
    reset(initial);
    await triggerDictionaryLookup(payload.word);
  };

  const triggerDictionaryLookup = async (wordToLookup?: string) => {
    const word = wordToLookup || currentWord;
    if (!word?.trim()) return;

    setLoadingLookup(true);
    setErrorMessage(null);

    try {
      const dictData = await dictionaryClient.lookup(word.trim());
      if (dictData.types.length > 0) setValue("types", dictData.types);
      if (dictData.pronunciations.length > 0) setValue("pronunciations", dictData.pronunciations);
      if (dictData.audio.length > 0) setValue("audio", dictData.audio);

      // Pre-fill meanings if currently empty or only has empty item
      const currentMeanings = watch("meanings");
      if (dictData.meanings.length > 0 && (!currentMeanings.length || !currentMeanings[0].text)) {
        setValue("meanings", [
          {
            id: generateUUID(),
            text: dictData.meanings[0].text,
            context: dictData.meanings[0].context || "",
            source: "dictionary",
          },
        ]);
      }

      // Add Cambridge example if available
      if (dictData.examples.length > 0) {
        const currentExamples = watch("examples");
        setValue("examples", [...currentExamples, ...dictData.examples]);
      }
    } catch (err) {
      console.warn("Dictionary lookup failed or partial:", err);
    } finally {
      setLoadingLookup(false);
    }
  };

  const onSubmit = async (data: VocabularyFormData) => {
    setErrorMessage(null);
    setSaveSuccess(false);

    try {
      await saveVocabulary(data);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Lỗi khi lưu từ vào IndexedDB");
    }
  };

  const openDashboard = () => {
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage({ type: "OPEN_DASHBOARD" });
    }
  };

  return (
    <div style={{ maxWidth: "480px", margin: "0 auto", padding: "16px", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "18px", color: "#1e1b4b" }}>VocabExtend</h2>
          <span style={{ fontSize: "12px", color: "#64748b" }}>Quick Capture & Cambridge Enrich</span>
        </div>
        <button
          onClick={openDashboard}
          style={{
            background: "#e0e7ff",
            color: "#3730a3",
            border: "none",
            borderRadius: "6px",
            padding: "6px 10px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Dashboard 📊
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Word input & Lookup button */}
        <div style={{ background: "#ffffff", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#64748b", marginBottom: "4px" }}>
            TỪ CẦN LƯU (WORD)
          </label>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              {...register("word")}
              placeholder="VD: reconcile, provision..."
              style={{
                flex: 1,
                padding: "8px 10px",
                fontSize: "16px",
                fontWeight: 600,
                color: "#1e293b",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
              }}
            />
            <button
              type="button"
              disabled={loadingLookup}
              onClick={() => triggerDictionaryLookup()}
              style={{
                padding: "8px 12px",
                backgroundColor: loadingLookup ? "#94a3b8" : "#4f46e5",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: loadingLookup ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {loadingLookup ? "Đang tra..." : "Crawl"}
            </button>
          </div>
          {errors.word && <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px" }}>{errors.word.message}</div>}

          {/* Pronunciations & Types badge */}
          {(pronunciations?.length > 0 || types?.length > 0) && (
            <div style={{ marginTop: "10px", display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
              {types?.map((t, idx) => (
                <span
                  key={idx}
                  style={{
                    backgroundColor: "#f1f5f9",
                    color: "#475569",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    fontSize: "11px",
                    fontWeight: 600,
                  }}
                >
                  {t.name}
                </span>
              ))}
              {pronunciations?.map((p, idx) => (
                <span
                  key={idx}
                  style={{
                    backgroundColor: "#eef2ff",
                    color: "#4338ca",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    fontSize: "11px",
                  }}
                >
                  {p.dialect ? `${p.dialect}: ` : ""}
                  {p.variants.map((v) => v.ipa).join(" ")}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Meanings */}
        <MeaningEditor control={control} register={register} errors={errors} />
        {errors.meanings && <div style={{ color: "#ef4444", fontSize: "12px", marginBottom: "8px" }}>{errors.meanings.message}</div>}

        {/* Examples */}
        <ExampleEditor control={control} register={register} />

        {/* Memory Hint */}
        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#1e293b", marginBottom: "4px" }}>
            Gợi nhớ / Mẹo thuộc (Memory Hint - tùy chọn)
          </label>
          <input
            {...register("memory")}
            placeholder="Mẹo nhớ nhanh, từ đồng nghĩa hoặc liên tưởng..."
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              fontSize: "13px",
            }}
          />
        </div>

        {/* Feedback messages */}
        {saveSuccess && (
          <div
            style={{
              padding: "10px",
              backgroundColor: "#dcfce7",
              color: "#166534",
              borderRadius: "6px",
              fontSize: "13px",
              marginBottom: "12px",
              fontWeight: 500,
            }}
          >
            ✓ Đã lưu từ vào Local Cache (IndexedDB) thành công!
          </div>
        )}

        {errorMessage && (
          <div
            style={{
              padding: "10px",
              backgroundColor: "#fee2e2",
              color: "#991b1b",
              borderRadius: "6px",
              fontSize: "13px",
              marginBottom: "12px",
            }}
          >
            {errorMessage}
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            width: "100%",
            padding: "12px",
            backgroundColor: isSubmitting ? "#94a3b8" : "#16a34a",
            color: "#ffffff",
            border: "none",
            borderRadius: "6px",
            fontSize: "14px",
            fontWeight: 700,
            cursor: isSubmitting ? "not-allowed" : "pointer",
            boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          }}
        >
          {isSubmitting ? "Đang lưu..." : "💾 Lưu vào IndexedDB"}
        </button>
      </form>
    </div>
  );
};
