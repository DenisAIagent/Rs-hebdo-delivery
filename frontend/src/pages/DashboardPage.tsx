import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore.ts';
import { isOnboardingDone, resetOnboarding } from './OnboardingPage.tsx';
import { getMyDeliveries, getNextHebdo } from '../services/api.ts';
import type { Delivery, HebdoConfig } from '../types/index.ts';
import {
  Send,
  Plus,
  FileText,
  Clock,
  ExternalLink,
  FolderOpen,
  Pencil,
  Search,
  Mail,
  Calendar,
  Sparkles,
  Check,
  Play,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

/** Only allow http/https URLs to prevent javascript: injection */
function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function statusChip(s: Delivery['status']) {
  if (s === 'delivered') {
    return (
      <span className="rs-chip ok">
        <Check size={11} /> Livré
      </span>
    );
  }
  if (s === 'corrected') {
    return (
      <span className="rs-chip info">
        <Sparkles size={11} /> Corrigé
      </span>
    );
  }
  return (
    <span className="rs-chip muted">
      <Pencil size={11} /> Brouillon
    </span>
  );
}

export function DashboardPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [hebdos, setHebdos] = useState<HebdoConfig[]>([]);
  const [currentHebdo, setCurrentHebdo] = useState<HebdoConfig | null>(null);
  const [selectedHebdoId, setSelectedHebdoId] = useState<string | 'all'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Redirect to onboarding if not completed
  useEffect(() => {
    if (user && !isOnboardingDone(user.id)) {
      navigate('/onboarding', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    async function load() {
      try {
        const [d, currentH] = await Promise.all([getMyDeliveries(), getNextHebdo()]);
        setDeliveries(d);
        setCurrentHebdo(currentH);

        // Build hebdo list from deliveries joined data
        const hebdoMap = new Map<string, HebdoConfig>();
        for (const del of d) {
          if (del.hebdo_id && del.hebdo) {
            hebdoMap.set(del.hebdo_id, {
              id: del.hebdo_id,
              numero: del.hebdo.numero,
              label: del.hebdo.label,
              start_date: null,
              end_date: null,
              is_current: currentH?.id === del.hebdo_id,
              created_at: '',
            });
          }
        }
        if (currentH && !hebdoMap.has(currentH.id)) {
          hebdoMap.set(currentH.id, currentH);
        }
        const hebdoList = Array.from(hebdoMap.values()).sort((a, b) => b.numero - a.numero);
        setHebdos(hebdoList);

        if (currentH) setSelectedHebdoId(currentH.id);
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className="animate-spin rounded-full h-8 w-8 border-2 border-t-transparent"
          style={{ borderColor: 'var(--rs-red)', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  const selectedHebdo = hebdos.find((h) => h.id === selectedHebdoId);
  let filteredDeliveries =
    selectedHebdoId === 'all'
      ? deliveries
      : deliveries.filter((d) => d.hebdo_id === selectedHebdoId);

  if (search.trim()) {
    const q = search.trim().toLowerCase();
    filteredDeliveries = filteredDeliveries.filter((d) =>
      d.title.toLowerCase().includes(q),
    );
  }

  // Stats — current hebdo focused
  const currentHebdoDeliveries = currentHebdo
    ? deliveries.filter((d) => d.hebdo_id === currentHebdo.id)
    : [];
  const totalSigns = deliveries.reduce((sum, d) => sum + (d.sign_count || 0), 0);
  const onTime = deliveries.length > 0
    ? Math.round(
        (deliveries.filter((d) => d.status === 'delivered').length /
          deliveries.length) *
          100,
      )
    : 0;
  const hebdoLabel = currentHebdo?.label || 'numéro en cours';
  const expectedCount = Math.max(0, 3 - currentHebdoDeliveries.length);

  return (
    <div>
      {/* Welcome */}
      <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
        <div>
          <div className="eyebrow">Mon espace</div>
          <h1
            className="serif"
            style={{
              fontSize: 44,
              lineHeight: 1.05,
              marginTop: 6,
              color: 'var(--ink)',
            }}
          >
            Bonjour {user?.full_name?.split(' ')[0] || 'à vous'}.
          </h1>
          {currentHebdo && (
            <p style={{ marginTop: 6, color: 'var(--muted)' }}>
              {expectedCount > 0 ? (
                <>
                  Vous avez{' '}
                  <strong style={{ color: 'var(--ink)' }}>
                    {expectedCount} papier{expectedCount > 1 ? 's' : ''} attendu
                    {expectedCount > 1 ? 's' : ''}
                  </strong>{' '}
                  pour {hebdoLabel}.
                </>
              ) : (
                <>Vous êtes à jour pour {hebdoLabel}.</>
              )}
            </p>
          )}
        </div>
        <Link to="/livrer" className="rs-btn primary lg">
          <Plus size={18} />
          Livrer un papier
        </Link>
      </div>

      {/* Hero row: issue + deadline + dropbox */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* Issue badge */}
        <div
          className="rs-card thick md:col-span-1"
          style={{
            padding: '20px 22px',
            background: currentHebdo
              ? 'linear-gradient(135deg, var(--rs-red-tint), var(--surface))'
              : 'var(--surface)',
            borderColor: currentHebdo ? 'var(--rs-red-tint)' : 'var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 18,
          }}
        >
          <div
            style={{
              width: 70,
              height: 70,
              borderRadius: 12,
              background: 'var(--ink)',
              color: 'var(--paper)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-serif)',
              fontStyle: 'italic',
              fontSize: 28,
              flexShrink: 0,
            }}
          >
            {currentHebdo?.numero ?? '—'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="eyebrow" style={{ marginBottom: 4 }}>
              Numéro de la semaine
            </div>
            <div
              className="serif"
              style={{
                fontSize: 22,
                lineHeight: 1.05,
                color: 'var(--ink)',
              }}
            >
              {currentHebdo?.label || 'Aucun numéro programmé'}
            </div>
            {currentHebdo?.start_date && currentHebdo?.end_date && (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--muted)',
                  marginTop: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Calendar size={12} />
                <span>
                  du{' '}
                  {format(new Date(currentHebdo.start_date + 'T00:00:00'), 'd', {
                    locale: fr,
                  })}{' '}
                  au{' '}
                  {format(
                    new Date(currentHebdo.end_date + 'T00:00:00'),
                    'd MMMM yyyy',
                    { locale: fr },
                  )}
                </span>
              </div>
            )}
          </div>
          {currentHebdo && <span className="rs-chip red">EN COURS</span>}
        </div>

        {/* Status / count card */}
        <div
          className="rs-card flex items-center gap-3"
          style={{ padding: '18px 20px' }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 'var(--r-md)',
              background: 'var(--info-tint)',
              color: 'var(--info)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Send size={18} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="eyebrow" style={{ color: 'var(--info)' }}>
              {hebdoLabel}
            </div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>
              {currentHebdoDeliveries.length} papier
              {currentHebdoDeliveries.length > 1 ? 's' : ''} livré
              {currentHebdoDeliveries.length > 1 ? 's' : ''}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              {expectedCount > 0
                ? `${expectedCount} encore attendu${expectedCount > 1 ? 's' : ''}`
                : 'Tout est à jour'}
            </div>
          </div>
        </div>

        {/* Dropbox dark card */}
        <div
          className="rs-card flex items-center gap-3"
          style={{
            padding: '18px 20px',
            background: 'var(--ink)',
            color: 'var(--paper)',
            borderColor: 'var(--ink)',
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 'var(--r-md)',
              background: 'rgba(255,255,255,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <FolderOpen size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              className="eyebrow"
              style={{ color: 'rgba(255,255,255,0.55)' }}
            >
              Dossier Dropbox
            </div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              Hebdo Delivery
              {currentHebdo ? ` / ${currentHebdo.label}` : ''}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
              Synchronisé automatiquement
            </div>
          </div>
        </div>
      </div>

      {/* Stats row — personal */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Mes papiers"
          value={String(deliveries.length)}
          delta="depuis votre arrivée"
        />
        <StatCard
          label="Signes rédigés"
          value={totalSigns.toLocaleString('fr-FR')}
          delta={`≈ ${Math.max(1, Math.round(totalSigns / 6000))} colonnes magazine`}
        />
        <StatCard
          label="Livrés à temps"
          value={`${onTime}%`}
          delta={
            deliveries.length > 0
              ? `${deliveries.filter((d) => d.status === 'delivered').length} papier(s) livré(s)`
              : 'Aucune livraison'
          }
          tone={onTime === 100 && deliveries.length > 0 ? 'ok' : undefined}
        />
        <StatCard
          label="En cours"
          value={String(currentHebdoDeliveries.length)}
          delta={`pour ${hebdoLabel}`}
        />
      </div>

      {/* Filter row */}
      <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
        <div>
          <div className="eyebrow">Mes livraisons</div>
          <h2
            className="serif"
            style={{ fontSize: 22, lineHeight: 1.1, marginTop: 4 }}
          >
            Tout ce que vous avez envoyé
          </h2>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            Recherche, filtre par numéro et accès Dropbox pour chaque papier.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="rs-input-wrap" style={{ width: 220 }}>
            <span className="lead">
              <Search size={14} />
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un titre…"
              className="rs-input with-icon"
              style={{ padding: '9px 14px 9px 36px', fontSize: 13 }}
            />
          </div>
          {hebdos.length > 0 && (
            <select
              value={selectedHebdoId}
              onChange={(e) => setSelectedHebdoId(e.target.value)}
              className="rs-select"
              style={{ width: 200, padding: '9px 12px', fontSize: 13 }}
            >
              <option value="all">Tous les numéros</option>
              {hebdos.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.label} {h.is_current ? '— en cours' : ''}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Deliveries list */}
      <div className="rs-card overflow-hidden">
        {filteredDeliveries.length === 0 ? (
          <div className="text-center" style={{ padding: '48px 20px' }}>
            <FileText
              size={32}
              className="mx-auto mb-3"
              style={{ color: 'var(--muted-2)' }}
            />
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>
              {search
                ? 'Aucun résultat pour cette recherche.'
                : selectedHebdo
                  ? `Aucune livraison pour ${selectedHebdo.label}.`
                  : 'Aucune livraison pour le moment.'}
            </p>
            <Link
              to="/livrer"
              className="rs-btn primary sm inline-flex mt-4"
            >
              <Plus size={14} />
              Livrer un papier
            </Link>
          </div>
        ) : (
          <>
            <div
              className="hidden md:grid"
              style={{
                gridTemplateColumns: '140px 1fr 130px 130px 110px 130px',
                padding: '12px 20px',
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--muted)',
                borderBottom: '1px solid var(--border)',
                background: 'var(--surface-2)',
              }}
            >
              <div>Type</div>
              <div>Titre</div>
              <div>Numéro</div>
              <div>Date</div>
              <div>Statut</div>
              <div style={{ textAlign: 'right' }}>Actions</div>
            </div>

            {filteredDeliveries.map((d, i) => (
              <div
                key={d.id}
                className="grid grid-cols-1 md:grid-cols-[140px_1fr_130px_130px_110px_130px] gap-2 md:gap-0 items-center"
                style={{
                  padding: '14px 20px',
                  borderBottom:
                    i < filteredDeliveries.length - 1
                      ? '1px solid var(--border)'
                      : 'none',
                }}
              >
                <div>
                  <span className="rs-chip muted">
                    {d.paper_type?.name || 'N/A'}
                  </span>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 14,
                      color: 'var(--ink)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {d.title}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--muted)',
                      marginTop: 2,
                    }}
                  >
                    {d.sign_count.toLocaleString('fr-FR')} signes
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                  {d.hebdo?.label || '—'}
                </div>
                <div style={{ fontSize: 12 }}>
                  <span style={{ color: 'var(--ink)' }}>
                    <Clock
                      size={11}
                      className="inline mr-1"
                      style={{ color: 'var(--muted-2)' }}
                    />
                    {d.delivered_at
                      ? format(new Date(d.delivered_at), 'd MMM HH:mm', {
                          locale: fr,
                        })
                      : format(new Date(d.created_at), 'd MMM', {
                          locale: fr,
                        })}
                  </span>
                </div>
                <div>{statusChip(d.status)}</div>
                <div className="flex items-center justify-end gap-1">
                  {d.drive_folder_url && isSafeUrl(d.drive_folder_url) && (
                    <a
                      href={d.drive_folder_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rs-btn icon"
                      title="Voir Dropbox"
                    >
                      <FolderOpen size={16} />
                    </a>
                  )}
                  <Link
                    to={`/livrer/${d.id}`}
                    className="rs-btn icon"
                    title="Modifier"
                  >
                    <Pencil size={16} />
                  </Link>
                  {d.digital_link && isSafeUrl(d.digital_link) && (
                    <a
                      href={d.digital_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rs-btn icon"
                      title="Lien numérique"
                    >
                      <ExternalLink size={16} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Help footer */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4 mt-8">
        <ReplayCard />
        <div className="flex flex-col gap-3">
          <HelpCard
            icon={<FileText size={18} />}
            eyebrow="Documentation"
            title="Guide écrit pas-à-pas"
            cta="Lire"
            href="/guide.html"
          />
          <HelpCard
            icon={<Mail size={18} />}
            eyebrow="Contact"
            title="Rédaction en chef"
            cta="redac@rollingstone.fr"
            href="mailto:redac@rollingstone.fr"
          />
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  delta: string;
  tone?: 'ok';
}

function StatCard({ label, value, delta, tone }: StatCardProps) {
  return (
    <div className="rs-card" style={{ padding: '20px 22px' }}>
      <div className="eyebrow" style={{ color: 'var(--muted)' }}>
        {label}
      </div>
      <div
        className="serif"
        style={{
          fontSize: 38,
          lineHeight: 1,
          marginTop: 8,
          marginBottom: 6,
          letterSpacing: '-0.02em',
          color: 'var(--ink)',
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 11,
          color: tone === 'ok' ? 'var(--ok)' : 'var(--muted)',
        }}
      >
        {delta}
      </div>
    </div>
  );
}

function ReplayCard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const handleReplay = () => {
    if (user) {
      resetOnboarding(user.id);
    }
    navigate('/onboarding');
  };

  return (
    <div
      className="rs-card flex items-stretch overflow-hidden"
      style={{ minHeight: 110 }}
    >
      <button
        onClick={handleReplay}
        style={{
          width: 200,
          background: '#16140F',
          position: 'relative',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(245,240,230,0.04) 0 1px, transparent 1px 30px)',
          color: 'var(--paper)',
          cursor: 'pointer',
          border: 'none',
        }}
        aria-label="Revoir la présentation"
      >
        <div
          className="serif italic text-center"
          style={{ fontSize: 20, lineHeight: 1, padding: '0 16px' }}
        >
          Revoir le tour
        </div>
        <span
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: 'var(--rs-red)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 6px 18px rgba(0,0,0,0.4)',
          }}
        >
          <Play size={18} fill="currentColor" />
        </span>
      </button>
      <div style={{ padding: '18px 22px', flex: 1 }}>
        <div className="eyebrow">Tutoriel</div>
        <div
          style={{
            fontWeight: 600,
            fontSize: 16,
            marginTop: 4,
          }}
        >
          Comment livrer un papier ?
        </div>
        <p
          style={{
            fontSize: 12,
            color: 'var(--muted)',
            marginTop: 6,
            marginBottom: 12,
            lineHeight: 1.5,
          }}
        >
          Une présentation visuelle des 4 étapes — type, rédaction, correction
          IA, envoi.
        </p>
        <button onClick={handleReplay} className="rs-btn primary sm">
          <Sparkles size={13} />
          Revoir la présentation
        </button>
      </div>
    </div>
  );
}

interface HelpCardProps {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  cta: string;
  href: string;
}

function HelpCard({ icon, eyebrow, title, cta, href }: HelpCardProps) {
  return (
    <a
      href={href}
      target={href.startsWith('http') || href.endsWith('.html') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      className="rs-card flex items-center gap-4"
      style={{
        padding: '16px 20px',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'background 0.15s var(--ease)',
      }}
      onMouseEnter={(e) =>
        ((e.currentTarget as HTMLElement).style.background = 'var(--surface-2)')
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLElement).style.background = 'var(--surface)')
      }
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 'var(--r-md)',
          background: 'var(--paper-2)',
          color: 'var(--ink)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="eyebrow" style={{ color: 'var(--muted)' }}>
          {eyebrow}
        </div>
        <div style={{ fontWeight: 600, marginTop: 2 }}>{title}</div>
      </div>
      <span
        className="rs-btn ghost sm"
        style={{ pointerEvents: 'none' }}
      >
        {cta}
      </span>
    </a>
  );
}
