import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Crown, Loader2, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminGetAgents, adminGetPaperTypes, adminUpdateAgent } from '../../services/api.ts';
import type { AgentsResponse, EditorialAgent, LeadConfig } from '../../types/index.ts';
import { AgentEditor } from './agents/AgentEditor.tsx';

/** Onglet « Agents IA » : l'equipe d'agents web qui prepare les articles WordPress. */
export function AgentsTab() {
  const [data, setData] = useState<AgentsResponse | null>(null);
  const [paperTypeNames, setPaperTypeNames] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([adminGetAgents(), adminGetPaperTypes()])
      .then(([agents, types]) => {
        setData(agents);
        setPaperTypeNames(types.map((t) => t.name));
      })
      .catch((err) => setError(err?.response?.data?.error || 'Erreur chargement des agents'));
  }, []);

  const lead = data?.agents.find((a) => a.is_lead) || null;
  const categoryNames = useMemo(
    () => new Map(((lead?.config as LeadConfig | undefined)?.categoryIds || []).map((c) => [c.id, c.name] as [number, string])),
    [lead],
  );
  const selected = data?.agents.find((a) => a.id === selectedId) || null;

  const replace = (a: EditorialAgent) =>
    setData((d) => (d ? { ...d, agents: d.agents.map((x) => (x.id === a.id ? a : x)) } : d));

  const toggleActive = async (a: EditorialAgent) => {
    setToggling(a.id);
    try {
      const saved = await adminUpdateAgent(a.id, { is_active: !a.is_active });
      replace(saved);
      toast.success(`${saved.name} ${saved.is_active ? 'activé' : 'désactivé'}`);
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e.response?.data?.error || 'Erreur');
    } finally {
      setToggling(null);
    }
  };

  if (error) {
    return <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm rounded-lg px-4 py-3"><AlertCircle size={16} /> {error}</div>;
  }
  if (!data) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-rs-black">Agents IA</h2>
        <p className="text-sm text-gray-500 max-w-3xl">
          L'équipe qui met en forme les papiers pour rollingstone.fr. Chaque type de papier a son agent ; le Chef d'édition web
          porte les règles communes et les interdits. Les agents mettent en forme, ils n'écrivent pas : le texte du journaliste
          reste intégral et aucun chapô n'est inventé. Chaque modification crée une nouvelle version, restaurable.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.agents.map((a) => (
          <article key={a.id}
            className={`group relative bg-white rounded-xl border p-4 transition-shadow hover:shadow-md ${a.is_lead ? 'sm:col-span-2 xl:col-span-3 border-rs-black' : 'border-gray-200'} ${selectedId === a.id ? 'ring-2 ring-rs-red/40' : ''} ${a.is_active ? '' : 'opacity-60'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="flex items-center gap-1.5 font-semibold text-rs-black">
                  {a.is_lead && <Crown size={15} className="text-rs-red shrink-0" />} {a.name}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{a.role}</p>
              </div>
              <button type="button" role="switch" aria-checked={a.is_active} aria-label={`Activer ${a.name}`}
                disabled={toggling === a.id} onClick={() => toggleActive(a)}
                className={`relative shrink-0 w-10 h-6 rounded-full transition-colors disabled:opacity-60 ${a.is_active ? 'bg-green-600' : 'bg-gray-300'}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${a.is_active ? 'translate-x-4' : ''}`} />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1">
              {a.is_lead
                ? <span className="text-[11px] bg-rs-black text-white rounded-full px-2 py-0.5">Tous les types · règles communes</span>
                : a.paper_types.map((t) => (
                  <span key={t} className="text-[11px] bg-gray-100 text-gray-700 rounded-full px-2 py-0.5">{t}{a.subtype ? ` · ${a.subtype}` : ''}</span>
                ))}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[11px] text-gray-400">v{a.version}</span>
              <button type="button" onClick={() => setSelectedId(a.id)}
                className="flex items-center gap-1 text-xs font-medium text-rs-red hover:underline">
                <Pencil size={13} /> Modifier les règles
              </button>
            </div>
          </article>
        ))}
      </div>

      {selected && (
        <AgentEditor agent={selected} meta={data.meta} paperTypeNames={paperTypeNames} categoryNames={categoryNames}
          onSaved={replace} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
