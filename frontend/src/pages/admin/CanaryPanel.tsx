import { useEffect, useState } from 'react';
import { Activity, Send, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  adminGetCanary,
  adminRunCanary,
  adminTestCanaryAlert,
  type CanaryComponentState,
  type CanaryStatus,
} from '../../services/api.ts';

function apiErrorMessage(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

function StatusRow({ label, watcher, state }: { label: string; watcher: string; state: CanaryComponentState | null }) {
  const tone = !state
    ? { dot: 'bg-gray-300', text: 'text-gray-500', word: 'En attente du premier contrôle' }
    : state.status === 'ok'
      ? { dot: 'bg-green-500', text: 'text-green-700', word: 'Opérationnel' }
      : { dot: 'bg-red-500', text: 'text-red-700', word: 'En panne' };
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium text-rs-black">{label}</p>
        <p className="text-xs text-gray-500">{watcher}</p>
        {state?.detail && <p className="text-xs text-red-700 mt-1">{state.detail}</p>}
      </div>
      <div className="text-right shrink-0">
        <p className={`inline-flex items-center gap-1.5 text-sm font-medium ${tone.text}`}>
          <span className={`w-2 h-2 rounded-full ${tone.dot}`} aria-hidden />
          {tone.word}
        </p>
        {state && (
          <p className="text-xs text-gray-400">
            depuis le {formatDate(state.since)}
            {state.last_checked ? ` · vu le ${formatDate(state.last_checked)}` : ''}
          </p>
        )}
      </div>
    </div>
  );
}

/** Etat du canari (surveillance croisee Railway / Supabase) et alerte de test au CTO. */
export function CanaryPanel() {
  const [status, setStatus] = useState<CanaryStatus | null>(null);
  const [busy, setBusy] = useState<'run' | 'test' | null>(null);

  const load = async () => {
    try {
      setStatus(await adminGetCanary());
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, 'Erreur lecture du canari'));
    }
  };

  useEffect(() => { load(); }, []);

  const runNow = async () => {
    setBusy('run');
    try {
      await adminRunCanary();
      await load();
      toast.success('Contrôle de la base effectué');
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, 'Erreur contrôle'));
    } finally {
      setBusy(null);
    }
  };

  const sendTest = async () => {
    setBusy('test');
    try {
      const { message } = await adminTestCanaryAlert();
      toast.success(message);
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, "Erreur envoi de l'alerte"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-gray-50">
        <Activity size={18} className="text-rs-red" />
        <h3 className="font-semibold text-rs-black">Surveillance (canari)</h3>
      </div>
      <div className="px-5 py-2 divide-y divide-gray-100">
        <StatusRow label="Base Supabase" watcher="Contrôlée toutes les heures par le serveur" state={status?.supabase ?? null} />
        <StatusRow label="Serveur Railway" watcher="Contrôlé toutes les heures par la base" state={status?.railway ?? null} />
      </div>
      <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          {status && status.ctoCount === 0
            ? 'Aucun CTO actif : donnez le rôle CTO à un compte (onglet Journalistes) pour recevoir les alertes.'
            : `Alertes envoyées par email à ${status?.ctoCount ?? '…'} CTO, au début d'une panne et au retour à la normale.`}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={runNow}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-white disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={14} className={busy === 'run' ? 'animate-spin' : ''} />
            Contrôler maintenant
          </button>
          <button
            type="button"
            onClick={sendTest}
            disabled={busy !== null || status?.ctoCount === 0}
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-rs-red hover:bg-rs-red-dark text-white disabled:opacity-50 transition-colors"
          >
            <Send size={14} />
            Envoyer une alerte de test
          </button>
        </div>
      </div>
    </div>
  );
}
