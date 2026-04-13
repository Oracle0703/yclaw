import type { Tab } from '@shared/types/browser';

export function TabBar({
  tabs,
  activeTabId,
  onSwitch,
  onClose,
  onNew,
}: {
  tabs: Tab[];
  activeTabId: number | null;
  onSwitch: (id: number) => void;
  onClose: (id: number) => void;
  onNew: () => void;
}) {
  return (
    <div className="tab-bar">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`tab ${tab.id === activeTabId ? 'active' : ''}`}
          onClick={() => onSwitch(tab.id)}
        >
          <span className="tab-title">
            {tab.loading ? '⏳ ' : ''}
            {tab.title || '新标签页'}
          </span>
          <button
            className="tab-close"
            onClick={(e) => {
              e.stopPropagation();
              onClose(tab.id);
            }}
          >
            ×
          </button>
        </div>
      ))}
      <button className="tab-new" onClick={onNew}>
        +
      </button>
    </div>
  );
}
