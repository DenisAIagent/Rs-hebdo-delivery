import { useEffect, useState } from 'react';
import {
  adminGetSettings,
  adminUpdateSettings,
  adminGetModels,
  adminGetLatestModel,
  adminTestWordpress,
  type ClaudeModelInfo,
} from '../../services/api.ts';
import type { AppSetting } from '../../types/index.ts';
import { Key, Eye, EyeOff, Save, AlertCircle, Loader2, Sparkles, Cpu, RefreshCw, Globe, PlugZap } from 'lucide-react';
import toast from 'react-hot-toast';

interface SettingField {
  key: string;
  label: string;
  description: string;
}

interface SettingSection {
  title: string;
  icon: React.ReactNode;
  fields: SettingField[];
}

const SECRET_SECTIONS: SettingSection[] = [
  {
    title: 'Cles API IA',
    icon: <Key size={18} className="text-purple-600" />,
    fields: [
      {
        key: 'ANTHROPIC_API_KEY',
        label: 'Cle API Anthropic (Claude)',
        description: 'Utilisee quand le moteur IA selectionne est Anthropic.',
      },
      {
        key: 'GEMINI_API_KEY',
        label: 'Cle API Google Gemini',
        description: 'Utilisee quand le moteur IA selectionne est Gemini (modele gemini-3.5-flash).',
      },
      {
        key: 'MISTRAL_API_KEY',
        label: 'Cle API Mistral',
        description: 'Utilisee quand le moteur IA selectionne est Mistral (modele mistral-large-latest).',
      },
    ],
  },
  {
    title: 'Dropbox',
    icon: <Key size={18} className="text-blue-600" />,
    fields: [
      { key: 'DROPBOX_APP_KEY', label: 'App Key', description: "Identifiant de l'application Dropbox." },
      { key: 'DROPBOX_APP_SECRET', label: 'App Secret', description: "Secret de l'application Dropbox." },
      { key: 'DROPBOX_REFRESH_TOKEN', label: 'Refresh Token', description: "Token de rafraichissement pour l'acces Dropbox." },
    ],
  },
];

type AIProvider = 'anthropic' | 'gemini' | 'mistral' | 'claude-code';

interface ProviderDef {
  id: AIProvider;
  label: string;
  model: string;
  /** App-settings key for the secret; null means no key required (e.g. local CLI). */
  keyName: string | null;
  /** True when this provider only works locally (no production deploy). */
  localOnly?: boolean;
}

const PROVIDERS: ReadonlyArray<ProviderDef> = [
  { id: 'anthropic', label: 'Anthropic', model: 'choisi ci-dessous', keyName: 'ANTHROPIC_API_KEY' },
  { id: 'gemini', label: 'Gemini', model: 'gemini-3.5-flash', keyName: 'GEMINI_API_KEY' },
  { id: 'mistral', label: 'Mistral', model: 'mistral-large-latest', keyName: 'MISTRAL_API_KEY' },
  { id: 'claude-code', label: 'Claude Code', model: 'sonnet (CLI local)', keyName: null, localOnly: true },
];

// Modèle par défaut côté UI (doit rester aligné sur DEFAULT_CLAUDE_MODEL du backend).
const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-5-20250929';

// Liste de secours affichée dans le sélecteur quand l'API live Anthropic est
// injoignable (clé absente, réseau). La liste live (récupérée à chaud) prime
// toujours et fait apparaître automatiquement les nouveaux modèles.
const FALLBACK_CLAUDE_MODELS: ReadonlyArray<ClaudeModelInfo> = [
  { id: 'claude-opus-4-1-20250805', display_name: 'Claude Opus 4.1', created_at: '' },
  { id: 'claude-sonnet-4-5-20250929', display_name: 'Claude Sonnet 4.5', created_at: '' },
  { id: 'claude-3-5-haiku-latest', display_name: 'Claude Haiku 3.5', created_at: '' },
];

export function SettingsTab() {
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Secret fields editing state
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  // AI provider state
  const [provider, setProvider] = useState<AIProvider>('anthropic');
  const [providerDirty, setProviderDirty] = useState(false);
  const [providerSaving, setProviderSaving] = useState(false);

  // WordPress state
  const [wpEnabled, setWpEnabled] = useState(false);
  const [wpUrl, setWpUrl] = useState('');
  const [wpUser, setWpUser] = useState('');
  const [wpPass, setWpPass] = useState('');
  const [wpPassVisible, setWpPassVisible] = useState(false);
  const [wpDirty, setWpDirty] = useState(false);
  const [wpSaving, setWpSaving] = useState(false);
  const [wpTesting, setWpTesting] = useState(false);

  // Claude model state
  const [model, setModel] = useState('');
  const [models, setModels] = useState<ClaudeModelInfo[]>([]);
  const [modelDirty, setModelDirty] = useState(false);
  const [modelSaving, setModelSaving] = useState(false);
  const [modelSearching, setModelSearching] = useState(false);

  const load = async () => {
    try {
      const data = await adminGetSettings();
      setSettings(data);
      const p = data.find((s) => s.key === 'AI_PROVIDER')?.value;
      if (p && PROVIDERS.some((x) => x.id === p)) {
        setProvider(p as AIProvider);
        setProviderDirty(false);
      }
      const m = data.find((s) => s.key === 'CLAUDE_MODEL')?.value;
      if (m) { setModel(m); setModelDirty(false); }
      setWpEnabled(data.find((s) => s.key === 'WORDPRESS_ENABLED')?.value === 'true');
      setWpUrl(data.find((s) => s.key === 'WORDPRESS_URL')?.value || '');
      setWpUser(data.find((s) => s.key === 'WORDPRESS_USERNAME')?.value || '');
      setWpPass('');
      setWpDirty(false);
    } catch {
      setError('Erreur chargement des settings');
    } finally {
      setLoading(false);
    }
  };

  // Charge la liste live des modèles Anthropic (silencieux si la clé n'est pas configurée)
  const loadModels = async () => {
    try {
      const list = await adminGetModels();
      setModels(list);
      // si aucun modèle enregistré, propose le plus récent par défaut dans le menu
      setModel((cur) => cur || (list[0]?.id ?? FALLBACK_CLAUDE_MODELS[0].id));
    } catch {
      /* clé API absente ou erreur réseau — on bascule sur la liste de secours */
      setModel((cur) => cur || FALLBACK_CLAUDE_MODELS[0].id);
    }
  };

  // Options du sélecteur : liste live si disponible, sinon liste de secours.
  const modelOptions: ClaudeModelInfo[] = models.length > 0 ? models : [...FALLBACK_CLAUDE_MODELS];

  useEffect(() => { load().then(loadModels); }, []);

  const handleSaveModel = async (value?: string) => {
    const v = (value ?? model).trim();
    if (!v) { toast.error('Choisis un modèle'); return; }
    setModelSaving(true);
    try {
      const { failures } = await adminUpdateSettings([{ key: 'CLAUDE_MODEL', value: v }]);
      if (failures.length > 0) {
        toast.error(`Erreur : ${failures[0].reason}`);
      } else {
        toast.success(`Modèle de correction : ${v}`);
        setModel(v);
        setModelDirty(false);
        await load();
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || err?.response?.data?.error || 'Erreur enregistrement modèle');
    } finally {
      setModelSaving(false);
    }
  };

  const handleSearchLatest = async () => {
    setModelSearching(true);
    try {
      const latest = await adminGetLatestModel();
      // rafraîchit aussi la liste complète au passage
      await loadModels();
      const created = latest.created_at ? new Date(latest.created_at).toLocaleDateString('fr-FR') : '';
      toast.success(`Dernier modèle : ${latest.display_name}${created ? ` (${created})` : ''}`);
      await handleSaveModel(latest.id);
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || err?.response?.data?.error || 'Détection impossible (clé API Anthropic configurée ?)');
    } finally {
      setModelSearching(false);
    }
  };

  const getSettingValue = (key: string): string => {
    return settings.find((s) => s.key === key)?.value || '';
  };

  const isEditing = (key: string): boolean => key in editing;
  const startEditing = (key: string) => setEditing((p) => ({ ...p, [key]: '' }));
  const cancelEditing = (key: string) =>
    setEditing((p) => {
      const next = { ...p };
      delete next[key];
      return next;
    });
  const toggleVisibility = (key: string) => setVisible((p) => ({ ...p, [key]: !p[key] }));

  const handleSaveSecretSection = async (section: SettingSection) => {
    const sectionKeys = section.fields.map((f) => f.key);
    const toUpdate = sectionKeys
      .filter((key) => key in editing && editing[key].trim() !== '')
      .map((key) => ({ key, value: editing[key] }));

    if (toUpdate.length === 0) {
      toast.error('Aucune modification a enregistrer');
      return;
    }

    setSaving((p) => ({ ...p, [section.title]: true }));
    try {
      const { updated, failures } = await adminUpdateSettings(toUpdate);
      if (failures.length > 0) {
        const first = failures[0];
        toast.error(`Erreur sur ${first.key} : ${first.reason}`);
      }
      if (updated.length > 0) {
        toast.success(`${updated.length} parametre(s) mis a jour`);
      }
      setEditing((p) => {
        const next = { ...p };
        for (const k of updated.map((u) => u.key)) delete next[k];
        return next;
      });
      await load();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.error || err?.message || 'Erreur inconnue';
      toast.error(`Erreur mise a jour : ${msg}`);
    } finally {
      setSaving((p) => ({ ...p, [section.title]: false }));
    }
  };

  const handleSaveProvider = async () => {
    setProviderSaving(true);
    try {
      const { failures } = await adminUpdateSettings([{ key: 'AI_PROVIDER', value: provider }]);
      if (failures.length > 0) {
        toast.error(`Erreur : ${failures[0].reason}`);
      } else {
        const label = PROVIDERS.find((p) => p.id === provider)?.label ?? provider;
        toast.success(`Moteur IA : ${label}`);
        setProviderDirty(false);
      }
      await load();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.error || err?.message || 'Erreur inconnue';
      toast.error(`Erreur moteur IA : ${msg}`);
    } finally {
      setProviderSaving(false);
    }
  };

  const handleSaveWordpress = async () => {
    setWpSaving(true);
    try {
      const updates: { key: string; value: string }[] = [
        { key: 'WORDPRESS_ENABLED', value: wpEnabled ? 'true' : 'false' },
        { key: 'WORDPRESS_URL', value: wpUrl.trim() },
        { key: 'WORDPRESS_USERNAME', value: wpUser.trim() },
      ];
      if (wpPass.trim() !== '') {
        updates.push({ key: 'WORDPRESS_APP_PASSWORD', value: wpPass.trim() });
      }
      const { failures } = await adminUpdateSettings(updates);
      if (failures.length > 0) {
        toast.error(`Erreur sur ${failures[0].key} : ${failures[0].reason}`);
      } else {
        toast.success('Configuration WordPress enregistree');
      }
      await load();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.response?.data?.error || err?.message || 'Erreur inconnue';
      toast.error(`Erreur WordPress : ${msg}`);
    } finally {
      setWpSaving(false);
    }
  };

  const handleTestWordpress = async () => {
    setWpTesting(true);
    try {
      const result = await adminTestWordpress();
      if (result.ok) {
        toast.success(`Connexion WordPress OK — connecte en tant que ${result.name}`);
      } else {
        toast.error(`Connexion WordPress echouee : ${result.error}`);
      }
    } finally {
      setWpTesting(false);
    }
  };

  const sectionHasEdits = (section: SettingSection): boolean =>
    section.fields.some((f) => f.key in editing && editing[f.key].trim() !== '');

  if (loading) {
    return <div className="text-center py-8 text-gray-400">Chargement...</div>;
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-rs-black mb-4">Parametres et cles API</h2>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* AI Engine selector */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-gray-50">
          <Sparkles size={18} className="text-rs-red" />
          <h3 className="font-semibold text-rs-black">Moteur IA pour la correction</h3>
        </div>
        <div className="px-5 py-4 space-y-4">
          <p className="text-xs text-gray-500">
            Choisis le fournisseur d'IA utilise pour corriger les textes. La cle API correspondante doit etre configuree ci-dessous.
          </p>

          {/* Segmented toggle — 3 positions */}
          <div
            role="radiogroup"
            aria-label="Moteur IA"
            className="relative inline-flex w-full max-w-xl p-1 rounded-full bg-gray-100 border border-gray-200"
          >
            {/* Sliding indicator */}
            <span
              aria-hidden
              className="absolute top-1 bottom-1 rounded-full bg-rs-red shadow-sm transition-transform duration-200 ease-out"
              style={{
                width: `calc(${100 / PROVIDERS.length}% - ${8 / PROVIDERS.length}px)`,
                transform: `translateX(${PROVIDERS.findIndex((p) => p.id === provider) * 100}%)`,
              }}
            />

            {PROVIDERS.map((p) => {
              const isActive = provider === p.id;
              const keyConfigured = p.keyName ? !!getSettingValue(p.keyName) : true;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  onClick={() => {
                    setProvider(p.id);
                    setProviderDirty(true);
                  }}
                  className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-full transition-colors whitespace-nowrap ${
                    isActive ? 'text-white' : 'text-gray-600 hover:text-rs-black'
                  }`}
                >
                  {p.label}
                  {!keyConfigured && (
                    <span
                      title={`Cle ${p.label} manquante`}
                      className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : 'bg-red-500'}`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Selection details */}
          <div className="space-y-2">
            <div className="text-xs text-gray-500 flex items-center gap-2">
              <span>Modele :</span>
              <code className="font-mono text-rs-black bg-gray-50 px-2 py-0.5 rounded">
                {provider === 'anthropic'
                  ? (getSettingValue('CLAUDE_MODEL') || model || DEFAULT_CLAUDE_MODEL)
                  : (PROVIDERS.find((p) => p.id === provider)?.model ?? '—')}
              </code>
            </div>
            {PROVIDERS.find((p) => p.id === provider)?.localOnly && (
              <div className="flex items-start gap-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
                <AlertCircle size={13} className="mt-0.5 shrink-0" />
                <span>
                  <strong>Mode local uniquement.</strong> Utilise le CLI <code className="font-mono">claude</code>{' '}
                  installe sur la machine du serveur (ton abonnement Claude). Ne fonctionne pas en production sur Railway.
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button
            onClick={handleSaveProvider}
            disabled={!providerDirty || providerSaving}
            className="flex items-center gap-1.5 bg-rs-red hover:bg-rs-red-dark text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {providerSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Appliquer
          </button>
        </div>
      </div>

      {/* Modèle Claude pour la correction */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-gray-50">
          <Cpu size={18} className="text-rs-red" />
          <h3 className="font-semibold text-rs-black">Modèle Claude (correction)</h3>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-xs text-gray-500">
            Modèle Anthropic utilisé pour la correction quand le moteur « Anthropic » est actif. La liste est
            récupérée en direct depuis l'API Anthropic — les modèles futurs apparaissent automatiquement. Si la clé
            n'est pas encore configurée, une liste de secours est proposée.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <select
              value={model}
              onChange={(e) => { setModel(e.target.value); setModelDirty(true); }}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-rs-red focus:border-transparent"
            >
              {modelOptions.map((m) => (
                <option key={m.id} value={m.id}>{m.display_name} — {m.id}</option>
              ))}
              {model && !modelOptions.some((m) => m.id === model) && (
                <option value={model}>{model} (actuel)</option>
              )}
            </select>
            <button
              type="button"
              onClick={handleSearchLatest}
              disabled={modelSearching || modelSaving}
              className="flex items-center justify-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg border border-rs-red text-rs-red hover:bg-rs-red/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {modelSearching ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              Rechercher la version la plus récente
            </button>
          </div>
          <div className="text-xs text-gray-500 flex items-center gap-2">
            <span>Actif :</span>
            <code className="font-mono text-rs-black bg-gray-50 px-2 py-0.5 rounded">
              {getSettingValue('CLAUDE_MODEL') || `défaut (${DEFAULT_CLAUDE_MODEL})`}
            </code>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button
            onClick={() => handleSaveModel()}
            disabled={!modelDirty || modelSaving || modelSearching}
            className="flex items-center gap-1.5 bg-rs-red hover:bg-rs-red-dark text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {modelSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Enregistrer le modèle
          </button>
        </div>
      </div>

      {/* WordPress */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-3">
            <Globe size={18} className="text-rs-red" />
            <h3 className="font-semibold text-rs-black">WordPress (rollingstone.fr)</h3>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className={`text-xs font-medium ${wpEnabled ? 'text-green-700' : 'text-gray-400'}`}>
              {wpEnabled ? 'Active' : 'Desactive'}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={wpEnabled}
              onClick={() => { setWpEnabled((v) => !v); setWpDirty(true); }}
              className={`relative w-10 h-6 rounded-full transition-colors ${wpEnabled ? 'bg-green-600' : 'bg-gray-300'}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${wpEnabled ? 'translate-x-4' : ''}`}
              />
            </button>
          </label>
        </div>
        <div className="px-5 py-4 space-y-4">
          <p className="text-xs text-gray-500">
            Quand le module est actif, chaque papier livre est aussi envoye sur WordPress en <strong>brouillon</strong>{' '}
            avec la mention <code className="font-mono bg-gray-50 px-1 rounded">[EN ATTENTE DE RELECTURE]</code> dans le titre :
            mise en forme editoriale (chapo H3, intertitres H4, citations), categories + sous-categories, tags et image a la une.
            L'authentification utilise un <strong>mot de passe application</strong> WordPress (profil utilisateur → Mots de passe d'application).
          </p>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-rs-black mb-1">URL du site</label>
              <input
                type="url"
                value={wpUrl}
                onChange={(e) => { setWpUrl(e.target.value); setWpDirty(true); }}
                placeholder="https://www.rollingstone.fr"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-rs-red focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-rs-black mb-1">Nom d'utilisateur WP</label>
              <input
                type="text"
                value={wpUser}
                onChange={(e) => { setWpUser(e.target.value); setWpDirty(true); }}
                placeholder="redaction"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-rs-red focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-rs-black mb-1">Mot de passe application</label>
              <div className="relative">
                <input
                  type={wpPassVisible ? 'text' : 'password'}
                  value={wpPass}
                  onChange={(e) => { setWpPass(e.target.value); setWpDirty(true); }}
                  placeholder={getSettingValue('WORDPRESS_APP_PASSWORD') ? 'Configure — saisir pour remplacer' : 'xxxx xxxx xxxx xxxx xxxx xxxx'}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-rs-red focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setWpPassVisible((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {wpPassVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
          <button
            onClick={handleTestWordpress}
            disabled={wpTesting}
            className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg border border-rs-red text-rs-red hover:bg-rs-red/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {wpTesting ? <Loader2 size={16} className="animate-spin" /> : <PlugZap size={16} />}
            Tester la connexion
          </button>
          <button
            onClick={handleSaveWordpress}
            disabled={!wpDirty || wpSaving}
            className="flex items-center gap-1.5 bg-rs-red hover:bg-rs-red-dark text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {wpSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Enregistrer
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {SECRET_SECTIONS.map((section) => (
          <div key={section.title} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-gray-50">
              {section.icon}
              <h3 className="font-semibold text-rs-black">{section.title}</h3>
            </div>

            <div className="divide-y divide-gray-100">
              {section.fields.map((field) => {
                const maskedValue = getSettingValue(field.key);
                const isFieldEditing = isEditing(field.key);
                const isVisible = visible[field.key] || false;

                return (
                  <div key={field.key} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <label className="block text-sm font-medium text-rs-black mb-0.5">
                          {field.label}
                        </label>
                        <p className="text-xs text-gray-500 mb-3">{field.description}</p>

                        {isFieldEditing ? (
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <input
                                type={isVisible ? 'text' : 'password'}
                                value={editing[field.key]}
                                onChange={(e) =>
                                  setEditing((prev) => ({ ...prev, [field.key]: e.target.value }))
                                }
                                placeholder="Entrer la nouvelle valeur..."
                                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-rs-red focus:border-transparent"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => toggleVisibility(field.key)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              >
                                {isVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                              </button>
                            </div>
                            <button
                              onClick={() => cancelEditing(field.key)}
                              className="text-xs text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                            >
                              Annuler
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <code className="flex-1 px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-600 font-mono truncate">
                              {maskedValue || <span className="text-gray-300 italic">Non configure</span>}
                            </code>
                            <button
                              onClick={() => startEditing(field.key)}
                              className="text-xs text-rs-red hover:underline font-medium px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                            >
                              Modifier
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button
                onClick={() => handleSaveSecretSection(section)}
                disabled={!sectionHasEdits(section) || saving[section.title]}
                className="flex items-center gap-1.5 bg-rs-red hover:bg-rs-red-dark text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saving[section.title] ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Enregistrer
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
