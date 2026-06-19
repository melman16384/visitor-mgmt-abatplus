import { ArrowLeft } from 'lucide-react';
import { useKioskLang } from '../context/KioskLangContext';

const FLAG  = { de: '🇩🇪', en: '🇬🇧' };
const LABEL = { de: 'DE',   en: 'EN'  };

export default function KioskHeader({ onBack, title }) {
  const { lang, setLang, languages } = useKioskLang();

  return (
    <div className="flex-shrink-0">
      <div className="bg-abat-dunkelgrau px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="text-abat-hellgrau hover:text-white transition-colors active:scale-90 p-1 rounded-lg hover:bg-white/10">
            <ArrowLeft size={30} strokeWidth={2.5} />
          </button>
          <img src="/logo-light.png" alt="abat AG" className="h-9" />
          {title && <span className="text-white/30 select-none mx-1">|</span>}
          {title && <h1 className="text-white font-bold text-lg tracking-tight">{title}</h1>}
        </div>

        <div className="flex items-center gap-2">
          {languages.map(l => (
            <button key={l} onClick={() => setLang(l)}
              className={`px-3 py-1.5 rounded-full text-sm font-bold tracking-wide transition-all ${
                lang === l
                  ? 'bg-abat-blau text-white'
                  : 'text-abat-hellgrau hover:text-white border border-white/20 hover:border-white/40'
              }`}>
              {FLAG[l]} {LABEL[l]}
            </button>
          ))}
        </div>
      </div>
      <div className="h-0.5 bg-gradient-to-r from-abat-blau via-abat-hellblau to-abat-lichtblau" />
    </div>
  );
}
