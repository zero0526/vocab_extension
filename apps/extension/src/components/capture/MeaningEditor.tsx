import React from "react";
import { useFieldArray, type Control, type UseFormRegister, type FieldErrors } from "react-hook-form";
import type { VocabularyFormData } from "@vocab-extend/shared";
import { generateUUID } from "../../utils/text";

interface Props {
  control: Control<VocabularyFormData>;
  register: UseFormRegister<VocabularyFormData>;
  errors?: FieldErrors<VocabularyFormData>;
}

export const MeaningEditor: React.FC<Props> = ({ control, register, errors }) => {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "meanings",
  });

  return (
    <div style={{ marginBottom: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <label style={{ fontWeight: 600, fontSize: "14px", color: "#1e293b" }}>
          Nghĩa từ vựng
        </label>
        <button
          type="button"
          onClick={() =>
            append({
              id: generateUUID(),
              text: "",
              context: "",
              source: "user",
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
          + Thêm nghĩa
        </button>
      </div>

      {fields.length === 0 && (
        <div style={{ fontSize: "12px", color: "#94a3b8", fontStyle: "italic", marginBottom: "8px" }}>
          Chưa có nghĩa nào. Bấm "+ Thêm nghĩa" hoặc "Crawl" để lấy tự động.
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
            <input
              {...register(`meanings.${index}.text` as const)}
              placeholder="Nhập nghĩa tiếng Việt hoặc định nghĩa (VD: thử, cố gắng...)"
              style={{
                flex: 1,
                padding: "8px 10px",
                borderRadius: "4px",
                border: "1px solid #cbd5e1",
                fontSize: "13px",
              }}
            />
            {fields.length > 1 && (
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
                  fontSize: "14px",
                }}
              >
                ✕
              </button>
            )}
          </div>
          <input
            {...register(`meanings.${index}.context` as const)}
            placeholder="Ngữ cảnh / từ loại (VD: verb / danh từ / kỹ thuật...)"
            style={{
              width: "100%",
              padding: "6px 8px",
              borderRadius: "4px",
              border: "1px solid #e2e8f0",
              fontSize: "12px",
              color: "#64748b",
            }}
          />
          {errors?.meanings?.[index]?.text && (
            <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px" }}>
              {errors.meanings[index]?.text?.message}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
