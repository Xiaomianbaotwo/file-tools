import { create } from 'zustand';
import { FileItem, FileStatus } from '../types';
import { loadImagePreview } from '../utils/imageLoader';

interface AppState {
  files: FileItem[];
  globalFormat: string;
  globalQuality: number;
  addFiles: (newFiles: File[]) => void;
  removeFile: (id: string) => void;
  updateFileFormat: (id: string, format: string) => void;
  updateFileQuality: (id: string, quality: number) => void;
  setGlobalFormat: (format: string) => void;
  setGlobalQuality: (quality: number) => void;
  updateFileStatus: (id: string, status: FileStatus, progress?: number, resultBlob?: Blob | null, errorMsg?: string) => void;
  updateFileDetails: (id: string, updates: Partial<Pick<FileItem, 'customName' | 'outputWidth' | 'outputHeight' | 'keepAspectRatio'>>) => void;
  clearAll: () => void;
}

let idCounter = 0;

export const useStore = create<AppState>((set, get) => ({
  files: [],
  globalFormat: 'png',
  globalQuality: 100,

  addFiles: (newFiles) => {
    const state = get();
    const supportedExt = ['png','jpg','jpeg','webp','avif','bmp','ico','tiff','tif','svg','heic','heif','pdf','psd','tga','raw','cr2','nef','arw','dng','orf','jxl'];
    const validFiles = newFiles.filter(
      f => supportedExt.includes(f.name.split('.').pop()?.toLowerCase() ?? '') ||
           f.type.startsWith('image/') ||
           f.type === 'application/pdf'
    );

    if (validFiles.length === 0) return;

    const baseItems: FileItem[] = validFiles.map(file => ({
      id: `f_${++idCounter}_${Date.now()}`,
      file,
      targetFormat: state.globalFormat,
      quality: state.globalQuality,
      status: 'pending',
      progress: 0,
      resultBlob: null,
      resultUrl: null,
      errorMsg: '',
    }));

    set({ files: [...state.files, ...baseItems] });

    // 异步加载预览图及原始尺寸
    for (const item of baseItems) {
      loadImagePreview(item.file)
        .then(meta => {
          set(state => ({
            files: state.files.map(f =>
              f.id === item.id
                ? { ...f, previewUrl: meta.url, originalWidth: meta.width, originalHeight: meta.height }
                : f
            ),
          }));
        })
        .catch(() => {
          // 忽略预览加载失败（非关键功能）
        });
    }
  },

  removeFile: (id) => {
    const state = get();
    const file = state.files.find(f => f.id === id);
    if (file?.resultUrl) URL.revokeObjectURL(file.resultUrl);
    if (file?.previewUrl) URL.revokeObjectURL(file.previewUrl);
    set({ files: state.files.filter(f => f.id !== id) });
  },

  updateFileFormat: (id, format) => {
    set(state => ({
      files: state.files.map(f => f.id === id ? { ...f, targetFormat: format } : f),
    }));
  },

  updateFileQuality: (id, quality) => {
    set(state => ({
      files: state.files.map(f => f.id === id ? { ...f, quality } : f),
    }));
  },

  setGlobalFormat: (format) => {
    set(state => ({
      globalFormat: format,
      files: state.files.map(f => ({ ...f, targetFormat: format })),
    }));
  },

  setGlobalQuality: (quality) => {
    set(state => ({
      globalQuality: quality,
      files: state.files.map(f => ({ ...f, quality })),
    }));
  },

  updateFileStatus: (id, status, progress = 0, resultBlob = null, errorMsg = '') => {
    set(state => ({
      files: state.files.map(f =>
        f.id === id
          ? {
              ...f,
              status,
              progress,
              resultBlob,
              resultUrl: resultBlob ? URL.createObjectURL(resultBlob) : f.resultUrl,
              errorMsg,
            }
          : f
      ),
    }));
  },

  updateFileDetails: (id, updates) => {
    set(state => ({
      files: state.files.map(f =>
        f.id === id ? { ...f, ...updates } : f
      ),
    }));
  },

  clearAll: () => {
    const state = get();
    state.files.forEach(f => {
      if (f.resultUrl) URL.revokeObjectURL(f.resultUrl);
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    });
    set({ files: [] });
  },
}));