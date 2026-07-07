import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import abatLogo from '../assets/abat-logo.png';

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" fill="none">
      <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
      <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
    </svg>
  );
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showLocal, setShowLocal] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const ssoError = params.get('error');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Anmeldung fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoft = () => {
    window.location.href = '/api/auth/microsoft';
  };

  return (
    <div className="min-h-screen bg-abat-dunkelgrau flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
        backgroundSize: '40px 40px'
      }} />

      <div className="relative w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-abat-dunkelgrau px-8 py-8 text-center">
            <img src={abatLogo} alt="abat AG" className="h-10 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-white">abat<span className="text-abat-hellblau">+</span> Besucherverwaltung</h1>
            <p className="text-abat-hellgrau text-sm mt-1">Eingangsregistrierung</p>
          </div>

          <div className="px-8 py-8 space-y-4">
            {(error || ssoError) && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
                <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                <span>{error || ssoError}</span>
              </div>
            )}

            {/* Primary: Microsoft SSO */}
            <button
              onClick={handleMicrosoft}
              className="w-full flex items-center justify-center gap-3 bg-white border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-3 px-4 rounded-xl transition-colors shadow-sm text-sm"
            >
              <MicrosoftIcon />
              Mit Microsoft-Konto anmelden
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">oder</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Local login (admin fallback) */}
            {!showLocal ? (
              <button
                onClick={() => setShowLocal(true)}
                className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors py-1"
              >
                Mit E-Mail & Passwort anmelden
              </button>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-abat-dunkelgrau mb-2">E-Mail</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-abat-hellgrau rounded-xl focus:outline-none focus:border-abat-blau text-sm transition-all"
                    placeholder="name@abat.de"
                    required
                    autoComplete="email"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-abat-dunkelgrau mb-2">Passwort</label>
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

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-abat-blau hover:bg-primary-600 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-xl transition-colors shadow-md text-sm"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Wird angemeldet…
                    </span>
                  ) : 'Anmelden'}
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-abat-hellgrau text-xs mt-6">
          © {new Date().getFullYear()} abat AG · Besucherverwaltung
        </p>
      </div>
    </div>
  );
}
