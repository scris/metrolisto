/**
 * Bridge to the HarmonyOS shell in harmony/. The shell runs the app in a Cloak WebView, which
 * injects `Cloak` and lists native plugins under `Cloak.plugins` once the page has loaded.
 */
interface SaveUserTextFileResult {
  success: boolean;
  cancelled?: boolean;
  error?: string;
}

interface CloakBridge {
  plugins?: {
    AppControl?: { openSystemBrowser(url: string): Promise<boolean> };
    FileExport?: {
      saveUserTextFile(fileName: string, utf8Content: string): Promise<SaveUserTextFileResult>;
    };
  };
}

const bridge = () => (globalThis as { Cloak?: CloakBridge }).Cloak;

export const isHarmony = () => bridge() !== undefined;

/** Opens the system save panel; rejects when the user cancels or nothing was written. */
export async function saveTextFile(filename: string, contents: string): Promise<void> {
  const result = await bridge()?.plugins?.FileExport?.saveUserTextFile(filename, contents);
  if (result?.success) return;
  throw new Error(result?.cancelled ? '已取消保存' : (result?.error ?? '系统保存面板不可用'));
}

/** The WebView is the whole app and exposes native plugins, so other sites must not load in it. */
export function openExternalLinksInSystemBrowser() {
  document.addEventListener('click', (event) => {
    if (!isHarmony() || event.defaultPrevented) return;
    const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href]');
    if (!link || !/^https?:$/.test(link.protocol) || link.origin === location.origin) return;
    event.preventDefault();
    void bridge()?.plugins?.AppControl?.openSystemBrowser(link.href);
  });
}
