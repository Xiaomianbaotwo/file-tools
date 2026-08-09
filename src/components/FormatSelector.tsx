import { useStore } from '../store/useStore';
import { useLang } from '../context/LangContext';

export default function FormatSelector() {
  const globalFormat = useStore(s => s.globalFormat);
  const setGlobalFormat = useStore(s => s.setGlobalFormat);
  const { messages: t } = useLang();

  return (
    <div className="flex items-center gap-3">
      <label className="text-sm font-medium">{t.formatSelector.label}</label>
      <select
        value={globalFormat}
        onChange={(e) => setGlobalFormat(e.target.value)}
        className="border rounded px-3 py-1 text-sm"
      >
        {['png','jpg','webp','avif','bmp','ico','tiff'].map(f => (
          <option key={f} value={f}>{f.toUpperCase()}</option>
        ))}
      </select>
    </div>
  );
}