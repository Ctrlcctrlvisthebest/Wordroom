export type Word = {
  sourceIndex: number;
  word: string;
  meaning?: string;
  example?: string;
  phrase?: string;
};
export type Field = Exclude<keyof Word, 'sourceIndex'>;
export type Mapping = Record<Field, number | null>;
export type Locale = 'zh' | 'en' | 'es';

export const FIELDS: Field[];
export const OPTIONAL_FIELDS: Exclude<Field, 'word'>[];
export const LABELS: Record<Field, string>;
export const SUPPORTED_LOCALES: Locale[];
export const TRANSLATIONS: Record<Locale, Record<string, string>>;
export const SAMPLE_WORDS: Word[];
export function translate(
  locale: Locale,
  key: string,
  variables?: Record<string, string | number>,
): string;

export function parseCSV(text: unknown): string[][];
export function detectMapping(headers: unknown[]): Mapping;
export function createWords(rows: unknown[][], mapping: Mapping): Word[];
export function serializeCSV(rows: unknown[][]): string;
export function createStarredCSV(
  headers: unknown[],
  rows: unknown[][],
  sourceIndices: Iterable<number>,
): string;
export function shuffled<T>(items: readonly T[], random?: () => number): T[];
export function clampCount(value: unknown, total: number): number;
export function escapeHTML(value: unknown): string;
