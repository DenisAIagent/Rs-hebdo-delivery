import { useEffect, useState, type FormEvent } from 'react';
import { adminGetJournalists, adminCreateJournalist, adminUpdateJournalist, adminResetJournalistMfa, adminInviteJournalist } from '../../services/api.ts';
import type { Profile } from '../../types/index.ts';
import { Plus, Save, X, AlertCircle, UserCheck, UserX, ShieldOff, Pencil, Mail } from 'lucide-react';

function apiErrorMessage(err: unknown, fallback: string): string {
  return (err as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;
}
import toast from 'react-hot-toast';

export function JournalistsTab() {
  const [journalists, setJournalists] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  // Form
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'journalist' | 'admin'>('journalist');
  const [creating, setCreating] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await adminGetJournalists();
      setJournalists(data);
    } catch {
      setError('Erreur chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setEmail('');
    setFullName('');
    setRole('journalist');
    setShowForm(false);
    setError('');
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const created = await adminCreateJournalist({ email, full_name: fullName, role });
      if (created.invitation?.sent) {
        toast.success(`Compte cree : ${fullName} recoit un email pour definir son mot de passe`);
      } else {
        toast.error(
          `Compte cree, mais l'invitation n'est pas partie : ${created.invitation?.reason || 'erreur inconnue'}. Utilisez « Renvoyer l'invitation ».`,
          { duration: 8000 },
        );
      }
      resetForm();
      await load();
    } catch (err: unknown) {
      const msg = apiErrorMessage(err, 'Erreur creation');
      setError(msg);
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const resendInvite = async (j: Profile) => {
    setInvitingId(j.id);
    try {
      const { message } = await adminInviteJournalist(j.id);
      toast.success(message);
    } catch (err: unknown) {
      toast.error(apiErrorMessage(err, "Erreur envoi de l'invitation"));
    } finally {
      setInvitingId(null);
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      await adminUpdateJournalist(id, { is_active: !isActive } as Partial<Profile>);
      toast.success(isActive ? 'Compte desactive' : 'Compte reactive');
      await load();
    } catch {
      setError('Erreur mise a jour');
      toast.error('Erreur mise a jour');
    }
  };

  const resetMfa = async (j: Profile) => {
    if (!confirm(`Reinitialiser la double authentification de ${j.full_name} ?\nSon application actuelle ne fonctionnera plus : il devra rescanner un QR code a la prochaine connexion.`)) {
      return;
    }
    try {
      const { message } = await adminResetJournalistMfa(j.id);
      toast.success(message);
    } catch {
      toast.error('Erreur reinitialisation 2FA');
    }
  };

  // Modification de l'email (compte de connexion + fiche)
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  const startEditEmail = (j: Profile) => {
    setEditingEmailId(j.id);
    setEmailDraft(j.email);
  };

  const cancelEditEmail = () => {
    setEditingEmailId(null);
    setEmailDraft('');
  };

  const saveEmail = async (j: Profile) => {
    const next = emailDraft.trim();
    if (!next || next.toLowerCase() === j.email.toLowerCase()) {
      cancelEditEmail();
      return;
    }
    setSavingEmail(true);
    try {
      await adminUpdateJournalist(j.id, { email: next } as Partial<Profile>);
      toast.success(`Email de ${j.full_name} modifie : il se connecte desormais avec ${next.toLowerCase()}`);
      cancelEditEmail();
      await load();
    } catch (err: unknown) {
      const apiError = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(apiError || 'Erreur modification email');
    } finally {
      setSavingEmail(false);
    }
  };

  const toggleRole = async (id: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'journalist' : 'admin';
    try {
      await adminUpdateJournalist(id, { role: newRole } as Partial<Profile>);
      toast.success(`Role change en ${newRole === 'admin' ? 'Admin' : 'Journaliste'}`);
      await load();
    } catch {
      setError('Erreur mise a jour');
      toast.error('Erreur mise a jour');
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-400">Chargement...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-rs-black">Journalistes</h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1 bg-rs-red hover:bg-rs-red-dark text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={16} />
            Ajouter
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nom complet</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-rs-red focus:border-transparent"
                placeholder="Jean Dupont"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-rs-red focus:border-transparent"
                placeholder="jean@rollingstone.fr"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as 'journalist' | 'admin')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-rs-red focus:border-transparent"
              >
                <option value="journalist">Journaliste</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <p className="flex items-start gap-2 text-xs text-gray-500 mt-3">
            <Mail size={14} className="mt-0.5 shrink-0" />
            Pas de mot de passe a choisir : la personne recoit un email pour definir le sien.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <button
              type="submit"
              disabled={creating}
              className="flex items-center gap-1 bg-rs-red hover:bg-rs-red-dark disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Save size={14} />
              {creating ? 'Envoi en cours…' : "Creer et envoyer l'invitation"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <X size={14} />
              Annuler
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Nom</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Email</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Role</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Statut</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {journalists.map((j) => (
              <tr key={j.id} className={`hover:bg-gray-50 ${!j.is_active ? 'opacity-50' : ''}`}>
                <td className="px-4 py-3 font-medium text-rs-black">{j.full_name}</td>
                <td className={`px-4 py-3 text-gray-500 ${editingEmailId === j.id ? '' : 'hidden sm:table-cell'}`}>
                  {editingEmailId === j.id ? (
                    <form
                      onSubmit={(e) => { e.preventDefault(); saveEmail(j); }}
                      className="flex items-center gap-1"
                    >
                      <input
                        type="email"
                        value={emailDraft}
                        onChange={(e) => setEmailDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Escape') cancelEditEmail(); }}
                        required
                        autoFocus
                        disabled={savingEmail}
                        aria-label={`Nouvel email de ${j.full_name}`}
                        className="w-full min-w-0 px-2 py-1 border border-gray-300 rounded-md text-sm text-rs-black focus:ring-2 focus:ring-rs-red focus:border-transparent"
                      />
                      <button
                        type="submit"
                        disabled={savingEmail}
                        className="p-1.5 text-gray-400 hover:text-green-600 disabled:opacity-50 transition-colors"
                        title="Enregistrer"
                      >
                        <Save size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditEmail}
                        disabled={savingEmail}
                        className="p-1.5 text-gray-400 hover:text-gray-700 transition-colors"
                        title="Annuler"
                      >
                        <X size={16} />
                      </button>
                    </form>
                  ) : (
                    <button
                      onClick={() => startEditEmail(j)}
                      className="group inline-flex items-center gap-1.5 text-left hover:text-rs-black transition-colors"
                      title="Modifier l'email (adresse de connexion)"
                    >
                      {j.email}
                      <Pencil size={13} className="text-gray-300 group-hover:text-rs-red transition-colors" />
                    </button>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleRole(j.id, j.role)}
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                      j.role === 'admin'
                        ? 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    title="Cliquer pour changer le role"
                  >
                    {j.role === 'admin' ? 'Admin' : 'Journaliste'}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    j.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {j.is_active ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => startEditEmail(j)}
                    className="p-1.5 text-gray-400 hover:text-rs-red transition-colors sm:hidden"
                    title="Modifier l'email"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => resendInvite(j)}
                    disabled={!j.is_active || invitingId === j.id}
                    className="p-1.5 text-gray-400 hover:text-rs-red disabled:opacity-40 disabled:hover:text-gray-400 transition-colors"
                    title="Renvoyer l'invitation (lien pour definir le mot de passe)"
                    aria-label={`Renvoyer l'invitation a ${j.full_name}`}
                  >
                    <Mail size={16} />
                  </button>
                  <button
                    onClick={() => resetMfa(j)}
                    className="p-1.5 text-gray-400 hover:text-amber-600 transition-colors"
                    title="Reinitialiser la double authentification (telephone perdu...)"
                  >
                    <ShieldOff size={16} />
                  </button>
                  <button
                    onClick={() => toggleActive(j.id, j.is_active)}
                    className={`p-1.5 transition-colors ${
                      j.is_active
                        ? 'text-gray-400 hover:text-red-600'
                        : 'text-gray-400 hover:text-green-600'
                    }`}
                    title={j.is_active ? 'Desactiver' : 'Reactiver'}
                  >
                    {j.is_active ? <UserX size={16} /> : <UserCheck size={16} />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
