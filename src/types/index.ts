export type FileStatus = 'pending' | 'converting' | 'done' | 'error';

export interface FileItem {
  id: string;
  file: File;
  targetFormat: string;
  quality: number;
  status: FileStatus;
  progress: number;
  resultBlob: Blob | null;
  resultUrl: string | null;
  errorMsg: string;
  thumbnail?: string;
  customName?: string;
  previewUrl?: string;
  originalWidth?: number;
  originalHeight?: number;
  outputWidth?: number;
  outputHeight?: number;
  keepAspectRatio?: boolean;
}

export type SupportedInputFormat =
  | 'png' | 'jpg' | 'jpeg' | 'webp' | 'avif' | 'bmp' | 'ico'
  | 'tiff' | 'tif' | 'svg' | 'heic' | 'heif' | 'pdf' | 'psd' | 'tga'
  | 'raw' | 'cr2' | 'nef' | 'arw' | 'dng' | 'orf' | 'jxl';

export type SupportedOutputFormat =
  | 'png' | 'jpg' | 'webp' | 'avif' | 'bmp' | 'ico' | 'tiff'
  | 'svg' | 'heic' | 'tga' | 'psd' | 'raw' | 'jxl';

export interface FormatDescriptor {
  extension: string;
  mime: string;
  label: string;
  inputSupport: boolean;
  outputSupport: boolean;
  status: 'supported' | 'limited' | 'dev';
}