import { useEffect, useState, useCallback, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore.ts';
import { useDropzone } from 'react-dropzone';
import {
  getActivePaperTypes,
  getNextHebdo,
  prepareHebdo,
  correctText,
  submitDelivery,
  getDelivery,
  updateDelivery,
  adminGetDelivery,
  adminUpdateDelivery,
  adminGetJournalists,
} from '../services/api.ts';
import type { PaperType, HebdoConfig, CorrectionResult, Delivery, FieldConfig, Profile } from '../types/index.ts';
import { isAdminRole } from '../types/index.ts';
import {
  ChevronRight,
  ChevronLeft,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
  Sparkles,
  X,
  Send,
  Star,
  Calendar,
  Plus,
  Check,
  Upload,
  Home,
  Eye,
  UserRound,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

/** Cle du champ chapo (texte affiche sur le site), relu avec le corps du texte. */
const CHAPO_KEY = 'chapo';

type Step = 'type' | 'content' | 'correction' | 'review';

const STEPS: { key: Step; label: string }[] = [
  { key: 'type', label: 'Type de papier' },
  { key: 'content', label: 'Rédaction' },
  { key: 'correction', label: 'Relecture' },
  { key: 'review', label: 'Vérification & envoi' },
];

export function DeliveryFormPage() {
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();
  const isAdminEdit = searchParams.get('admin') === 'true';
  const isEditMode = !!editId;

  // Data
  const [paperTypes, setPaperTypes] = useState<PaperType[]>([]);
  const [nextHebdo, setNextHebdo] = useState<HebdoConfig | null>(null);
  const [hebdoConfirmed, setHebdoConfirmed] = useState(false);
  const [preparingFolders, setPreparingFolders] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editDelivery, setEditDelivery] = useState<Delivery | null>(null);

  // Livraison au nom d'un journaliste (admin uniquement) : l'admin choisit
  // pour qui il livre avant de selectionner le type de papier.
  const currentUser = useAuthStore((s) => s.user);
  const isAdmin = isAdminRole(currentUser?.role);
  const [journalists, setJournalists] = useState<Profile[]>([]);
  const [authorId, setAuthorId] = useState('');

  // Form
  const [step, setStep] = useState<Step>('type');
  const [selectedType, setSelectedType] = useState<PaperType | null>(null);
  const [metadata, setMetadata] = useState<Record<string, any>>({});

  // Multiple images
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  // Correction
  const [correcting, setCorrecting] = useState(false);
  const [correction, setCorrection] = useState<CorrectionResult | null>(null);
  const [bodyCorrected, setBodyCorrected] = useState('');

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [driveUrl, setDriveUrl] = useState('');

  // Validation
  const [showValidation, setShowValidation] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [pt, hebdo] = await Promise.all([getActivePaperTypes(), getNextHebdo()]);
        setPaperTypes(pt);
        setNextHebdo(hebdo);

        // Admin : liste des journalistes actifs pour choisir l'auteur du papier.
        if (isAdminRole(useAuthStore.getState().user?.role)) {
          try {
            const people = await adminGetJournalists();
            setJournalists(people.filter((p: Profile) => p.is_active));
          } catch {
            setJournalists([]);
          }
        }

        if (editId) {
          const delivery = isAdminEdit ? await adminGetDelivery(editId) : await getDelivery(editId);
          setEditDelivery(delivery);

          const paperType =
            pt.find((p) => p.id === delivery.paper_type_id) ||
            (delivery.paper_type as unknown as PaperType);
          if (paperType) setSelectedType(paperType);

          if (delivery.hebdo) {
            setNextHebdo({
              id: delivery.hebdo_id,
              numero: delivery.hebdo.numero,
              label: delivery.hebdo.label,
              start_date: null,
              end_date: null,
              is_current: true,
              created_at: '',
            });
          }

          setMetadata(delivery.metadata || {});
          if (delivery.body_corrected) setBodyCorrected(delivery.body_corrected);

          setHebdoConfirmed(true);
          setStep('content');
        }
      } catch (err) {
        console.error('Load error:', err);
        if (editId) {
          toast.error('Impossible de charger la livraison');
          navigate('/');
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [editId]);

  const handleConfirmHebdo = async () => {
    if (!nextHebdo) return;
    setPreparingFolders(true);
    try {
      await prepareHebdo(nextHebdo.id);
      setHebdoConfirmed(true);
    } catch (err) {
      console.error('Prepare hebdo error:', err);
      toast.error('Erreur préparation des dossiers Dropbox');
    } finally {
      setPreparingFolders(false);
    }
  };

  // Nombre maximum de photos accepte par le format (champ images, cle "max").
  const maxImages = selectedType?.fields_config?.find((f) => f.type === 'images')?.max;

  const onDrop = useCallback((accepted: File[], rejected: any[]) => {
    if (rejected.length > 0) {
      rejected.forEach((r: any) => {
        const errors = r.errors?.map((e: any) => e.message).join(', ') || 'Fichier refusé';
        toast.error(`${r.file?.name}: ${errors}`);
      });
    }
    if (accepted.length === 0) return;

    setImageFiles((prev) => {
      const room = maxImages ? Math.max(0, maxImages - prev.length) : accepted.length;
      const kept = accepted.slice(0, room);
      if (kept.length < accepted.length) {
        toast.error(
          maxImages === 1
            ? 'Ce format accepte une seule photo'
            : `Ce format accepte ${maxImages} photos maximum`,
        );
      }
      kept.forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => setImagePreviews((p) => [...p, reader.result as string]);
        reader.readAsDataURL(file);
      });
      return [...prev, ...kept];
    });
  }, [maxImages]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': [
        '.jpg', '.jpeg', '.png', '.webp', '.gif',
        '.heic', '.heif', '.tiff', '.tif', '.bmp', '.avif',
      ],
    },
    maxFiles: 20,
    maxSize: 25 * 1024 * 1024,
  });

  const removeImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const updateMetadata = (key: string, value: any) => {
    setMetadata((prev) => ({ ...prev, [key]: value }));
  };

  const getBodyFieldKey = () => {
    if (!selectedType?.fields_config) return null;
    return selectedType.fields_config.find((f) => f.key === 'corps') ? 'corps' : null;
  };

  const bodyFieldKey = getBodyFieldKey();
  const bodyText = bodyCorrected || (bodyFieldKey ? metadata[bodyFieldKey] || '' : '');
  const signCount = bodyText.length;
  const signLimit = selectedType?.sign_limit || 0;
  const signOverLimit = signLimit > 0 && signCount > signLimit;
  const signRatio = signLimit > 0 ? Math.min(1, signCount / signLimit) : 0;

  const hasChapo = !!selectedType?.fields_config?.some((f) => f.key === CHAPO_KEY);

  const handleCorrection = async () => {
    const k = getBodyFieldKey();
    if (!k || !metadata[k]?.trim()) return;
    const chapo = hasChapo ? String(metadata[CHAPO_KEY] || '').trim() : '';

    setCorrecting(true);
    try {
      // Le chapo (affiche sur le site) est relu en meme temps que le corps.
      // Un echec sur le chapo seul ne bloque pas : il reste tel que saisi.
      const [result, chapoResult] = await Promise.all([
        correctText(metadata[k]),
        chapo ? correctText(chapo).catch(() => null) : Promise.resolve(null),
      ]);
      setCorrection(
        chapoResult
          ? {
              ...result,
              corrections: [
                ...chapoResult.corrections.map((c) => ({ ...c, type: `chapô · ${c.type}` })),
                ...result.corrections,
              ],
            }
          : result,
      );
      if (chapoResult) updateMetadata(CHAPO_KEY, chapoResult.correctedText);
      setBodyCorrected(result.correctedText);
      setStep('correction');
    } catch (err) {
      console.error('Correction error:', err);
      toast.error('Correction automatique indisponible — texte original conservé');
      setBodyCorrected(metadata[k]);
      setStep('correction');
    } finally {
      setCorrecting(false);
    }
  };

  const getTitle = () => {
    if (!selectedType) return '';
    if (selectedType.name === 'Sujet de couv' || selectedType.name === 'Interview 3000')
      return metadata.artiste || '';
    if (selectedType.name === 'Disque de la semaine')
      return metadata.album || metadata.artiste || '';
    if (selectedType.name === 'Chroniques') return metadata.artiste || '';
    const firstTextField = selectedType.fields_config.find((f) => f.type === 'text');
    return firstTextField ? metadata[firstTextField.key] || '' : '';
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedType || !nextHebdo) return;

    setSubmitting(true);
    setSubmitError('');

    const formData = new FormData();
    formData.append('paper_type_id', selectedType.id);
    formData.append('hebdo_id', nextHebdo.id);

    const finalMetadata = { ...metadata };
    if (bodyCorrected && bodyFieldKey) finalMetadata[bodyFieldKey] = bodyCorrected;
    formData.append('metadata', JSON.stringify(finalMetadata));

    const title = getTitle();
    formData.append('title', title);
    if (isAdmin && authorId && authorId !== currentUser?.id) {
      formData.append('author_id', authorId);
    }
    imageFiles.forEach((file) => formData.append('images', file));

    try {
      if (isAdminEdit && editId) {
        const finalMeta = { ...metadata };
        if (bodyCorrected && bodyFieldKey) finalMeta[bodyFieldKey] = bodyCorrected;
        await adminUpdateDelivery(editId, finalMeta, getTitle());
        setSubmitSuccess(true);
      } else if (isEditMode && editId) {
        const result = await updateDelivery(editId, formData);
        setDriveUrl(result.drive.folderUrl);
        setSubmitSuccess(true);
      } else {
        const result = await submitDelivery(formData);
        setDriveUrl(result.drive.folderUrl);
        setSubmitSuccess(true);
      }
    } catch (err: unknown) {
      console.error('Submit error:', err);
      const msg = err instanceof Error ? err.message : 'Erreur lors de la modification';
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const urlProblem = (field: FieldConfig) => urlFieldProblem(field, metadata[field.key]);

  const getMissingFields = (): string[] => {
    if (!selectedType?.fields_config) return [];
    const missing: string[] = [];

    for (const field of selectedType.fields_config) {
      if (!field.required) continue;

      if (field.alternateKey) {
        const altField = selectedType.fields_config.find((f) => f.key === field.alternateKey);
        const hasAlt = altField?.type === 'images'
          ? imageFiles.length > 0 || (isEditMode && !!editDelivery?.image_filename)
          : !!metadata[field.alternateKey]?.trim();
        const hasCurrent = field.type === 'images'
          ? imageFiles.length >= (field.min || 1) || (isEditMode && !!editDelivery?.image_filename)
          : !!metadata[field.key]?.trim();
        if (hasCurrent || hasAlt) continue;
        missing.push(`${field.label} ou ${altField?.label || field.alternateKey}`);
        continue;
      }

      if (field.type === 'images') {
        const minImages = field.min || 1;
        const hasExistingImages = isEditMode && editDelivery?.image_filename;
        if (imageFiles.length < minImages && !hasExistingImages) {
          missing.push(`${field.label} (${minImages} minimum)`);
        }
      } else if (field.type === 'stars') {
        const rating = parseFloat(metadata[field.key]);
        if (!rating || rating < 0.5) missing.push(field.label);
      } else {
        if (!metadata[field.key]?.trim()) missing.push(field.label);
      }
    }
    for (const field of selectedType.fields_config) {
      const problem = urlProblem(field);
      if (problem) missing.push(`${field.label} (${problem.toLowerCase()})`);
    }

    return missing;
  };

  const isFieldMissing = (field: FieldConfig) => {
    if (!showValidation) return false;
    if (field.type === 'url' && urlProblem(field)) return true;
    if (!field.required) return false;

    if (field.alternateKey && selectedType) {
      const altField = selectedType.fields_config.find((f) => f.key === field.alternateKey);
      const hasAlt = altField?.type === 'images'
        ? imageFiles.length > 0 || (isEditMode && !!editDelivery?.image_filename)
        : !!metadata[field.alternateKey]?.trim();
      const hasCurrent = field.type === 'images'
        ? imageFiles.length >= (field.min || 1) || (isEditMode && !!editDelivery?.image_filename)
        : !!metadata[field.key]?.trim();
      return !hasCurrent && !hasAlt;
    }

    if (field.type === 'images') {
      const hasExistingImages = isEditMode && editDelivery?.image_filename;
      return imageFiles.length < (field.min || 1) && !hasExistingImages;
    }
    if (field.type === 'stars') {
      const r = parseFloat(metadata[field.key]);
      return !r || r < 0.5;
    }
    return !metadata[field.key]?.trim();
  };

  const handleCorrectionClick = () => {
    const missing = getMissingFields();
    if (missing.length > 0) {
      setShowValidation(true);
      toast.error(`Champs manquants : ${missing.join(', ')}`);
      return;
    }
    handleCorrection();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className="animate-spin rounded-full h-8 w-8 border-2"
          style={{ borderColor: 'var(--rs-red)', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  // Remise a zero pour enchainer un papier : on est deja sur /livrer, une
  // navigation vers la meme route ne remonte pas le composant — il faut donc
  // vider l'etat a la main (le bouton restait sans effet).
  const handleDeliverAnother = () => {
    setStep('type');
    setSelectedType(null);
    setMetadata({});
    setImageFiles([]);
    setImagePreviews([]);
    setCorrection(null);
    setCorrecting(false);
    setBodyCorrected('');
    setSubmitting(false);
    setSubmitError('');
    setSubmitSuccess(false);
    setDriveUrl('');
    setShowValidation(false);
    setAuthorId('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Success screen
  if (submitSuccess) {
    return (
      <SuccessScreen
        title={getTitle()}
        driveUrl={driveUrl}
        isEditMode={isEditMode}
        // En edition, le formulaire est lie a un papier precis : on renvoie
        // vers une nouvelle livraison plutot que de vider le formulaire.
        onDeliverAnother={isEditMode ? () => navigate('/livrer') : handleDeliverAnother}
      />
    );
  }

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div>
      {/* Header (eyebrow + step title + stepper) */}
      <div
        style={{
          padding: '4px 0 18px',
          marginBottom: 24,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <div className="eyebrow">
              {isEditMode ? 'Modifier un papier' : 'Livrer un papier'}
            </div>
            <div
              className="serif"
              style={{ fontSize: 26, lineHeight: 1.1, marginTop: 2 }}
            >
              {STEPS[stepIndex].label}
            </div>
          </div>
          {nextHebdo && (
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              {nextHebdo.label}
              {nextHebdo.start_date && nextHebdo.end_date && (
                <>
                  {' · du '}
                  {format(new Date(nextHebdo.start_date + 'T00:00:00'), 'd', { locale: fr })}
                  {' au '}
                  {format(new Date(nextHebdo.end_date + 'T00:00:00'), 'd MMMM yyyy', {
                    locale: fr,
                  })}
                </>
              )}
            </div>
          )}
        </div>
        <div className="rs-stepper-h">
          {STEPS.map((s, i) => (
            <div key={s.key} className="contents">
              <div
                className={`seg ${i < stepIndex ? 'done' : ''} ${
                  i === stepIndex ? 'active' : ''
                }`}
              >
                <span className="num">
                  {i < stepIndex ? <Check size={13} /> : i + 1}
                </span>
                <span className="lbl hidden sm:inline">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`bar ${i < stepIndex ? 'done' : ''}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Two-column layout: main + helper */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div>
          {step === 'type' && (
            <StepTypeView
              nextHebdo={nextHebdo}
              hebdoConfirmed={hebdoConfirmed}
              preparingFolders={preparingFolders}
              onConfirm={handleConfirmHebdo}
              paperTypes={paperTypes}
              selectedType={selectedType}
              journalists={isAdmin && !isEditMode ? journalists : []}
              authorId={authorId}
              onSelectAuthor={setAuthorId}
              onSelectType={(pt) => {
                setSelectedType(pt);
                setMetadata({});
                setImageFiles([]);
                setImagePreviews([]);
                setBodyCorrected('');
                setStep('content');
              }}
            />
          )}

          {step === 'content' && selectedType && (
            <StepContentView
              selectedType={selectedType}
              metadata={metadata}
              updateMetadata={updateMetadata}
              isFieldMissing={isFieldMissing}
              imagePreviews={imagePreviews}
              imageFiles={imageFiles}
              removeImage={removeImage}
              getRootProps={getRootProps}
              getInputProps={getInputProps}
              isDragActive={isDragActive}
              isEditMode={isEditMode}
              editDelivery={editDelivery}
              signCount={signCount}
              signLimit={signLimit}
              signOverLimit={signOverLimit}
            />
          )}

          {step === 'correction' && selectedType && (
            <StepCorrectionView
              correction={correction}
              bodyCorrected={bodyCorrected}
              onChangeBody={setBodyCorrected}
              chapo={hasChapo ? String(metadata[CHAPO_KEY] || '') : null}
              onChangeChapo={(v) => updateMetadata(CHAPO_KEY, v)}
              signLimit={signLimit}
              signOverLimit={signOverLimit}
            />
          )}

          {step === 'review' && selectedType && (
            <StepReviewView
              selectedType={selectedType}
              nextHebdo={nextHebdo}
              metadata={metadata}
              bodyCorrected={bodyCorrected}
              imagePreviews={imagePreviews}
              imageFiles={imageFiles}
              signCount={signCount}
              signLimit={signLimit}
              signOverLimit={signOverLimit}
            />
          )}

          {/* Footer actions */}
          <div
            className="flex items-center justify-between flex-wrap gap-3"
            style={{
              borderTop: '1px solid var(--border)',
              paddingTop: 18,
              marginTop: 24,
            }}
          >
            {step === 'type' ? (
              <Link to="/" className="rs-btn ghost">
                <X size={16} />
                Annuler
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (step === 'content') setStep('type');
                  else if (step === 'correction') setStep('content');
                  else if (step === 'review') setStep('correction');
                }}
                className="rs-btn ghost"
              >
                <ChevronLeft size={16} />
                {step === 'content' && 'Type de papier'}
                {step === 'correction' && 'Modifier le texte'}
                {step === 'review' && 'Corriger encore'}
              </button>
            )}

            {step === 'content' && (
              <button
                type="button"
                onClick={handleCorrectionClick}
                disabled={correcting}
                className="rs-btn primary lg"
              >
                {correcting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Correction en cours…
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Relire et corriger le texte
                  </>
                )}
              </button>
            )}

            {step === 'correction' && (
              <button
                type="button"
                onClick={() => setStep('review')}
                className="rs-btn primary lg"
              >
                Tout valider et vérifier
                <ChevronRight size={16} />
              </button>
            )}

            {step === 'review' && (
              <button
                type="button"
                onClick={handleSubmit as unknown as () => void}
                disabled={submitting}
                className="rs-btn primary lg"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Envoi en cours…
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    {isEditMode ? 'Enregistrer les modifications' : 'Livrer le papier'}
                  </>
                )}
              </button>
            )}
          </div>

          {submitError && (
            <div className="rs-banner red mt-4 flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{submitError}</span>
            </div>
          )}
        </div>

        {/* Helper sidebar */}
        <aside className="lg:sticky lg:top-24">
          <HelperPanel
            step={step}
            selectedType={selectedType}
            nextHebdo={nextHebdo}
            hebdoConfirmed={hebdoConfirmed}
            signCount={signCount}
            signLimit={signLimit}
            signRatio={signRatio}
            signOverLimit={signOverLimit}
            correction={correction}
          />
        </aside>
      </div>
    </div>
  );
}

/* ============================================================
   Step 1: Type de papier
   ============================================================ */

interface StepTypeViewProps {
  nextHebdo: HebdoConfig | null;
  hebdoConfirmed: boolean;
  preparingFolders: boolean;
  onConfirm: () => void;
  paperTypes: PaperType[];
  selectedType: PaperType | null;
  onSelectType: (pt: PaperType) => void;
  /** Non vide uniquement pour un admin qui livre : il choisit l'auteur du papier. */
  journalists: Profile[];
  authorId: string;
  onSelectAuthor: (id: string) => void;
}

const YOUTUBE_URL_RE = /^(https?:\/\/)?(www\.|m\.|music\.)?(youtube\.com|youtu\.be)\//i;

/** Même règle que le serveur (services/fieldValidation.ts) : clip YouTube, ou site hors YouTube. */
function urlFieldProblem(field: FieldConfig, value: string | undefined): string | null {
  const v = (value || '').trim();
  if (!v || field.type !== 'url') return null;
  if (!/^https?:\/\/[^\s]+\.[^\s]+$/i.test(v)) return 'Adresse complète attendue (https://…)';
  if (field.validation === 'youtube' && !YOUTUBE_URL_RE.test(v)) return 'Lien YouTube attendu (youtube.com ou youtu.be)';
  if (field.validation === 'website' && YOUTUBE_URL_RE.test(v)) return 'Un site est attendu ici (Bandcamp, site officiel), pas un lien YouTube';
  return null;
}

function StepTypeView({
  nextHebdo,
  hebdoConfirmed,
  preparingFolders,
  onConfirm,
  paperTypes,
  selectedType,
  onSelectType,
  journalists,
  authorId,
  onSelectAuthor,
}: StepTypeViewProps) {
  // Admin : le journaliste doit etre choisi avant le type de papier.
  const needsAuthor = journalists.length > 0;
  const authorReady = !needsAuthor || !!authorId;
  return (
    <div className="space-y-4">
      {/* Hebdo confirmation */}
      <div className="rs-card" style={{ padding: '24px 28px' }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          Numéro en cours
        </div>
        <h2
          className="serif"
          style={{ fontSize: 22, lineHeight: 1.1, marginBottom: 14 }}
        >
          Vous livrez pour {nextHebdo?.label || 'un numéro à venir'}
        </h2>

        {!nextHebdo ? (
          <div
            className="text-center"
            style={{ padding: '24px 0', color: 'var(--muted)', fontSize: 13 }}
          >
            Aucun numéro programmé. Contactez l'administrateur.
          </div>
        ) : (
          <>
            <div
              className="flex items-center gap-4"
              style={{
                padding: '18px 20px',
                borderRadius: 'var(--r-md)',
                border: '2px solid',
                borderColor: hebdoConfirmed ? 'var(--ok)' : 'var(--rs-red)',
                background: hebdoConfirmed ? 'var(--ok-tint)' : 'var(--rs-red-tint)',
              }}
            >
              <Calendar
                size={28}
                style={{ color: hebdoConfirmed ? 'var(--ok)' : 'var(--rs-red)' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>
                  {nextHebdo.label}
                </div>
                {nextHebdo.start_date && nextHebdo.end_date && (
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>
                    du {format(new Date(nextHebdo.start_date + 'T00:00:00'), 'd', { locale: fr })}{' '}
                    au{' '}
                    {format(new Date(nextHebdo.end_date + 'T00:00:00'), 'd MMMM yyyy', {
                      locale: fr,
                    })}
                  </div>
                )}
              </div>
              {hebdoConfirmed && (
                <CheckCircle size={24} style={{ color: 'var(--ok)', flexShrink: 0 }} />
              )}
            </div>

            {!hebdoConfirmed && (
              <button
                onClick={onConfirm}
                disabled={preparingFolders}
                className="rs-btn primary lg w-full mt-4"
              >
                {preparingFolders ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Préparation des dossiers…
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} />
                    Confirmer ce numéro
                  </>
                )}
              </button>
            )}
          </>
        )}
      </div>

      {/* Paper type selector */}
      {/* Admin : pour qui livre-t-on ? (avant le choix du type de papier) */}
      {hebdoConfirmed && needsAuthor && (
        <div className="rs-card" style={{ padding: '24px 28px' }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            Étape 1 · Admin
          </div>
          <h2
            className="serif"
            style={{ fontSize: 22, lineHeight: 1.1, marginBottom: 4 }}
          >
            Pour quel journaliste livrez-vous ?
          </h2>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
            Le papier sera enregistré à son nom, dans Dropbox comme dans l'historique.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {journalists.map((j) => {
              const active = authorId === j.id;
              return (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => onSelectAuthor(j.id)}
                  className="text-left"
                  style={{
                    padding: '14px 16px',
                    borderRadius: 'var(--r-md)',
                    border: '2px solid',
                    borderColor: active ? 'var(--rs-red)' : 'var(--border)',
                    background: active ? 'var(--rs-red-tint)' : 'var(--surface)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    transition: 'border-color .15s var(--ease), background .15s var(--ease)',
                  }}
                >
                  <UserRound
                    size={20}
                    style={{ color: active ? 'var(--rs-red)' : 'var(--muted)', flexShrink: 0 }}
                  />
                  <span style={{ minWidth: 0 }}>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 15,
                        fontWeight: 600,
                        color: 'var(--ink)',
                      }}
                    >
                      {j.full_name}
                    </span>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 12,
                        color: 'var(--muted)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {j.email}
                    </span>
                  </span>
                  {active && (
                    <CheckCircle size={18} style={{ color: 'var(--rs-red)', marginLeft: 'auto', flexShrink: 0 }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {hebdoConfirmed && authorReady && (
        <div className="rs-card" style={{ padding: '24px 28px' }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            {needsAuthor ? 'Étape 2' : 'Étape 1'}
          </div>
          <h2
            className="serif"
            style={{ fontSize: 22, lineHeight: 1.1, marginBottom: 4 }}
          >
            Quel type de papier livrez-vous ?
          </h2>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
            Choisissez le format. Le formulaire s'adaptera ensuite.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {paperTypes.map((pt) => {
              const isSelected = selectedType?.id === pt.id;
              return (
                <button
                  key={pt.id}
                  onClick={() => onSelectType(pt)}
                  className="text-left"
                  style={{
                    padding: '16px 18px',
                    borderRadius: 'var(--r-lg)',
                    border: isSelected ? '2px solid var(--rs-red)' : '1px solid var(--border-strong)',
                    background: isSelected ? 'var(--rs-red-tint)' : 'var(--surface)',
                    transition: 'all 0.15s var(--ease)',
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--rs-red)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      (e.currentTarget as HTMLElement).style.background = 'var(--surface)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-strong)';
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="serif"
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 'var(--r-md)',
                        background: isSelected ? 'var(--rs-red)' : 'var(--paper-2)',
                        color: isSelected ? 'white' : 'var(--ink)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 18,
                        fontStyle: 'italic',
                        flexShrink: 0,
                      }}
                    >
                      {pt.name[0]}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: 'var(--ink)' }}>
                        {pt.name}
                      </div>
                      <div
                        className="mono"
                        style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}
                      >
                        {pt.sign_limit.toLocaleString('fr-FR')} signes max
                      </div>
                    </div>
                    {isSelected && (
                      <Check size={18} style={{ color: 'var(--rs-red)', flexShrink: 0 }} />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Step 2: Content
   ============================================================ */

interface StepContentViewProps {
  selectedType: PaperType;
  metadata: Record<string, any>;
  updateMetadata: (key: string, value: any) => void;
  isFieldMissing: (field: FieldConfig) => boolean;
  imagePreviews: string[];
  imageFiles: File[];
  removeImage: (index: number) => void;
  getRootProps: () => any;
  getInputProps: () => any;
  isDragActive: boolean;
  isEditMode: boolean;
  editDelivery: Delivery | null;
  signCount: number;
  signLimit: number;
  signOverLimit: boolean;
}

function StepContentView(props: StepContentViewProps) {
  const {
    selectedType,
    metadata,
    updateMetadata,
    isFieldMissing,
    imagePreviews,
    imageFiles,
    removeImage,
    getRootProps,
    getInputProps,
    isDragActive,
    isEditMode,
    editDelivery,
  } = props;

  return (
    <div className="space-y-4">
      <div className="rs-card" style={{ padding: '24px 28px' }}>
        <div className="flex items-end justify-between mb-5 flex-wrap gap-2">
          <div>
            <div className="eyebrow">Format choisi</div>
            <div
              className="serif"
              style={{ fontSize: 22, lineHeight: 1.1, marginTop: 2 }}
            >
              {selectedType.name}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {selectedType.fields_config?.map((field) => {
            const missing = isFieldMissing(field);

            if (field.type === 'images') {
              const isOptionalViaAlternate = !!field.alternateKey;
              return (
                <div key={field.key}>
                  <FieldLabel
                    label={field.label}
                    required={field.required && !isOptionalViaAlternate}
                  />

                  {imagePreviews.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-3">
                      {imagePreviews.map((preview, index) => (
                        <div key={index} style={{ position: 'relative' }}>
                          <img
                            src={preview}
                            alt={`Preview ${index + 1}`}
                            style={{
                              width: '100%',
                              height: 96,
                              objectFit: 'cover',
                              borderRadius: 'var(--r-md)',
                              border: '1px solid var(--border)',
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            style={{
                              position: 'absolute',
                              top: -8,
                              right: -8,
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              background: 'var(--ink)',
                              color: 'var(--paper)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              border: 'none',
                            }}
                            aria-label="Supprimer"
                          >
                            <X size={12} />
                          </button>
                          <div
                            style={{
                              fontSize: 11,
                              marginTop: 6,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {imageFiles[index]?.name}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div
                    {...getRootProps()}
                    style={{
                      border: `2px dashed ${
                        isDragActive
                          ? 'var(--rs-red)'
                          : missing
                            ? 'var(--rs-red)'
                            : 'var(--border-strong)'
                      }`,
                      background: isDragActive
                        ? 'var(--rs-red-tint)'
                        : missing
                          ? 'var(--rs-red-tint)'
                          : 'var(--surface-2)',
                      borderRadius: 'var(--r-lg)',
                      padding: '24px',
                      textAlign: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s var(--ease)',
                    }}
                  >
                    <input {...getInputProps()} />
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        margin: '0 auto 10px',
                        borderRadius: '50%',
                        background: isDragActive ? 'var(--rs-red)' : 'var(--paper-2)',
                        color: isDragActive ? 'white' : 'var(--muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        animation: isDragActive ? 'drop-pulse 1.8s var(--ease) infinite' : 'none',
                      }}
                    >
                      <Upload size={20} />
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {isDragActive
                        ? 'Déposez vos photos ici'
                        : 'Glissez vos photos ici'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                      ou{' '}
                      <span style={{ color: 'var(--rs-red)', textDecoration: 'underline' }}>
                        cliquez pour les choisir
                      </span>{' '}
                      · {field.min ? `${field.min} photos minimum` : 'jusqu\'à 20 fichiers'}
                    </div>
                    {isEditMode && editDelivery?.image_filename && imageFiles.length === 0 && (
                      <div style={{ fontSize: 11, color: 'var(--info)', marginTop: 8 }}>
                        Images existantes : {editDelivery.image_filename}
                      </div>
                    )}
                  </div>
                  {missing && (
                    <div style={{ fontSize: 11, color: 'var(--rs-red)', marginTop: 6 }}>
                      {field.alternateKey
                        ? 'Ajoutez des photos ou renseignez le lien Drive ci-dessus'
                        : field.min
                          ? `${field.min} photo(s) minimum requise(s)`
                          : 'Au moins une photo est requise'}
                    </div>
                  )}
                </div>
              );
            }

            if (field.type === 'text') {
              return (
                <div key={field.key}>
                  <FieldLabel label={field.label} required={field.required} hint={field.transform === 'uppercase' ? 'en MAJUSCULES' : field.hint} />
                  <input
                    type="text"
                    value={metadata[field.key] || ''}
                    onChange={(e) => updateMetadata(field.key, field.transform === 'uppercase' ? e.target.value.toLocaleUpperCase('fr-FR') : e.target.value)}
                    style={field.transform === 'uppercase' ? { textTransform: 'uppercase' } : undefined}
                    className={`rs-input${missing ? ' error' : ''}`}
                  />
                  {missing && <FieldError message="Ce champ est obligatoire" />}
                </div>
              );
            }

            if (field.type === 'url') {
              const isOptionalViaAlternate = !!field.alternateKey;
              return (
                <div key={field.key}>
                  <FieldLabel
                    label={field.label}
                    required={field.required && !isOptionalViaAlternate}
                    hint={isOptionalViaAlternate ? '(ou ajoutez des photos)' : field.hint}
                  />
                  <input
                    type="url"
                    value={metadata[field.key] || ''}
                    onChange={(e) => updateMetadata(field.key, e.target.value)}
                    placeholder={field.validation === 'youtube' ? 'https://www.youtube.com/watch?v=…' : field.validation === 'website' ? 'https://… (Bandcamp ou site officiel)' : 'https://…'}
                    className={`rs-input${missing ? ' error' : ''}`}
                  />
                  {missing && (
                    <FieldError message={urlFieldProblem(field, metadata[field.key]) || (isOptionalViaAlternate ? 'Renseignez un lien ou ajoutez des photos ci-dessous' : 'Ce champ est obligatoire')} />
                  )}
                </div>
              );
            }

            if (field.type === 'stars') {
              const maxStars = field.max || 5;
              const currentRating = parseFloat(metadata[field.key]) || 0;

              const handleStarClick = (
                starIndex: number,
                e: React.MouseEvent<HTMLButtonElement>,
              ) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const isLeftHalf = clickX < rect.width / 2;
                const newRating = isLeftHalf ? starIndex - 0.5 : starIndex;
                updateMetadata(field.key, String(newRating === currentRating ? 0 : newRating));
              };

              return (
                <div key={field.key}>
                  <FieldLabel label={field.label} required={field.required} />
                  <div className="flex items-center gap-1">
                    {Array.from({ length: maxStars }, (_, i) => i + 1).map((star) => {
                      const isFull = currentRating >= star;
                      const isHalf = !isFull && currentRating >= star - 0.5;
                      return (
                        <button
                          key={star}
                          type="button"
                          onClick={(e) => handleStarClick(star, e)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 2,
                            cursor: 'pointer',
                          }}
                        >
                          {isHalf ? (
                            <span style={{ position: 'relative', width: 28, height: 28, display: 'inline-block' }}>
                              <Star size={28} style={{ color: 'var(--border-strong)', position: 'absolute', inset: 0 }} />
                              <span
                                style={{
                                  position: 'absolute',
                                  inset: 0,
                                  overflow: 'hidden',
                                  width: '50%',
                                }}
                              >
                                <Star size={28} style={{ color: 'var(--star)', fill: 'var(--star)' }} />
                              </span>
                            </span>
                          ) : (
                            <Star
                              size={28}
                              style={{
                                color: isFull ? 'var(--star)' : 'var(--border-strong)',
                                fill: isFull ? 'var(--star)' : 'transparent',
                              }}
                            />
                          )}
                        </button>
                      );
                    })}
                    {currentRating > 0 && (
                      <span
                        className="mono"
                        style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 8 }}
                      >
                        {currentRating % 1 === 0 ? currentRating : currentRating.toFixed(1)}/{maxStars}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                    Clic gauche de l'étoile = demi, clic droit = entière
                  </p>
                  {missing && <FieldError message="Veuillez sélectionner une note" />}
                </div>
              );
            }

            if (field.type === 'textarea') {
              const isBodyField = field.key === 'corps';
              const fieldValue = metadata[field.key] || '';
              return (
                <div key={field.key}>
                  <div className="flex items-center justify-between mb-1">
                    <FieldLabel label={field.label} required={field.required} inline hint={field.hint} />
                    {isBodyField && (
                      <span
                        className="mono"
                        style={{
                          fontSize: 11,
                          padding: '2px 8px',
                          borderRadius: 'var(--r-pill)',
                          background: props.signOverLimit
                            ? 'var(--rs-red-tint)'
                            : 'var(--paper-2)',
                          color: props.signOverLimit ? 'var(--rs-red-deep)' : 'var(--muted)',
                        }}
                      >
                        {fieldValue.length.toLocaleString('fr-FR')} /{' '}
                        {selectedType.sign_limit.toLocaleString('fr-FR')} signes
                      </span>
                    )}
                  </div>
                  <textarea
                    value={fieldValue}
                    onChange={(e) => updateMetadata(field.key, e.target.value)}
                    rows={isBodyField ? 14 : 4}
                    className={`rs-textarea${missing ? ' error' : ''}`}
                    style={
                      isBodyField
                        ? {
                            fontFamily: 'Cambria, Georgia, serif',
                            fontSize: 14,
                            lineHeight: 1.7,
                            resize: 'vertical',
                          }
                        : { resize: 'vertical' }
                    }
                  />
                  {missing && <FieldError message="Ce champ est obligatoire" />}
                  {isBodyField && props.signOverLimit && (
                    <FieldError
                      message={`Dépassement de ${(
                        fieldValue.length - selectedType.sign_limit
                      ).toLocaleString('fr-FR')} signes`}
                    />
                  )}
                </div>
              );
            }

            return null;
          })}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Step 3: Correction
   ============================================================ */

interface StepCorrectionViewProps {
  correction: CorrectionResult | null;
  bodyCorrected: string;
  onChangeBody: (v: string) => void;
  /** Chapo relu en meme temps que le corps ; null si le type de papier n'en a pas. */
  chapo: string | null;
  onChangeChapo: (v: string) => void;
  signLimit: number;
  signOverLimit: boolean;
}

function StepCorrectionView({
  correction,
  bodyCorrected,
  onChangeBody,
  chapo,
  onChangeChapo,
  signLimit,
  signOverLimit,
}: StepCorrectionViewProps) {
  return (
    <div className="space-y-4">
      <div className="rs-card" style={{ padding: '24px 28px' }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          Étape 3
        </div>
        <h2 className="serif" style={{ fontSize: 22, lineHeight: 1.1, marginBottom: 4 }}>
          Texte relu et corrigé
        </h2>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 18 }}>
          Modifiez librement le texte ci-dessous. La relecture ne change pas votre style.
        </p>

        {correction && correction.corrections.length > 0 && (
          <div
            style={{
              padding: '14px 16px',
              borderRadius: 'var(--r-md)',
              background: 'var(--info-tint)',
              border: '1px solid var(--info)',
              borderColor: 'rgba(14,93,170,0.25)',
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--info)',
                marginBottom: 8,
              }}
            >
              <Sparkles size={13} className="inline mr-1" />
              {correction.corrections.length} correction
              {correction.corrections.length > 1 ? 's' : ''} appliquée
              {correction.corrections.length > 1 ? 's' : ''}
            </div>
            <div className="space-y-1.5" style={{ maxHeight: 180, overflowY: 'auto' }}>
              {correction.corrections.map((c, i) => (
                <div
                  key={i}
                  style={{ fontSize: 12, fontFamily: 'Cambria, Georgia, serif' }}
                >
                  <span
                    style={{
                      textDecoration: 'line-through',
                      color: 'var(--rs-red-deep)',
                    }}
                  >
                    {c.original}
                  </span>
                  <span className="mono" style={{ margin: '0 6px', color: 'var(--muted)' }}>
                    →
                  </span>
                  <span style={{ color: 'var(--ok)', fontWeight: 600 }}>
                    {c.corrected}
                  </span>
                  <span
                    style={{ marginLeft: 8, fontSize: 11, color: 'var(--muted)' }}
                  >
                    ({c.type})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {chapo !== null && (
          <div style={{ marginBottom: 18 }}>
            <div className="mb-2">
              <FieldLabel label="Chapô final (modifiable)" inline />
            </div>
            <textarea
              value={chapo}
              onChange={(e) => onChangeChapo(e.target.value)}
              rows={3}
              className="rs-textarea"
              style={{
                fontFamily: 'Cambria, Georgia, serif',
                fontSize: 14,
                lineHeight: 1.6,
                resize: 'vertical',
              }}
            />
          </div>
        )}

        <div className="flex items-center justify-between mb-2">
          <FieldLabel label="Texte final (modifiable)" inline />
          <span
            className="mono"
            style={{
              fontSize: 11,
              padding: '2px 8px',
              borderRadius: 'var(--r-pill)',
              background: signOverLimit ? 'var(--rs-red-tint)' : 'var(--paper-2)',
              color: signOverLimit ? 'var(--rs-red-deep)' : 'var(--muted)',
            }}
          >
            {bodyCorrected.length.toLocaleString('fr-FR')} /{' '}
            {signLimit.toLocaleString('fr-FR')} signes
          </span>
        </div>
        <textarea
          value={bodyCorrected}
          onChange={(e) => onChangeBody(e.target.value)}
          rows={16}
          className="rs-textarea"
          style={{
            fontFamily: 'Cambria, Georgia, serif',
            fontSize: 14,
            lineHeight: 1.7,
            resize: 'vertical',
          }}
        />
      </div>
    </div>
  );
}

/* ============================================================
   Step 4: Review
   ============================================================ */

interface StepReviewViewProps {
  selectedType: PaperType;
  nextHebdo: HebdoConfig | null;
  metadata: Record<string, any>;
  bodyCorrected: string;
  imagePreviews: string[];
  imageFiles: File[];
  signCount: number;
  signLimit: number;
  signOverLimit: boolean;
}

function StepReviewView({
  selectedType,
  nextHebdo,
  metadata,
  bodyCorrected,
  imagePreviews,
  imageFiles,
  signCount,
  signLimit,
  signOverLimit,
}: StepReviewViewProps) {
  return (
    <div className="space-y-4">
      <div className="rs-card" style={{ padding: '24px 28px' }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          Étape 4 — Récapitulatif
        </div>
        <h2 className="serif" style={{ fontSize: 22, lineHeight: 1.1, marginBottom: 16 }}>
          Tout est-il bon ?
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Meta label="Format" value={selectedType.name} />
          <Meta label="Numéro" value={nextHebdo?.label || '—'} />
          {selectedType.fields_config?.map((field) => {
            if (field.type === 'images') {
              return (
                <Meta
                  key={field.key}
                  label={field.label}
                  value={`${imageFiles.length} photo${imageFiles.length > 1 ? 's' : ''}`}
                />
              );
            }
            const value =
              field.key === 'corps' && bodyCorrected ? bodyCorrected : metadata[field.key];
            if (!value) return null;
            if (field.type === 'textarea') return null; // shown separately below
            if (field.type === 'stars') {
              const r = parseFloat(value) || 0;
              return (
                <Meta
                  key={field.key}
                  label={field.label}
                  value={`${r % 1 === 0 ? r : r.toFixed(1)}/${field.max || 5} étoiles`}
                />
              );
            }
            return (
              <Meta
                key={field.key}
                label={field.label}
                value={String(value)}
                tone={field.type === 'url' ? 'info' : undefined}
              />
            );
          })}
          <Meta
            label="Signes"
            value={`${signCount.toLocaleString('fr-FR')} / ${signLimit.toLocaleString('fr-FR')}`}
            tone={signOverLimit ? 'red' : 'ok'}
          />
        </div>

        {/* Body preview */}
        {bodyCorrected && (
          <div
            style={{
              marginTop: 18,
              padding: '14px 16px',
              background: 'var(--paper-2)',
              borderRadius: 'var(--r-md)',
            }}
          >
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              Aperçu du corps
            </div>
            <p
              style={{
                fontFamily: 'Cambria, Georgia, serif',
                fontSize: 13,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                maxHeight: 200,
                overflowY: 'auto',
                color: 'var(--ink-2)',
              }}
            >
              {bodyCorrected.substring(0, 800)}
              {bodyCorrected.length > 800 ? '…' : ''}
            </p>
          </div>
        )}

        {imagePreviews.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>
              Visuels joints ({imagePreviews.length})
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {imagePreviews.map((preview, i) => (
                <img
                  key={i}
                  src={preview}
                  alt=""
                  style={{
                    width: '100%',
                    height: 80,
                    objectFit: 'cover',
                    borderRadius: 'var(--r-md)',
                    border: '1px solid var(--border)',
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   Helper sidebar
   ============================================================ */

interface HelperPanelProps {
  step: Step;
  selectedType: PaperType | null;
  nextHebdo: HebdoConfig | null;
  hebdoConfirmed: boolean;
  signCount: number;
  signLimit: number;
  signRatio: number;
  signOverLimit: boolean;
  correction: CorrectionResult | null;
}

function HelperPanel({
  step,
  selectedType,
  nextHebdo,
  hebdoConfirmed,
  signCount,
  signLimit,
  signRatio,
  signOverLimit,
  correction,
}: HelperPanelProps) {
  return (
    <div className="space-y-4">
      {/* Issue badge — always visible */}
      {nextHebdo && (
        <div
          className="rs-card thick"
          style={{
            padding: '16px 18px',
            background: 'linear-gradient(135deg, var(--rs-red-tint), var(--surface))',
            borderColor: 'var(--rs-red-tint)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: 12,
              background: 'var(--ink)',
              color: 'var(--paper)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontSize: 24,
              flexShrink: 0,
            }}
          >
            {nextHebdo.numero}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="eyebrow" style={{ marginBottom: 2 }}>
              Numéro
            </div>
            <div
              className="serif"
              style={{ fontSize: 18, lineHeight: 1.05, color: 'var(--ink)' }}
            >
              {nextHebdo.label}
            </div>
            {nextHebdo.start_date && nextHebdo.end_date && (
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                du{' '}
                {format(new Date(nextHebdo.start_date + 'T00:00:00'), 'd', { locale: fr })}{' '}
                au{' '}
                {format(new Date(nextHebdo.end_date + 'T00:00:00'), 'd MMMM', { locale: fr })}
              </div>
            )}
          </div>
        </div>
      )}

      {step === 'type' && (
        <>
          <div className="rs-card" style={{ padding: '20px 22px' }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              Confirmation
            </div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>
              {hebdoConfirmed
                ? 'Numéro confirmé'
                : 'Confirmez le numéro pour commencer'}
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
              Le dossier Dropbox sera prêt à recevoir votre papier dès que vous
              aurez confirmé.
            </p>
            {hebdoConfirmed && (
              <div
                className="flex items-center gap-2"
                style={{ color: 'var(--ok)', fontSize: 13, fontWeight: 600 }}
              >
                <Check size={16} />
                <span>Dossier préparé</span>
              </div>
            )}
          </div>
          <Tip>
            Le format détermine le nombre de signes et les champs à remplir. Pas
            d'inquiétude — vous pouvez changer plus tard.
          </Tip>
        </>
      )}

      {step === 'content' && selectedType && signLimit > 0 && (
        <>
          {/* Sign counter */}
          <div className="rs-card" style={{ padding: '20px 22px' }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              Compteur de signes
            </div>
            <div className="flex items-end justify-between mb-3">
              <div className="serif" style={{ fontSize: 38, lineHeight: 1 }}>
                {signCount.toLocaleString('fr-FR')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                / {signLimit.toLocaleString('fr-FR')}
              </div>
            </div>
            <div
              style={{
                height: 8,
                borderRadius: 4,
                background: 'var(--paper-2)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${Math.min(100, signRatio * 100)}%`,
                  height: '100%',
                  background: signOverLimit
                    ? 'var(--rs-red)'
                    : 'linear-gradient(90deg, var(--ok), var(--rs-red))',
                  borderRadius: 4,
                  transition: 'width 0.2s var(--ease)',
                }}
              />
            </div>
            <div
              className="flex items-center justify-between mt-2"
              style={{ fontSize: 11 }}
            >
              <span style={{ color: 'var(--muted)' }}>
                {signOverLimit
                  ? 'Dépassement'
                  : signRatio < 0.5
                    ? 'Texte un peu court'
                    : signRatio > 0.95
                      ? 'Au taquet'
                      : 'Bonne longueur'}
              </span>
              <span
                className="mono"
                style={{
                  fontWeight: 600,
                  color: signOverLimit ? 'var(--rs-red)' : 'var(--ok)',
                }}
              >
                {Math.round(signRatio * 100)}%
              </span>
            </div>
          </div>
          <Tip label="Champs obligatoires">
            Les champs marqués <strong style={{ color: 'var(--rs-red)' }}>•</strong>{' '}
            doivent être remplis pour passer à l'étape suivante.
          </Tip>
        </>
      )}

      {step === 'correction' && (
        <>
          <div
            className="rs-card"
            style={{
              padding: '20px 22px',
              background: 'linear-gradient(135deg, var(--rs-red-tint), var(--surface))',
            }}
          >
            <div
              className="flex items-center gap-2 mb-2"
              style={{ color: 'var(--rs-red)' }}
            >
              <Sparkles size={14} />
              <span className="eyebrow" style={{ color: 'var(--rs-red)' }}>
                Relecture
              </span>
            </div>
            <div className="serif" style={{ fontSize: 26, lineHeight: 1.1, marginBottom: 4 }}>
              {correction?.corrections.length || 0} suggestion
              {(correction?.corrections.length || 0) > 1 ? 's' : ''}
            </div>
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>
              Votre texte a été relu. Vous restez maître du résultat final.
            </p>
          </div>
          <Tip label="Vous restez maître">
            La relecture ne touche jamais à votre style. Modifiez librement le texte
            avant de continuer.
          </Tip>
        </>
      )}

      {step === 'review' && (
        <>
          <div
            className="rs-card"
            style={{
              padding: '24px 26px',
              background: 'var(--ink)',
              color: 'var(--paper)',
              borderColor: 'var(--ink)',
            }}
          >
            <div
              className="eyebrow"
              style={{ color: 'rgba(245,240,230,0.5)', marginBottom: 6 }}
            >
              Vous êtes prêt·e.
            </div>
            <div
              className="serif"
              style={{ fontSize: 22, lineHeight: 1.15, marginBottom: 16 }}
            >
              Un dernier coup d'œil avant de livrer ?
            </div>
            <div className="space-y-3">
              <ChecklistRow done text="Champs obligatoires" />
              <ChecklistRow
                done={!signOverLimit && signCount > 0}
                text={`Compteur de signes (${signCount.toLocaleString('fr-FR')} / ${signLimit.toLocaleString('fr-FR')})`}
              />
              <ChecklistRow done text="Texte corrigé" />
            </div>
            <p
              style={{
                fontSize: 11,
                color: 'rgba(245,240,230,0.55)',
                marginTop: 16,
                lineHeight: 1.5,
              }}
            >
              On envoie le DOCX dans Dropbox et on prévient la rédaction.
            </p>
          </div>
          <Tip label="Modifiable après envoi">
            Tant que la rédaction n'a pas relu, vous pouvez revenir éditer ce
            papier depuis votre tableau de bord.
          </Tip>
        </>
      )}
    </div>
  );
}

/* ============================================================
   Success screen
   ============================================================ */

interface SuccessScreenProps {
  title: string;
  driveUrl: string;
  isEditMode: boolean;
  /** Reinitialise le formulaire pour enchainer un papier (meme route /livrer). */
  onDeliverAnother: () => void;
}

function SuccessScreen({ title, driveUrl, isEditMode, onDeliverAnother }: SuccessScreenProps) {
  return (
    <div className="flex items-center justify-center" style={{ padding: '40px 16px' }}>
      <div className="text-center" style={{ maxWidth: 720, width: '100%', position: 'relative' }}>
        {/* confetti dots */}
        {[...Array(12)].map((_, i) => (
          <span
            key={i}
            aria-hidden
            style={{
              position: 'absolute',
              width: [6, 8, 4, 10][i % 4],
              height: [6, 8, 4, 10][i % 4],
              background: ['var(--rs-red)', 'var(--ok)', 'var(--star)', 'var(--info)'][i % 4],
              top: `${10 + (i * 7) % 80}%`,
              left: `${(i * 13) % 100}%`,
              borderRadius: i % 2 ? '50%' : 2,
              animation: `float-up ${2 + (i % 5) * 0.3}s var(--ease) ${i * 0.15}s infinite`,
              opacity: 0,
            }}
          />
        ))}

        <div
          style={{
            width: 96,
            height: 96,
            margin: '0 auto 24px',
            borderRadius: '50%',
            background: 'var(--ok-tint)',
            border: '2px solid var(--ok)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--ok)',
            position: 'relative',
          }}
        >
          <Check size={42} />
          <span
            style={{
              position: 'absolute',
              inset: -6,
              borderRadius: '50%',
              border: '2px solid var(--ok)',
              opacity: 0.4,
            }}
          />
        </div>

        <div className="eyebrow" style={{ color: 'var(--ok)' }}>
          {isEditMode ? 'Papier modifié' : 'Papier livré'}
        </div>
        <h1
          className="serif italic"
          style={{ fontSize: 48, lineHeight: 1.05, margin: '10px 0 14px' }}
        >
          {isEditMode ? 'Modifications enregistrées !' : 'Bravo, c\'est envoyé !'}
        </h1>
        <p
          className="mx-auto"
          style={{
            fontSize: 16,
            color: 'var(--muted)',
            maxWidth: 480,
            marginBottom: 28,
          }}
        >
          Votre papier{' '}
          <strong style={{ color: 'var(--ink)' }}>{title}</strong>{' '}
          {isEditMode
            ? 'a bien été mis à jour dans Dropbox.'
            : 'est dans Dropbox. La rédaction en chef vient de recevoir un email.'}
        </p>

        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link to="/" className="rs-btn ghost lg">
            <Home size={16} />
            Retour à l'espace
          </Link>
          {driveUrl && (
            <a
              href={driveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rs-btn ink lg"
            >
              <FileText size={16} />
              Voir dans Dropbox
            </a>
          )}
          <button type="button" onClick={onDeliverAnother} className="rs-btn primary lg">
            <Plus size={16} />
            Livrer un autre papier
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Small helpers
   ============================================================ */

function FieldLabel({
  label,
  required,
  hint,
  inline,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  inline?: boolean;
}) {
  return (
    <label
      style={{
        display: inline ? 'inline-block' : 'block',
        fontSize: 12,
        fontWeight: 500,
        color: 'var(--ink-2)',
        marginBottom: inline ? 0 : 6,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}
    >
      {label}
      {required && <span style={{ color: 'var(--rs-red)', marginLeft: 4 }}>•</span>}
      {hint && (
        <span
          style={{
            color: 'var(--muted)',
            textTransform: 'none',
            letterSpacing: 0,
            fontWeight: 400,
            marginLeft: 6,
          }}
        >
          {hint}
        </span>
      )}
    </label>
  );
}

function FieldError({ message }: { message: string }) {
  return (
    <p style={{ fontSize: 11, color: 'var(--rs-red)', marginTop: 4 }}>{message}</p>
  );
}

interface MetaProps {
  label: string;
  value: string;
  tone?: 'ok' | 'red' | 'info';
}

function Meta({ label, value, tone }: MetaProps) {
  const color =
    tone === 'ok'
      ? 'var(--ok)'
      : tone === 'red'
        ? 'var(--rs-red)'
        : tone === 'info'
          ? 'var(--info)'
          : 'var(--ink)';
  return (
    <div
      style={{
        padding: '12px 14px',
        background: 'var(--paper-2)',
        borderRadius: 'var(--r-md)',
      }}
    >
      <div className="eyebrow" style={{ marginBottom: 4 }}>
        {label}
      </div>
      <div
        style={{
          fontWeight: 600,
          color,
          fontSize: 13,
          wordBreak: 'break-word',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Tip({
  children,
  label = 'Astuce',
}: {
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <div className="rs-tip">
      <span style={{ color: 'var(--rs-red)', flexShrink: 0 }}>
        <Eye size={14} />
      </span>
      <span>
        <strong>{label}.</strong> {children}
      </span>
    </div>
  );
}

function ChecklistRow({ done, text }: { done: boolean; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: done ? 'var(--rs-red)' : 'rgba(255,255,255,0.1)',
          color: done ? 'white' : 'rgba(245,240,230,0.4)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {done ? <Check size={12} /> : '·'}
      </span>
      <span style={{ fontSize: 13 }}>{text}</span>
    </div>
  );
}
