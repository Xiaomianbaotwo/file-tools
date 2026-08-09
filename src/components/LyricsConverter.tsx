import React, { useState } from 'react';
import { ArrowLeftRight, Download, Copy, Check } from 'lucide-react';

type Mode = 'lrc2smi' | 'smi2lrc';

/* ========== 转换函数保持不变 ========== */
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
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
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
function decodeEntities(str: string) {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = str;
  return textarea.value;
}
function smiToLrc(smiText: string): string {
  const items: { start: number; text: string }[] = [];
  const lines = smiText.split('\n');
  let currentStart: number | null = null;
  for (const line of lines) {
    const syncMatch = line.match(/<SYNC\s+Start\s*=\s*(\d+)\s*>/i);
    if (syncMatch) {
      currentStart = parseInt(syncMatch[1], 10);
      const pMatch = line.match(/<P[^>]*>(.*?)<\/P>/i);
      if (pMatch && currentStart !== null) {
        const text = pMatch[1].trim();
        if (text && text !== '&nbsp;') items.push({ start: currentStart, text: decodeEntities(text) });
      }
    } else if (currentStart !== null) {
      const pMatch = line.match(/<P[^>]*>(.*?)<\/P>/i);
      if (pMatch) {
        const text = pMatch[1].trim();
        if (text && text !== '&nbsp;') items.push({ start: currentStart!, text: decodeEntities(text) });
      }
    }
  }
  if (items.length === 0) throw new Error('未找到有效的 SMI 同步数据');
  const msToLrcTime = (ms: number) => {
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const centiseconds = Math.round((totalSeconds - Math.floor(totalSeconds)) * 100);
    return `[${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}]`;
  };
  return items.map(item => `${msToLrcTime(item.start)}${item.text}`).join('\n');
}

export default function LyricsConverter() {
  const [mode, setMode] = useState<Mode>('lrc2smi');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [copied, setCopied] = useState(false);

  const handleConvert = () => {
    if (!input.trim()) { alert('请先输入内容'); return; }
    try {
      setOutput(mode === 'lrc2smi' ? lrcToSmi(input) : smiToLrc(input));
    } catch (err: any) { alert('转换失败：' + err.message); }
  };

  const handleDownload = () => {
    if (!output.trim()) { alert('没有可下载的内容'); return; }
    const extension = mode === 'lrc2smi' ? 'smi' : 'lrc';
    const mime = extension === 'smi' ? 'application/smil+xml' : 'text/plain';
    const blob = new Blob([output], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `lyrics.${extension}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    if (!output.trim()) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-[900px] mx-auto py-8 px-4">
      <h2 className="text-3xl font-bold text-center mb-2">🎵 LRC ↔ SMI 歌词双向转换器</h2>
      <p className="text-center text-gray-500 mb-6">支持 LRC 歌词与 SMI 字幕互相转换 · 完全本地处理</p>

      <div className="flex justify-center gap-3 mb-6">
        <button onClick={() => { setMode('lrc2smi'); setOutput(''); }}
          className={`px-5 py-2 rounded-full font-medium text-sm transition ${mode === 'lrc2smi' ? 'bg-indigo-500 text-white shadow' : 'bg-white/70 backdrop-blur border border-gray-300 text-gray-700 hover:bg-gray-100'}`}>
          🔄 LRC → SMI
        </button>
        <button onClick={() => { setMode('smi2lrc'); setOutput(''); }}
          className={`px-5 py-2 rounded-full font-medium text-sm transition ${mode === 'smi2lrc' ? 'bg-indigo-500 text-white shadow' : 'bg-white/70 backdrop-blur border border-gray-300 text-gray-700 hover:bg-gray-100'}`}>
          🔄 SMI → LRC
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="flex flex-col">
          <label className="text-sm font-medium mb-2">{mode === 'lrc2smi' ? '📥 输入 LRC 歌词' : '📥 输入 SMI 字幕'}</label>
          <textarea value={input} onChange={(e) => setInput(e.target.value)}
            placeholder={mode === 'lrc2smi' ? '[00:12.00]第一句歌词\n[00:15.50]第二句歌词' : '<SAMI>\n<HEAD>\n...\n<SYNC Start=12000>\n<P Class=CC>第一句歌词</P>\n...'}
            rows={12} className="w-full border rounded-xl p-3 text-sm font-mono bg-white/80 backdrop-blur resize-y focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        </div>
        <div className="flex flex-col">
          <label className="text-sm font-medium mb-2">{mode === 'lrc2smi' ? '📤 生成的 SMI 字幕' : '📤 生成的 LRC 歌词'}</label>
          <textarea value={output} readOnly placeholder="点击转换按钮后这里会显示结果"
            rows={12} className="w-full border rounded-xl p-3 text-sm font-mono bg-gray-50/80 backdrop-blur resize-y focus:outline-none" />
        </div>
      </div>

      <div className="flex justify-center gap-3">
        <button onClick={handleConvert}
          className="px-6 py-2.5 bg-indigo-500 text-white rounded-xl font-medium hover:bg-indigo-600 transition flex items-center gap-2">
          <ArrowLeftRight size={18} /> 开始转换
        </button>
        <button onClick={handleDownload}
          className="px-6 py-2.5 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition flex items-center gap-2">
          <Download size={18} /> 下载文件
        </button>
        <button onClick={handleCopy} disabled={!output.trim()}
          className="px-6 py-2.5 bg-white/80 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-100 transition flex items-center gap-2 disabled:opacity-50">
          {copied ? <Check size={18} /> : <Copy size={18} />}
          {copied ? '已复制' : '复制结果'}
        </button>
      </div>
    </div>
  );
}