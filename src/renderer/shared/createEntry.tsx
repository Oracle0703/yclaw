import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppProviders } from './components/AppProviders';
import './styles/globals.css';

export function createEntry(App: React.ComponentType) {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <AppProviders>
        <App />
      </AppProviders>
    </React.StrictMode>,
  );
}
