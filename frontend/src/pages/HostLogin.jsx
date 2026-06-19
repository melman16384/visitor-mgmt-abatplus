import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
      <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
    </svg>
  );
}

export default function HostLogin() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ssoAvailable, setSsoAvailable] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Handle redirect back from Microsoft SSO (?token= or ?error=)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const err = params.get('error');
    if (token) {
      localStorage.setItem('host_token', token);
      navigate('/host', { replace: true });
      return;
    }
    if (err) {
      const messages = {
        sso_not_configured: 'Microsoft SSO ist nicht konfiguriert.',
        invalid_state: 'Ungültige Anfrage. Bitte erneut versuchen.',
        no_email: 'Kein E-Mail-Konto im Microsoft-Profil gefunden.',
        auth_failed: 'Anmeldung fehlgeschlagen. Bitte erneut versuchen.',
        access_denied: 'Zugriff verweigert.',
      };
      setError(messages[err] || `Anmeldefehler: ${err}`);
      window.history.replaceState({}, '', '/host-login');
    }
  }, [location.search, navigate]);

  // Check if MS SSO is available (public endpoint, no auth needed)
  useEffect(() => {
    axios.get('/api/settings/ms-sso/status')
      .then(r => setSsoAvailable(r.data.available))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await axios.post('/api/host-portal/login', { email, password });
      localStorage.setItem('host_token', res.data.token);
      navigate('/host');
    } catch (err) {
      setError(err.response?.data?.error || t('login.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-abat-dunkelgrau flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
        backgroundSize: '40px 40px'
      }} />

      <div className="relative w-full max-w-xl">
        <div className="kiosk-fade-up bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-abat-dunkelgrau px-8 py-8 text-center">
            <img src="/logo-light.png" alt="abat AG" className="kiosk-pop-in h-14 mx-auto mb-4" />
            <h1 className="kiosk-fade-up kiosk-delay-1 text-2xl font-bold text-white">{t('login.hostPortalTitle')}</h1>
            <p className="kiosk-fade-up kiosk-delay-2 text-abat-hellgrau text-sm mt-1">{t('login.hostPortalSubtitle')}</p>
          </div>

          <div className="px-8 py-8 space-y-5">
            {error && (
              <div className="kiosk-fade-up flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
                <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Microsoft SSO */}
            {ssoAvailable && (
              <div className="kiosk-fade-up">
                <button
                  type="button"
                  onClick={() => { window.location.href = '/api/host-portal/auth/microsoft'; }}
                  className="w-full flex items-center justify-center gap-3 border-2 border-gray-200 hover:border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-semibold py-3 px-4 rounded-xl transition-all shadow-sm hover:shadow text-sm active:scale-[0.98]"
                >
                  <MicrosoftIcon />
                  Mit Microsoft anmelden
                </button>
                <div className="flex items-center gap-3 mt-5">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400 font-medium">oder mit E-Mail</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="kiosk-fade-up kiosk-delay-2">
                <label className="block text-sm font-semibold text-abat-dunkelgrau mb-2">{t('login.email')}</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-abat-hellgrau rounded-xl focus:outline-none focus:border-abat-blau text-sm transition-all"
                  placeholder="name@firma.de"
                  required
                  autoComplete="email"
                />
              </div>

              <div className="kiosk-fade-up kiosk-delay-3">
                <label className="block text-sm font-semibold text-abat-dunkelgrau mb-2">{t('login.password')}</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-abat-hellgrau rounded-xl focus:outline-none focus:border-abat-blau text-sm pr-12 transition-all"
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="kiosk-fade-up kiosk-delay-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-abat-blau hover:bg-primary-600 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-xl transition-colors shadow-md hover:shadow-lg text-sm active:scale-[0.98]"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {t('login.loggingIn')}
                    </span>
                  ) : t('login.submit')}
                </button>
              </div>
            </form>
          </div>
        </div>

        <p className="kiosk-fade-up kiosk-delay-5 text-center text-abat-hellgrau text-xs mt-6">
          © 2025 abat AG Besucherverwaltung
        </p>
      </div>
    </div>
  );
}
