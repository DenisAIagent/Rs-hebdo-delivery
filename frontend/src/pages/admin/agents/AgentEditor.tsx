import { useEffect, useMemo, useState } from 'react';
import { Save, X, History, RotateCcw, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminUpdateAgent, adminGetAgentVersions, adminRestoreAgentVersion } from '../../../services/api.ts';
import type { AgentConfig, AgentsResponse, AgentVersion, EditorialAgent, LeadConfig } from '../../../types/index.ts';
import { AgentRulesForm } from './AgentRulesForm.tsx';
import { LeadRulesForm } from './LeadRulesForm.tsx';
import { Section, Field, inputCls } from './fields.tsx';

interface Props {
  agent: EditorialAgent;
  meta: AgentsResponse['meta'];
  paperTypeNames: string[];
  categoryNames: Map<number, string>;
  onSaved: (a: EditorialAgent) => void;
  onClose: () => void;
}

const errorMessage = (err: unknown) => {
  const e = err as { response?: { data?: { error?: string } }; message?: string };
  return e.response?.data?.error || e.message || 'Erreur inconnue';
};

/** Edition d'un agent : identite, regles structurees, regles detaillees, historique. */
export function AgentEditor({ agent, meta, paperTypeNames, categoryNames, onSaved, onClose }: Props) {
  const [draft, setDraft] = useState<EditorialAgent>(agent);
  const [saving, setSaving] = useState(false);
  const [versions, setVersions] = useState<AgentVersion[] | null>(null);

  // Apres un enregistrement ou une restauration, l'agent recu remplace le brouillon.
  useEffect(() => { setDraft(agent); setVersions(null); }, [agent]);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(agent), [draft, agent]);
  const set = <K extends keyof EditorialAgent>(key: K, value: EditorialAgent[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const togglePaperType = (name: string) =>
    set('paper_types', draft.paper_types.includes(name) ? draft.paper_types.filter((t) => t !== name) : [...draft.paper_types, name]);

  const save = async () => {
    setSaving(true);
    try {
      const saved = await adminUpdateAgent(agent.id, {
        name: draft.name, role: draft.role, paper_types: draft.paper_types, subtype: draft.subtype,
        is_active: draft.is_active, config: draft.config, notes_md: draft.notes_md,
      });
      toast.success(`${saved.name} enregistré (version ${saved.version})`);
      onSaved(saved);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const loadVersions = async () => {
    try { setVersions(await adminGetAgentVersions(agent.id)); } catch (err) { toast.error(errorMessage(err)); }
  };

  const restore = async (v: number) => {
    try {
      const saved = await adminRestoreAgentVersion(agent.id, v);
      toast.success(`Version ${v} restaurée (nouvelle version ${saved.version})`);
      onSaved(saved);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  // Garde-fou : jamais le brouillon d'un autre agent dans ce formulaire.
  if (draft.id !== agent.id) return null;
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
        <div>
          <h3 className="font-semibold text-rs-black">{agent.name}</h3>
          <p className="text-xs text-gray-500">Version {agent.version}{agent.updated_at ? ` · modifié le ${new Date(agent.updated_at).toLocaleString('fr-FR')}` : ''}</p>
        </div>
        <button type="button" onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-rs-black hover:bg-gray-100" aria-label="Fermer"><X size={18} /></button>
      </div>

      <div className="px-5 py-5 space-y-5">
        <Section title="Identité">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Nom de l'agent"><input className={inputCls} value={draft.name} onChange={(e) => set('name', e.target.value)} /></Field>
            {!agent.is_lead && (
              <Field label="Sous-type (facultatif)" hint="Ex. « expo » pour distinguer dans « Livres et Expo »">
                <input className={inputCls} value={draft.subtype ?? ''} onChange={(e) => set('subtype', e.target.value || null)} />
              </Field>
            )}
          </div>
          <div className="mt-3"><Field label="Rôle"><textarea rows={2} className={inputCls} value={draft.role} onChange={(e) => set('role', e.target.value)} /></Field></div>
          {!agent.is_lead && (
            <div className="mt-3">
              <span className="text-xs font-medium text-gray-600">Types de papier gérés</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {paperTypeNames.map((n) => {
                  const on = draft.paper_types.includes(n);
                  return (
                    <button key={n} type="button" onClick={() => togglePaperType(n)}
                      className={`text-xs rounded-full px-2.5 py-1 border ${on ? 'bg-rs-red text-white border-rs-red' : 'border-gray-300 text-gray-600 hover:border-rs-red'}`}>{n}</button>
                  );
                })}
              </div>
            </div>
          )}
        </Section>

        {agent.is_lead
          ? <LeadRulesForm cfg={draft.config as LeadConfig} onChange={(c) => set('config', c)} />
          : <AgentRulesForm cfg={draft.config as AgentConfig} onChange={(c) => set('config', c)} meta={meta} categoryNames={categoryNames} />}

        <Section title="Règles détaillées et points à valider" hint="Texte libre transmis tel quel à l'agent (références, cas particuliers, « À VALIDER »).">
          <textarea rows={8} className={`${inputCls} font-mono text-xs leading-relaxed`} value={draft.notes_md} onChange={(e) => set('notes_md', e.target.value)} />
        </Section>

        <Section title="Historique">
          {versions === null ? (
            <button type="button" onClick={loadVersions} className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-rs-black">
              <History size={14} /> Afficher les versions précédentes
            </button>
          ) : versions.length === 0 ? (
            <p className="text-xs text-gray-400">Aucune version précédente.</p>
          ) : (
            <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
              {versions.map((v) => (
                <li key={v.version} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span>Version {v.version} <span className="text-xs text-gray-400">· {new Date(v.created_at).toLocaleString('fr-FR')}</span></span>
                  <button type="button" onClick={() => restore(v.version)} className="flex items-center gap-1 text-xs font-medium text-rs-red hover:underline">
                    <RotateCcw size={13} /> Restaurer
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50 sticky bottom-0">
        <button type="button" onClick={() => setDraft(agent)} disabled={!dirty || saving}
          className="text-sm font-medium px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-40">Annuler les modifications</button>
        <button type="button" onClick={save} disabled={!dirty || saving}
          className="flex items-center gap-1.5 bg-rs-red hover:bg-rs-red-dark text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Enregistrer
        </button>
      </div>
    </div>
  );
}
