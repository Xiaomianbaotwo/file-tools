import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useFFmpeg } from '../hooks/useFFmpeg';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useLang } from '../context/LangContext';
import { saveAs } from 'file-saver';
import {
  Music, Loader2, Mic, MicOff, X, ChevronDown, ChevronUp,
  ImageIcon, Trash2, Play, Pause, Clock, RefreshCw
} from 'lucide-react';

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
  lyrics: string;
  embedLyrics: boolean;
  saveLyricsFile: boolean;
  lyricsFormat: 'lrc' | 'smi';
}

const PRESET_BITRATES = ['', '128k', '192k', '256k', '320k'];

/* ========== LRC / SMI 转换工具 ========== */
function parseLrcLine(line: string) {
  const timeRegex = /\[(\d{1,3}):(\d{2})\.(\d{2,3})\]/g;
  const times: number[] = [];
  let match;
  while ((match = timeRegex.exec(line)) !== null) {
    const minutes = parseInt(match[1], 10);
    const seconds = parseInt(match[2], 10);
    let fraction = match[3];
    if (fraction.length === 2) fraction += '0';
    else if (fraction.length === 1) fraction += '00';
    const milliseconds = parseInt(fraction, 10);
    const totalMs = (minutes * 60 + seconds) * 1000 + milliseconds;
    times.push(totalMs);
  }
  const text = line.replace(timeRegex, '').trim();
  return { times, text };
}

function escapeXml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function lrcToSmi(lrcText: string): string {
  const lines = lrcText.split('\n');
  const subtitles: { start: number; text: string }[] = [];
  for (const rawLine of lines) {
    if (!rawLine.trim()) continue;
    const { times, text } = parseLrcLine(rawLine);
    if (times.length === 0 || !text) continue;
    for (const t of times) subtitles.push({ start: t, text });
  }
  if (subtitles.length === 0) throw new Error('没有有效的时间标签');
  subtitles.sort((a, b) => a.start - b.start);

  let smi = `<SAMI>\n<HEAD>\n<TITLE>Converted from LRC</TITLE>\n<STYLE TYPE="text/css">\n<!--\nP { margin-left: 1pt; margin-right: 1pt; margin-bottom: 1pt; margin-top: 1pt; text-align: center; font-size: 10pt; font-family: Arial, sans-serif; font-weight: normal; font-style: normal; color: #FFFFFF; }\n.CC { Name: CC; lang: zh-CN; SAMIType: CC; }\n-->\n</STYLE>\n</HEAD>\n<BODY>\n`;
  smi += `<SYNC Start=0>\n<P Class=CC>&nbsp;</P>\n`;
  for (const sub of subtitles) smi += `<SYNC Start=${sub.start}>\n<P Class=CC>${escapeXml(sub.text)}</P>\n`;
  smi += `</BODY>\n</SAMI>`;
  return smi;
}

function getProcessedLyrics(lrcText: string, format: 'lrc' | 'smi'): string {
  if (format === 'lrc' || !lrcText.trim()) return lrcText;
  return lrcToSmi(lrcText);
}

export default function MusicConverter() {
  const { messages: t } = useLang();
  const { load, loaded, loading, progress, processAudio } = useFFmpeg();
  const { isRecording, audioBlob, error: recError, startRecording, stopRecording } = useAudioRecorder();

  const [fileItems, setFileItems] = useState<AudioFileItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [globalBitrate, setGlobalBitrate] = useState('');
  const [globalOutputFormat, setGlobalOutputFormat] = useState('mp3');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playState, setPlayState] = useState({ currentTime: 0, duration: 0 });

  const [totalProgress, setTotalProgress] = useState(0);
  const [isConvertingAll, setIsConvertingAll] = useState(false);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
        audioRef.current = null;
      }
    };
  }, []);

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
    lyrics: '',
    embedLyrics: true,
    saveLyricsFile: false,
    lyricsFormat: 'lrc',
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
    if (playingId === id || playingId === `conv-${id}`) stopPlay();
    setFileItems(prev => prev.filter(item => item.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const updateItem = (id: string, updates: Partial<AudioFileItem>) => {
    setFileItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

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

  const stopPlay = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      URL.revokeObjectURL(audioRef.current.src);
      audioRef.current = null;
    }
    setPlayingId(null);
    setPlayState({ currentTime: 0, duration: 0 });
  };

  const togglePlayOriginal = (id: string) => {
    const item = fileItems.find(i => i.id === id);
    if (!item) return;
    if (playingId === id) { audioRef.current?.pause(); setPlayingId(null); return; }
    stopPlay();
    const url = URL.createObjectURL(item.file);
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.play();
    setPlayingId(id);
    audio.ontimeupdate = () => setPlayState({ currentTime: audio.currentTime, duration: audio.duration || 0 });
    audio.onloadedmetadata = () => setPlayState(p => ({ ...p, duration: audio.duration }));
    audio.onended = () => { stopPlay(); };
  };

  const togglePlayConverted = (id: string) => {
    const item = fileItems.find(i => i.id === id);
    if (!item?.resultBlob) return;
    const convId = `conv-${id}`;
    if (playingId === convId) { audioRef.current?.pause(); setPlayingId(null); return; }
    stopPlay();
    const url = URL.createObjectURL(item.resultBlob);
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.play();
    setPlayingId(convId);
    audio.ontimeupdate = () => setPlayState({ currentTime: audio.currentTime, duration: audio.duration || 0 });
    audio.onloadedmetadata = () => setPlayState(p => ({ ...p, duration: audio.duration }));
    audio.onended = () => { stopPlay(); };
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setPlayState(prev => ({ ...prev, currentTime: newTime }));
    }
  };

  const handleTimeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && audioRef.current) {
      audioRef.current.currentTime = Math.min(val, audioRef.current.duration || 0);
      setPlayState(prev => ({ ...prev, currentTime: audioRef.current!.currentTime }));
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const insertTimestamp = (id: string) => {
    const item = fileItems.find(i => i.id === id);
    if (!item || !audioRef.current) return;
    const time = audioRef.current.currentTime;
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    const ms = Math.floor((time % 1) * 100);
    const timestamp = `[${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms).padStart(2, '0')}]`;
    const textarea = document.getElementById(`lyrics-${id}`) as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newLyrics = item.lyrics.substring(0, start) + timestamp + item.lyrics.substring(end);
      updateItem(id, { lyrics: newLyrics });
      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + timestamp.length;
      }, 0);
    } else {
      updateItem(id, { lyrics: item.lyrics + timestamp });
    }
  };

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

  const convertSingle = async (id: string) => {
    const item = fileItems.find(i => i.id === id);
    if (!item || !loaded) return;
    updateItem(id, { converting: true, convProgress: 0 });
    try {
      let finalLyrics: string | undefined;
      if (item.embedLyrics && item.lyrics.trim() !== '') {
        finalLyrics = getProcessedLyrics(item.lyrics, item.lyricsFormat);
      }
      const blob = await processAudio(
        item.file,
        {
          outputFormat: item.outputFormat,
          startTime: item.startTime || undefined,
          endTime: item.endTime && item.endTime < item.duration ? item.endTime : undefined,
          volume: item.volume !== 100 ? item.volume : undefined,
          coverFile: item.coverFile || undefined,
          bitrate: item.bitrate || undefined,
          lyrics: finalLyrics,
        },
        (p) => updateItem(id, { convProgress: p })
      );
      updateItem(id, { converting: false, resultBlob: blob });

      if (item.saveLyricsFile && item.lyrics.trim() !== '') {
        const baseName = item.file.name.replace(/\.[^/.]+$/, '') || 'audio';
        const processed = getProcessedLyrics(item.lyrics, item.lyricsFormat);
        const ext = item.lyricsFormat === 'smi' ? 'smi' : 'lrc';
        const mime = ext === 'smi' ? 'application/smil+xml' : 'text/plain';
        const lyricBlob = new Blob([processed], { type: mime });
        saveAs(lyricBlob, `${baseName}.${ext}`);
      }
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

  // 单个文件重新转换
  const retryConvert = (id: string) => {
    updateItem(id, {
      converting: false,
      convProgress: 0,
      resultBlob: null,
    });
    convertSingle(id);
  };

  // 一键转换
  const convertAll = async () => {
    const pending = fileItems.filter(f => !f.resultBlob && !f.converting);
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

  // 全局重新转换（修复：直接重置并转换，避免依赖异步状态）
  const retryConvertAll = async () => {
    const toRetry = fileItems.filter(item => item.resultBlob);
    if (toRetry.length === 0) return;
    setIsConvertingAll(true);
    // 重置所有已完成/错误文件的状态
    toRetry.forEach(item => updateItem(item.id, {
      converting: false,
      convProgress: 0,
      resultBlob: null,
    }));
    // 逐个转换
    let completed = 0;
    for (const item of toRetry) {
      await convertSingle(item.id);
      completed++;
      setTotalProgress((completed / toRetry.length) * 100);
    }
    setIsConvertingAll(false);
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
                  {PRESET_BITRATES.filter(b => b !== '').map(br => (<option key={br} value={br}>{br}</option>))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={convertAll} disabled={fileItems.length === 0} className="px-4 py-2 bg-indigo-500 text-white rounded-lg flex items-center gap-1 font-medium">
                🚀 {t.actions.convertAll}
              </button>
              {fileItems.some(item => item.resultBlob) && (
                <button onClick={retryConvertAll}
                  className="px-4 py-2 bg-yellow-500 text-white rounded-lg flex items-center gap-1 font-medium hover:bg-yellow-600">
                  <RefreshCw size={16} /> 重新转换全部
                </button>
              )}
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

          {/* 总进度条（批量 >1 时显示） */}
          {isConvertingAll && fileItems.filter(f => !f.resultBlob && !f.converting).length > 1 && (
            <div className="bg-white/80 backdrop-blur rounded-xl p-3 mb-3">
              <div className="flex justify-between text-sm mb-1">
                <span>🚀 批量转换总进度</span>
                <span>{totalProgress.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div className="bg-indigo-500 h-3 rounded-full transition-all" style={{ width: `${totalProgress}%` }} />
              </div>
            </div>
          )}

          {/* 全局播放进度条 */}
          {playingId && (
            <div className="bg-white/80 backdrop-blur rounded-xl p-3 mb-3">
              <div className="flex items-center gap-2 text-sm">
                <button onClick={stopPlay} className="p-1 rounded hover:bg-gray-200"><Pause size={16} /></button>
                <input type="number" value={playState.currentTime.toFixed(1)} onChange={handleTimeInput} className="w-16 border rounded px-1 py-0.5 text-xs text-center" />
                <span className="text-xs text-gray-500">/ {formatTime(playState.duration)}</span>
                <input type="range" min={0} max={playState.duration || 0} step={0.1} value={playState.currentTime} onChange={handleSeek} className="flex-1" />
              </div>
            </div>
          )}

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
                  {item.resultBlob && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); togglePlayConverted(item.id); }}
                        className={`p-1.5 rounded-full ${playingId === `conv-${item.id}` ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        title={playingId === `conv-${item.id}` ? '暂停' : '播放'}>
                        {playingId === `conv-${item.id}` ? <Pause size={16} /> : <Play size={16} />}
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); downloadSingle(item.id); }} className="px-3 py-1 bg-green-500 text-white rounded text-sm font-medium hover:bg-green-600">💾 下载</button>
                      <button onClick={(e) => { e.stopPropagation(); retryConvert(item.id); }} className="px-3 py-1 bg-yellow-500 text-white rounded text-sm font-medium hover:bg-yellow-600 flex items-center gap-1">
                        <RefreshCw size={14} /> 重新转换
                      </button>
                    </>
                  )}
                  {!item.resultBlob && !item.converting && (
                    <button onClick={(e) => { e.stopPropagation(); convertSingle(item.id); }} className="px-3 py-1 bg-indigo-500 text-white rounded text-sm font-medium hover:bg-indigo-600">转换</button>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); removeFile(item.id); }} className="text-red-500 hover:bg-red-50 rounded p-1"><X size={14} /></button>
                </div>
              </div>

              {item.converting && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-indigo-600">🔄 转换中</span>
                    <span className="text-xs font-bold text-indigo-700">{item.convProgress.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden shadow-inner">
                    <div className="bg-gradient-to-r from-indigo-500 to-purple-600 h-4 rounded-full transition-all duration-300 ease-out" style={{ width: `${item.convProgress}%` }} />
                  </div>
                </div>
              )}

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
                        {PRESET_BITRATES.filter(b => b !== '').map(br => (<option key={br} value={br}>{br}</option>))}
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

                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-1">📝 LRC 歌词</p>
                    <div className="flex items-center gap-2 mb-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); togglePlayOriginal(item.id); }}
                        className="flex items-center gap-1 text-xs px-2 py-1 bg-indigo-100 text-indigo-700 rounded"
                      >
                        {playingId === item.id ? <Pause size={14} /> : <Play size={14} />}
                        {playingId === item.id ? '暂停' : '播放'}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); insertTimestamp(item.id); }}
                        disabled={playingId !== item.id}
                        className="flex items-center gap-1 text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded disabled:opacity-50"
                      >
                        <Clock size={14} /> 插入时间戳
                      </button>
                      <span className="text-xs text-gray-400">{playingId === item.id ? `${playState.currentTime.toFixed(1)}s` : ''}</span>
                    </div>
                    <textarea
                      id={`lyrics-${item.id}`}
                      value={item.lyrics}
                      onChange={(e) => updateItem(item.id, { lyrics: e.target.value })}
                      placeholder="[00:01.00]第一句歌词&#10;[00:05.00]第二句歌词"
                      rows={6}
                      className="w-full border rounded p-2 text-xs font-mono"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex flex-wrap gap-4 mt-2 items-center">
                      <label className="flex items-center gap-1 text-xs">
                        <input type="checkbox" checked={item.embedLyrics} onChange={(e) => updateItem(item.id, { embedLyrics: e.target.checked })} className="rounded" />
                        嵌入歌词
                      </label>
                      <label className="flex items-center gap-1 text-xs">
                        <input type="checkbox" checked={item.saveLyricsFile} onChange={(e) => updateItem(item.id, { saveLyricsFile: e.target.checked })} className="rounded" />
                        导出歌词文件
                      </label>
                      <div className="flex items-center gap-1 text-xs">
                        <span className="text-gray-500">格式：</span>
                        <select value={item.lyricsFormat} onChange={(e) => updateItem(item.id, { lyricsFormat: e.target.value as 'lrc' | 'smi' })} className="border rounded px-1 py-0.5 text-xs">
                          <option value="lrc">LRC</option>
                          <option value="smi">SMI</option>
                        </select>
                      </div>
                    </div>
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