import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { vocabularyFormSchema } from "@vocab-extend/shared";
import { MeaningEditor } from "../components/capture/MeaningEditor";
import { ExampleEditor } from "../components/capture/ExampleEditor";
import { saveVocabulary, createInitialFormData } from "../services/vocabulary.service";
import { dictionaryClient } from "../services/dictionary/cambridge-adapter";
import { generateUUID } from "../utils/text";
export const QuickCapturePage = () => {
    const [loadingLookup, setLoadingLookup] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);
    const form = useForm({
        resolver: zodResolver(vocabularyFormSchema),
        defaultValues: createInitialFormData(""),
    });
    const { register, control, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting }, } = form;
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
            const messageListener = (msg) => {
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
    const handleNewCapture = async (payload) => {
        setSaveSuccess(false);
        setErrorMessage(null);
        const initial = createInitialFormData(payload.word, payload.sourceUrl, payload.sourceTitle);
        reset(initial);
        await triggerDictionaryLookup(payload.word);
    };
    const triggerDictionaryLookup = async (wordToLookup) => {
        const word = wordToLookup || currentWord;
        if (!word?.trim())
            return;
        setLoadingLookup(true);
        setErrorMessage(null);
        try {
            const dictData = await dictionaryClient.lookup(word.trim());
            if (dictData.types.length > 0)
                setValue("types", dictData.types);
            if (dictData.pronunciations.length > 0)
                setValue("pronunciations", dictData.pronunciations);
            if (dictData.audio.length > 0)
                setValue("audio", dictData.audio);
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
        }
        catch (err) {
            console.warn("Dictionary lookup failed or partial:", err);
        }
        finally {
            setLoadingLookup(false);
        }
    };
    const onSubmit = async (data) => {
        setErrorMessage(null);
        setSaveSuccess(false);
        try {
            await saveVocabulary(data);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 3500);
        }
        catch (err) {
            setErrorMessage(err instanceof Error ? err.message : "Lỗi khi lưu từ vào IndexedDB");
        }
    };
    const openDashboard = () => {
        if (typeof chrome !== "undefined" && chrome.runtime) {
            chrome.runtime.sendMessage({ type: "OPEN_DASHBOARD" });
        }
    };
    return (_jsxs("div", { style: { maxWidth: "480px", margin: "0 auto", padding: "16px", minHeight: "100vh" }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }, children: [_jsxs("div", { children: [_jsx("h2", { style: { margin: 0, fontSize: "18px", color: "#1e1b4b" }, children: "VocabExtend" }), _jsx("span", { style: { fontSize: "12px", color: "#64748b" }, children: "Quick Capture & Cambridge Enrich" })] }), _jsx("button", { onClick: openDashboard, style: {
                            background: "#e0e7ff",
                            color: "#3730a3",
                            border: "none",
                            borderRadius: "6px",
                            padding: "6px 10px",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                        }, children: "Dashboard \uD83D\uDCCA" })] }), _jsxs("form", { onSubmit: handleSubmit(onSubmit), children: [_jsxs("div", { style: { background: "#ffffff", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0", marginBottom: "16px" }, children: [_jsx("label", { style: { display: "block", fontSize: "12px", fontWeight: 600, color: "#64748b", marginBottom: "4px" }, children: "T\u1EEA C\u1EA6N L\u01AFU (WORD)" }), _jsxs("div", { style: { display: "flex", gap: "8px" }, children: [_jsx("input", { ...register("word"), placeholder: "VD: reconcile, provision...", style: {
                                            flex: 1,
                                            padding: "8px 10px",
                                            fontSize: "16px",
                                            fontWeight: 600,
                                            color: "#1e293b",
                                            border: "1px solid #cbd5e1",
                                            borderRadius: "6px",
                                        } }), _jsx("button", { type: "button", disabled: loadingLookup, onClick: () => triggerDictionaryLookup(), style: {
                                            padding: "8px 12px",
                                            backgroundColor: loadingLookup ? "#94a3b8" : "#4f46e5",
                                            color: "#ffffff",
                                            border: "none",
                                            borderRadius: "6px",
                                            fontSize: "13px",
                                            fontWeight: 600,
                                            cursor: loadingLookup ? "not-allowed" : "pointer",
                                            whiteSpace: "nowrap",
                                        }, children: loadingLookup ? "Đang tra..." : "Crawl" })] }), errors.word && _jsx("div", { style: { color: "#ef4444", fontSize: "12px", marginTop: "4px" }, children: errors.word.message }), (pronunciations?.length > 0 || types?.length > 0) && (_jsxs("div", { style: { marginTop: "10px", display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }, children: [types?.map((t, idx) => (_jsx("span", { style: {
                                            backgroundColor: "#f1f5f9",
                                            color: "#475569",
                                            padding: "2px 8px",
                                            borderRadius: "4px",
                                            fontSize: "11px",
                                            fontWeight: 600,
                                        }, children: t.name }, idx))), pronunciations?.map((p, idx) => (_jsxs("span", { style: {
                                            backgroundColor: "#eef2ff",
                                            color: "#4338ca",
                                            padding: "2px 8px",
                                            borderRadius: "4px",
                                            fontSize: "11px",
                                        }, children: [p.dialect ? `${p.dialect}: ` : "", p.variants.map((v) => v.ipa).join(" ")] }, idx)))] }))] }), _jsx(MeaningEditor, { control: control, register: register, errors: errors }), errors.meanings && _jsx("div", { style: { color: "#ef4444", fontSize: "12px", marginBottom: "8px" }, children: errors.meanings.message }), _jsx(ExampleEditor, { control: control, register: register }), _jsxs("div", { style: { marginBottom: "16px" }, children: [_jsx("label", { style: { display: "block", fontSize: "13px", fontWeight: 600, color: "#1e293b", marginBottom: "4px" }, children: "G\u1EE3i nh\u1EDB / M\u1EB9o thu\u1ED9c (Memory Hint - t\u00F9y ch\u1ECDn)" }), _jsx("input", { ...register("memory"), placeholder: "M\u1EB9o nh\u1EDB nhanh, t\u1EEB \u0111\u1ED3ng ngh\u0129a ho\u1EB7c li\u00EAn t\u01B0\u1EDFng...", style: {
                                    width: "100%",
                                    padding: "8px 10px",
                                    borderRadius: "6px",
                                    border: "1px solid #cbd5e1",
                                    fontSize: "13px",
                                } })] }), saveSuccess && (_jsx("div", { style: {
                            padding: "10px",
                            backgroundColor: "#dcfce7",
                            color: "#166534",
                            borderRadius: "6px",
                            fontSize: "13px",
                            marginBottom: "12px",
                            fontWeight: 500,
                        }, children: "\u2713 \u0110\u00E3 l\u01B0u t\u1EEB v\u00E0o Local Cache (IndexedDB) th\u00E0nh c\u00F4ng!" })), errorMessage && (_jsx("div", { style: {
                            padding: "10px",
                            backgroundColor: "#fee2e2",
                            color: "#991b1b",
                            borderRadius: "6px",
                            fontSize: "13px",
                            marginBottom: "12px",
                        }, children: errorMessage })), _jsx("button", { type: "submit", disabled: isSubmitting, style: {
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
                        }, children: isSubmitting ? "Đang lưu..." : "💾 Lưu vào IndexedDB" })] })] }));
};
