import { translate, type Locale } from './i18n';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isHarmony, saveTextFile } from './harmony';

/** Native exports use a real file; the caller reports cancellation and failures. */
export async function downloadBackup(
  contents: string,
  filename = `MetroListo-backup-${new Date().toISOString().slice(0, 10)}.json`,
  locale: Locale = 'zh-CN',
): Promise<'native' | 'saved' | 'web'> {
  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.writeFile({
      path: filename,
      data: contents,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({
      title: translate(locale, '全地铁足迹备份'),
      files: [uri],
      dialogTitle: translate(locale, '保存或分享备份'),
    });
    // Android recipients may read after the share promise resolves. Let the OS clear its cache.
    return 'native';
  }
  if (isHarmony()) {
    // The system save panel reports the outcome itself, unlike a share sheet or a download.
    await saveTextFile(filename, contents);
    return 'saved';
  }
  const blob = new Blob([contents], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return 'web';
}
