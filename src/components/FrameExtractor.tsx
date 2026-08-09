import React, { useState, useRef, useEffect, useCallback } from 'react';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { Film, Loader2, Download, Trash2, Package, X, Play } from 'lucide-react';

interface FrameItem {
  id: string;
  blob: Blob;
  url: string;
}

interface FileResult {
  id: string;
  fileName: string;
  file: File;
  previewUrl: string;
  frames: FrameItem[];
}

export default function FrameExtractor() {
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [ffmpegLoadingProgress, setFfmpegLoadingProgress] = useState(0);
  const [extracting, setExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);
  const [fileResults, setFileResults] = useState<FileResult[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ffmpegRef = useRef<any>(null);
  const gifParserRef = useRef<any>(null);

  useEffect(() => {
    const loadDependencies = async () => {
      try {
        const { FFmpeg } = await import('@ffmpeg/ffmpeg');
        const { toBlobURL } = await import('@ffmpeg/util');
        const ffmpeg = new FFmpeg();
        ffmpeg.on('progress', ({ progress }) => setFfmpegLoadingProgress(progress * 100));
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm';
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        ffmpegRef.current = ffmpeg;
        setFfmpegLoaded(true);
      } catch (err) {
        alert('FFmpeg 加载失败，请刷新重试');
      }

      try {
        const gifModule = await import('gifuct-js');
        // 兼容不同导出方式
        gifParserRef.current = (gifModule as any).default || (gifModule as any).Gif || (gifModule as any).GIF || gifModule;
        if (!gifParserRef.current) {
          console.warn('gifuct-js 模块解析失败，尝试全局回退');
          gifParserRef.current = (window as any).Gif || (window as any).GIF;
        }
      } catch (e) {
        console.warn('gifuct-js 动态导入失败，尝试全局回退', e);
        gifParserRef.current = (window as any).Gif || (window as any).GIF;
      }
    };
    if (!ffmpegRef.current) loadDependencies();
    else setFfmpegLoaded(true);
  }, []);

  // 生成预览URL（视频第一帧）
  const generatePreview = async (file: File): Promise<string> => {
    if (file.type === 'image/gif' || file.name.endsWith('.gif')) {
      return URL.createObjectURL(file);
    }
    try {
      const ffmpeg = ffmpegRef.current;
      if (!ffmpeg) return '';
      const inputName = 'preview_input' + file.name.substring(file.name.lastIndexOf('.'));
      const outputName = 'preview_first_frame.png';
      await ffmpeg.writeFile(inputName, new Uint8Array(await file.arrayBuffer()));
      await ffmpeg.exec(['-i', inputName, '-vframes', '1', outputName]);
      const data = await ffmpeg.readFile(outputName);
      const blob = new Blob([data], { type: 'image/png' });
      return URL.createObjectURL(blob);
    } catch {
      return '';
    }
  };

  // 处理多个文件
  const handleFiles = useCallback(async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setExtracting(true);
    setExtractProgress(0);
    const newResults: FileResult[] = [];
    const totalFiles = files.length;

    for (let fIdx = 0; fIdx < totalFiles; fIdx++) {
      const file = files[fIdx];
      try {
        const frames = file.type === 'image/gif' || file.name.endsWith('.gif')
          ? await extractGifFrames(file)
          : await extractVideoFrames(file);
        const previewUrl = await generatePreview(file);
        newResults.push({
          id: `result-${Date.now()}-${fIdx}`,
          fileName: file.name,
          file,
          previewUrl,
          frames,
        });
      } catch (err: any) {
        alert(`${file.name} 提取失败: ${err.message}`);
      }
      setExtractProgress(((fIdx + 1) / totalFiles) * 100);
    }

    setFileResults(prev => [...prev, ...newResults]);
    setExtracting(false);
  }, [ffmpegLoaded]);

  // GIF 帧提取（使用动态加载的 gifuct-js）
  const extractGifFrames = async (file: File): Promise<FrameItem[]> => {
    const GifParser = gifParserRef.current;
    if (!GifParser) throw new Error('gifuct-js 库未正确加载，请刷新页面');

    const arrayBuf = await file.arrayBuffer();
    const gif = new GifParser(new Uint8Array(arrayBuf));

    let rawFrames;
    if (typeof gif.decompressFrames === 'function') {
      rawFrames = gif.decompressFrames(true);
    } else if (typeof gif.decode === 'function') {
      const decoded = gif.decode();
      rawFrames = decoded.frames || decoded;
    } else {
      throw new Error('当前 gifuct-js 版本不支持解码');
    }

    if (!rawFrames || rawFrames.length === 0) throw new Error('GIF 中无帧');

    const frames: FrameItem[] = [];
    for (let i = 0; i < rawFrames.length; i++) {
      const frame = rawFrames[i];
      const canvas = document.createElement('canvas');
      canvas.width = frame.dims.width;
      canvas.height = frame.dims.height;
      const ctx = canvas.getContext('2d')!;
      const imageData = ctx.createImageData(canvas.width, canvas.height);
      imageData.data.set(frame.patch);
      ctx.putImageData(imageData, frame.dims.left, frame.dims.top);
      const blob = await new Promise<Blob>(r => canvas.toBlob(b => r(b!), 'image/png'));
      frames.push({ id: `gif-frame-${i}`, blob, url: URL.createObjectURL(blob) });
    }
    return frames;
  };

  // 视频帧提取
  const extractVideoFrames = async (file: File): Promise<FrameItem[]> => {
    const ffmpeg = ffmpegRef.current;
    if (!ffmpeg) throw new Error('FFmpeg 未就绪');
    const ext = file.name.substring(file.name.lastIndexOf('.'));
    const inputName = 'input' + ext;
    const outputPattern = 'frame_%04d.png';
    await ffmpeg.writeFile(inputName, new Uint8Array(await file.arrayBuffer()));
    await ffmpeg.exec(['-i', inputName, '-vf', 'fps=30', outputPattern]);

    const files = (await ffmpeg.listDir('/')).filter((f: any) => f.name.startsWith('frame_') && f.name.endsWith('.png'));
    const frames: FrameItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const data = await ffmpeg.readFile(f.name);
      const blob = new Blob([data], { type: 'image/png' });
      frames.push({ id: `vid-frame-${i}`, blob, url: URL.createObjectURL(blob) });
    }
    return frames;
  };

  // 删除文件结果
  const removeFileResult = (id: string) => {
    const target = fileResults.find(r => r.id === id);
    if (target) {
      if (target.previewUrl) URL.revokeObjectURL(target.previewUrl);
      target.frames.forEach(f => URL.revokeObjectURL(f.url));
    }
    setFileResults(prev => prev.filter(r => r.id !== id));
    if (selectedFileId === id) setSelectedFileId(null);
  };

  // 清空所有
  const clearAll = () => {
    fileResults.forEach(r => {
      if (r.previewUrl) URL.revokeObjectURL(r.previewUrl);
      r.frames.forEach(f => URL.revokeObjectURL(f.url));
    });
    setFileResults([]);
    setSelectedFileId(null);
  };

  // 下载单帧
  const downloadSingleFrame = (blob: Blob, fileName: string, index: number) => {
    saveAs(blob, `${fileName}_frame_${index + 1}.png`);
  };

  // 打包文件的所有帧
  const downloadFileFramesAsZip = async (result: FileResult) => {
    const zip = new JSZip();
    result.frames.forEach((f, i) => zip.file(`frame_${i + 1}.png`, f.blob));
    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, `${result.fileName.replace(/\.[^/.]+$/, '')}_frames.zip`);
  };

  const selectedFile = fileResults.find(r => r.id === selectedFileId);

  return (
    <div className="max-w-[1200px] mx-auto py-8 px-4">
      <h2 className="text-3xl font-bold text-center mb-2">🎞️ GIF / 视频逐帧提取</h2>
      <p className="text-center text-gray-500 mb-6">支持多文件上传，原文件动态预览，点击查看所有帧</p>

      {!ffmpegLoaded && (
        <div className="glass-panel p-6 text-center mb-4">
          <Loader2 className="animate-spin mx-auto mb-2" size={32} />
          <p className="text-lg font-medium">⏳ 正在加载 FFmpeg 引擎...</p>
          <div className="w-full bg-gray-200 rounded-full h-3 mt-2 overflow-hidden">
            <div className="bg-indigo-500 h-3 rounded-full" style={{ width: `${ffmpegLoadingProgress}%` }} />
          </div>
        </div>
      )}

      {ffmpegLoaded && (
        <>
          <div
            className="glass-panel p-8 text-center border-2 border-dashed border-gray-300 hover:border-indigo-300 cursor-pointer mb-4"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            onClick={() => fileInputRef.current?.click()}
          >
            <Film className="mx-auto text-5xl text-indigo-400 mb-3" />
            <p className="text-lg font-medium">拖拽 GIF 或视频文件到此处（支持多文件）</p>
            <p className="text-sm text-gray-400 mt-1">或点击选择多个文件</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/gif,video/*"
              className="hidden"
              onChange={(e) => { handleFiles(e.target.files!); e.target.value = ''; }}
            />
          </div>

          {extracting && (
            <div className="glass-panel p-4 mb-4">
              <p className="text-sm font-medium mb-2">🔍 正在提取帧... {extractProgress.toFixed(0)}%</p>
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <div className="bg-indigo-500 h-4 rounded-full" style={{ width: `${extractProgress}%` }} />
              </div>
            </div>
          )}

          {fileResults.length > 0 && (
            <>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium text-lg">📁 提取结果（{fileResults.length} 个文件）</h3>
                <button onClick={clearAll} className="text-sm text-red-500 hover:underline"><Trash2 size={14} className="inline" /> 清空全部</button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {fileResults.map(result => (
                  <div key={result.id} className="glass-panel overflow-hidden">
                    <div
                      className="relative cursor-pointer group"
                      onClick={() => setSelectedFileId(result.id)}
                    >
                      {result.file.type === 'image/gif' ? (
                        <img src={result.previewUrl} alt="预览" className="w-full h-32 object-cover" />
                      ) : (
                        <div className="w-full h-32 bg-gray-100 flex items-center justify-center">
                          {result.previewUrl ? (
                            <img src={result.previewUrl} alt="预览" className="w-full h-full object-cover" />
                          ) : (
                            <Play size={32} className="text-gray-400" />
                          )}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                        <span className="bg-white/80 px-3 py-1 rounded-full text-sm font-medium">查看 {result.frames.length} 帧</span>
                      </div>
                    </div>
                    <div className="p-2">
                      <p className="text-sm font-medium truncate" title={result.fileName}>{result.fileName}</p>
                      <p className="text-xs text-gray-500">{result.frames.length} 帧</p>
                      <div className="flex gap-1 mt-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); downloadFileFramesAsZip(result); }}
                          className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs flex-1"
                        >
                          <Package size={14} className="inline" /> 打包
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); removeFileResult(result.id); }}
                          className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 查看帧弹窗 —— 逐帧大图显示 */}
              {selectedFile && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setSelectedFileId(null)}>
                  <div className="bg-white rounded-2xl shadow-2xl w-[90%] max-w-[1000px] max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-between items-center p-4 border-b">
                      <h3 className="font-bold text-lg">{selectedFile.fileName} 的帧（{selectedFile.frames.length} 帧）</h3>
                      <div className="flex gap-2">
                        <button
                          onClick={() => downloadFileFramesAsZip(selectedFile)}
                          className="px-3 py-1 bg-green-500 text-white rounded text-sm"
                        >
                          📦 打包全部
                        </button>
                        <button onClick={() => setSelectedFileId(null)} className="p-1 hover:bg-gray-100 rounded"><X size={20} /></button>
                      </div>
                    </div>
                    <div className="overflow-y-auto p-4 space-y-4">
                      {selectedFile.frames.map((frame, idx) => (
                        <div key={frame.id} className="border rounded-lg overflow-hidden relative bg-gray-50 p-2">
                          <img
                            src={frame.url}
                            alt={`帧 ${idx + 1}`}
                            className="w-auto max-w-full h-auto mx-auto"
                            style={{ maxHeight: '80vh' }}
                          />
                          <div className="flex items-center justify-between mt-2 px-2">
                            <span className="text-sm font-medium">帧 {idx + 1}</span>
                            <button
                              onClick={() => downloadSingleFrame(frame.blob, selectedFile.fileName, idx)}
                              className="bg-white/80 rounded p-1 hover:bg-gray-100"
                            >
                              <Download size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}