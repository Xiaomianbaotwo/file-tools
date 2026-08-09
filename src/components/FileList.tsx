import { useStore } from '../store/useStore';
import { X, Download, RotateCcw, RefreshCw } from 'lucide-react';
import { useFileConverter } from '../hooks/useFileConverter';
import { saveAs } from 'file-saver';
import { useLang } from '../context/LangContext';
import FileEditPanel from './FileEditPanel';

function formatFileSize(bytes: number) {
  if (!bytes || bytes < 0) return '未知';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = Math.floor(Math.log(bytes) / Math.log(1024));
  if (i >= units.length) i = units.length - 1;
  return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
}

export default function FileList() {
  const files = useStore(s => s.files);
  const removeFile = useStore(s => s.removeFile);
  const updateFileStatus = useStore(s => s.updateFileStatus);
  const { convertSingle } = useFileConverter();
  const { messages: t } = useLang();

  const downloadFile = (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (file && file.resultBlob) {
      const ext = file.targetFormat;
      const baseName = file.customName || file.file.name.replace(/\.[^/.]+$/, '');
      const name = baseName + '.' + ext;
      saveAs(file.resultBlob, name);
    }
  };

  const retryConvert = (fileId: string) => {
    updateFileStatus(fileId, 'pending', 0, null, '');
    convertSingle(fileId);
  };

  if (files.length === 0) {
    return (
      <div className="bg-white/70 backdrop-blur-lg rounded-xl border border-white/30 shadow-lg p-8 text-center text-gray-400">
        📭 {t.fileList.empty}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {files.map(file => (
        <div key={file.id} className="bg-white/70 backdrop-blur-lg rounded-xl border border-white/30 shadow-sm overflow-hidden">
          <div className="flex items-center p-3 gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{file.file.name}</p>
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                <span>{formatFileSize(file.file.size)}</span>
                {file.status === 'done' && <span className="text-green-500">✅ {t.fileList.statusDone}</span>}
                {file.status === 'error' && <span className="text-red-500">❌ {file.errorMsg}</span>}
                {file.status === 'converting' && <span className="text-yellow-500">🔄 {file.progress}%</span>}
                {file.status === 'pending' && <span className="text-gray-400">⏳ {t.fileList.statusPending}</span>}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {file.status === 'pending' && (
                <button onClick={() => convertSingle(file.id)} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition">
                  <RotateCcw size={16} /> {t.fileList.btnConvert}
                </button>
              )}
              {file.status === 'done' && (
                <>
                  <button onClick={() => downloadFile(file.id)} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-green-500 text-white rounded-lg hover:bg-green-600 transition">
                    <Download size={16} /> {t.fileList.btnDownload}
                  </button>
                  <button onClick={() => retryConvert(file.id)} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition">
                    <RefreshCw size={16} /> 重新转换
                  </button>
                </>
              )}
              {file.status === 'error' && (
                <button onClick={() => retryConvert(file.id)} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition">
                  <RefreshCw size={16} /> 重新转换
                </button>
              )}
              <button onClick={() => removeFile(file.id)} className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-white/80 text-red-500 border border-red-300 rounded-lg hover:bg-red-50 hover:border-red-400 transition">
                <X size={16} /> {t.fileList.btnDelete}
              </button>
            </div>
          </div>

          {file.status === 'converting' && (
            <div className="px-3 pb-2">
              <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                <div className="bg-indigo-500 h-2.5 rounded-full transition-all" style={{ width: `${file.progress}%` }} />
              </div>
              <p className="text-xs text-gray-500 text-right mt-1">{file.progress}%</p>
            </div>
          )}
          <div className="px-3 pb-3">
            <FileEditPanel fileItem={file} />
          </div>
        </div>
      ))}
    </div>
  );
}