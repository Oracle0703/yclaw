import React, { useState } from 'react';

export function AddressBar({
  url,
  canGoBack,
  canGoForward,
  onNavigate,
  onBack,
  onForward,
  onReload,
}: {
  url: string;
  canGoBack: boolean;
  canGoForward: boolean;
  onNavigate: (url: string) => void;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
}) {
  const [input, setInput] = useState(url);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      let target = input.trim();
      if (target && !target.includes('://')) {
        target = 'https://' + target;
      }
      onNavigate(target);
    }
  };

  return (
    <div className="address-bar">
      <button onClick={onBack} disabled={!canGoBack} title="后退">←</button>
      <button onClick={onForward} disabled={!canGoForward} title="前进">→</button>
      <button onClick={onReload} title="刷新">↻</button>
      <input
        className="address-input"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => setInput(url)}
        placeholder="输入网址..."
      />
    </div>
  );
}
