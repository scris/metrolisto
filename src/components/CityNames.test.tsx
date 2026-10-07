import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import CityNames from './CityNames';

const seoulNames = {
  zhName: '首尔',
  enName: 'Seoul',
  localLanguage: 'ko',
  localName: { name: '서울', language: 'ko' },
};

describe('city name display', () => {
  it.each(['zh-CN', 'en-GB'] as const)(
    'shows only the interface and local names with language tags in %s',
    (locale) => {
      const html = renderToStaticMarkup(<CityNames city={seoulNames} locale={locale} />);
      const primary = locale === 'zh-CN' ? '首尔' : 'Seoul';
      expect(html).toMatch(new RegExp(`^<span lang="${locale}">${primary}</span>`));
      expect(html).toContain('<span lang="ko">서울</span>');
      expect(html).not.toContain(locale === 'zh-CN' ? 'Seoul' : '首尔');
    },
  );
  it.each(['zh', 'zh-CN', 'zh-Hant', 'ZH-tw'])(
    'shows Chinese and English names in both modes for local language %s',
    (localLanguage) => {
      const city = { zhName: '北京', enName: 'Beijing', localLanguage };
      for (const locale of ['zh-CN', 'en-GB'] as const) {
        const html = renderToStaticMarkup(<CityNames city={city} locale={locale} />);
        expect(html).toContain('<span lang="zh-CN">北京</span>');
        expect(html).toContain('<span lang="en-GB">Beijing</span>');
        expect(html.match(/<span /g)).toHaveLength(2);
      }
    },
  );
  it.each(['en', 'en-GB', 'en-US', 'EN-au'])(
    'shows only English in English mode for local language %s',
    (localLanguage) => {
      const city = { zhName: '伦敦', enName: 'London', localLanguage };
      expect(renderToStaticMarkup(<CityNames city={city} locale="en-GB" />)).toBe(
        '<span lang="en-GB">London</span>',
      );
      const chinese = renderToStaticMarkup(<CityNames city={city} locale="zh-CN" />);
      expect(chinese).toContain('<span lang="zh-CN">伦敦</span>');
      expect(chinese).toContain('<span lang="en-GB">London</span>');
    },
  );
  it('suppresses duplicate local names regardless of whitespace and case', () => {
    const city = {
      zhName: '阿姆斯特丹',
      enName: 'Amsterdam',
      localLanguage: 'nl',
      localName: { name: ' AMSTERDAM ', language: 'nl' },
    };
    expect(renderToStaticMarkup(<CityNames city={city} locale="en-GB" />)).toBe(
      '<span lang="en-GB">Amsterdam</span>',
    );
    const chinese = renderToStaticMarkup(<CityNames city={city} locale="zh-CN" />);
    expect(chinese).toContain('<span lang="zh-CN">阿姆斯特丹</span>');
    expect(chinese).toContain('<span lang="nl"> AMSTERDAM </span>');
  });
  it('selects the local name instead of an unrelated local name', () => {
    const city = { ...seoulNames, localLanguage: 'en' };
    expect(renderToStaticMarkup(<CityNames city={city} locale="zh-CN" />)).not.toContain('서울');
  });
});
