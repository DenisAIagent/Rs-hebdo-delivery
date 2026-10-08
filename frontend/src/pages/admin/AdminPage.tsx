import { useState } from 'react';
import { PaperTypesTab } from './PaperTypesTab.tsx';
import { HebdoTab } from './HebdoTab.tsx';
import { JournalistsTab } from './JournalistsTab.tsx';
import { DeliveriesTab } from './DeliveriesTab.tsx';
import { PromptTab } from './PromptTab.tsx';
import { LogsTab } from './LogsTab.tsx';
import { SettingsTab } from './SettingsTab.tsx';
import { AgentsTab } from './AgentsTab.tsx';
import { FileText, Hash, Users, Send, Bot, Activity, Settings, Sparkles } from 'lucide-react';

type Tab =
  | 'paper-types'
  | 'hebdo'
  | 'journalists'
  | 'deliveries'
  | 'prompt'
  | 'agents'
  | 'logs'
  | 'settings';

export function AdminPage() {
  const [tab, setTab] = useState<Tab>('paper-types');

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'hebdo', label: 'Hebdo', icon: <Hash size={16} /> },
    { key: 'paper-types', label: 'Types de papier', icon: <FileText size={16} /> },
    { key: 'journalists', label: 'Journalistes', icon: <Users size={16} /> },
    { key: 'deliveries', label: 'Livraisons', icon: <Send size={16} /> },
    { key: 'prompt', label: 'Prompt IA', icon: <Bot size={16} /> },
    { key: 'agents', label: 'Agents IA', icon: <Sparkles size={16} /> },
    { key: 'logs', label: 'Logs', icon: <Activity size={16} /> },
    { key: 'settings', label: 'Réglages', icon: <Settings size={16} /> },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
        <div>
          <div className="eyebrow">Administration</div>
          <h1
            className="serif"
            style={{ fontSize: 40, lineHeight: 1.05, marginTop: 6 }}
          >
            Coulisses de la rédaction.
          </h1>
          <p style={{ marginTop: 6, color: 'var(--muted)' }}>
            Hebdos, journalistes, prompt IA, intégrations — pilotez tout sans
            redéployer.
          </p>
        </div>
      </div>

      {/* Editorial tabs (underline) */}
      <div
        style={{ borderBottom: '1px solid var(--border)', marginBottom: 24 }}
        className="overflow-x-auto"
      >
        <div className="flex gap-1 min-w-max">
          {tabs.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="flex items-center gap-2"
                style={{
                  padding: '10px 14px',
                  fontSize: 13,
                  fontWeight: 500,
                  color: active ? 'var(--ink)' : 'var(--muted)',
                  borderBottom: active
                    ? '2px solid var(--rs-red)'
                    : '2px solid transparent',
                  marginBottom: -1,
                  background: 'none',
                  border: 'none',
                  borderBottomStyle: 'solid',
                  cursor: 'pointer',
                  transition: 'color 0.15s var(--ease)',
                }}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {tab === 'paper-types' && <PaperTypesTab />}
      {tab === 'hebdo' && <HebdoTab />}
      {tab === 'journalists' && <JournalistsTab />}
      {tab === 'deliveries' && <DeliveriesTab />}
      {tab === 'prompt' && <PromptTab />}
      {tab === 'agents' && <AgentsTab />}
      {tab === 'logs' && <LogsTab />}
      {tab === 'settings' && <SettingsTab />}
    </div>
  );
}
