import { useEffect, useState, type FormEvent } from 'react';
import { adminGetJournalists, adminCreateJournalist, adminUpdateJournalist, adminResetJournalistMfa } from '../../services/api.ts';
import type { Profile } from '../../types/index.ts';
import { Plus, Save, X, AlertCircle, UserCheck, UserX, ShieldOff } from 'lucide-react';
import toast from 'react-hot-toast';

export function JournalistsTab() {
  const [journalists, setJournalists] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  // Form
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'journalist' | 'admin'>('journalist');

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
    setPassword('');
    setRole('journalist');
    setShowForm(false);
    setError('');
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await adminCreateJournalist({ email, full_name: fullName, password, role });
      toast.success(`Compte cree pour ${fullName}`);
      resetForm();
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur creation';
      setError(msg);
      toast.error(msg);
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
              <label className="block text-xs font-medium text-gray-600 mb-1">Mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={10}
                pattern="(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{10,}"
                title="Min. 10 caracteres, 1 majuscule, 1 minuscule, 1 chiffre"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-rs-red focus:border-transparent"
                placeholder="Min. 10 car., maj+min+chiffre"
              />
              <p className="text-xs text-gray-400 mt-1">Min. 10 caracteres, 1 majuscule, 1 minuscule, 1 chiffre</p>
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
          <div className="flex items-center gap-2 mt-3">
            <button
              type="submit"
              className="flex items-center gap-1 bg-rs-red hover:bg-rs-red-dark text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Save size={14} />
              Creer le compte
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
                <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{j.email}</td>
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
