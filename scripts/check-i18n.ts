import { readFileSync } from 'node:fs';
import path from 'node:path';

type JsonRecord = Record<string, unknown>;

const localeFiles = {
  en: path.resolve('apps/web/src/i18n/locales/en/common.json'),
  fr: path.resolve('apps/web/src/i18n/locales/fr/common.json'),
} as const;

function readJson(filePath: string): JsonRecord {
  return JSON.parse(readFileSync(filePath, 'utf8')) as JsonRecord;
}

function flattenKeys(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }

  return Object.entries(value as JsonRecord).flatMap(([key, nestedValue]) => {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    return flattenKeys(nestedValue, nextPrefix);
  });
}

const english = flattenKeys(readJson(localeFiles.en)).sort();
const french = flattenKeys(readJson(localeFiles.fr)).sort();

const missingInFrench = english.filter((key) => !french.includes(key));
const missingInEnglish = french.filter((key) => !english.includes(key));

if (missingInFrench.length > 0 || missingInEnglish.length > 0) {
  console.error('Locale key mismatch detected.');

  for (const key of missingInFrench) {
    console.error(`- Missing in fr: ${key}`);
  }

  for (const key of missingInEnglish) {
    console.error(`- Missing in en: ${key}`);
  }

  process.exitCode = 1;
} else {
  console.log('Locale keys are aligned between English and French.');
}
