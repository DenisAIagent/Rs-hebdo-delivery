import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase.ts';
import { useAuthStore } from '../stores/authStore.ts';
import { ShieldCheck, AlertCircle, LogOut, Copy } from 'lucide-react';
import toast from 'react-hot-toast';

type Mode = 'loading' | 'verify' | 'enroll';

/**
 * Double authentification (obligatoire pour tous les comptes).
 * - Compte deja configure : saisie du code TOTP a 6 chiffres.
 * - Premier passage : enrolement (QR code a scanner) puis verification.
 */
export function MfaPage() {
  const navigate = useNavigate();
  const { completeMfa, logout } = useAuthStore();

  const [mode, setMode] = useState<Mode>('loading');
  const [factorId, setFactorId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login', { replace: true });
        return;
      }

      // Session deja au niveau AAL2 (2FA passee) : on entre directement
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === 'aal2') {
        try {
          await completeMfa();
          navigate('/', { replace: true });
        } catch {
          setError('Impossible de charger votre profil. Reessayez.');
        }
        return;
      }

      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) {
        setError(listError.message);
        return;
      }

      const verified = (factors?.totp || []).find((f) => f.status === 'verified');
      if (verified) {
        setFactorId(verified.id);
        setMode('verify');
        return;
      }

      // Nettoie les enrolements abandonnes avant d'en creer un nouveau
      const stale = (factors?.all || []).filter((f) => f.status === 'unverified');
      for (const f of stale) {
        await supabase.auth.mfa.unenroll({ factorId: f.id }).catch(() => undefined);
      }

      const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'RS Hebdo Delivery',
      });
      if (enrollError || !enrollData) {
        setError(enrollError?.message || "Impossible de demarrer l'activation 2FA");
        return;
      }
      setFactorId(enrollData.id);
      setQrCode(enrollData.totp.qr_code);
      setSecret(enrollData.totp.secret);
      setMode('enroll');
    })();
  }, [navigate, completeMfa]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (code.trim().length !== 6 || submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
      if (challengeError || !challenge) throw new Error(challengeError?.message || 'Erreur 2FA');

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: code.trim(),
      });
      if (verifyError) throw new Error(verifyError.message);

      await completeMfa();
      if (mode === 'enroll') toast.success('Double authentification activee !');
      navigate('/', { replace: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      setError(/invalid|expired/i.test(msg) ? 'Code invalide ou expire. Reessayez.' : (msg || 'Erreur de verification'));
      setCode('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      toast.success('Cle copiee');
    } catch {
      toast.error('Copie impossible');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--paper)', padding: 24 }}>
      <div className="w-full" style={{ maxWidth: 440 }}>
        <div className="flex flex-col items-center text-center mb-6">
          <img src="/logo_rollingstone.png" alt="Rolling Stone France" className="h-10 mb-3" />
          <span className="serif italic" style={{ fontSize: 16, color: 'var(--ink)' }}>
            Hebdo<span style={{ color: 'var(--rs-red)' }}>·</span>Delivery
          </span>
        </div>

        <div
          style={{
            background: 'var(--paper-2, #fff)',
            border: '1px solid var(--border-strong, #e5e0d5)',
            borderRadius: 14,
            padding: '28px 28px 24px',
          }}
        >
          <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
            <ShieldCheck size={18} style={{ color: 'var(--rs-red)' }} />
            <span className="eyebrow">Double authentification</span>
          </div>

          {mode === 'loading' && !error && (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-rs-red border-t-transparent" />
            </div>
          )}

          {mode === 'enroll' && (
            <>
              <h2 className="serif" style={{ fontSize: 26, lineHeight: 1.1, marginBottom: 8 }}>
                Activez la 2FA pour continuer.
              </h2>
              <p className="text-sm" style={{ color: 'var(--muted)', marginBottom: 18 }}>
                La double authentification est obligatoire. Scannez ce QR code avec une application
                d'authentification (Google Authenticator, 1Password, Authy…), puis saisissez le code a 6 chiffres.
              </p>
              <div className="flex justify-center" style={{ marginBottom: 12 }}>
                {qrCode && (
                  <img
                    src={qrCode}
                    alt="QR code d'activation 2FA"
                    width={176}
                    height={176}
                    style={{ background: '#fff', borderRadius: 10, border: '1px solid var(--border-strong, #e5e0d5)', padding: 8 }}
                  />
                )}
              </div>
              <button
                type="button"
                onClick={copySecret}
                className="flex items-center gap-1.5 mx-auto text-xs"
                style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 18 }}
                title="Si vous ne pouvez pas scanner, saisissez cette cle manuellement dans l'application"
              >
                <Copy size={12} />
                <code className="font-mono">{secret}</code>
              </button>
            </>
          )}

          {mode === 'verify' && (
            <>
              <h2 className="serif" style={{ fontSize: 26, lineHeight: 1.1, marginBottom: 8 }}>
                Code de verification.
              </h2>
              <p className="text-sm" style={{ color: 'var(--muted)', marginBottom: 18 }}>
                Saisissez le code a 6 chiffres affiche par votre application d'authentification.
              </p>
            </>
          )}

          {error && (
            <div className="rs-banner red flex items-center gap-2 mb-4" role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {mode !== 'loading' && (
            <form onSubmit={handleSubmit}>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                autoFocus
                className="rs-input w-full text-center font-mono"
                style={{ fontSize: 24, letterSpacing: '0.4em' }}
              />
              <button
                type="submit"
                disabled={submitting || code.length !== 6}
                className="rs-btn primary lg w-full"
                style={{ marginTop: 14 }}
              >
                {submitting ? 'Verification…' : mode === 'enroll' ? 'Activer et continuer' : 'Verifier'}
              </button>
            </form>
          )}
        </div>

        <div className="text-center" style={{ marginTop: 16 }}>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 text-xs"
            style={{ color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            <LogOut size={12} />
            Se deconnecter
          </button>
          <p className="text-xs" style={{ color: 'var(--muted)', marginTop: 10 }}>
            Telephone perdu ? Contactez un administrateur pour reinitialiser votre 2FA.
          </p>
        </div>
      </div>
    </div>
  );
}
