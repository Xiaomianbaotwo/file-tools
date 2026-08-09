import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useFFmpeg } from '../hooks/useFFmpeg';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useLang } from '../context/LangContext';
import { saveAs } from 'file-saver';
import { Music, Loader2, Mic, MicOff, X, ChevronDown, ChevronUp, ImageIcon, Trash2, Play, Pause } from 'lucide-react';

interface AudioFileItem {
  id: string;
  file: File;
  outputFormat: string;
  bitrate: string;
  startTime: number;
  endTime: number;
  duration: number;
  volume: number;
  coverFile: File | null;
  coverPreview: string;
  converting: boolean;
  convProgress: number;
  resultBlob: Blob | null;
}

const PRESET_BITRATES = ['', '128k', '192k', '256k', '320k'];

export default function MusicConverter() {
  const { messages: t } = useLang();
  const { load, loaded, loading, progress, processAudio } = useFFmpeg();
  const { isRecording, audioBlob, error: recError, startRecording, stopRecording } = useAudioRecorder();

  const [fileItems, setFileItems] = useState<AudioFileItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [globalBitrate, setGlobalBitrate] = useState('');
  const [globalOutputFormat, setGlobalOutputFormat] = useState('mp3');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 播放器相关
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  useEffect(() => { load(); }, [load]);

  // 清理播放器
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
        audioRef.current = null;
      }
    };
  }, []);

  // 录音完成后自动添加
  useEffect(() => {
    if (audioBlob) {
      const id = `rec_${Date.now()}`;
      const newFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });
      const item = createFileItem(id, newFile);
      setFileItems(prev => [...prev, item]);
    }
  }, [audioBlob]);

  const createFileItem = (id: string, file: File): AudioFileItem => ({
    id,
    file,
    outputFormat: globalOutputFormat,
    bitrate: globalBitrate,
    startTime: 0,
    endTime: 0,
    duration: 0,
    volume: 100,
    coverFile: null,
    coverPreview: '',
    converting: false,
    convProgress: 0,
    resultBlob: null,
  });

  const addFiles = useCallback((files: FileList | File[]) => {
    const newItems: AudioFileItem[] = [];
    for (const file of Array.from(files)) {
      const id = `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      newItems.push(createFileItem(id, file));
    }
    setFileItems(prev => [...prev, ...newItems]);
  }, [globalOutputFormat, globalBitrate]);

  const removeFile = (id: string) => {
    if (playingId === id) stopPlay();
    setFileItems(prev => prev.filter(item => item.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const updateItem = (id: string, updates: Partial<AudioFileItem>) => {
    setFileItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  // 获取音频时长（用于修剪）
  useEffect(() => {
    fileItems.forEach(item => {
      if (item.duration === 0) {
        const audio = new Audio();
        audio.src = URL.createObjectURL(item.file);
        audio.addEventListener('loadedmetadata', () => {
          updateItem(item.id, { duration: audio.duration, endTime: audio.duration });
        });
      }
    });
  }, [fileItems.length]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      e.target.value = '';
    }
  };

  const handleCoverSelect = (id: string, file: File) => {
    const img = new Image();
    img.onload = () => {
      if (img.width < 128 || img.height < 128) { alert('封面尺寸需≥128×128'); return; }
      if (img.width !== img.height) { alert('封面必须为1:1正方形'); return; }
      updateItem(id, { coverFile: file, coverPreview: URL.createObjectURL(file) });
    };
    img.src = URL.createObjectURL(file);
  };

  // 播放转换后的音频
  const togglePlay = (id: string) => {
    const item = fileItems.find(i => i.id === id);
    if (!item?.resultBlob) return;

    if (playingId === id) {
      // 暂停
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      // 停止之前的播放
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
      // 播放新的
      const url = URL.createObjectURL(item.resultBlob);
      const audio = new Audio(url);
      audio.play();
      audioRef.current = audio;
      setPlayingId(id);

      audio.onended = () => {
        URL.revokeObjectURL(audio.src);
        setPlayingId(null);
        audioRef.current = null;
      };
    }
  };

  const stopPlay = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      URL.revokeObjectURL(audioRef.current.src);
      audioRef.current = null;
    }
    setPlayingId(null);
  };

  // 转换单个文件
  const convertSingle = async (id: string) => {
    const item = fileItems.find(i => i.id === id);
    if (!item || !loaded) return;
    updateItem(id, { converting: true, convProgress: 0 });
    try {
      const blob = await processAudio(
        item.file,
        {
          outputFormat: item.outputFormat,
          startTime: item.startTime || undefined,
          endTime: item.endTime && item.endTime < item.duration ? item.endTime : undefined,
          volume: item.volume !== 100 ? item.volume : undefined,
          coverFile: item.coverFile || undefined,
          bitrate: item.bitrate || undefined,
        },
        (p) => updateItem(id, { convProgress: p })
      );
      updateItem(id, { converting: false, resultBlob: blob });
    } catch (err: any) {
      alert(t.music.error + ': ' + err.message);
      updateItem(id, { converting: false });
    }
  };

  const downloadSingle = (id: string) => {
    const item = fileItems.find(i => i.id === id);
    if (item?.resultBlob) {
      const baseName = item.file.name.replace(/\.[^/.]+$/, '') || 'audio';
      saveAs(item.resultBlob, `${baseName}.${item.outputFormat}`);
    }
  };

  const convertAll = async () => {
    for (const item of fileItems) {
      if (!item.resultBlob) await convertSingle(item.id);
    }
  };

  const acceptFormats = '.mp3,.ogg,.flac,.wav,.m4s,.mp4,.webm';

  return (
    <div className="max-w-[800px] mx-auto py-8 px-4">
      <h2 className="text-3xl font-bold text-center mb-2">{t.music.title}</h2>
      <p className="text-center text-gray-500 mb-6">{t.music.subtitle}</p>

      {!loaded && (
        <div className="glass-panel p-6 text-center">
          <Loader2 className="animate-spin mx-auto mb-2" size={32} />
          <p className="text-lg font-medium">{t.music.loading}</p>
          <div className="w-full bg-gray-200 rounded-full h-3 mt-2 overflow-hidden">
            <div className="bg-indigo-500 h-3 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {loaded && (
        <>
          {/* 上传区 */}
          <div
            className="glass-panel p-8 text-center border-2 border-dashed border-gray-300 hover:border-indigo-300 cursor-pointer mb-4"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Music className="mx-auto text-5xl text-indigo-400 mb-3" />
            <p className="text-lg font-medium">{t.music.upload}</p>
            <p className="text-sm text-gray-400 mt-1">{t.music.uploadHint}</p>
            <input ref={fileInputRef} type="file" className="hidden" multiple accept={acceptFormats} onChange={handleFileSelect} />
          </div>

          {/* 全局设置 + 操作按钮 */}
          <div className="glass-panel p-4 mb-4 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <label className="text-sm font-medium">{t.music.outputFormat}:</label>
                <select value={globalOutputFormat} onChange={(e) => {
                  setGlobalOutputFormat(e.target.value);
                  fileItems.forEach(item => updateItem(item.id, { outputFormat: e.target.value }));
                }} className="border rounded px-2 py-1 text-sm ml-2">
                  <option value="mp3">MP3</option>
                  <option value="ogg">OGG</option>
                  <option value="flac">FLAC</option>
                  <option value="wav">WAV</option>
                  <option value="m4a">M4A</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">{t.music.bitrate?.label || '码率'}:</label>
                <select value={globalBitrate} onChange={(e) => {
                  setGlobalBitrate(e.target.value);
                  fileItems.forEach(item => updateItem(item.id, { bitrate: e.target.value }));
                }} className="border rounded px-2 py-1 text-sm ml-2">
                  <option value="">{t.music.bitrate?.default || '默认'}</option>
                  {PRESET_BITRATES.filter(b => b !== '').map(br => (
                    <option key={br} value={br}>{br}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={convertAll} disabled={fileItems.length === 0} className="px-4 py-2 bg-indigo-500 text-white rounded-lg flex items-center gap-1 font-medium">
                🚀 {t.actions.convertAll}
              </button>
              <button onClick={() => setFileItems([])} disabled={fileItems.length === 0} className="px-4 py-2 bg-white/80 border border-gray-300 rounded-lg flex items-center gap-1 text-red-500 hover:bg-red-50 font-medium">
                <Trash2 size={16} /> {t.actions.clearList}
              </button>
              {!isRecording ? (
                <button onClick={startRecording} className="px-4 py-2 bg-red-500 text-white rounded-lg flex items-center gap-1 font-medium">
                  <Mic size={16} /> {t.music.recorder.start}
                </button>
              ) : (
                <button onClick={stopRecording} className="px-4 py-2 bg-gray-800 text-white rounded-lg flex items-center gap-1 animate-pulse font-medium">
                  <MicOff size={16} /> {t.music.recorder.stop}
                </button>
              )}
            </div>
            {recError && <span className="text-red-500 text-xs w-full">{recError}</span>}
          </div>

          {/* 文件列表 */}
          {fileItems.map(item => (
            <div key={item.id} className="glass-panel p-3 mb-3">
              <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {expandedId === item.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  <span className="font-medium truncate">{item.file.name}</span>
                  <span className="text-xs text-gray-400">{(item.file.size / 1024 / 1024).toFixed(1)} MB</span>
                  {item.resultBlob && <span className="text-green-500 text-xs ml-2">✅ 完成</span>}
                </div>
                <div className="flex items-center gap-2 ml-2">
                  {/* 转换完成后的播放按钮 */}
                  {item.resultBlob && (
                    <button
                      onClick={(e) => { e.stopPropagation(); togglePlay(item.id); }}
                      className={`p-1.5 rounded-full ${playingId === item.id ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      title={playingId === item.id ? '暂停' : '播放'}
                    >
                      {playingId === item.id ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                  )}
                  {!item.resultBlob && !item.converting && (
                    <button onClick={(e) => { e.stopPropagation(); convertSingle(item.id); }} className="px-3 py-1 bg-indigo-500 text-white rounded text-sm font-medium hover:bg-indigo-600">转换</button>
                  )}
                  {item.resultBlob && (
                    <button onClick={(e) => { e.stopPropagation(); downloadSingle(item.id); }} className="px-3 py-1 bg-green-500 text-white rounded text-sm font-medium hover:bg-green-600">💾 下载</button>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); removeFile(item.id); }} className="text-red-500 hover:bg-red-50 rounded p-1"><X size={14} /></button>
                </div>
              </div>

              {/* 进度条 */}
              {item.converting && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-indigo-600">🔄 转换中</span>
                    <span className="text-xs font-bold text-indigo-700">{item.convProgress.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden shadow-inner">
                    <div
                      className="bg-gradient-to-r from-indigo-500 to-purple-600 h-4 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${item.convProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* 展开的详细设置面板 */}
              {expandedId === item.id && (
                <div className="mt-4 p-3 bg-gray-50/80 rounded-lg space-y-3 border">
                  <div className="flex gap-4 flex-wrap">
                    <div>
                      <label className="text-xs font-medium">{t.music.outputFormat}:</label>
                      <select value={item.outputFormat} onChange={(e) => updateItem(item.id, { outputFormat: e.target.value })} className="border rounded px-2 py-1 text-xs ml-1">
                        <option value="mp3">MP3</option>
                        <option value="ogg">OGG</option>
                        <option value="flac">FLAC</option>
                        <option value="wav">WAV</option>
                        <option value="m4a">M4A</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium">{t.music.bitrate?.label || '码率'}:</label>
                      <select value={item.bitrate} onChange={(e) => updateItem(item.id, { bitrate: e.target.value })} className="border rounded px-2 py-1 text-xs ml-1">
                        <option value="">{t.music.bitrate?.default || '默认'}</option>
                        {PRESET_BITRATES.filter(b => b !== '').map(br => (
                          <option key={br} value={br}>{br}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-1">{t.music.trim.title}</p>
                    <p className="text-xs text-gray-400">时长: {item.duration.toFixed(1)} 秒</p>
                    <div className="flex gap-2 items-center mt-1">
                      <input type="number" min={0} max={item.duration} step={0.1} value={item.startTime} onChange={(e) => updateItem(item.id, { startTime: Math.max(0, parseFloat(e.target.value) || 0) })} className="w-20 border rounded px-2 py-1 text-xs" placeholder="开始" />
                      <span className="text-xs">-</span>
                      <input type="number" min={0} max={item.duration} step={0.1} value={item.endTime} onChange={(e) => updateItem(item.id, { endTime: Math.min(item.duration, parseFloat(e.target.value) || 0) })} className="w-20 border rounded px-2 py-1 text-xs" placeholder="结束" />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-1">{t.music.volume.title}</p>
                    <div className="flex items-center gap-2">
                      <input type="range" min={1} max={500} value={item.volume} onChange={(e) => updateItem(item.id, { volume: parseInt(e.target.value) })} className="w-32" />
                      <input type="number" min={1} max={500} value={item.volume} onChange={(e) => updateItem(item.id, { volume: parseInt(e.target.value) || 100 })} className="w-14 border rounded px-1 py-0.5 text-xs text-center" />
                      <span className="text-xs">%</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-1">{t.music.cover.title}</p>
                    <div className="flex items-center gap-2">
                      <label className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs cursor-pointer">
                        <ImageIcon size={12} className="inline mr-1" />{t.music.cover.uploadCover}
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleCoverSelect(item.id, e.target.files[0])} />
                      </label>
                      {item.coverFile && (
                        <button onClick={() => updateItem(item.id, { coverFile: null, coverPreview: '' })} className="text-xs text-red-500 hover:underline">{t.music.cover.resetCover}</button>
                      )}
                    </div>
                    {item.coverPreview && (
                      <img src={item.coverPreview} alt="cover" className="w-16 h-16 object-cover rounded border mt-1" />
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}