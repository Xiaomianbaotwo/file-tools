import { useStore } from '../store/useStore';
import { Download, Archive } from 'lucide-react';
import { useZipDownload } from '../hooks/useZipDownload';
import { useLang } from '../context/LangContext';

export default function DownloadPanel() {
  const files = useStore(s => s.files);
  const doneFiles = files.filter(f => f.status === 'done');
  const { downloadAllAsZip, downloadAllSequentially } = useZipDownload();
  const { messages: t } = useLang();

  return (
    <div className="flex flex-col gap-2">
      <button
        disabled={doneFiles.length <= 1}
        onClick={downloadAllAsZip}
        className="flex items-center justify-center gap-2 bg-gray-800 text-white px-4 py-2 rounded-lg disabled:opacity-50 transition"
      >
        <Archive size={18} /> {t.downloadPanel.zip}
      </button>
      <button
        disabled={doneFiles.length === 0}
        onClick={downloadAllSequentially}
        className="flex items-center justify-center gap-2 bg-indigo-500 text-white px-4 py-2 rounded-lg disabled:opacity-50 transition"
      >
        <Download size={18} /> {t.downloadPanel.downloadAll}
      </button>
    </div>
  );
}