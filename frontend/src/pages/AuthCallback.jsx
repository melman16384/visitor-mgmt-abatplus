import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AuthCallback() {
  const [params] = useSearchParams();
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const token = params.get('token');
    const error = params.get('error');

    if (token) {
      loginWithToken(token);
      navigate('/dashboard', { replace: true });
    } else {
      const msg = {
        sso_failed: 'SSO-Anmeldung fehlgeschlagen.',
        sso_cancelled: 'Anmeldung abgebrochen.',
        sso_token_failed: 'Token-Fehler. Bitte erneut versuchen.',
        no_email: 'Kein E-Mail-Konto gefunden.',
      }[error] || 'Anmeldung fehlgeschlagen.';
      navigate(`/login?error=${encodeURIComponent(msg)}`, { replace: true });
    }
  }, []);

  return (
    <div className="min-h-screen bg-abat-dunkelgrau flex items-center justify-center">
      <div className="text-white text-sm flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        Wird angemeldet…
      </div>
    </div>
  );
}
