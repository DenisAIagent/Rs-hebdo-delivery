import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore.ts';
import {
  LayoutDashboard,
  Send,
  Pencil,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Star,
  StarHalf,
  ImageIcon,
  FileText,
  FolderOpen,
  ArrowRight,
  Check,
  X,
  Play,
} from 'lucide-react';

const TOTAL_STEPS = 6;

/** Vidéo de présentation (projet HyperFrames rs-hebdo-tuto, copiée dans public/). */
const TUTO_VIDEO_SRC = '/tuto-rs-hebdo.mp4';
const TUTO_VIDEO_POSTER = '/tuto-rs-hebdo.jpg';

/**
 * Clé versionnée : incrémenter ONBOARDING_VERSION force tous les journalistes
 * à revoir la présentation une fois à leur prochaine connexion
 * (v4 = vidéo sans mention d'IA, avec musique, octobre 2026).
 */
const ONBOARDING_VERSION = 4;

function getOnboardingKey(userId: string) {
  return `rs-onboarding-done-v${ONBOARDING_VERSION}-${userId}`;
}

export function resetOnboarding(userId: string) {
  localStorage.removeItem(getOnboardingKey(userId));
}

export function isOnboardingDone(userId: string): boolean {
  return localStorage.getItem(getOnboardingKey(userId)) === 'true';
}

function markOnboardingDone(userId: string) {
  localStorage.setItem(getOnboardingKey(userId), 'true');
}

/* ------------------------------------------------------------------ */
/*  Step components                                                    */
/* ------------------------------------------------------------------ */

function StepVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [blocked, setBlocked] = useState(false);

  // Lecture automatique au premier affichage ; si le navigateur la refuse
  // (pas d'interaction préalable), on affiche un grand bouton Lire.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const attempt = el.play();
    if (attempt && typeof attempt.catch === 'function') {
      attempt.catch(() => setBlocked(true));
    }
    return () => {
      el.pause();
    };
  }, []);

  const playManually = () => {
    const el = videoRef.current;
    if (!el) return;
    el.play()
      .then(() => setBlocked(false))
      .catch(() => setBlocked(true));
  };

  return (
    <div className="text-center px-4">
      <div className="eyebrow" style={{ marginBottom: 8 }}>Présentation vidéo · 35 s</div>
      <h2
        className="serif italic"
        style={{ fontSize: 40, lineHeight: 1.05, marginBottom: 18 }}
      >
        Comment livrer un papier
      </h2>
      <div
        className="rs-card thick relative mx-auto overflow-hidden"
        style={{ maxWidth: 960, background: 'var(--ink)' }}
      >
        <video
          ref={videoRef}
          src={TUTO_VIDEO_SRC}
          poster={TUTO_VIDEO_POSTER}
          controls
          playsInline
          preload="auto"
          className="block w-full"
          style={{ aspectRatio: '16 / 9' }}
          aria-label="Vidéo de présentation de RS Hebdo Delivery"
        />
        {blocked && (
          <button
            type="button"
            onClick={playManually}
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: 'rgba(22, 20, 15, 0.45)' }}
            aria-label="Lire la vidéo"
          >
            <span
              className="inline-flex items-center gap-2 rs-btn primary lg"
              style={{ fontSize: 18 }}
            >
              <Play size={20} /> Lire la présentation
            </span>
          </button>
        )}
      </div>
      <p
        className="mx-auto mt-6"
        style={{ color: 'var(--muted)', maxWidth: 560, fontSize: 14 }}
      >
        Trente-cinq secondes pour voir tout le parcours. Vous pourrez la
        revoir à tout moment depuis votre tableau de bord.
      </p>
    </div>
  );
}

function StepWelcome() {
  return (
    <div className="text-center px-4">
      <img
        src="/logo-rs-france.png"
        alt="Rolling Stone France"
        className="h-12 mx-auto mb-8"
      />
      <div className="eyebrow" style={{ marginBottom: 8 }}>Bienvenue</div>
      <h2
        className="serif italic"
        style={{ fontSize: 48, lineHeight: 1.05, marginBottom: 16 }}
      >
        Bienvenue sur<br />Hebdo Delivery.
      </h2>
      <p
        className="mx-auto"
        style={{
          fontSize: 16,
          color: 'var(--muted)',
          lineHeight: 1.6,
          maxWidth: 520,
        }}
      >
        Cette plateforme vous permet de livrer vos papiers pour le magazine{' '}
        <strong style={{ color: 'var(--rs-red)' }}>Rolling Stone France</strong>.
        En quatre étapes, envoyez vos articles, photos et critiques directement à
        la rédaction.
      </p>
      <div
        className="inline-flex items-center gap-2 mt-10"
        style={{ fontSize: 12, color: 'var(--muted)' }}
      >
        <Sparkles size={14} style={{ color: 'var(--rs-red)' }} />
        <span>Rapide, simple et centralisé</span>
      </div>
    </div>
  );
}

function StepDashboard() {
  return (
    <div className="text-center px-4">
      <div
        className="inline-flex items-center justify-center mb-6"
        style={{
          width: 64,
          height: 64,
          borderRadius: 'var(--r-lg)',
          background: 'var(--rs-red-tint)',
          color: 'var(--rs-red)',
        }}
      >
        <LayoutDashboard size={28} />
      </div>
      <div className="eyebrow" style={{ marginBottom: 6 }}>Étape 1</div>
      <h2
        className="serif"
        style={{ fontSize: 32, lineHeight: 1.1, marginBottom: 12 }}
      >
        Votre tableau de bord
      </h2>
      <p
        className="mx-auto"
        style={{ color: 'var(--muted)', maxWidth: 520, marginBottom: 32 }}
      >
        Le tableau de bord affiche le numéro en cours, votre dossier Dropbox et
        toutes vos livraisons. Le menu « Tous les numéros » permet de retrouver
        vos anciens papiers.
      </p>

      <div className="rs-card mx-auto text-left" style={{ maxWidth: 420 }}>
        <div
          className="flex items-center justify-between"
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600 }}>Mes livraisons</span>
          <span className="rs-chip red">RSH 240</span>
        </div>
        <div
          className="flex items-center justify-between"
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <div className="flex items-center gap-2">
            <span className="rs-chip muted">Interview 3000</span>
            <span style={{ fontSize: 13, color: 'var(--ink)' }}>
              PJ Harvey — l'élégance…
            </span>
          </div>
          <span className="rs-chip ok">
            <Check size={11} /> Livré
          </span>
        </div>
        <div
          className="flex items-center justify-between"
          style={{ padding: '12px 16px' }}
        >
          <div className="flex items-center gap-2">
            <span className="rs-chip muted">Chronique</span>
            <span style={{ fontSize: 13, color: 'var(--ink)' }}>
              Anatomie d'une chute…
            </span>
          </div>
          <span className="rs-chip ok">
            <Check size={11} /> Livré
          </span>
        </div>
      </div>

      <p
        className="inline-flex items-center gap-1 mt-6"
        style={{ fontSize: 11, color: 'var(--muted)' }}
      >
        <ArrowRight size={12} />
        Chaque livraison ouvre son dossier Dropbox d'un clic.
      </p>
    </div>
  );
}

function StepDeliver() {
  const steps = [
    { icon: <FileText size={18} />, label: 'Choisissez le type de papier' },
    { icon: <Pencil size={18} />, label: 'Rédigez le contenu et joignez les visuels' },
    { icon: <Sparkles size={18} />, label: 'Lancez la relecture et validez les corrections' },
    { icon: <Send size={18} />, label: 'Vérifiez et envoyez à la rédaction' },
  ];
  return (
    <div className="text-center px-4">
      <div
        className="inline-flex items-center justify-center mb-6"
        style={{
          width: 64,
          height: 64,
          borderRadius: 'var(--r-lg)',
          background: 'var(--ok-tint)',
          color: 'var(--ok)',
        }}
      >
        <Send size={28} />
      </div>
      <div className="eyebrow" style={{ marginBottom: 6 }}>Étape 2</div>
      <h2 className="serif" style={{ fontSize: 32, lineHeight: 1.1, marginBottom: 12 }}>
        Livrer un papier
      </h2>
      <p
        className="mx-auto"
        style={{ color: 'var(--muted)', maxWidth: 520, marginBottom: 28 }}
      >
        La livraison se fait en quatre étapes claires.
      </p>

      <div className="mx-auto space-y-3 text-left" style={{ maxWidth: 420 }}>
        {steps.map((s, i) => (
          <div
            key={i}
            className="rs-card flex items-center gap-3"
            style={{ padding: '12px 14px' }}
          >
            <div
              className="flex items-center justify-center"
              style={{
                width: 36,
                height: 36,
                borderRadius: 'var(--r-md)',
                background: 'var(--paper-2)',
                color: 'var(--ink)',
                flexShrink: 0,
              }}
            >
              {s.icon}
            </div>
            <span style={{ fontSize: 14, fontWeight: 500, flex: 1 }}>
              {s.label}
            </span>
            <span
              className="mono"
              style={{ fontSize: 12, color: 'var(--muted)' }}
            >
              0{i + 1}
            </span>
          </div>
        ))}
      </div>

      <div
        className="mx-auto mt-8 space-y-2 text-left"
        style={{ maxWidth: 420, fontSize: 13, color: 'var(--muted)' }}
      >
        <p className="flex items-start gap-2">
          <ImageIcon size={14} className="mt-0.5 shrink-0" />
          Les champs marqués <strong style={{ color: 'var(--rs-red)' }}>•</strong>{' '}
          sont obligatoires.
        </p>
        <p className="flex items-start gap-2">
          <Star size={14} className="mt-0.5 shrink-0" />
          Chaque type de papier a une limite de signes à respecter.
        </p>
        <p className="flex items-start gap-2">
          <ImageIcon size={14} className="mt-0.5 shrink-0" />
          Au moins une photo est demandée sur la plupart des formats (25 Mo max par fichier).
        </p>
        <p className="flex items-start gap-2">
          <StarHalf size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--star)' }} />
          Étoiles : clic gauche = demi, clic droit = entière.
        </p>
      </div>
    </div>
  );
}

function StepEdit() {
  return (
    <div className="text-center px-4">
      <div
        className="inline-flex items-center justify-center mb-6"
        style={{
          width: 64,
          height: 64,
          borderRadius: 'var(--r-lg)',
          background: 'var(--info-tint)',
          color: 'var(--info)',
        }}
      >
        <Pencil size={28} />
      </div>
      <div className="eyebrow" style={{ marginBottom: 6 }}>Étape 3</div>
      <h2 className="serif" style={{ fontSize: 32, lineHeight: 1.1, marginBottom: 12 }}>
        Modifier un papier
      </h2>
      <p
        className="mx-auto"
        style={{ color: 'var(--muted)', maxWidth: 520, marginBottom: 28 }}
      >
        Vous pouvez modifier un papier déjà livré à tout moment, en cliquant sur
        l'icône crayon dans votre liste de livraisons.
      </p>

      <div className="rs-card mx-auto text-left" style={{ maxWidth: 420 }}>
        <div
          className="flex items-center justify-between"
          style={{ padding: '14px 16px' }}
        >
          <div className="flex items-center gap-2">
            <span className="rs-chip muted">Interview 3000</span>
            <span style={{ fontSize: 13 }}>PJ Harvey…</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rs-chip ok">
              <Check size={11} /> Livré
            </span>
            <button
              className="rs-btn icon"
              style={{
                width: 28,
                height: 28,
                background: 'var(--rs-red-tint)',
                color: 'var(--rs-red)',
              }}
              tabIndex={-1}
            >
              <Pencil size={14} />
            </button>
          </div>
        </div>
      </div>

      <div
        className="mx-auto mt-8 space-y-2 text-left"
        style={{ maxWidth: 420, fontSize: 13, color: 'var(--muted)' }}
      >
        <p className="flex items-start gap-2">
          <FolderOpen size={14} className="mt-0.5 shrink-0" />
          Le document sera automatiquement mis à jour dans Dropbox.
        </p>
        <p className="flex items-start gap-2">
          <Sparkles size={14} className="mt-0.5 shrink-0" />
          Vous pourrez relancer la relecture sur le texte modifié.
        </p>
      </div>
    </div>
  );
}

function StepReady({
  skipChecked,
  onToggleSkip,
}: {
  skipChecked: boolean;
  onToggleSkip: () => void;
}) {
  return (
    <div className="text-center px-4">
      <div
        className="inline-flex items-center justify-center mb-6 relative"
        style={{
          width: 80,
          height: 80,
          borderRadius: '50%',
          background: 'var(--ok-tint)',
          border: '2px solid var(--ok)',
          color: 'var(--ok)',
        }}
      >
        <Check size={36} />
        <span
          aria-hidden
          style={{
            position: 'absolute',
            inset: -6,
            borderRadius: '50%',
            border: '2px solid var(--ok)',
            opacity: 0.4,
          }}
        />
      </div>
      <div className="eyebrow" style={{ color: 'var(--ok)', marginBottom: 8 }}>
        Tout est prêt
      </div>
      <h2
        className="serif italic"
        style={{ fontSize: 44, lineHeight: 1.05, marginBottom: 14 }}
      >
        C'est parti !
      </h2>
      <p
        className="mx-auto"
        style={{
          color: 'var(--muted)',
          maxWidth: 520,
          marginBottom: 28,
        }}
      >
        Vous êtes prêt·e à livrer votre premier papier pour Rolling Stone France.
        Bonne rédaction.
      </p>

      <label
        className="inline-flex items-center gap-2 cursor-pointer select-none"
        style={{ fontSize: 13, color: 'var(--muted)' }}
      >
        <input
          type="checkbox"
          checked={skipChecked}
          onChange={onToggleSkip}
          style={{
            width: 16,
            height: 16,
            accentColor: 'var(--rs-red)',
            cursor: 'pointer',
          }}
        />
        Ne plus afficher ce tutoriel au démarrage
      </label>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Progress dots                                                      */
/* ------------------------------------------------------------------ */

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          aria-label={`Étape ${i + 1}`}
          style={{
            display: 'inline-block',
            borderRadius: 999,
            transition: 'all 0.3s var(--ease)',
            width: i === current ? 32 : 10,
            height: 10,
            background:
              i === current
                ? 'var(--rs-red)'
                : i < current
                  ? 'var(--rs-red-tint)'
                  : 'var(--border)',
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export function OnboardingPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [skipChecked, setSkipChecked] = useState(true);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [animating, setAnimating] = useState(false);

  const goTo = useCallback(
    (target: number, dir: 'next' | 'prev') => {
      if (animating) return;
      setDirection(dir);
      setAnimating(true);
      setTimeout(() => {
        setStep(target);
        setAnimating(false);
      }, 200);
    },
    [animating],
  );

  const next = () => {
    if (step < TOTAL_STEPS - 1) goTo(step + 1, 'next');
  };

  const prev = () => {
    if (step > 0) goTo(step - 1, 'prev');
  };

  const finish = () => {
    if (user && skipChecked) {
      markOnboardingDone(user.id);
    }
    navigate('/', { replace: true });
  };

  const isLast = step === TOTAL_STEPS - 1;

  const steps = [
    <StepVideo key="video" />,
    <StepWelcome key="welcome" />,
    <StepDashboard key="dashboard" />,
    <StepDeliver key="deliver" />,
    <StepEdit key="edit" />,
    <StepReady
      key="ready"
      skipChecked={skipChecked}
      onToggleSkip={() => setSkipChecked((v) => !v)}
    />,
  ];

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--paper)' }}
    >
      {/* Skip link */}
      <div className="flex justify-end p-4">
        <button
          onClick={finish}
          className="rs-btn ghost sm"
          aria-label="Passer le tutoriel"
        >
          <X size={14} />
          Passer le tutoriel
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
        <div
          className={`w-full ${step === 0 ? 'max-w-5xl' : 'max-w-2xl'} transition-all duration-200 ease-in-out ${
            animating
              ? direction === 'next'
                ? 'opacity-0 translate-x-6'
                : 'opacity-0 -translate-x-6'
              : 'opacity-100 translate-x-0'
          }`}
        >
          {steps[step]}
        </div>
      </div>

      {/* Bottom bar */}
      <div
        className="sticky bottom-0"
        style={{
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
        }}
      >
        <div className="max-w-2xl mx-auto flex items-center justify-between px-6 py-4">
          <button
            onClick={prev}
            disabled={step === 0}
            className="rs-btn ghost sm"
            style={{ opacity: step === 0 ? 0.3 : 1 }}
          >
            <ChevronLeft size={16} />
            Précédent
          </button>

          <ProgressDots current={step} total={TOTAL_STEPS} />

          {isLast ? (
            <button onClick={finish} className="rs-btn primary">
              <Check size={16} />
              Commencer
            </button>
          ) : (
            <button onClick={next} className="rs-btn ink sm">
              Suivant
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
