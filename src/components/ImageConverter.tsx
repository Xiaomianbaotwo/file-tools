import { useState, useMemo } from 'react';
import { useStore } from '../store/useStore';
import { useFileConverter } from '../hooks/useFileConverter';
import { useLang } from '../context/LangContext';
import UploadZone from './UploadZone';
import FileList from './FileList';
import FormatSelector from './FormatSelector';
import QualityControl from './QualityControl';
import DownloadPanel from './DownloadPanel';
import { Trash2, RefreshCw } from 'lucide-react';

export default function ImageConverter() {
  const { convertSingle } = useFileConverter();
  const clearAll = useStore(s => s.clearAll);
  const files = useStore(s => s.files);
  const updateFileStatus = useStore(s => s.updateFileStatus);
  const { messages: t } = useLang();

  const [totalProgress, setTotalProgress] = useState(0);
  const [isConvertingAll, setIsConvertingAll] = useState(false);

  const pendingCount = useMemo(
    () => files.filter(f => f.status === 'pending' || f.status === 'error').length,
    [files]
  );
  const doneCount = useMemo(() => files.filter(f => f.status === 'done').length, [files]);

  // 一键转换（处理 pending 和 error）
  const convertAll = async () => {
    const pending = files.filter(f => f.status === 'pending' || f.status === 'error');
    if (pending.length === 0) return;
    setIsConvertingAll(true);
    let completed = 0;
    if (pending.length > 1) setTotalProgress(0);
    for (const item of pending) {
      await convertSingle(item.id);
      completed++;
      if (pending.length > 1) setTotalProgress((completed / pending.length) * 100);
    }
    setIsConvertingAll(false);
  };

  // 重新转换全部：直接重置状态并逐个转换，不再依赖 convertAll 的异步状态更新
  const retryAll = async () => {
    const doneOrError = files.filter(f => f.status === 'done' || f.status === 'error');
    if (doneOrError.length === 0) return;
    setIsConvertingAll(true);
    // 重置所有已完成/错误文件的状态
    for (const f of doneOrError) {
      updateFileStatus(f.id, 'pending', 0, null, '');
    }
    // 逐个转换
    let completed = 0;
    for (const f of doneOrError) {
      await convertSingle(f.id);
      completed++;
      setTotalProgress((completed / doneOrError.length) * 100);
    }
    setIsConvertingAll(false);
  };

  return (
    <div className="max-w-[1200px] mx-auto py-8 px-4">
      <header className="text-center mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">{t.app.title}</h1>
        <p className="text-gray-500 mt-2">{t.app.subtitle}</p>
      </header>

      <div className="flex gap-6">
        <div className="flex-1 space-y-4">
          <UploadZone />
          {/* 总进度条（批量 >1 时显示） */}
          {isConvertingAll && (doneCount > 0 || pendingCount > 0) && (
            <div className="bg-white/80 backdrop-blur rounded-xl p-3 border">
              <div className="flex justify-between text-sm mb-1">
                <span>🚀 批量转换总进度</span>
                <span>{totalProgress.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div className="bg-indigo-500 h-3 rounded-full transition-all" style={{ width: `${totalProgress}%` }} />
              </div>
            </div>
          )}
          <FileList />
        </div>

        <div className="w-80 space-y-4">
          <div className="glass-panel p-4">
            <FormatSelector />
            <div className="mt-3"><QualityControl /></div>
            <div className="mt-4 space-y-2">
              <button onClick={convertAll} disabled={isConvertingAll || pendingCount === 0}
                className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition">
                🚀 {t.actions.convertAll}
              </button>
              {doneCount > 0 && (
                <button onClick={retryAll}
                  className="w-full py-2 flex items-center justify-center gap-2 bg-yellow-500 text-white rounded-xl font-medium hover:bg-yellow-600 transition">
                  <RefreshCw size={18} /> 重新转换全部
                </button>
              )}
              <DownloadPanel />
              <button onClick={clearAll}
                className="w-full py-2 flex items-center justify-center gap-2 bg-white/80 backdrop-blur text-gray-700 border border-gray-300 rounded-xl hover:bg-red-50 hover:border-red-300 transition">
                <Trash2 size={18} /> {t.actions.clearList}
              </button>
            </div>
          </div>
          <StatsPanel />
        </div>
      </div>
    </div>
  );
}

function StatsPanel() {
  const files = useStore(s => s.files);
  const { messages: t } = useLang();
  const total = files.length;
  const done = files.filter(f => f.status === 'done').length;
  const pending = files.filter(f => f.status === 'pending' || f.status === 'converting').length;
  const errors = files.filter(f => f.status === 'error').length;
  return (
    <div className="glass-panel p-4 text-sm">
      <h3 className="font-semibold mb-2">{t.stats.title}</h3>
      <div className="grid grid-cols-2 gap-2">
        <span>{t.stats.total}: {total}</span>
        <span>{t.stats.done}: {done}</span>
        <span>{t.stats.pending}: {pending}</span>
        <span>{t.stats.error}: {errors}</span>
      </div>
    </div>
  );
}