import { AbilityConstant, ConfigurationConstant, UIAbility, Want } from '@kit.AbilityKit';
import { BusinessError } from '@kit.BasicServicesKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { window } from '@kit.ArkUI';
import { Cloak } from '@wisdomgarden/cloak';
import AppControlPlugin from '../plugins/AppControlPlugin';
import FileExportPlugin from '../plugins/FileExportPlugin';

const DOMAIN = 0x0000;
const TAG = 'MetroListo';
// Same as --bg in src/styles.css, so the system bars blend into the page.
const APP_BACKGROUND = '#F3F5F9';

export default class EntryAbility extends UIAbility {
  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    try {
      // The web app has no dark theme; keep system dialogs and bars light as well.
      this.context.getApplicationContext().setColorMode(ConfigurationConstant.ColorMode.COLOR_MODE_LIGHT);
    } catch (err) {
      hilog.error(DOMAIN, TAG, 'Failed to set colorMode. Cause: %{public}s', JSON.stringify(err));
    }

    const cloak = new Cloak(this);
    cloak.addPlugins([
      new AppControlPlugin(),
      new FileExportPlugin(),
    ]);
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    windowStage.loadContent('pages/Index', (err) => {
      if (err.code) {
        hilog.error(DOMAIN, TAG, 'Failed to load the content. Cause: %{public}s', JSON.stringify(err));
        return;
      }
      try {
        const mainWindow = windowStage.getMainWindowSync();
        mainWindow.setWindowBackgroundColor(APP_BACKGROUND);
        // No effect on 2in1 devices, where the window has a title bar instead.
        mainWindow.setWindowSystemBarProperties({
          statusBarColor: APP_BACKGROUND,
          statusBarContentColor: '#000000',
        }).catch((error: BusinessError) => {
          hilog.warn(DOMAIN, TAG, 'Failed to set system bars. Cause: %{public}s', JSON.stringify(error));
        });
      } catch (error) {
        hilog.error(DOMAIN, TAG, 'Failed to set window. Cause: %{public}s', JSON.stringify(error));
      }
    });
  }
}
