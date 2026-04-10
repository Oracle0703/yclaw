import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppProviders } from './components/AppProviders';
import { TitleBar } from './components/TitleBar';
import './styles/globals.css';

export function createEntry(App: React.ComponentType) {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <AppProviders>
      <TitleBar />
      <App />
    </AppProviders>,
  );
}
