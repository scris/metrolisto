import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/manrope/latin-500.css';
import '@fontsource/manrope/latin-600.css';
import '@fontsource/manrope/latin-700.css';
import 'tdesign-mobile-react/es/style/index.css';
import App from './App';
import { LocaleProvider } from './components/LocaleProvider';
import { openExternalLinksInSystemBrowser } from './lib/harmony';
import './styles.css';

openExternalLinksInSystemBrowser();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LocaleProvider>
      <App />
    </LocaleProvider>
  </React.StrictMode>,
);
