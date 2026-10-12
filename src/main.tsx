import React from 'react';
import ReactDOM from 'react-dom/client';
import { initializeDiagnostics, logDiagnostic } from './diagnostics';
import './styles.css';

initializeDiagnostics();
logDiagnostic('application.import-start');
import('./App').then(({ default: App }) => {
  logDiagnostic('application.import-complete');
  function AppStartup() {
    React.useEffect(() => {
      window.__smartHouseDiagnostics?.appReady();
      logDiagnostic('application.mounted');
    }, []);
    return <App />;
  }
  ReactDOM.createRoot(document.getElementById('root')!, {
    onUncaughtError(error, info) {
      logDiagnostic('react.uncaught', { error, componentStack: info.componentStack }, 'error');
      window.__smartHouseDiagnostics?.showFallback();
    },
    onRecoverableError(error, info) {
      logDiagnostic('react.recoverable', { error, componentStack: info.componentStack }, 'warn');
    },
  }).render(<React.StrictMode><AppStartup /></React.StrictMode>);
}).catch(error => {
  logDiagnostic('application.import-error', error, 'error');
  window.__smartHouseDiagnostics?.showFallback();
});
