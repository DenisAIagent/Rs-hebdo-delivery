import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore.ts';
import { getNextHebdo } from '../services/api.ts';
import type { HebdoConfig } from '../types/index.ts';
import { isAdminRole } from '../types/index.ts';
import { LogOut, HelpCircle, Sparkles } from 'lucide-react';

declare global {
  interface Window {
    $crisp: any[];
  }
}

interface LayoutProps {
  children: React.ReactNode;
  saveLabel?: string | null;
}

export function Layout({ children, saveLabel = null }: LayoutProps) {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [hebdo, setHebdo] = useState<HebdoConfig | null>(null);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Push user info to Crisp chat widget
  useEffect(() => {
    if (user && window.$crisp) {
      window.$crisp.push(['set', 'user:email', [user.email]]);
      window.$crisp.push(['set', 'user:nickname', [user.full_name]]);
    }
  }, [user]);

  // Load current hebdo (for issue chip in topbar)
  useEffect(() => {
    let mounted = true;
    getNextHebdo()
      .then((h) => {
        if (mounted) setHebdo(h);
      })
      .catch(() => {
        // Silent fail — topbar chip is optional
      });
    return () => {
      mounted = false;
    };
  }, []);

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const initials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((s) => s[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U';

  const handleReplayTour = () => {
    if (user) {
      localStorage.removeItem(`rs-onboarding-done-${user.id}`);
    }
    navigate('/onboarding');
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--paper)' }}>
      {/* Editorial topbar */}
      <header
        className="sticky top-0 z-40"
        style={{
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 h-16">
            {/* Left — Logo + issue chip */}
            <div className="flex items-center gap-5">
              <Link to="/" className="flex items-center gap-3">
                <img
                  src="/logo-rs-france.png"
                  alt="Rolling Stone France"
                  className="h-8 w-auto"
                />
                <span
                  className="hidden md:inline serif italic"
                  style={{ fontSize: 18, color: 'var(--ink)', lineHeight: 1 }}
                >
                  Hebdo<span style={{ color: 'var(--rs-red)' }}>·</span>Delivery
                </span>
              </Link>
              {hebdo && (
                <span
                  className="hidden lg:inline-flex items-center gap-2"
                  style={{
                    padding: '5px 10px 5px 8px',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-pill)',
                    fontSize: 12,
                    color: 'var(--muted)',
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--rs-red)',
                    }}
                  />
                  Numéro en cours · {hebdo.label}
                </span>
              )}
            </div>

            {/* Center — Nav */}
            <nav className="flex items-center gap-1">
              <NavLink to="/" active={isActive('/')}>
                Mon espace
              </NavLink>
              <NavLink to="/livrer" active={isActive('/livrer')}>
                Livrer un papier
              </NavLink>
              {isAdminRole(user?.role) && (
                <NavLink to="/admin" active={isActive('/admin')}>
                  Admin
                </NavLink>
              )}
            </nav>

            {/* Right — actions + user */}
            <div className="flex items-center gap-3">
              {saveLabel && (
                <span
                  className="hidden md:inline-flex items-center gap-2"
                  style={{ fontSize: 12, color: 'var(--muted)' }}
                >
                  <span
                    className="pulse-dot"
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--ok)',
                    }}
                  />
                  {saveLabel}
                </span>
              )}
              <button
                onClick={handleReplayTour}
                className="rs-btn ghost sm hidden sm:inline-flex"
                title="Revoir la présentation"
                style={{ padding: '6px 12px' }}
              >
                <Sparkles size={14} />
                Revoir le tour
              </button>
              <button
                className="rs-btn icon"
                title="Aide"
                onClick={() => window.open('https://rollingstone.fr', '_blank')}
              >
                <HelpCircle size={18} />
              </button>
              <div
                className="flex items-center gap-2.5"
                style={{
                  padding: '4px 4px 4px 12px',
                  borderRadius: 'var(--r-pill)',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                }}
              >
                <span
                  className="hidden sm:inline"
                  style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}
                >
                  {user?.full_name}
                </span>
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'var(--rs-red)',
                    color: 'white',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {initials}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="rs-btn icon"
                title="Déconnexion"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main
        className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8"
        style={{ background: 'var(--paper)' }}
      >
        {children}
      </main>

      {/* Footer */}
      <footer
        className="py-4 text-center"
        style={{
          borderTop: '1px solid var(--border)',
          background: 'var(--surface)',
        }}
      >
        <p style={{ fontSize: 11, color: 'var(--muted)' }}>
          <span className="serif italic" style={{ color: 'var(--ink)' }}>
            Rolling Stone France
          </span>
          {' '}·{' '}Plateforme de livraison Hebdo
        </p>
      </footer>
    </div>
  );
}

interface NavLinkProps {
  to: string;
  active: boolean;
  children: React.ReactNode;
}

function NavLink({ to, active, children }: NavLinkProps) {
  return (
    <Link
      to={to}
      style={{
        padding: '8px 14px',
        borderRadius: 'var(--r-md)',
        fontSize: 13,
        fontWeight: 500,
        color: active ? 'var(--paper)' : 'var(--muted)',
        background: active ? 'var(--ink)' : 'transparent',
        transition: 'all 0.15s var(--ease)',
        textDecoration: 'none',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = 'var(--paper-2)';
          (e.currentTarget as HTMLElement).style.color = 'var(--ink)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = 'transparent';
          (e.currentTarget as HTMLElement).style.color = 'var(--muted)';
        }
      }}
    >
      {children}
    </Link>
  );
}
