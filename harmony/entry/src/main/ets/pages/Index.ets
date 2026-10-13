import { Cloak, CloakWebview, PluginManager } from '@wisdomgarden/cloak';

@Entry
@Component
struct CloakIndex {
  onBackPress(): boolean {
    // Cloak exits the app when the WebView has no history. Leave that case to the system,
    // which moves the app to the background and keeps the map where the user left it.
    try {
      if (PluginManager.webviewController?.accessBackward()) {
        return Cloak.onBackPress();
      }
    } catch (error) {
      // WebView not attached yet: nothing to go back to.
    }
    return false;
  }

  build() {
    Column() {
      CloakWebview()
    }
  }
}
