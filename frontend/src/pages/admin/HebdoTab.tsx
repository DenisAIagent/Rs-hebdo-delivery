import { Fragment, useEffect, useState, type FormEvent } from 'react';
import { adminGetHebdos, adminCreateHebdo, adminSetCurrentHebdo, adminGetHebdoStatus, adminDownloadRecap, adminSendRecap } from '../../services/api.ts';
import type { HebdoConfig } from '../../types/index.ts';
import type { HebdoStatusItem } from '../../services/api.ts';
import { Plus, Check, AlertCircle, Calendar, ChevronDown, ChevronUp, CheckCircle, XCircle, User, FileDown, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

function formatRange(h: HebdoConfig): string {
  if (!h.start_date || !h.end_date) return '';
  const s = new Date(h.start_date + 'T00:00:00');
  const e = new Date(h.end_date + 'T00:00:00');
  return `du ${format(s, 'd', { locale: fr })} au ${format(e, 'd MMM yyyy', { locale: fr })}`;
}

/** Mois précédent au format AAAA-MM (valeur par défaut du récapitulatif). */
function previousMonthValue(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function MonthlyRecapCard() {
  const [month, setMonth] = useState(previousMonthValue());
  const [busy, setBusy] = useState<'download' | 'send' | null>(null);

  const download = async () => {
    setBusy('download');
    try {
      const blob = await adminDownloadRecap(month);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `RS-Hebdo-recap-livraisons-${month}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Téléchargement impossible');
    } finally {
      setBusy(null);
    }
  };

  const send = async () => {
    if (!window.confirm(`Envoyer le récapitulatif ${month} par email à la rédaction en chef ?`)) return;
    setBusy('send');
    try {
      const r = await adminSendRecap(month);
      toast.success(`Récapitulatif envoyé à ${r.recipients.join(', ')} (${r.total} papiers)`);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || e?.message || 'Envoi impossible');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <h3 className="text-sm font-semibold text-rs-black">Récapitulatif mensuel des livraisons</h3>
          <p className="text-xs text-gray-500 mt-1">
            PDF par journaliste (numéro, format, titre, date, signes). Envoyé automatiquement à la rédaction en chef
            le 1er de chaque mois pour le mois écoulé ; vous pouvez aussi le télécharger ou l'envoyer manuellement.
          </p>
        </div>
        <label className="text-xs text-gray-600">
          Mois
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="block mt-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
          />
        </label>
        <button type="button" onClick={download} disabled={busy !== null} className="rs-btn ghost sm">
          <FileDown size={14} />
          {busy === 'download' ? 'Génération…' : 'Télécharger le PDF'}
        </button>
        <button type="button" onClick={send} disabled={busy !== null} className="rs-btn primary sm">
          <Send size={14} />
          {busy === 'send' ? 'Envoi…' : 'Envoyer à la rédaction'}
        </button>
      </div>
    </div>
  );
}

export function HebdoTab() {
  const [hebdos, setHebdos] = useState<HebdoConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [numero, setNumero] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');

  // Status panel
  const [expandedHebdo, setExpandedHebdo] = useState<string | null>(null);
  const [statusData, setStatusData] = useState<Record<string, HebdoStatusItem[]>>({});
  const [loadingStatus, setLoadingStatus] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await adminGetHebdos();
      setHebdos(data);
    } catch {
      setError('Erreur chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleStatus = async (hebdoId: string) => {
    if (expandedHebdo === hebdoId) {
      setExpandedHebdo(null);
      return;
    }

    setExpandedHebdo(hebdoId);

    // Load status if not already cached
    if (!statusData[hebdoId]) {
      setLoadingStatus(hebdoId);
      try {
        const data = await adminGetHebdoStatus(hebdoId);
        setStatusData(prev => ({ ...prev, [hebdoId]: data }));
      } catch {
        toast.error('Erreur chargement statut');
      } finally {
        setLoadingStatus(null);
      }
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!numero) return;
    setError('');
    try {
      await adminCreateHebdo(parseInt(numero), startDate || undefined, endDate || undefined);
      toast.success(`Hebdo RSH${numero} cree et active`);
      setNumero('');
      setStartDate('');
      setEndDate('');
      await load();
    } catch {
      setError('Erreur creation');
      toast.error('Erreur creation');
    }
  };

  const handleSetCurrent = async (id: string) => {
    try {
      await adminSetCurrentHebdo(id);
      toast.success('Numero actif mis a jour');
      await load();
    } catch {
      setError('Erreur changement');
      toast.error('Erreur changement');
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-400">Chargement...</div>;
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-rs-black mb-4">Gestion des numeros Hebdo</h2>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Create form */}
      <MonthlyRecapCard />

      <form onSubmit={handleCreate} className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-28">
            <label className="block text-xs font-medium text-gray-600 mb-1">Numero</label>
            <input
              type="number"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="227"
              required
              min="1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-rs-red focus:border-transparent"
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Date debut</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-rs-red focus:border-transparent"
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Date fin</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-rs-red focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            className="flex items-center gap-1 bg-rs-red hover:bg-rs-red-dark text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={16} />
            Creer et activer
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Laissez les dates vides : elles seront calculées automatiquement (aujourd'hui &rarr; vendredi suivant). La rotation hebdomadaire reprendra ensuite chaque vendredi à partir de ce numéro.
        </p>
      </form>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Label</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Periode</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">En cours</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Statut</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {hebdos.map((h) => {
              const range = formatRange(h);
              const isExpanded = expandedHebdo === h.id;
              const status = statusData[h.id];
              const totalCategories = status?.length || 0;
              const filledCategories = status?.filter(s => s.count > 0).length || 0;

              return (
                <Fragment key={h.id}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-rs-black">{h.label}</span>
                      <span className="text-gray-400 ml-1.5 text-xs">n{h.numero}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {range ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar size={13} className="text-gray-400" />
                          {range}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">pas de dates</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {h.is_current ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 text-xs font-medium rounded-full">
                          <Check size={12} />
                          Actif
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleStatus(h.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors hover:bg-gray-100"
                      >
                        {status ? (
                          <span className={filledCategories === totalCategories ? 'text-green-600' : 'text-orange-500'}>
                            {filledCategories}/{totalCategories}
                          </span>
                        ) : (
                          <span className="text-gray-400">Voir</span>
                        )}
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!h.is_current && (
                        <button
                          onClick={() => handleSetCurrent(h.id)}
                          className="text-xs text-rs-red hover:underline font-medium"
                        >
                          Activer
                        </button>
                      )}
                    </td>
                  </tr>

                  {/* Expanded status panel */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={5} className="px-4 py-0">
                        <div className="py-4 border-t border-gray-100">
                          {loadingStatus === h.id ? (
                            <div className="text-center py-4 text-gray-400 text-sm">Chargement...</div>
                          ) : status ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                              {status.map((s) => (
                                <div
                                  key={s.paper_type_id}
                                  className={`rounded-lg border p-3 ${
                                    s.count > 0
                                      ? 'border-green-200 bg-green-50'
                                      : 'border-red-200 bg-red-50'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 mb-1">
                                    {s.count > 0 ? (
                                      <CheckCircle size={16} className="text-green-600 shrink-0" />
                                    ) : (
                                      <XCircle size={16} className="text-red-400 shrink-0" />
                                    )}
                                    <span className="font-medium text-sm text-rs-black">{s.name}</span>
                                    <span className={`ml-auto text-xs font-medium px-1.5 py-0.5 rounded ${
                                      s.count > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500'
                                    }`}>
                                      {s.count}
                                    </span>
                                  </div>
                                  {s.deliveries.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                      {s.deliveries.map((d, i) => (
                                        <div key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
                                          <User size={11} className="text-gray-400 shrink-0" />
                                          <span className="font-medium">{d.author}</span>
                                          <span className="text-gray-400">—</span>
                                          <span className="truncate">{d.title}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
