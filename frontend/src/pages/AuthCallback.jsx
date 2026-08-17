import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';

export default function AuthCallback() {
  const [params] = useSearchParams();
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const code = params.get('code');
    const error = params.get('error');

    const fail = (msg) => navigate(`/login?error=${encodeURIComponent(msg)}`, { replace: true });

    const messages = {
      sso_failed: 'SSO-Anmeldung fehlgeschlagen.',
      sso_cancelled: 'Anmeldung abgebrochen.',
      sso_token_failed: 'Token-Fehler. Bitte erneut versuchen.',
      no_email: 'Kein E-Mail-Konto gefunden.',
      invalid_state: 'Sicherheitsprüfung fehlgeschlagen. Bitte erneut versuchen.',
      not_allowed: 'Diese E-Mail-Adresse ist nicht für die Anmeldung freigeschaltet.',
    };

    if (code) {
      client.post('/auth/microsoft/exchange', { code })
        .then(({ data }) => {
          loginWithToken(data.token);
          navigate('/dashboard', { replace: true });
        })
        .catch(() => fail('Anmeldung fehlgeschlagen.'));
    } else {
      fail(messages[error] || 'Anmeldung fehlgeschlagen.');
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
