import React, { useEffect, useState, useCallback } from "react";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { vocabularyFormSchema, type VocabularyFormData, type VocabularyEntry } from "@vocab-extend/shared";
import { MeaningEditor } from "../components/capture/MeaningEditor";
import { ExampleEditor } from "../components/capture/ExampleEditor";
import { saveVocabulary, createInitialFormData } from "../services/vocabulary.service";
import { dictionaryClient } from "../services/dictionary/cambridge-adapter";
import { cambridgeAuth } from "../services/dictionary/cambridge-auth";
import { vocabularyRepository } from "../db/vocabulary.repository";
import { generateUUID } from "../utils/text";
import { getLocalDateKey } from "../utils/date";

export const QuickCapturePage: React.FC = () => {
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [todayWords, setTodayWords] = useState<VocabularyEntry[]>([]);
  const [hasCambridgeToken, setHasCambridgeToken] = useState(false);
  const [refreshingToken, setRefreshingToken] = useState(false);

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
  const audio = watch("audio");

  const loadTodayWords = useCallback(async () => {
    try {
      const list = await vocabularyRepository.listByDate(getLocalDateKey());
      setTodayWords(list);
    } catch (e) {
      console.warn("Lỗi tải danh sách từ hôm nay:", e);
    }
  }, []);

  // Load pending capture from storage or listener
  useEffect(() => {
    loadTodayWords();

    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.get(["pendingCapture"], (res) => {
        if (res.pendingCapture?.word) {
          handleNewCapture(res.pendingCapture);
          chrome.storage.local.remove(["pendingCapture"]);
        }
      });

      const messageListener = (msg: {
        type: string;
        payload: { word: string; sourceUrl?: string; sourceTitle?: string };
      }) => {
        if (msg.type === "NEW_SELECTION_CAPTURE" && msg.payload?.word) {
          handleNewCapture(msg.payload);
        }
      };

      chrome.runtime.onMessage.addListener(messageListener);
      return () => {
        chrome.runtime.onMessage.removeListener(messageListener);
      };
    }
  }, [loadTodayWords]);

  const handleNewCapture = async (payload: { word: string; sourceUrl?: string; sourceTitle?: string }) => {
    setSaveSuccess(false);
    setErrorMessage(null);
    const initial = createInitialFormData(payload.word, payload.sourceUrl, payload.sourceTitle);
    reset(initial);
    await triggerDictionaryLookup(payload.word);
  };

  const triggerDictionaryLookup = async (wordToLookup?: string) => {
    const word = wordToLookup || currentWord;
    if (!word?.trim()) {
      setErrorMessage("Vui lòng nhập từ trước khi bấm Crawl");
      return;
    }

    setLoadingLookup(true);
    setErrorMessage(null);

    try {
      const dictData = await dictionaryClient.lookup(word.trim());
      if (dictData.types.length > 0) setValue("types", dictData.types);
      if (dictData.pronunciations.length > 0) setValue("pronunciations", dictData.pronunciations);
      if (dictData.audio.length > 0) setValue("audio", dictData.audio);

      // Pre-fill meanings with definitions from dictionary
      if (dictData.meanings.length > 0) {
        setValue("meanings", dictData.meanings);
      }

      // Add Cambridge example if available
      if (dictData.examples.length > 0) {
        setValue("examples", dictData.examples);
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Không thể tải dữ liệu từ điển. Vui lòng kiểm tra lại."
      );
    } finally {
      setLoadingLookup(false);
    }
  };

  const onSubmit = async (data: VocabularyFormData) => {
    setErrorMessage(null);
    setSaveSuccess(false);

    try {
      await saveVocabulary(data);

      // Xóa khỏi hàng đợi lưu trữ tạm thời
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        await chrome.storage.local.remove(["pendingCapture"]);
      }

      // Dọn sạch form để sẵn sàng bắt từ tiếp theo
      reset(createInitialFormData(""));

      setSaveSuccess(true);
      await loadTodayWords();
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Lỗi khi lưu từ vào IndexedDB");
    }
  };

  const onInvalid = (fieldErrors: FieldErrors<VocabularyFormData>) => {
    if (fieldErrors.word) {
      setErrorMessage("Vui lòng nhập từ tiếng Anh (Word)");
    } else {
      setErrorMessage("Vui lòng kiểm tra lại các trường thông tin trong form");
    }
  };

  const resetForNewWord = () => {
    reset(createInitialFormData(""));
    setErrorMessage(null);
    setSaveSuccess(false);
  };

  const handleDeleteWord = async (id: string) => {
    if (confirm("Xóa từ này khỏi bộ nhớ đệm hôm nay?")) {
      await vocabularyRepository.delete(id);
      await loadTodayWords();
    }
  };

  const openDashboard = () => {
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage({ type: "OPEN_DASHBOARD" });
    }
  };

  useEffect(() => {
    cambridgeAuth.hasValidToken().then(setHasCambridgeToken);
  }, []);

  const handleRefreshToken = async () => {
    setRefreshingToken(true);
    setErrorMessage(null);
    try {
      const success = await cambridgeAuth.acquireTokenInteractive();
      setHasCambridgeToken(success);
      if (success && currentWord?.trim()) {
        await triggerDictionaryLookup();
      }
    } finally {
      setRefreshingToken(false);
    }
  };

  return (
    <div style={{ maxWidth: "480px", margin: "0 auto", padding: "16px", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "18px", color: "#1e1b4b" }}>VocabExtend</h2>
          <span style={{ fontSize: "12px", color: "#64748b" }}>Quick Capture & Dictionary Enrich</span>
        </div>
        <button
          onClick={openDashboard}
          style={{
            background: "#e0e7ff",
            color: "#3730a3",
            border: "none",
            borderRadius: "6px",
            padding: "6px 12px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Dashboard 📊 ({todayWords.length})
        </button>
      </div>

      {/* Cambridge Token Status Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: hasCambridgeToken ? "#f0fdf4" : "#f8fafc",
          border: hasCambridgeToken ? "1px solid #bbf7d0" : "1px solid #e2e8f0",
          borderRadius: "6px",
          padding: "6px 10px",
          marginBottom: "14px",
          fontSize: "12px",
        }}
      >
        <span style={{ color: hasCambridgeToken ? "#166534" : "#64748b", fontWeight: 500 }}>
          {hasCambridgeToken ? "🟢 Token Cambridge: Đã sẵn sàng" : "⚪ Token Cambridge: Chưa nạp"}
        </span>
        <button
          type="button"
          disabled={refreshingToken}
          onClick={handleRefreshToken}
          style={{
            background: "#ffffff",
            border: "1px solid #cbd5e1",
            borderRadius: "4px",
            padding: "3px 8px",
            fontSize: "11px",
            fontWeight: 600,
            cursor: refreshingToken ? "wait" : "pointer",
            color: "#334155",
          }}
        >
          {refreshingToken ? "Đang lấy token..." : hasCambridgeToken ? "Làm mới token" : "🔑 Lấy Token"}
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit, onInvalid)}>
        {/* Word input & Lookup button */}
        <div style={{ background: "#ffffff", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#64748b", marginBottom: "4px" }}>
            TỪ CẦN LƯU (WORD)
          </label>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              {...register("word")}
              placeholder="VD: try, reconcile, scalable..."
              style={{
                flex: 1,
                padding: "8px 10px",
                fontSize: "16px",
                fontWeight: 600,
                color: "#1e293b",
                border: errors.word ? "1px solid #ef4444" : "1px solid #cbd5e1",
                borderRadius: "6px",
              }}
            />
            <button
              type="button"
              disabled={loadingLookup}
              onClick={() => triggerDictionaryLookup()}
              style={{
                padding: "8px 14px",
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
              {loadingLookup ? "Đang crawl..." : "🔍 Crawl"}
            </button>
          </div>
          {errors.word && <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px" }}>{errors.word.message}</div>}

          {/* Pronunciations & Types badge & Audio playback */}
          {(pronunciations?.length > 0 || types?.length > 0 || audio?.length > 0) && (
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
              {audio?.map((a, idx) =>
                a.url ? (
                  <button
                    key={`audio-${idx}`}
                    type="button"
                    title={`Nghe phát âm ${a.dialect || ""}`}
                    onClick={() => {
                      const sound = new Audio(a.url);
                      sound.play().catch((err) => console.warn("Lỗi phát audio", err));
                    }}
                    style={{
                      background: "#f0fdf4",
                      color: "#166534",
                      border: "1px solid #bbf7d0",
                      borderRadius: "4px",
                      padding: "2px 8px",
                      fontSize: "11px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    🔊 {a.dialect || "Audio"}
                  </button>
                ) : null
              )}
            </div>
          )}
        </div>

        {/* Meanings */}
        <MeaningEditor control={control} register={register} errors={errors} />

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
              border: "1px solid #fecaca",
            }}
          >
            ⚠️ {errorMessage}
          </div>
        )}

        {/* Submit button group */}
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              flex: 1,
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
          <button
            type="button"
            onClick={resetForNewWord}
            title="Xóa form để nhập từ mới"
            style={{
              padding: "12px 14px",
              backgroundColor: "#f1f5f9",
              color: "#475569",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            + Từ mới
          </button>
        </div>
      </form>

      {/* Real-time Saved Words Today Section */}
      <div style={{ marginTop: "24px", borderTop: "1px solid #e2e8f0", paddingTop: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h3 style={{ margin: 0, fontSize: "14px", color: "#334155", fontWeight: 700 }}>
            📚 Từ đã lưu hôm nay ({todayWords.length})
          </h3>
        </div>

        {todayWords.length === 0 ? (
          <div style={{ fontSize: "12px", color: "#94a3b8", fontStyle: "italic", textAlign: "center", padding: "12px", background: "#ffffff", borderRadius: "6px" }}>
            Chưa có từ nào được lưu hôm nay. Hãy nhập từ và bấm "Lưu vào IndexedDB" ở trên.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {todayWords.map((item) => (
              <div
                key={item.id}
                style={{
                  background: "#ffffff",
                  padding: "10px 12px",
                  borderRadius: "6px",
                  border: "1px solid #e2e8f0",
                  fontSize: "13px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "14px" }}>{item.word}</span>
                    {item.types.map((t, i) => (
                      <span key={i} style={{ fontSize: "10px", background: "#f1f5f9", color: "#475569", padding: "1px 4px", borderRadius: "3px" }}>
                        {t.name}
                      </span>
                    ))}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span
                      style={{
                        fontSize: "10px",
                        padding: "1px 6px",
                        borderRadius: "10px",
                        fontWeight: 600,
                        backgroundColor: item.status === "exported" ? "#dcfce7" : "#e0e7ff",
                        color: item.status === "exported" ? "#15803d" : "#3730a3",
                      }}
                    >
                      {item.status}
                    </span>
                    <button
                      onClick={() => handleDeleteWord(item.id)}
                      style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "12px" }}
                      title="Xóa"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Pronunciations & Audio */}
                {item.pronunciations.length > 0 && (
                  <div style={{ fontSize: "11px", color: "#6366f1", marginBottom: "4px", display: "flex", gap: "6px", alignItems: "center" }}>
                    {item.pronunciations.map((p, i) => (
                      <span key={i}>
                        {p.dialect ? `[${p.dialect}] ` : ""}{p.variants.map((v) => v.ipa).join(" ")}
                      </span>
                    ))}
                    {item.audio?.map((a, i) => a.url && (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          const snd = new Audio(a.url);
                          snd.play().catch(() => {});
                        }}
                        style={{
                          border: "none",
                          background: "#f0fdf4",
                          color: "#166534",
                          borderRadius: "3px",
                          fontSize: "10px",
                          padding: "1px 4px",
                          cursor: "pointer"
                        }}
                      >
                        🔊 {a.dialect || ""}
                      </button>
                    ))}
                  </div>
                )}

                {/* Meaning */}
                <div style={{ color: "#334155" }}>
                  {item.meanings.length > 0 && item.meanings[0].text ? (
                    item.meanings.map((m, idx) => (
                      <div key={m.id} style={{ fontSize: "12px" }}>
                        {item.meanings.length > 1 && `${idx + 1}. `}
                        <b>{m.text}</b>
                      </div>
                    ))
                  ) : (
                    <span style={{ fontStyle: "italic", color: "#94a3b8", fontSize: "12px" }}>
                      (Chưa nhập nghĩa tiếng Việt)
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
