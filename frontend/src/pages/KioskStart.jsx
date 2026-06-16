import { useNavigate } from 'react-router-dom';
import { LogIn, LogOut } from 'lucide-react';
import { useKioskLang } from '../context/KioskLangContext';

const FLAG = { de: '🇩🇪', en: '🇬🇧' };
const LABEL = { de: 'DE', en: 'EN' };

export default function KioskStart() {
  const navigate = useNavigate();
  const { t, lang, setLang, languages } = useKioskLang();

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="kiosk-fade-up bg-abat-dunkelgrau py-8 px-8 flex items-center justify-between">
        <img src="/logo-light.png" alt="abat AG" className="h-12" />
        <div className="flex items-center gap-3">
          {languages.map(l => (
            <button key={l} onClick={() => setLang(l)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${lang === l ? 'bg-abat-blau text-white' : 'bg-white/10 text-abat-hellgrau hover:bg-white/20'}`}>
              {FLAG[l]} {LABEL[l]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12">
        <h1 className="kiosk-fade-up kiosk-delay-1 text-4xl font-bold text-abat-dunkelgrau text-center mb-3">{t('welcome')}</h1>
        <p className="kiosk-fade-up kiosk-delay-2 text-abat-metallic text-lg text-center mb-16">{t('pleaseChoose')}</p>

        <div className="grid grid-cols-1 gap-6 w-full max-w-lg">
          <button
            onClick={() => navigate('/kiosk/checkin')}
            className="kiosk-fade-up kiosk-delay-2 group flex items-center gap-6 bg-abat-blau hover:bg-primary-600 text-white rounded-2xl px-8 py-7 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98]">
            <div className="bg-white/20 rounded-xl p-3"><LogIn size={32} /></div>
            <div className="text-left">
              <p className="text-2xl font-bold">{t('checkin')}</p>
              <p className="text-white/70 text-sm mt-0.5">{t('checkinSub')}</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/kiosk/checkout')}
            className="kiosk-fade-up kiosk-delay-3 group flex items-center gap-6 bg-white hover:bg-gray-50 border-2 border-abat-hellgrau hover:border-abat-blau text-abat-dunkelgrau rounded-2xl px-8 py-7 transition-all shadow hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]">
            <div className="bg-abat-hellgrau rounded-xl p-3"><LogOut size={32} className="text-abat-dunkelgrau" /></div>
            <div className="text-left">
              <p className="text-2xl font-bold">{t('checkout')}</p>
              <p className="text-abat-metallic text-sm mt-0.5">{t('checkoutSub')}</p>
            </div>
          </button>

        </div>
      </div>

      <div className="kiosk-fade-up kiosk-delay-5 py-4 text-center text-xs text-abat-metallic border-t border-abat-hellgrau">
        {t('questions')}
      </div>
    </div>
  );
}
