import { FormatDescriptor, SupportedOutputFormat } from '../types';

export const outputFormats: SupportedOutputFormat[] = [
  'png', 'jpg', 'webp', 'avif', 'bmp', 'ico', 'tiff',
  'svg', 'heic', 'tga', 'psd', 'raw', 'jxl',
];

export const formatRegistry: Record<string, FormatDescriptor> = {
  png:   { extension: 'png', mime: 'image/png', label: 'PNG', inputSupport: true, outputSupport: true, status: 'supported' },
  jpg:   { extension: 'jpg', mime: 'image/jpeg', label: 'JPG', inputSupport: true, outputSupport: true, status: 'supported' },
  webp:  { extension: 'webp', mime: 'image/webp', label: 'WEBP', inputSupport: true, outputSupport: true, status: 'supported' },
  avif:  { extension: 'avif', mime: 'image/avif', label: 'AVIF', inputSupport: true, outputSupport: true, status: 'supported' },
  bmp:   { extension: 'bmp', mime: 'image/bmp', label: 'BMP', inputSupport: true, outputSupport: true, status: 'supported' },
  ico:   { extension: 'ico', mime: 'image/x-icon', label: 'ICO', inputSupport: true, outputSupport: true, status: 'supported' },
  tiff:  { extension: 'tiff', mime: 'image/tiff', label: 'TIFF', inputSupport: true, outputSupport: true, status: 'limited' },
  svg:   { extension: 'svg', mime: 'image/svg+xml', label: 'SVG', inputSupport: true, outputSupport: false, status: 'dev' },
  heic:  { extension: 'heic', mime: 'image/heic', label: 'HEIC', inputSupport: true, outputSupport: false, status: 'dev' },
  tga:   { extension: 'tga', mime: 'image/tga', label: 'TGA', inputSupport: true, outputSupport: false, status: 'dev' },
  psd:   { extension: 'psd', mime: 'image/psd', label: 'PSD', inputSupport: true, outputSupport: false, status: 'dev' },
  raw:   { extension: 'raw', mime: 'image/raw', label: 'RAW', inputSupport: true, outputSupport: false, status: 'dev' },
  jxl:   { extension: 'jxl', mime: 'image/jxl', label: 'JXL', inputSupport: false, outputSupport: false, status: 'dev' },
};