import React from "react";
import { useFieldArray, type Control, type UseFormRegister } from "react-hook-form";
import type { VocabularyFormData } from "@vocab-extend/shared";
import { generateUUID } from "../../utils/text";

interface Props {
  control: Control<VocabularyFormData>;
  register: UseFormRegister<VocabularyFormData>;
}

export const ExampleEditor: React.FC<Props> = ({ control, register }) => {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "examples",
  });

  return (
    <div style={{ marginBottom: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <label style={{ fontWeight: 600, fontSize: "14px", color: "#1e293b" }}>
          Câu ví dụ thực tế
        </label>
        <button
          type="button"
          onClick={() =>
            append({
              id: generateUUID(),
              sentence: "",
              translation: "",
              source: "document",
              sourceType: "document",
            })
          }
          style={{
            background: "none",
            border: "none",
            color: "#4f46e5",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + Thêm ví dụ
        </button>
      </div>

      {fields.length === 0 && (
        <div style={{ fontSize: "12px", color: "#94a3b8", fontStyle: "italic", marginBottom: "8px" }}>
          Chưa có câu ví dụ nào.
        </div>
      )}

      {fields.map((field, index) => (
        <div
          key={field.id}
          style={{
            background: "#ffffff",
            padding: "10px",
            borderRadius: "6px",
            border: "1px solid #e2e8f0",
            marginBottom: "8px",
          }}
        >
          <div style={{ display: "flex", gap: "8px", marginBottom: "6px" }}>
            <textarea
              {...register(`examples.${index}.sentence` as const)}
              rows={2}
              placeholder="The controller reconciles the desired state."
              style={{
                flex: 1,
                padding: "8px 10px",
                borderRadius: "4px",
                border: "1px solid #cbd5e1",
                fontSize: "13px",
                resize: "vertical",
              }}
            />
            <button
              type="button"
              onClick={() => remove(index)}
              style={{
                background: "#fee2e2",
                border: "none",
                color: "#ef4444",
                borderRadius: "4px",
                padding: "0 8px",
                cursor: "pointer",
                height: "fit-content",
              }}
            >
              ✕
            </button>
          </div>
          <input
            {...register(`examples.${index}.source` as const)}
            placeholder="Nguồn (VD: Kubernetes doc / Cambridge...)"
            style={{
              width: "100%",
              padding: "4px 8px",
              borderRadius: "4px",
              border: "1px solid #e2e8f0",
              fontSize: "11px",
              color: "#64748b",
            }}
          />
        </div>
      ))}
    </div>
  );
};
