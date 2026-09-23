import React, { useState } from "react";
import {
  useFieldArray,
  type Control,
  type UseFormRegister,
  type UseFormSetValue,
  type UseFormWatch,
  type FieldErrors,
} from "react-hook-form";
import type { VocabularyFormData } from "@vocab-extend/shared";
import { generateUUID } from "../../utils/text";
import { translateToVietnamese } from "../../services/translate/translate.service";

interface Props {
  control: Control<VocabularyFormData>;
  register: UseFormRegister<VocabularyFormData>;
  errors?: FieldErrors<VocabularyFormData>;
  setValue?: UseFormSetValue<VocabularyFormData>;
  watch?: UseFormWatch<VocabularyFormData>;
}

export const MeaningEditor: React.FC<Props> = ({
  control,
  register,
  errors,
  setValue,
  watch,
}) => {
  const { fields, append, remove } = useFieldArray({
    control,
    name: "meanings",
  });

  const [translatingIdx, setTranslatingIdx] = useState<number | null>(null);
  const [isTranslatingAll, setIsTranslatingAll] = useState(false);

  const watchedMeanings = watch ? watch("meanings") : undefined;

  const handleTranslateSingle = async (index: number) => {
    if (!setValue) return;
    const currentList = watchedMeanings || [];
    const item = currentList[index];
    if (!item?.text?.trim()) return;

    setTranslatingIdx(index);
    try {
      const translated = await translateToVietnamese(item.text);
      if (translated) {
        setValue(`meanings.${index}.translation`, translated, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    } finally {
      setTranslatingIdx(null);
    }
  };

  const handleTranslateAll = async () => {
    if (!setValue) return;
    const currentList = watchedMeanings || [];
    if (currentList.length === 0) return;

    setIsTranslatingAll(true);
    try {
      for (let i = 0; i < currentList.length; i++) {
        const item = currentList[i];
        if (item?.text?.trim()) {
          const translated = await translateToVietnamese(item.text);
          if (translated) {
            setValue(`meanings.${i}.translation`, translated, {
              shouldDirty: true,
              shouldValidate: true,
            });
          }
        }
      }
    } finally {
      setIsTranslatingAll(false);
    }
  };

  const handleClearTranslation = (index: number) => {
    if (!setValue) return;
    setValue(`meanings.${index}.translation`, "", {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  return (
    <div style={{ marginBottom: "16px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "8px",
        }}
      >
        <label style={{ fontWeight: 600, fontSize: "14px", color: "#1e293b" }}>
          Nghĩa từ vựng
        </label>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {fields.length > 0 && setValue && (
            <button
              type="button"
              disabled={isTranslatingAll}
              onClick={handleTranslateAll}
              style={{
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                color: "#047857",
                borderRadius: "4px",
                padding: "3px 8px",
                fontSize: "11px",
                fontWeight: 600,
                cursor: isTranslatingAll ? "wait" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
              title="Dịch tất cả các nghĩa tiếng Anh sang tiếng Việt để tham khảo"
            >
              {isTranslatingAll ? "Đang dịch tất cả..." : "🇻🇳 Dịch tất cả nghĩa"}
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              append({
                id: generateUUID(),
                text: "",
                context: "",
                source: "user",
                translation: "",
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
      </div>

      {fields.length === 0 && (
        <div
          style={{
            fontSize: "12px",
            color: "#94a3b8",
            fontStyle: "italic",
            marginBottom: "8px",
          }}
        >
          Chưa có nghĩa nào. Bấm "+ Thêm nghĩa" hoặc "Crawl" để lấy tự động.
        </div>
      )}

      {fields.map((field, index) => {
        const currentItem = watchedMeanings ? watchedMeanings[index] : undefined;
        const translationValue = currentItem?.translation;
        const hasTranslation =
          typeof translationValue === "string" && translationValue.trim().length > 0;

        return (
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
            {/* Định nghĩa tiếng Anh gốc (Giữ nguyên, không ghi đè) */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "6px" }}>
              <input
                {...register(`meanings.${index}.text` as const)}
                placeholder="Định nghĩa tiếng Anh (VD: to make an effort to do something...)"
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
                  title="Xóa nghĩa này"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Ngữ cảnh / Từ loại */}
            <input
              {...register(`meanings.${index}.context` as const)}
              placeholder="Ngữ cảnh / từ loại (VD: verb / noun / formal / figurative...)"
              style={{
                width: "100%",
                padding: "6px 8px",
                borderRadius: "4px",
                border: "1px solid #e2e8f0",
                fontSize: "12px",
                color: "#64748b",
                boxSizing: "border-box",
              }}
            />

            {/* Hiển thị nghĩa tiếng Việt tham khảo ở bên dưới (không thay thế nghĩa tiếng Anh) */}
            {hasTranslation ? (
              <div
                style={{
                  marginTop: "8px",
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: "6px",
                  padding: "6px 8px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "4px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "#166534",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <span>🇻🇳</span> <span>Bản dịch tham khảo:</span>
                  </span>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    <button
                      type="button"
                      disabled={translatingIdx === index || isTranslatingAll}
                      onClick={() => handleTranslateSingle(index)}
                      title="Dịch lại bằng Google Translate"
                      style={{
                        background: "none",
                        border: "none",
                        color: "#15803d",
                        fontSize: "11px",
                        fontWeight: 600,
                        cursor:
                          translatingIdx === index || isTranslatingAll ? "wait" : "pointer",
                        padding: "0",
                      }}
                    >
                      {translatingIdx === index ? "..." : "🔄 Dịch lại"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleClearTranslation(index)}
                      title="Xóa bản dịch tham khảo này"
                      style={{
                        background: "none",
                        border: "none",
                        color: "#94a3b8",
                        fontSize: "12px",
                        cursor: "pointer",
                        padding: "0",
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <input
                  {...register(`meanings.${index}.translation` as const)}
                  placeholder="Nghĩa tiếng Việt tham khảo (có thể chỉnh sửa nếu muốn)..."
                  style={{
                    width: "100%",
                    padding: "5px 8px",
                    borderRadius: "4px",
                    border: "1px solid #86efac",
                    backgroundColor: "#ffffff",
                    fontSize: "12px",
                    color: "#14532d",
                    fontWeight: 500,
                    boxSizing: "border-box",
                  }}
                />
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "6px",
                  marginTop: "6px",
                }}
              >
                <input
                  type="hidden"
                  {...register(`meanings.${index}.translation` as const)}
                />
                <button
                  type="button"
                  disabled={translatingIdx === index || isTranslatingAll}
                  onClick={() => handleTranslateSingle(index)}
                  style={{
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    color: "#166534",
                    borderRadius: "4px",
                    padding: "3px 8px",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor:
                      translatingIdx === index || isTranslatingAll ? "wait" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                  title="Dịch nghĩa này sang tiếng Việt để tham khảo"
                >
                  {translatingIdx === index ? "Đang dịch..." : "🇻🇳 Dịch nghĩa tham khảo"}
                </button>
              </div>
            )}

            {errors?.meanings?.[index]?.text && (
              <div style={{ color: "#ef4444", fontSize: "12px", marginTop: "4px" }}>
                {errors.meanings[index]?.text?.message}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
