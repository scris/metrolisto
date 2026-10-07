import type { CityData } from '../types';
import type { Locale } from '../lib/i18n';

/** Show the interface name and, when needed, the local-language city name. */
export default function CityNames({
  city,
  locale,
}: {
  city: Pick<CityData, 'zhName' | 'enName' | 'localLanguage' | 'localName'>;
  locale: Locale;
}) {
  const chinese = { name: city.zhName, language: 'zh-CN' };
  const english = { name: city.enName, language: 'en-GB' };
  const localLanguage = new Intl.Locale(city.localLanguage).language;
  const localName =
    localLanguage === 'zh' ? chinese : localLanguage === 'en' ? english : city.localName;
  const primary = locale === 'en-GB' ? english : chinese;
  const secondary =
    locale === 'en-GB'
      ? localLanguage === 'en'
        ? undefined
        : localName
      : localLanguage === 'zh'
        ? english
        : localName;
  const ordered = secondary ? [primary, secondary] : [primary];
  const seen = new Set<string>();
  const names = ordered.filter(({ name }) => {
    const key = name.trim().normalize().toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return (
    <>
      <span lang={names[0].language}>{names[0].name}</span>
      {names.length > 1 && (
        <small className="city-other-names">
          <span lang={names[1].language}>{names[1].name}</span>
        </small>
      )}
    </>
  );
}
