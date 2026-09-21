import React, { useEffect, useState } from "react";
import type { VocabularyEntry } from "@vocab-extend/shared";
import { vocabularyRepository } from "../db/vocabulary.repository";
import { ankiClient } from "../services/anki/anki-client";
import { getLocalDateKey, formatDateDisplay } from "../utils/date";

export const DashboardPage: React.FC = () => {
  const [dateKey, setDateKey] = useState<string>(getLocalDateKey());
  const [entries, setEntries] = useState<VocabularyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Anki Export State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [ankiOnline, setAnkiOnline] = useState<boolean | null>(null);
  const [decks, setDecks] = useState<string[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<string>("");
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("Basic");
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ success: number; failed: number } | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const list = await vocabularyRepository.listByDate(dateKey);
      setEntries(list);
      setSelectedIds(new Set());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [dateKey]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredEntries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEntries.map((e) => e.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Bạn có chắc muốn xóa từ này khỏi bộ nhớ đệm?")) {
      await vocabularyRepository.delete(id);
      await loadData();
    }
  };

  const openAnkiExportModal = async () => {
    setIsExportModalOpen(true);
    setExportResult(null);
    const online = await ankiClient.checkConnection();
    setAnkiOnline(online);
    if (online) {
      const [fetchedDecks, fetchedModels] = await Promise.all([
        ankiClient.getDeckNames().catch((): string[] => []),
        ankiClient.getModelNames().catch((): string[] => []),
      ]);
      setDecks(fetchedDecks);
      if (fetchedDecks.length > 0) setSelectedDeck(fetchedDecks[0]);
      setModels(fetchedModels);
      if (fetchedModels.includes("Basic")) setSelectedModel("Basic");
      else if (fetchedModels.length > 0) setSelectedModel(fetchedModels[0]);
    }
  };

  const handleExecuteExport = async () => {
    if (!selectedDeck) return;
    setExporting(true);
    setExportResult(null);

    const selectedEntries = entries.filter((e) => selectedIds.has(e.id));
    try {
      const results = await ankiClient.exportBatch(selectedEntries, selectedDeck, selectedModel);
      const success = results.filter((r) => r.status === "success").length;
      const failed = results.filter((r) => r.status === "failed").length;
      setExportResult({ success, failed });
      await loadData();
    } finally {
      setExporting(false);
    }
  };

  const filteredEntries = entries.filter((e) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      e.word.toLowerCase().includes(term) ||
      e.meanings.some((m) => m.text.toLowerCase().includes(term))
    );
  });

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "24px 16px" }}>
      {/* Header bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "24px", color: "#0f172a" }}>VocabExtend Dashboard</h1>
          <div style={{ fontSize: "14px", color: "#64748b", marginTop: "4px" }}>
            Quản lý từ vựng đã thu thập và đồng bộ vào Anki
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <input
            type="date"
            value={dateKey}
            onChange={(e) => setDateKey(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              fontSize: "14px",
            }}
          />
          <button
            disabled={selectedIds.size === 0}
            onClick={openAnkiExportModal}
            style={{
              padding: "8px 16px",
              backgroundColor: selectedIds.size > 0 ? "#4f46e5" : "#cbd5e1",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: selectedIds.size > 0 ? "pointer" : "not-allowed",
            }}
          >
            Export sang Anki ({selectedIds.size})
          </button>
        </div>
      </div>

      {/* Control Bar: Search & Select All */}
      <div style={{ background: "#ffffff", padding: "12px 16px", borderRadius: "8px", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "14px", fontWeight: 500 }}>
            <input
              type="checkbox"
              checked={filteredEntries.length > 0 && selectedIds.size === filteredEntries.length}
              onChange={toggleSelectAll}
            />
            Chọn tất cả ({filteredEntries.length} từ)
          </label>
        </div>

        <input
          type="text"
          placeholder="Tìm từ vựng hoặc nghĩa..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: "6px 12px",
            borderRadius: "6px",
            border: "1px solid #cbd5e1",
            fontSize: "13px",
            width: "240px",
          }}
        />
      </div>

      {/* Vocabulary List */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>Đang tải dữ liệu...</div>
      ) : filteredEntries.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 16px", background: "#ffffff", borderRadius: "8px", border: "1px dashed #cbd5e1" }}>
          <div style={{ fontSize: "16px", color: "#475569", marginBottom: "8px" }}>
            Không có từ vựng nào trong ngày {formatDateDisplay(dateKey)}
          </div>
          <div style={{ fontSize: "13px", color: "#94a3b8" }}>
            Hãy bôi đen từ trên bất kỳ trang tài liệu nào, click chuột phải và chọn "Tra từ & Lưu vào VocabExtend".
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {filteredEntries.map((entry) => {
            const isSelected = selectedIds.has(entry.id);
            return (
              <div
                key={entry.id}
                style={{
                  background: "#ffffff",
                  padding: "16px",
                  borderRadius: "8px",
                  border: isSelected ? "1px solid #4f46e5" : "1px solid #e2e8f0",
                  boxShadow: isSelected ? "0 0 0 1px #4f46e5" : "none",
                  display: "flex",
                  gap: "16px",
                  alignItems: "flex-start",
                }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelect(entry.id)}
                  style={{ marginTop: "4px", width: "16px", height: "16px" }}
                />

                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "18px", fontWeight: 700, color: "#1e293b" }}>{entry.word}</span>
                    {entry.types.map((t, idx) => (
                      <span key={idx} style={{ backgroundColor: "#f1f5f9", color: "#475569", padding: "1px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: 600 }}>
                        {t.name}
                      </span>
                    ))}
                    {entry.pronunciations.map((p, idx) => (
                      <span key={idx} style={{ color: "#4338ca", fontSize: "12px" }}>
                        {p.dialect ? `[${p.dialect}] ` : ""}{p.variants.map((v) => v.ipa).join(" ")}
                      </span>
                    ))}
                    {entry.audio?.map((a, idx) =>
                      a.url ? (
                        <button
                          key={`dash-audio-${idx}`}
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
                            padding: "1px 6px",
                            fontSize: "11px",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          🔊 {a.dialect || "Audio"}
                        </button>
                      ) : null
                    )}
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: "11px",
                        padding: "2px 8px",
                        borderRadius: "12px",
                        fontWeight: 600,
                        backgroundColor: entry.status === "exported" ? "#dcfce7" : "#e0e7ff",
                        color: entry.status === "exported" ? "#15803d" : "#3730a3",
                      }}
                    >
                      {entry.status === "exported" ? "✓ Exported Anki" : "Enriched"}
                    </span>
                  </div>

                  {/* Meanings */}
                  <div style={{ marginTop: "8px" }}>
                    {entry.meanings.map((m, idx) => (
                      <div key={m.id} style={{ fontSize: "14px", color: "#0f172a", marginBottom: "4px" }}>
                        {entry.meanings.length > 1 && <span style={{ color: "#94a3b8" }}>{idx + 1}. </span>}
                        <b>{m.text}</b>
                        {m.context && <span style={{ color: "#64748b", fontStyle: "italic", marginLeft: "6px" }}>({m.context})</span>}
                      </div>
                    ))}
                  </div>

                  {/* Examples */}
                  {entry.examples.length > 0 && (
                    <div style={{ marginTop: "6px", fontSize: "13px", color: "#475569", borderLeft: "3px solid #e2e8f0", paddingLeft: "10px" }}>
                      {entry.examples.map((ex) => (
                        <div key={ex.id} style={{ marginBottom: "2px" }}>
                          <i>"{ex.sentence}"</i>
                          {ex.source && <span style={{ color: "#94a3b8", fontSize: "11px", marginLeft: "6px" }}>[{ex.source}]</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Source metadata */}
                  {entry.capture.sourceUrl && (
                    <div style={{ marginTop: "8px", fontSize: "11px", color: "#94a3b8" }}>
                      Nguồn: <a href={entry.capture.sourceUrl} target="_blank" rel="noreferrer" style={{ color: "#6366f1" }}>{entry.capture.sourceTitle || entry.capture.sourceUrl}</a>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleDelete(entry.id)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                    padding: "4px 8px",
                  }}
                  title="Xóa"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Anki Export Modal */}
      {isExportModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div style={{ background: "#ffffff", borderRadius: "10px", width: "480px", padding: "24px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}>
            <h2 style={{ margin: 0, fontSize: "18px", color: "#1e293b", marginBottom: "12px" }}>
              Xuất {selectedIds.size} từ vựng sang Anki
            </h2>

            {ankiOnline === false ? (
              <div style={{ backgroundColor: "#fee2e2", color: "#991b1b", padding: "12px", borderRadius: "6px", fontSize: "13px", marginBottom: "16px" }}>
                <b>Không kết nối được AnkiConnect!</b>
                <p style={{ margin: "6px 0 0 0" }}>
                  Hãy đảm bảo bạn đã mở ứng dụng Anki trên máy và cài đặt plugin <b>AnkiConnect</b> (port mặc định 8765).
                </p>
              </div>
            ) : ankiOnline === true ? (
              <div>
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                    Chọn Anki Deck:
                  </label>
                  <select
                    value={selectedDeck}
                    onChange={(e) => setSelectedDeck(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  >
                    {decks.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>
                    Chọn Note Model:
                  </label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  >
                    {models.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div style={{ padding: "20px 0", textAlign: "center", color: "#64748b" }}>
                Đang kiểm tra kết nối AnkiConnect...
              </div>
            )}

            {exportResult && (
              <div style={{ padding: "10px", backgroundColor: "#f0fdf4", color: "#166534", borderRadius: "6px", fontSize: "13px", marginBottom: "16px" }}>
                ✓ Đã tạo thành công {exportResult.success} note{exportResult.failed > 0 ? ` (Thất bại: ${exportResult.failed})` : ""}!
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                style={{ padding: "8px 16px", background: "#f1f5f9", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }}
              >
                Đóng
              </button>
              {ankiOnline && (
                <button
                  type="button"
                  disabled={exporting || !selectedDeck}
                  onClick={handleExecuteExport}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: exporting ? "#94a3b8" : "#4f46e5",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    cursor: exporting ? "not-allowed" : "pointer",
                    fontSize: "13px",
                    fontWeight: 600,
                  }}
                >
                  {exporting ? "Đang gửi sang Anki..." : "Bắt đầu xuất"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
