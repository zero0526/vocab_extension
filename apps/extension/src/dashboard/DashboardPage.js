import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { vocabularyRepository } from "../db/vocabulary.repository";
import { ankiClient } from "../services/anki/anki-client";
import { getLocalDateKey, formatDateDisplay } from "../utils/date";
export const DashboardPage = () => {
    const [dateKey, setDateKey] = useState(getLocalDateKey());
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedIds, setSelectedIds] = useState(new Set());
    // Anki Export State
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [ankiOnline, setAnkiOnline] = useState(null);
    const [decks, setDecks] = useState([]);
    const [selectedDeck, setSelectedDeck] = useState("");
    const [models, setModels] = useState([]);
    const [selectedModel, setSelectedModel] = useState("Basic");
    const [exporting, setExporting] = useState(false);
    const [exportResult, setExportResult] = useState(null);
    const loadData = async () => {
        setLoading(true);
        try {
            const list = await vocabularyRepository.listByDate(dateKey);
            setEntries(list);
            setSelectedIds(new Set());
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        loadData();
    }, [dateKey]);
    const toggleSelectAll = () => {
        if (selectedIds.size === filteredEntries.length) {
            setSelectedIds(new Set());
        }
        else {
            setSelectedIds(new Set(filteredEntries.map((e) => e.id)));
        }
    };
    const toggleSelect = (id) => {
        const next = new Set(selectedIds);
        if (next.has(id))
            next.delete(id);
        else
            next.add(id);
        setSelectedIds(next);
    };
    const handleDelete = async (id) => {
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
                ankiClient.getDeckNames().catch(() => []),
                ankiClient.getModelNames().catch(() => []),
            ]);
            setDecks(fetchedDecks);
            if (fetchedDecks.length > 0)
                setSelectedDeck(fetchedDecks[0]);
            setModels(fetchedModels);
            if (fetchedModels.includes("Basic"))
                setSelectedModel("Basic");
            else if (fetchedModels.length > 0)
                setSelectedModel(fetchedModels[0]);
        }
    };
    const handleExecuteExport = async () => {
        if (!selectedDeck)
            return;
        setExporting(true);
        setExportResult(null);
        const selectedEntries = entries.filter((e) => selectedIds.has(e.id));
        try {
            const results = await ankiClient.exportBatch(selectedEntries, selectedDeck, selectedModel);
            const success = results.filter((r) => r.status === "success").length;
            const failed = results.filter((r) => r.status === "failed").length;
            setExportResult({ success, failed });
            await loadData();
        }
        finally {
            setExporting(false);
        }
    };
    const filteredEntries = entries.filter((e) => {
        if (!searchTerm.trim())
            return true;
        const term = searchTerm.toLowerCase();
        return (e.word.toLowerCase().includes(term) ||
            e.meanings.some((m) => m.text.toLowerCase().includes(term)));
    });
    return (_jsxs("div", { style: { maxWidth: "1000px", margin: "0 auto", padding: "24px 16px" }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }, children: [_jsxs("div", { children: [_jsx("h1", { style: { margin: 0, fontSize: "24px", color: "#0f172a" }, children: "VocabExtend Dashboard" }), _jsx("div", { style: { fontSize: "14px", color: "#64748b", marginTop: "4px" }, children: "Qu\u1EA3n l\u00FD t\u1EEB v\u1EF1ng \u0111\u00E3 thu th\u1EADp v\u00E0 \u0111\u1ED3ng b\u1ED9 v\u00E0o Anki" })] }), _jsxs("div", { style: { display: "flex", gap: "10px", alignItems: "center" }, children: [_jsx("input", { type: "date", value: dateKey, onChange: (e) => setDateKey(e.target.value), style: {
                                    padding: "8px 12px",
                                    borderRadius: "6px",
                                    border: "1px solid #cbd5e1",
                                    fontSize: "14px",
                                } }), _jsxs("button", { disabled: selectedIds.size === 0, onClick: openAnkiExportModal, style: {
                                    padding: "8px 16px",
                                    backgroundColor: selectedIds.size > 0 ? "#4f46e5" : "#cbd5e1",
                                    color: "#ffffff",
                                    border: "none",
                                    borderRadius: "6px",
                                    fontSize: "14px",
                                    fontWeight: 600,
                                    cursor: selectedIds.size > 0 ? "pointer" : "not-allowed",
                                }, children: ["Export sang Anki (", selectedIds.size, ")"] })] })] }), _jsxs("div", { style: { background: "#ffffff", padding: "12px 16px", borderRadius: "8px", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }, children: [_jsx("div", { style: { display: "flex", alignItems: "center", gap: "12px" }, children: _jsxs("label", { style: { display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "14px", fontWeight: 500 }, children: [_jsx("input", { type: "checkbox", checked: filteredEntries.length > 0 && selectedIds.size === filteredEntries.length, onChange: toggleSelectAll }), "Ch\u1ECDn t\u1EA5t c\u1EA3 (", filteredEntries.length, " t\u1EEB)"] }) }), _jsx("input", { type: "text", placeholder: "T\u00ECm t\u1EEB v\u1EF1ng ho\u1EB7c ngh\u0129a...", value: searchTerm, onChange: (e) => setSearchTerm(e.target.value), style: {
                            padding: "6px 12px",
                            borderRadius: "6px",
                            border: "1px solid #cbd5e1",
                            fontSize: "13px",
                            width: "240px",
                        } })] }), loading ? (_jsx("div", { style: { textAlign: "center", padding: "40px", color: "#64748b" }, children: "\u0110ang t\u1EA3i d\u1EEF li\u1EC7u..." })) : filteredEntries.length === 0 ? (_jsxs("div", { style: { textAlign: "center", padding: "48px 16px", background: "#ffffff", borderRadius: "8px", border: "1px dashed #cbd5e1" }, children: [_jsxs("div", { style: { fontSize: "16px", color: "#475569", marginBottom: "8px" }, children: ["Kh\u00F4ng c\u00F3 t\u1EEB v\u1EF1ng n\u00E0o trong ng\u00E0y ", formatDateDisplay(dateKey)] }), _jsx("div", { style: { fontSize: "13px", color: "#94a3b8" }, children: "H\u00E3y b\u00F4i \u0111en t\u1EEB tr\u00EAn b\u1EA5t k\u1EF3 trang t\u00E0i li\u1EC7u n\u00E0o, click chu\u1ED9t ph\u1EA3i v\u00E0 ch\u1ECDn \"Tra t\u1EEB & L\u01B0u v\u00E0o VocabExtend\"." })] })) : (_jsx("div", { style: { display: "flex", flexDirection: "column", gap: "12px" }, children: filteredEntries.map((entry) => {
                    const isSelected = selectedIds.has(entry.id);
                    return (_jsxs("div", { style: {
                            background: "#ffffff",
                            padding: "16px",
                            borderRadius: "8px",
                            border: isSelected ? "1px solid #4f46e5" : "1px solid #e2e8f0",
                            boxShadow: isSelected ? "0 0 0 1px #4f46e5" : "none",
                            display: "flex",
                            gap: "16px",
                            alignItems: "flex-start",
                        }, children: [_jsx("input", { type: "checkbox", checked: isSelected, onChange: () => toggleSelect(entry.id), style: { marginTop: "4px", width: "16px", height: "16px" } }), _jsxs("div", { style: { flex: 1 }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }, children: [_jsx("span", { style: { fontSize: "18px", fontWeight: 700, color: "#1e293b" }, children: entry.word }), entry.types.map((t, idx) => (_jsx("span", { style: { backgroundColor: "#f1f5f9", color: "#475569", padding: "1px 6px", borderRadius: "4px", fontSize: "11px", fontWeight: 600 }, children: t.name }, idx))), entry.pronunciations.map((p, idx) => (_jsxs("span", { style: { color: "#4338ca", fontSize: "12px" }, children: [p.dialect ? `[${p.dialect}] ` : "", p.variants.map((v) => v.ipa).join(" ")] }, idx))), _jsx("span", { style: {
                                                    marginLeft: "auto",
                                                    fontSize: "11px",
                                                    padding: "2px 8px",
                                                    borderRadius: "12px",
                                                    fontWeight: 600,
                                                    backgroundColor: entry.status === "exported" ? "#dcfce7" : "#e0e7ff",
                                                    color: entry.status === "exported" ? "#15803d" : "#3730a3",
                                                }, children: entry.status === "exported" ? "✓ Exported Anki" : "Enriched" })] }), _jsx("div", { style: { marginTop: "8px" }, children: entry.meanings.map((m, idx) => (_jsxs("div", { style: { fontSize: "14px", color: "#0f172a", marginBottom: "4px" }, children: [entry.meanings.length > 1 && _jsxs("span", { style: { color: "#94a3b8" }, children: [idx + 1, ". "] }), _jsx("b", { children: m.text }), m.context && _jsxs("span", { style: { color: "#64748b", fontStyle: "italic", marginLeft: "6px" }, children: ["(", m.context, ")"] })] }, m.id))) }), entry.examples.length > 0 && (_jsx("div", { style: { marginTop: "6px", fontSize: "13px", color: "#475569", borderLeft: "3px solid #e2e8f0", paddingLeft: "10px" }, children: entry.examples.map((ex) => (_jsxs("div", { style: { marginBottom: "2px" }, children: [_jsxs("i", { children: ["\"", ex.sentence, "\""] }), ex.source && _jsxs("span", { style: { color: "#94a3b8", fontSize: "11px", marginLeft: "6px" }, children: ["[", ex.source, "]"] })] }, ex.id))) })), entry.capture.sourceUrl && (_jsxs("div", { style: { marginTop: "8px", fontSize: "11px", color: "#94a3b8" }, children: ["Ngu\u1ED3n: ", _jsx("a", { href: entry.capture.sourceUrl, target: "_blank", rel: "noreferrer", style: { color: "#6366f1" }, children: entry.capture.sourceTitle || entry.capture.sourceUrl })] }))] }), _jsx("button", { onClick: () => handleDelete(entry.id), style: {
                                    background: "none",
                                    border: "none",
                                    color: "#94a3b8",
                                    cursor: "pointer",
                                    padding: "4px 8px",
                                }, title: "X\u00F3a", children: "\u2715" })] }, entry.id));
                }) })), isExportModalOpen && (_jsx("div", { style: {
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
                }, children: _jsxs("div", { style: { background: "#ffffff", borderRadius: "10px", width: "480px", padding: "24px", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }, children: [_jsxs("h2", { style: { margin: 0, fontSize: "18px", color: "#1e293b", marginBottom: "12px" }, children: ["Xu\u1EA5t ", selectedIds.size, " t\u1EEB v\u1EF1ng sang Anki"] }), ankiOnline === false ? (_jsxs("div", { style: { backgroundColor: "#fee2e2", color: "#991b1b", padding: "12px", borderRadius: "6px", fontSize: "13px", marginBottom: "16px" }, children: [_jsx("b", { children: "Kh\u00F4ng k\u1EBFt n\u1ED1i \u0111\u01B0\u1EE3c AnkiConnect!" }), _jsxs("p", { style: { margin: "6px 0 0 0" }, children: ["H\u00E3y \u0111\u1EA3m b\u1EA3o b\u1EA1n \u0111\u00E3 m\u1EDF \u1EE9ng d\u1EE5ng Anki tr\u00EAn m\u00E1y v\u00E0 c\u00E0i \u0111\u1EB7t plugin ", _jsx("b", { children: "AnkiConnect" }), " (port m\u1EB7c \u0111\u1ECBnh 8765)."] })] })) : ankiOnline === true ? (_jsxs("div", { children: [_jsxs("div", { style: { marginBottom: "14px" }, children: [_jsx("label", { style: { display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }, children: "Ch\u1ECDn Anki Deck:" }), _jsx("select", { value: selectedDeck, onChange: (e) => setSelectedDeck(e.target.value), style: { width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1" }, children: decks.map((d) => (_jsx("option", { value: d, children: d }, d))) })] }), _jsxs("div", { style: { marginBottom: "16px" }, children: [_jsx("label", { style: { display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "4px" }, children: "Ch\u1ECDn Note Model:" }), _jsx("select", { value: selectedModel, onChange: (e) => setSelectedModel(e.target.value), style: { width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1" }, children: models.map((m) => (_jsx("option", { value: m, children: m }, m))) })] })] })) : (_jsx("div", { style: { padding: "20px 0", textAlign: "center", color: "#64748b" }, children: "\u0110ang ki\u1EC3m tra k\u1EBFt n\u1ED1i AnkiConnect..." })), exportResult && (_jsxs("div", { style: { padding: "10px", backgroundColor: "#f0fdf4", color: "#166534", borderRadius: "6px", fontSize: "13px", marginBottom: "16px" }, children: ["\u2713 \u0110\u00E3 t\u1EA1o th\u00E0nh c\u00F4ng ", exportResult.success, " note", exportResult.failed > 0 ? ` (Thất bại: ${exportResult.failed})` : "", "!"] })), _jsxs("div", { style: { display: "flex", justifyContent: "flex-end", gap: "10px" }, children: [_jsx("button", { type: "button", onClick: () => setIsExportModalOpen(false), style: { padding: "8px 16px", background: "#f1f5f9", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px" }, children: "\u0110\u00F3ng" }), ankiOnline && (_jsx("button", { type: "button", disabled: exporting || !selectedDeck, onClick: handleExecuteExport, style: {
                                        padding: "8px 16px",
                                        backgroundColor: exporting ? "#94a3b8" : "#4f46e5",
                                        color: "#ffffff",
                                        border: "none",
                                        borderRadius: "6px",
                                        cursor: exporting ? "not-allowed" : "pointer",
                                        fontSize: "13px",
                                        fontWeight: 600,
                                    }, children: exporting ? "Đang gửi sang Anki..." : "Bắt đầu xuất" }))] })] }) }))] }));
};
