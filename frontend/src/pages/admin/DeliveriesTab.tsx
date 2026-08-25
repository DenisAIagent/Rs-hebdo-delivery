import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { adminGetDeliveries, adminDeleteDelivery, adminSendDeliveryToWordpress } from '../../services/api.ts';
import type { Delivery } from '../../types/index.ts';
import { FolderOpen, ExternalLink, AlertCircle, Search, Trash2, Pencil, Globe, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const STATUS_LABELS: Record<string, { label: string; classes: string }> = {
  delivered: { label: 'Livre', classes: 'bg-green-50 text-green-700' },
  corrected: { label: 'Corrige', classes: 'bg-blue-50 text-blue-700' },
  draft: { label: 'Brouillon', classes: 'bg-gray-100 text-gray-600' },
};

export function DeliveriesTab() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [sendingWp, setSendingWp] = useState<string | null>(null);

  async function handleSendWordpress(d: Delivery) {
    if (d.wp_status === 'sent' && !confirm(`"${d.title}" a deja un brouillon WordPress. Renvoyer quand meme (nouveau brouillon) ?`)) {
      return;
    }
    setSendingWp(d.id);
    try {
      const { post, message } = await adminSendDeliveryToWordpress(d.id);
      toast.success(message);
      setDeliveries((prev) =>
        prev.map((x) =>
          x.id === d.id
            ? { ...x, wp_status: 'sent', wp_post_id: post.id, wp_post_url: post.editUrl }
            : x,
        ),
      );
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Erreur envoi WordPress (voir Logs)');
    } finally {
      setSendingWp(null);
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Supprimer la livraison "${title}" ? Cette action est irreversible.`)) return;
    setDeleting(id);
    try {
      await adminDeleteDelivery(id);
      setDeliveries((prev) => prev.filter((d) => d.id !== id));
    } catch {
      alert('Erreur lors de la suppression');
    } finally {
      setDeleting(null);
    }
  }

  useEffect(() => {
    async function load() {
      try {
        const data = await adminGetDeliveries();
        setDeliveries(data);
      } catch {
        setError('Erreur chargement');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return deliveries;
    const q = search.toLowerCase();
    return deliveries.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.author?.full_name?.toLowerCase().includes(q) ||
        d.paper_type?.name?.toLowerCase().includes(q) ||
        d.hebdo?.label?.toLowerCase().includes(q)
    );
  }, [deliveries, search]);

  if (loading) {
    return <div className="text-center py-8 text-gray-400">Chargement...</div>;
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">
        <AlertCircle size={16} />
        {error}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <h2 className="text-lg font-semibold text-rs-black whitespace-nowrap">Toutes les livraisons</h2>
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-rs-red focus:border-transparent"
          />
        </div>
        <span className="text-sm text-gray-500 whitespace-nowrap">{filtered.length} livraison{filtered.length > 1 ? 's' : ''}</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-400">
            {search ? 'Aucun resultat pour cette recherche.' : 'Aucune livraison pour le moment.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Journaliste</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Titre</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Hebdo</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Statut</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Signes</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Date</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Liens</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((d) => {
                  const st = STATUS_LABELS[d.status] || STATUS_LABELS.draft;
                  return (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-rs-black">
                        {d.author?.full_name || 'N/A'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                          {d.paper_type?.name || 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-rs-black max-w-[200px] truncate">{d.title}</td>
                      <td className="px-4 py-3 text-center text-gray-600">{d.hebdo?.label || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${st.classes}`}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-xs font-mono ${
                          d.paper_type && d.sign_count > d.paper_type.sign_limit
                            ? 'text-red-600'
                            : 'text-gray-600'
                        }`}>
                          {d.sign_count.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                        {d.delivered_at
                          ? format(new Date(d.delivered_at), 'd MMM yyyy HH:mm', { locale: fr })
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {d.wp_status === 'sent' && d.wp_post_url ? (
                            <a
                              href={d.wp_post_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-green-600 hover:text-green-700 transition-colors"
                              title={`Brouillon WordPress #${d.wp_post_id} — en attente de relecture`}
                            >
                              <Globe size={16} />
                            </a>
                          ) : (
                            <button
                              onClick={() => handleSendWordpress(d)}
                              disabled={sendingWp === d.id}
                              className={`p-1.5 transition-colors disabled:opacity-50 ${
                                d.wp_status === 'error'
                                  ? 'text-red-500 hover:text-red-600'
                                  : 'text-gray-300 hover:text-rs-red'
                              }`}
                              title={
                                d.wp_status === 'error'
                                  ? 'Echec envoi WordPress — cliquer pour reessayer'
                                  : 'Envoyer sur WordPress (brouillon)'
                              }
                            >
                              {sendingWp === d.id ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
                            </button>
                          )}
                          {d.drive_folder_url && (
                            <a
                              href={d.drive_folder_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-gray-400 hover:text-rs-red transition-colors"
                              title="Dropbox"
                            >
                              <FolderOpen size={16} />
                            </a>
                          )}
                          {d.digital_link && (
                            <a
                              href={d.digital_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"
                              title="Lien"
                            >
                              <ExternalLink size={16} />
                            </a>
                          )}
                          <Link
                            to={`/livrer/${d.id}?admin=true`}
                            className="p-1.5 text-gray-400 hover:text-rs-red transition-colors"
                            title="Modifier"
                          >
                            <Pencil size={15} />
                          </Link>
                          <button
                            onClick={() => handleDelete(d.id, d.title)}
                            disabled={deleting === d.id}
                            className="p-1.5 text-gray-300 hover:text-red-600 transition-colors disabled:opacity-50"
                            title="Supprimer"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
