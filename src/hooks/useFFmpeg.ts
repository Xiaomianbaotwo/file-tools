import { useRef, useState, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

export function useFFmpeg() {
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const load = useCallback(async () => {
    if (ffmpegRef.current?.loaded) {
      setLoaded(true);
      return;
    }
    setLoading(true);
    const ffmpeg = new FFmpeg();
    ffmpegRef.current = ffmpeg;

    ffmpeg.on('progress', ({ progress: p }) => setProgress(p * 100));

    const baseURL = 'https://registry.npmmirror.com/@ffmpeg/core/0.12.10/files/esm';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    setLoaded(true);
    setLoading(false);
  }, []);

  const processAudio = useCallback(async (
    inputFile: File,
    options: {
      outputFormat: string;
      startTime?: number;
      endTime?: number;
      volume?: number;
      coverFile?: File;
      bitrate?: string;
      lyrics?: string;        // LRC 歌词文本
    },
    onProgress?: (percent: number) => void
  ) => {
    const ffmpeg = ffmpegRef.current;
    if (!ffmpeg || !ffmpeg.loaded) throw new Error('FFmpeg not loaded');

    const inputExt = inputFile.name.includes('.') ? inputFile.name.substring(inputFile.name.lastIndexOf('.')) : '';
    const inputName = 'input' + inputExt;
    const outputName = `output.${options.outputFormat}`;

    await ffmpeg.writeFile(inputName, await fetchFile(inputFile));

    const args: string[] = [];
    if (options.startTime !== undefined && options.startTime > 0) args.push('-ss', String(options.startTime));
    if (options.endTime !== undefined && options.endTime > 0) args.push('-to', String(options.endTime));
    args.push('-i', inputName);

    if (options.coverFile) {
      const coverExt = options.coverFile.name.includes('.') ? options.coverFile.name.substring(options.coverFile.name.lastIndexOf('.')) : '.png';
      const coverName = 'cover' + coverExt;
      await ffmpeg.writeFile(coverName, await fetchFile(options.coverFile));
      args.push('-i', coverName);
    }

    const filters: string[] = [];
    if (options.volume !== undefined && options.volume !== 100) {
      filters.push(`volume=${options.volume / 100}`);
    }

    if (options.bitrate && options.bitrate !== '') {
      args.push('-b:a', options.bitrate);
    }

    // 嵌入歌词（MP3 等格式的 USLT 帧）
    if (options.lyrics && options.lyrics.trim() !== '') {
      // 转义换行符，防止命令行传递出错
      const escapedLyrics = options.lyrics.replace(/\\/g, '\\\\').replace(/\n/g, '\\n');
      args.push('-metadata', `lyrics=${escapedLyrics}`);
      // 兼容某些播放器读取的字段
      args.push('-metadata', `LYRICS=${options.lyrics}`);
    }

    switch (options.outputFormat) {
      case 'mp3': args.push('-acodec', 'libmp3lame'); break;
      case 'ogg': args.push('-acodec', 'libvorbis'); break;
      case 'flac': args.push('-acodec', 'flac'); break;
      case 'wav': args.push('-acodec', 'pcm_s16le'); break;
      case 'm4a': args.push('-acodec', 'aac'); break;
    }

    if (filters.length > 0) args.push('-af', filters.join(','));

    if (options.coverFile) {
      args.push('-map', '0:a', '-map', '1:v', '-disposition:v', 'attached_pic');
    }

    args.push('-y', outputName);

    ffmpeg.on('progress', ({ progress: p }) => onProgress?.(p * 100));

    await ffmpeg.exec(args);
    const data = await ffmpeg.readFile(outputName);

    let outputBlob: Blob;
    if (typeof data === 'string') {
      outputBlob = new Blob([new TextEncoder().encode(data)], { type: `audio/${options.outputFormat}` });
    } else {
      const byteArray = new Uint8Array(data.length);
      byteArray.set(data);
      outputBlob = new Blob([byteArray], { type: `audio/${options.outputFormat}` });
    }

    return outputBlob;
  }, []);

  return { load, loaded, loading, progress, processAudio };
}