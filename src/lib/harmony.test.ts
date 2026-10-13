import { afterEach, describe, expect, it, vi } from 'vitest';
import { openExternalLinksInSystemBrowser } from './harmony';

afterEach(() => vi.unstubAllGlobals());

/** Installs the handler and returns a function that clicks a link and reports preventDefault. */
function install(cloak?: object) {
  let onClick!: (event: unknown) => void;
  vi.stubGlobal('document', {
    addEventListener: (_type: string, listener: typeof onClick) => (onClick = listener),
  });
  vi.stubGlobal('location', { origin: 'http://localhost' });
  if (cloak) vi.stubGlobal('Cloak', cloak);
  openExternalLinksInSystemBrowser();
  return (href: string) => {
    const { protocol, origin } = new URL(href);
    const preventDefault = vi.fn();
    onClick({
      defaultPrevented: false,
      preventDefault,
      target: { closest: () => ({ href, protocol, origin }) },
    });
    return preventDefault;
  };
}

describe('HarmonyOS shell', () => {
  it('opens external links in the system browser and leaves in-app links alone', () => {
    const openSystemBrowser = vi.fn().mockResolvedValue(true);
    const click = install({ plugins: { AppControl: { openSystemBrowser } } });
    expect(click('https://github.com/scris/metrolisto')).toHaveBeenCalled();
    expect(openSystemBrowser).toHaveBeenCalledWith('https://github.com/scris/metrolisto');
    expect(click('http://localhost/journal')).not.toHaveBeenCalled();
    expect(click('mailto:hello@example.com')).not.toHaveBeenCalled();
    expect(openSystemBrowser).toHaveBeenCalledTimes(1);
  });
  it('keeps external pages out of the WebView before the plugins are ready', () => {
    const click = install({});
    expect(click('https://github.com/scris/metrolisto')).toHaveBeenCalled();
  });
  it('does not touch links outside the HarmonyOS shell', () => {
    const click = install();
    expect(click('https://github.com/scris/metrolisto')).not.toHaveBeenCalled();
  });
});
