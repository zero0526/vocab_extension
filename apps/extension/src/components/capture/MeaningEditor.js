import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useFieldArray } from "react-hook-form";
import { generateUUID } from "../../utils/text";
export const MeaningEditor = ({ control, register }) => {
    const { fields, append, remove } = useFieldArray({
        control,
        name: "meanings",
    });
    return (_jsxs("div", { style: { marginBottom: "16px" }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }, children: [_jsxs("label", { style: { fontWeight: 600, fontSize: "14px", color: "#1e293b" }, children: ["Ngh\u0129a ti\u1EBFng Vi\u1EC7t ", _jsx("span", { style: { color: "#ef4444" }, children: "*" })] }), _jsx("button", { type: "button", onClick: () => append({
                            id: generateUUID(),
                            text: "",
                            context: "",
                            source: "user",
                        }), style: {
                            background: "none",
                            border: "none",
                            color: "#4f46e5",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                        }, children: "+ Th\u00EAm ngh\u0129a" })] }), fields.map((field, index) => (_jsxs("div", { style: {
                    background: "#ffffff",
                    padding: "10px",
                    borderRadius: "6px",
                    border: "1px solid #e2e8f0",
                    marginBottom: "8px",
                }, children: [_jsxs("div", { style: { display: "flex", gap: "8px", marginBottom: "6px" }, children: [_jsx("input", { ...register(`meanings.${index}.text`), placeholder: "Nh\u1EADp ngh\u0129a ti\u1EBFng Vi\u1EC7t (VD: \u0111\u1ED3ng b\u1ED9, h\u00F2a gi\u1EA3i...)", style: {
                                    flex: 1,
                                    padding: "8px 10px",
                                    borderRadius: "4px",
                                    border: "1px solid #cbd5e1",
                                    fontSize: "13px",
                                } }), fields.length > 1 && (_jsx("button", { type: "button", onClick: () => remove(index), style: {
                                    background: "#fee2e2",
                                    border: "none",
                                    color: "#ef4444",
                                    borderRadius: "4px",
                                    padding: "0 8px",
                                    cursor: "pointer",
                                    fontSize: "14px",
                                }, children: "\u2715" }))] }), _jsx("input", { ...register(`meanings.${index}.context`), placeholder: "Ng\u1EEF c\u1EA3nh s\u1EED d\u1EE5ng (VD: K8s / Technical / Database...)", style: {
                            width: "100%",
                            padding: "6px 8px",
                            borderRadius: "4px",
                            border: "1px solid #e2e8f0",
                            fontSize: "12px",
                            color: "#64748b",
                        } })] }, field.id)))] }));
};
