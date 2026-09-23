import React, { useEffect, useState, useCallback } from "react";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { vocabularyFormSchema, type VocabularyFormData, type VocabularyEntry } from "@vocab-extend/shared";
import { MeaningEditor } from "../components/capture/MeaningEditor";
import { ExampleEditor } from "../components/capture/ExampleEditor";
import { saveVocabulary, updateVocabulary, createInitialFormData } from "../services/vocabulary.service";
import { dictionaryClient } from "../services/dictionary/cambridge-adapter";
import { cambridgeAuth } from "../services/dictionary/cambridge-auth";
import { ankiClient } from "../services/anki/anki-client";
import { vocabularyRepository } from "../db/vocabulary.repository";
import { generateUUID } from "../utils/text";
import { getLocalDateKey } from "../utils/date";
import { downloadAudioAsBase64, playAudioResource } from "../utils/audio";


export const QuickCapturePage: React.FC = () => {
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [todayWords, setTodayWords] = useState<VocabularyEntry[]>([]);
  const [hasCambridgeToken, setHasCambridgeToken] = useState(false);
  const [refreshingToken, setRefreshingToken] = useState(false);
  const [updatingAction, setUpdatingAction] = useState(false);

  // Trạng thái từ đã tồn tại trong DB / Anki
  const [duplicateInfo, setDuplicateInfo] = useState<{
    existingEntry: VocabularyEntry;
    isInAnki: boolean;
    ankiNoteId?: number;
    ankiDeckName?: string;
    fromDb: boolean;
  } | null>(null);


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
    setSaveSuccessMessage(null);
    setErrorMessage(null);
    setDuplicateInfo(null);
    const initial = createInitialFormData(payload.word, payload.sourceUrl, payload.sourceTitle);
    reset(initial);
    await triggerDictionaryLookup(payload.word);
  };

  const triggerDictionaryLookup = async (wordToLookup?: string, forceRemote = false) => {
    const word = wordToLookup || currentWord;
    if (!word?.trim()) {
      setErrorMessage("Vui lòng nhập từ trước khi bấm Crawl");
      return;
    }

    setLoadingLookup(true);
    setErrorMessage(null);

    try {
      const dictData = await dictionaryClient.lookup(word.trim(), { forceRemote });

      if (dictData.types.length > 0) setValue("types", dictData.types);
      if (dictData.pronunciations.length > 0) setValue("pronunciations", dictData.pronunciations);

      // Điền meanings
      if (dictData.meanings.length > 0) {
        setValue("meanings", dictData.meanings);
      }

      // Điền examples
      if (dictData.examples.length > 0) {
        setValue("examples", dictData.examples);
      }

      // Điền memory hint nếu bản ghi cũ đã có
      if (dictData.existingEntry?.memory) {
        setValue("memory", dictData.existingEntry.memory);
      }

      // Tải ngầm file audio để lưu vào IndexedDB và nghe offline ngay lập tức
      if (dictData.audio.length > 0) {
        setValue("audio", dictData.audio);

        Promise.all(
          dictData.audio.map(async (a) => {
            if (!a.url) return a;
            try {
              const { rawBase64 } = await downloadAudioAsBase64(a.url, word.trim(), a.dialect);
              const safeWord = word.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
              const filename = `vocab_${safeWord}_${(a.dialect || "audio").toLowerCase()}.mp3`;
              return {
                ...a,
                base64: rawBase64,
                filename,
              };
            } catch {
              return a;
            }
          })
        ).then((downloaded) => {
          setValue("audio", downloaded);
        }).catch(() => {});
      }

      // Xử lý phát hiện từ đã có trong DB
      if (dictData.existingEntry) {
        setDuplicateInfo({
          existingEntry: dictData.existingEntry,
          isInAnki: Boolean(dictData.isInAnki),
          ankiNoteId: dictData.ankiNoteId,
          ankiDeckName: dictData.ankiDeckName,
          fromDb: Boolean(dictData.fromDb),
        });
      } else {
        setDuplicateInfo(null);
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Không thể tải dữ liệu từ điển. Vui lòng kiểm tra lại."
      );
    } finally {
      setLoadingLookup(false);
    }
  };

  /**
   * Cập nhật bản ghi hiện tại trong DB, đồng thời cập nhật thẻ trên Anki (nếu có)
   */
  const handleUpdate = async () => {
    if (!duplicateInfo) return;
    setErrorMessage(null);
    setSaveSuccessMessage(null);

    const isValid = await form.trigger();
    if (!isValid) {
      setErrorMessage("Vui lòng kiểm tra lại các trường thông tin trong form");
      return;
    }

    setUpdatingAction(true);
    const data = form.getValues();

    try {
      const updated = await updateVocabulary(duplicateInfo.existingEntry.id, data);

      let ankiSuccessMsg = "";
      if (duplicateInfo.isInAnki && duplicateInfo.ankiNoteId) {
        try {
          await ankiClient.updateNote(duplicateInfo.ankiNoteId, updated);
          ankiSuccessMsg = ` và thẻ trên Anki (Note #${duplicateInfo.ankiNoteId})`;
        } catch (ankiErr) {
          console.warn("Không thể cập nhật trực tiếp trên Anki:", ankiErr);
          setErrorMessage(
            `Đã cập nhật DB nhưng không thể đồng bộ sang Anki: ${ankiErr instanceof Error ? ankiErr.message : String(ankiErr)}`
          );
        }
      }

      setDuplicateInfo(null);
      reset(createInitialFormData(""));
      setSaveSuccessMessage(`✓ Đã cập nhật từ vào Local Cache${ankiSuccessMsg} thành công!`);
      await loadTodayWords();
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Lỗi khi cập nhật từ");
    } finally {
      setUpdatingAction(false);
    }
  };

  /**
   * Lưu thành một bản ghi mới độc lập (không ghi đè bản ghi cũ)
   */
  const handleSaveAsNew = async () => {
    setErrorMessage(null);
    setSaveSuccessMessage(null);

    const isValid = await form.trigger();
    if (!isValid) {
      setErrorMessage("Vui lòng kiểm tra lại các trường thông tin trong form");
      return;
    }

    setUpdatingAction(true);
    const data = form.getValues();

    try {
      await saveVocabulary(data, { forceNew: true });
      setDuplicateInfo(null);
      reset(createInitialFormData(""));
      setSaveSuccessMessage("✓ Đã lưu thành 1 bản ghi mới độc lập thành công!");
      await loadTodayWords();
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Lỗi khi lưu bản ghi mới");
    } finally {
      setUpdatingAction(false);
    }
  };

  /**
   * Bỏ qua cảnh báo trùng
   */
  const handleSkip = () => {
    setDuplicateInfo(null);
  };

  /**
   * Cào lại dữ liệu từ Cambridge / DictionaryAPI trực tuyến
   */
  const handleForceReCrawl = async () => {
    await triggerDictionaryLookup(undefined, true);
  };

  const onSubmit = async (data: VocabularyFormData) => {
    // Nếu đang ở trạng thái phát hiện từ trùng và người dùng nhấn nút submit chính
    if (duplicateInfo) {
      await handleUpdate();
      return;
    }

    setErrorMessage(null);
    setSaveSuccessMessage(null);

    try {
      await saveVocabulary(data);

      // Xóa khỏi hàng đợi lưu trữ tạm thời
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        await chrome.storage.local.remove(["pendingCapture"]);
      }

      // Dọn sạch form để sẵn sàng bắt từ tiếp theo
      reset(createInitialFormData(""));

      setSaveSuccessMessage("✓ Đã lưu từ vào Local Cache (IndexedDB) thành công!");
      await loadTodayWords();
      setTimeout(() => setSaveSuccessMessage(null), 4000);
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
    setSaveSuccessMessage(null);
    setDuplicateInfo(null);
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
                a.url || a.base64 ? (
                  <button
                    key={`audio-${idx}`}
                    type="button"
                    title={`Nghe phát âm ${a.dialect || ""}${a.base64 ? " (Đã cache offline)" : ""}`}
                    onClick={() => playAudioResource(a)}
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
                    🔊 {a.dialect || "Audio"}{a.base64 ? " ⚡" : ""}
                  </button>
                ) : null
              )}
            </div>
          )}
        </div>

        {/* Duplicate / Existing in DB & Anki Banner */}
        {duplicateInfo && (
          <div
            style={{
              background: "#fffbeb",
              border: "1px solid #fcd34d",
              borderRadius: "8px",
              padding: "12px",
              marginBottom: "16px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "13px", color: "#92400e", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>⚠️ Từ này đã tồn tại trong CSDL</span>
                  {duplicateInfo.fromDb && (
                    <span style={{ fontSize: "10px", background: "#fef3c7", color: "#b45309", padding: "1px 6px", borderRadius: "4px", border: "1px solid #fde68a" }}>
                      Đã kéo từ DB ra
                    </span>
                  )}
                </div>
                <div style={{ fontSize: "11px", color: "#78350f", marginTop: "2px" }}>
                  Lưu lúc: {new Date(duplicateInfo.existingEntry.createdAt).toLocaleDateString("vi-VN")}
                  {duplicateInfo.existingEntry.meanings.length > 0 && ` • ${duplicateInfo.existingEntry.meanings.length} nghĩa`}
                </div>
              </div>

              {/* Trạng thái Anki */}
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "3px 8px",
                  borderRadius: "12px",
                  backgroundColor: duplicateInfo.isInAnki ? "#dcfce7" : "#f1f5f9",
                  color: duplicateInfo.isInAnki ? "#15803d" : "#64748b",
                  border: duplicateInfo.isInAnki ? "1px solid #86efac" : "1px solid #cbd5e1",
                  whiteSpace: "nowrap",
                }}
                title={duplicateInfo.isInAnki ? `Deck: ${duplicateInfo.ankiDeckName || "Anki"} | Note #${duplicateInfo.ankiNoteId || ""}` : "Chưa xuất sang Anki"}
              >
                {duplicateInfo.isInAnki
                  ? `🟢 Đã có trong Anki${duplicateInfo.ankiNoteId ? ` (#${duplicateInfo.ankiNoteId})` : ""}`
                  : "⚪ Chưa có trong Anki"}
              </span>
            </div>

            <div style={{ fontSize: "12px", color: "#451a03", marginBottom: "10px" }}>
              Từ này đã được lưu trước đó. Bạn có thể cập nhật nội dung cũ (đồng bộ Anki), thêm một bản ghi mới, hoặc bỏ qua:
            </div>

            {/* 3 Lựa chọn hành động: Cập nhật / Thêm bản ghi mới / Bỏ qua */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              <button
                type="button"
                disabled={updatingAction}
                onClick={handleUpdate}
                style={{
                  flex: "1 1 auto",
                  padding: "7px 12px",
                  background: "#2563eb",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "5px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: updatingAction ? "wait" : "pointer",
                }}
                title="Cập nhật bản ghi trong DB và đồng bộ lên Anki (nếu đã có thẻ)"
              >
                {updatingAction ? "Đang cập nhật..." : duplicateInfo.isInAnki ? "🔄 Cập nhật (DB & Anki)" : "🔄 Cập nhật DB"}
              </button>

              <button
                type="button"
                disabled={updatingAction}
                onClick={handleSaveAsNew}
                style={{
                  flex: "1 1 auto",
                  padding: "7px 12px",
                  background: "#16a34a",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "5px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: updatingAction ? "wait" : "pointer",
                }}
                title="Lưu thành bản ghi mới độc lập"
              >
                ➕ Thêm bản ghi mới
              </button>

              <button
                type="button"
                onClick={handleSkip}
                style={{
                  padding: "7px 12px",
                  background: "#ffffff",
                  color: "#475569",
                  border: "1px solid #cbd5e1",
                  borderRadius: "5px",
                  fontSize: "12px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
                title="Bỏ qua cảnh báo trùng"
              >
                Bỏ qua
              </button>

              {duplicateInfo.fromDb && (
                <button
                  type="button"
                  disabled={loadingLookup}
                  onClick={handleForceReCrawl}
                  style={{
                    padding: "7px 10px",
                    background: "#f8fafc",
                    color: "#6366f1",
                    border: "1px dashed #a5b4fc",
                    borderRadius: "5px",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: loadingLookup ? "wait" : "pointer",
                  }}
                  title="Bỏ qua dữ liệu trong DB và cào mới lại từ Cambridge trực tuyến"
                >
                  🌐 Cào lại Cambridge
                </button>
              )}
            </div>
          </div>
        )}

        {/* Meanings */}
        <MeaningEditor
          control={control}
          register={register}
          errors={errors}
          setValue={setValue}
          watch={watch}
        />

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
        {saveSuccessMessage && (
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
            {saveSuccessMessage}
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
            disabled={isSubmitting || updatingAction}
            style={{
              flex: 1,
              padding: "12px",
              backgroundColor: (isSubmitting || updatingAction) ? "#94a3b8" : duplicateInfo ? "#2563eb" : "#16a34a",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: 700,
              cursor: (isSubmitting || updatingAction) ? "not-allowed" : "pointer",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            }}
          >
            {(isSubmitting || updatingAction)
              ? "Đang lưu..."
              : duplicateInfo
                ? (duplicateInfo.isInAnki ? "🔄 Cập nhật (DB & Anki)" : "🔄 Cập nhật từ vựng")
                : "💾 Lưu vào IndexedDB"}
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
                    {item.audio?.map((a, i) => (a.url || a.base64) && (
                      <button
                        key={i}
                        type="button"
                        title={a.base64 ? "Đã cache offline" : ""}
                        onClick={() => playAudioResource(a)}
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
                        🔊 {a.dialect || ""}{a.base64 ? " ⚡" : ""}
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
