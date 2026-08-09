import { useStore } from '../store/useStore';
import { useLang } from '../context/LangContext';

export default function QualityControl() {
  const quality = useStore(s => s.globalQuality);
  const setQuality = useStore(s => s.setGlobalQuality);
  const { messages: t } = useLang();

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium whitespace-nowrap">{t.qualityControl.label}</label>
      <input
        type="number"
        min={5}
        max={100}
        value={quality}
        onChange={(e) => setQuality(+e.target.value)}
        className="w-16 border rounded px-2 py-1 text-sm text-center"
      />
      <span className="text-sm font-medium">%</span>
    </div>
  );
}