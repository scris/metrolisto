import { hilog } from '@kit.PerformanceAnalysisKit';
import { Cloak, CloakPlugin, PluginMethod } from '@wisdomgarden/cloak';

const DOMAIN = 0x2000;
const TAG = 'AppControl';

export default class AppControlPlugin extends CloakPlugin {
  protected _name = 'AppControl';
  protected _version = '1.0.0';
  protected _description = 'Opens external links outside the app';

  /**
   * Opens a web link in the system browser. Loading it in the app's own WebView would
   * replace the app and hand the page access to the native plugins.
   */
  @PluginMethod()
  public async openSystemBrowser(url: string): Promise<boolean> {
    if (!/^https?:\/\//i.test(url ?? '')) {
      return false;
    }
    try {
      await Cloak.getAbility().context.openLink(url);
      return true;
    } catch (error) {
      hilog.error(DOMAIN, TAG, 'openSystemBrowser failed: %{public}s', JSON.stringify(error));
      return false;
    }
  }
}
