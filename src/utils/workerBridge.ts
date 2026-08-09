import { FileItem } from '../types';

export interface WorkerRequest {
  type: 'convert';
  payload: {
    fileId: string;
    file: ArrayBuffer;
    targetFormat: string;
    quality: number;
    fileName: string;
  };
}

export interface WorkerResponse {
  type: 'progress' | 'done' | 'error';
  fileId: string;
  progress?: number;
  blob?: ArrayBuffer;
  error?: string;
  mimeType?: string;
}

/**
 * 创建 Web Worker 并返回通信方法
 */
export function createConversionWorker(): Worker {
  return new Worker(new URL('../workers/conversion.worker.ts', import.meta.url), { type: 'module' });
}