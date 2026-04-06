import { useIpc } from '../../../shared/hooks';
import { IPC_CHANNELS } from '@shared/constants';

interface ModuleCard {
  id: string;
  name: string;
  description: string;
  icon: string;
}

const modules: ModuleCard[] = [
  { id: 'stock', name: '股票分析', description: '行情数据、技术指标、策略测试', icon: '📈' },
  { id: 'automation', name: '自动化采集', description: '网页 RPA、任务流、数据采集', icon: '🤖' },
  { id: 'browser', name: '内嵌浏览器', description: '多标签页、会话隔离、脚本注入', icon: '🌐' },
  { id: 'plugin-center', name: '插件中心', description: '安装、管理、配置插件', icon: '🧩' },
];

export default function Home() {
  const { invoke } = useIpc();

  const openModule = async (moduleId: string) => {
    await invoke(IPC_CHANNELS.WINDOW_OPEN, { module: moduleId });
  };

  return (
    <div style={{ padding: '32px', maxWidth: '960px', margin: '0 auto' }}>
      <header style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700 }}>YClaw 工作台</h1>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: '8px' }}>
          可扩展的桌面生产力平台
        </p>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '16px',
        }}
      >
        {modules.map((mod) => (
          <button
            key={mod.id}
            onClick={() => openModule(mod.id)}
            style={{
              padding: '24px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg-secondary)',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>{mod.icon}</div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)' }}>
              {mod.name}
            </div>
            <div
              style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}
            >
              {mod.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
