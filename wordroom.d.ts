export type Word = {
  word: string;
  meaning?: string;
  example?: string;
  phrase?: string;
};
export type Field = keyof Word;
export type Mapping = Record<Field, number | null>;

export const FIELDS: Field[];
export const OPTIONAL_FIELDS: Exclude<Field, 'word'>[];
export const LABELS: Record<Field, string>;
export const SAMPLE_WORDS: Word[];

export function parseCSV(text: unknown): string[][];
export function detectMapping(headers: unknown[]): Mapping;
export function createWords(rows: unknown[][], mapping: Mapping): Word[];
export function shuffled<T>(items: readonly T[], random?: () => number): T[];
export function clampCount(value: unknown, total: number): number;
export function escapeHTML(value: unknown): string;
