import english from '../locales/en-GB.json';
import type { CityData, LocalisedName } from '../types';

export type Locale = 'zh-CN' | 'en-GB';
export const LOCALE_KEY = 'metrolisto.locale.v1';
const messages: Record<string, string> = english;

export function resolveLocale(saved: string | null, languages: readonly string[]): Locale {
  if (saved === 'zh-CN' || saved === 'en-GB') return saved;
  for (const language of languages) {
    if (/^zh(?:-|$)/i.test(language)) return 'zh-CN';
    if (/^en(?:-|$)/i.test(language)) return 'en-GB';
  }
  return 'en-GB';
}

export function translate(locale: Locale, message: string, ...values: (string | number)[]) {
  const template = locale === 'en-GB' ? (messages[message] ?? message) : message;
  return template.replace(/\{(\d+)\}/g, (placeholder, index: string) =>
    values[Number(index)] === undefined ? placeholder : String(values[Number(index)]),
  );
}

/** Match the exact tag, then its base language; otherwise use the first supplied name. */
export function nameInLanguage(names: readonly LocalisedName[], language: string): string {
  const tag = Intl.getCanonicalLocales(language)[0].toLowerCase();
  const base = tag.split('-')[0];
  const matching =
    names.find((name) => name.language.toLowerCase() === tag) ??
    names.find((name) => name.language.toLowerCase().split('-')[0] === base) ??
    names[0];
  return matching?.value ?? '';
}

/** Cities require Chinese/English names; stations and lines use explicit language tags. */
export function localisedName(
  value: { names: readonly LocalisedName[] } | Pick<CityData, 'zhName' | 'enName'> | undefined,
  locale: Locale,
): string {
  if (!value) return '';
  if ('names' in value) return nameInLanguage(value.names, locale);
  return locale === 'en-GB' ? value.enName : value.zhName;
}

export function contributionLabel(city: Pick<CityData, 'attribution'>, locale: Locale): string {
  const credit = city.attribution;
  if (credit?.kind === 'official') return translate(locale, '由应用开发者维护');
  if (credit?.kind === 'community')
    return translate(locale, '由 {0} 贡献', credit.name.toLowerCase());
  return translate(locale, '贡献者未注明');
}
