import { z } from "zod";

export const grammarPatternSchema = z.object({
  label: z.string(),
  description: z.string().optional(),
});

export const wordTypeSchema = z.object({
  name: z.string().min(1),
  patterns: z.array(grammarPatternSchema).default([]),
});

export const pronunciationVariantSchema = z.object({
  type: z.string().optional(),
  ipa: z.string().trim().min(1, "IPA cannot be empty"),
});

export const pronunciationSchema = z.object({
  dialect: z.string().optional(),
  variants: z.array(pronunciationVariantSchema).default([]),
});

export const audioResourceSchema = z.object({
  dialect: z.string().optional(),
  url: z.string().url().optional().or(z.literal("")),
  source: z.string().optional(),
  base64: z.string().optional(),
  filename: z.string().optional(),
});

export const meaningSchema = z.object({
  id: z.string(),
  text: z.string().trim(),
  context: z.string().optional(),
  source: z.enum(["user", "dictionary"]).default("user"),
});

export const exampleSchema = z.object({
  id: z.string(),
  sentence: z.string().trim(),
  translation: z.string().optional(),
  source: z.string().optional(),
  sourceUrl: z.string().url().optional().or(z.literal("")),
  sourceType: z.enum(["document", "dictionary", "user"]).default("document"),
});

export const captureMetadataSchema = z.object({
  sourceUrl: z.string().url().optional().or(z.literal("")),
  sourceTitle: z.string().optional(),
  selectedText: z.string().optional(),
  capturedAt: z.string(),
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format YYYY-MM-DD"),
});

export const vocabularyFormSchema = z.object({
  word: z.string().trim().min(1, "Word is required"),
  types: z.array(wordTypeSchema).default([]),
  pronunciations: z.array(pronunciationSchema).default([]),
  audio: z.array(audioResourceSchema).default([]),
  meanings: z.array(meaningSchema).default([]),
  examples: z.array(exampleSchema).default([]),
  memory: z.string().optional(),
  source: z
    .object({
      dictionary: z.string().optional(),
      url: z.string().url().optional().or(z.literal("")),
    })
    .optional(),
  capture: captureMetadataSchema,
});

export type VocabularyFormData = z.infer<typeof vocabularyFormSchema>;
