import { BusinessError } from '@kit.BasicServicesKit';
import { picker, fileIo, WriteOptions } from '@kit.CoreFileKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { util } from '@kit.ArkTS';
import { Cloak, CloakPlugin, PluginMethod } from '@wisdomgarden/cloak';

const DOMAIN = 0x2002;
const TAG = 'FileExport';

export interface SaveUserTextFileResult {
  success: boolean;
  cancelled?: boolean;
  error?: string;
}

/**
 * Saves UTF-8 text via the system DocumentViewPicker (Save As). The WebView has no download
 * handler, so the web app's `<a download>` export does nothing here.
 */
export default class FileExportPlugin extends CloakPlugin {
  protected _name = 'FileExport';
  protected _version = '1.0.0';
  protected _description = 'Save user files via DocumentViewPicker';

  private sanitizeFileName(name: string): string {
    const base = (name ?? '').replace(/^.*[/\\]/, '').trim();
    return base.length ? base : 'MetroListo-backup.json';
  }

  private isUserCancelled(err: BusinessError): boolean {
    const msg = `${err.message ?? ''}`.toLowerCase();
    const code = Number(err.code);
    // Common picker cancel paths (codes vary by API level).
    if (msg.includes('cancel') || msg.includes('dismiss') || msg.includes('abort')) {
      return true;
    }
    return code === 13900042 || code === 13900001;
  }

  /**
   * Opens the system save picker, then writes UTF-8 content to the chosen URI.
   */
  @PluginMethod()
  public async saveUserTextFile(fileName: string, utf8Content: string): Promise<SaveUserTextFileResult> {
    try {
      const saveOptions = new picker.DocumentSaveOptions();
      saveOptions.newFileNames = [this.sanitizeFileName(fileName)];
      saveOptions.fileSuffixChoices = ['JSON|.json', '.json'];

      const viewPicker = new picker.DocumentViewPicker(Cloak.getAbility().context);
      const uris: Array<string> = await viewPicker.save(saveOptions);
      if (!uris || uris.length === 0) {
        return { success: false, cancelled: true };
      }

      const file = fileIo.openSync(uris[0], fileIo.OpenMode.READ_WRITE | fileIo.OpenMode.CREATE);
      try {
        // writeSync(fd, Uint8Array) is unreliable on some builds (results in 0 B files).
        // Prefer UTF-8 string (same as Harmony docs); fallback to ArrayBuffer + WriteOptions.
        let written = fileIo.writeSync(file.fd, utf8Content);
        if (written === 0 && utf8Content.length > 0) {
          const u8 = new util.TextEncoder().encodeInto(utf8Content);
          const opts: WriteOptions = { length: u8.byteLength };
          written = fileIo.writeSync(file.fd, u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength), opts);
        }
        if (written === 0 && utf8Content.length > 0) {
          hilog.warn(DOMAIN, TAG, 'writeSync wrote 0 bytes, contentLen=%{public}d', utf8Content.length);
          return { success: false, error: 'WRITE_ZERO_BYTES' };
        }
        try {
          // Replacing an existing, longer file must not leave its old tail behind.
          fileIo.truncateSync(file.fd, written);
        } catch (err) {
          hilog.warn(DOMAIN, TAG, 'truncateSync failed: %{public}s', JSON.stringify(err));
        }
        fileIo.fsyncSync(file.fd);
      } finally {
        fileIo.closeSync(file);
      }

      return { success: true };
    } catch (err) {
      hilog.error(DOMAIN, TAG, 'saveUserTextFile failed: %{public}s', JSON.stringify(err));
      if (this.isUserCancelled(err as BusinessError)) {
        return { success: false, cancelled: true };
      }
      return {
        success: false,
        error: (err as Error)?.message ?? 'SAVE_FAILED',
      };
    }
  }
}
