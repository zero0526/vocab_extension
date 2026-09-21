import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useFieldArray } from "react-hook-form";
import { generateUUID } from "../../utils/text";
export const ExampleEditor = ({ control, register }) => {
    const { fields, append, remove } = useFieldArray({
        control,
        name: "examples",
    });
    return (_jsxs("div", { style: { marginBottom: "16px" }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }, children: [_jsx("label", { style: { fontWeight: 600, fontSize: "14px", color: "#1e293b" }, children: "C\u00E2u v\u00ED d\u1EE5 th\u1EF1c t\u1EBF" }), _jsx("button", { type: "button", onClick: () => append({
                            id: generateUUID(),
                            sentence: "",
                            translation: "",
                            source: "document",
                            sourceType: "document",
                        }), style: {
                            background: "none",
                            border: "none",
                            color: "#4f46e5",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                        }, children: "+ Th\u00EAm v\u00ED d\u1EE5" })] }), fields.length === 0 && (_jsx("div", { style: { fontSize: "12px", color: "#94a3b8", fontStyle: "italic", marginBottom: "8px" }, children: "Ch\u01B0a c\u00F3 c\u00E2u v\u00ED d\u1EE5 n\u00E0o." })), fields.map((field, index) => (_jsxs("div", { style: {
                    background: "#ffffff",
                    padding: "10px",
                    borderRadius: "6px",
                    border: "1px solid #e2e8f0",
                    marginBottom: "8px",
                }, children: [_jsxs("div", { style: { display: "flex", gap: "8px", marginBottom: "6px" }, children: [_jsx("textarea", { ...register(`examples.${index}.sentence`), rows: 2, placeholder: "The controller reconciles the desired state.", style: {
                                    flex: 1,
                                    padding: "8px 10px",
                                    borderRadius: "4px",
                                    border: "1px solid #cbd5e1",
                                    fontSize: "13px",
                                    resize: "vertical",
                                } }), _jsx("button", { type: "button", onClick: () => remove(index), style: {
                                    background: "#fee2e2",
                                    border: "none",
                                    color: "#ef4444",
                                    borderRadius: "4px",
                                    padding: "0 8px",
                                    cursor: "pointer",
                                    height: "fit-content",
                                }, children: "\u2715" })] }), _jsx("input", { ...register(`examples.${index}.source`), placeholder: "Ngu\u1ED3n (VD: Kubernetes doc / Cambridge...)", style: {
                            width: "100%",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            border: "1px solid #e2e8f0",
                            fontSize: "11px",
                            color: "#64748b",
                        } })] }, field.id)))] }));
};
