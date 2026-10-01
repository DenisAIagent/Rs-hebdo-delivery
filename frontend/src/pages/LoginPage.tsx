import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore.ts';
import { Lock, Mail, AlertCircle, Eye, EyeOff, ArrowRight } from 'lucide-react';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { login, loading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      // 2FA (si activee dans l'admin) : verification (ou enrolement) du code TOTP
      navigate(useAuthStore.getState().mfaRequired ? '/mfa' : '/');
    } catch (err: unknown) {
      setError('Email ou mot de passe incorrect');
    }
  };

  return (
    <div
      className="min-h-screen flex"
      style={{ background: 'var(--paper)' }}
    >
      {/* Left — editorial pane */}
      <aside
        className="hidden lg:flex flex-col justify-between relative overflow-hidden"
        style={{
          width: '46%',
          background: 'var(--ink)',
          color: 'var(--paper)',
          padding: '56px 56px 40px',
        }}
      >
        {/* Logo kept as-is — red mark stays readable on the dark pane */}
        <div className="inline-flex items-center gap-3 self-start">
          <img
            src="/logo_rollingstone.png"
            alt="Rolling Stone France"
            className="h-10 w-auto"
            style={{ display: 'block' }}
          />
          <span
            className="serif italic"
            style={{ fontSize: 18, color: 'var(--paper)', lineHeight: 1 }}
          >
            Hebdo<span style={{ color: 'var(--rs-red)' }}>·</span>Delivery
          </span>
        </div>

        <div>
          <div className="eyebrow" style={{ color: 'var(--rs-red)' }}>
            Plateforme rédactionnelle
          </div>
          <h1
            className="serif"
            style={{
              fontSize: 64,
              lineHeight: 0.95,
              marginTop: 12,
              marginBottom: 18,
              fontStyle: 'italic',
              color: 'var(--paper)',
            }}
          >
            Livrez votre
            <br />
            papier en
            <br />
            quatre étapes.
          </h1>
          <p
            style={{
              fontSize: 15,
              color: 'rgba(245,240,230,0.72)',
              maxWidth: 360,
              lineHeight: 1.55,
            }}
          >
            Choisissez le type, rédigez, relisez, envoyez. Tout est
            sauvegardé automatiquement et déposé dans Dropbox.
          </p>
        </div>

        <div
          className="flex items-center gap-3"
          style={{ color: 'rgba(245,240,230,0.55)', fontSize: 12 }}
        >
          <span>Rolling Stone France</span>
          <span
            style={{
              width: 3,
              height: 3,
              background: 'currentColor',
              borderRadius: '50%',
            }}
          />
          <span>Hebdo Delivery — édition rédaction</span>
        </div>

        {/* magazine-strip decoration */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            right: -60,
            top: 60,
            width: 240,
            height: 340,
            background:
              'repeating-linear-gradient(0deg, rgba(225,29,46,0.08) 0 1px, transparent 1px 22px)',
            borderLeft: '3px solid var(--rs-red)',
            opacity: 0.6,
            transform: 'rotate(4deg)',
            pointerEvents: 'none',
          }}
        />
      </aside>

      {/* Right — form */}
      <div
        className="flex-1 flex items-center justify-center"
        style={{ padding: 40 }}
      >
        <div className="w-full" style={{ maxWidth: 400 }}>
          {/* Mobile-only brand */}
          <div className="lg:hidden flex flex-col items-center text-center mb-8">
            <img
              src="/logo_rollingstone.png"
              alt="Rolling Stone France"
              className="h-12 mb-3"
            />
            <span
              className="serif italic"
              style={{ fontSize: 18, color: 'var(--ink)' }}
            >
              Hebdo<span style={{ color: 'var(--rs-red)' }}>·</span>Delivery
            </span>
          </div>

          <div className="eyebrow" style={{ marginBottom: 8 }}>
            Connexion
          </div>
          <h2
            className="serif"
            style={{ fontSize: 34, lineHeight: 1.05, marginBottom: 8 }}
          >
            Bon retour parmi nous.
          </h2>
          <p
            className="text-sm"
            style={{ color: 'var(--muted)', marginBottom: 28 }}
          >
            Identifiez-vous avec l'email transmis par la rédaction en chef.
          </p>

          {error && (
            <div
              className="rs-banner red flex items-center gap-2 mb-4"
              role="alert"
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label
                htmlFor="email"
                className="block"
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--ink-2)',
                  marginBottom: 6,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Email
              </label>
              <div className="rs-input-wrap">
                <span className="lead">
                  <Mail size={16} />
                </span>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="prenom@rollingstone.fr"
                  required
                  autoComplete="email"
                  className="rs-input with-icon"
                />
              </div>
            </div>

            <div style={{ marginBottom: 8 }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                <label
                  htmlFor="password"
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: 'var(--ink-2)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  Mot de passe
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs"
                  style={{ color: 'var(--rs-red)' }}
                >
                  Oublié ?
                </Link>
              </div>
              <div className="rs-input-wrap">
                <span className="lead">
                  <Lock size={16} />
                </span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Votre mot de passe"
                  required
                  autoComplete="current-password"
                  className="rs-input with-icon"
                  style={{ paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="trail"
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Masquer' : 'Afficher'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="rs-btn primary lg w-full"
              style={{ marginTop: 16 }}
            >
              {loading ? 'Connexion…' : (
                <>
                  Se connecter <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div
            className="flex items-center justify-center gap-2"
            style={{ marginTop: 22, color: 'var(--muted)' }}
          >
            <span style={{ width: 14, height: 1, background: 'var(--border-strong)' }} />
            <span style={{ fontSize: 11 }}>Pas encore de compte&nbsp;?</span>
            <span style={{ width: 14, height: 1, background: 'var(--border-strong)' }} />
          </div>
          <p
            className="text-center"
            style={{
              fontSize: 12,
              color: 'var(--muted)',
              marginTop: 10,
            }}
          >
            Contactez votre rédaction en chef pour recevoir vos identifiants.
          </p>
        </div>
      </div>
    </div>
  );
}
