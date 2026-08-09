import { useState } from 'react';
import { Image, Music, FileText, Film, Globe } from 'lucide-react';
import { useLang, LANGUAGES, Lang } from './context/LangContext';
import ImageConverter from './components/ImageConverter';
import MusicConverter from './components/MusicConverter';
import LyricsConverter from './components/LyricsConverter';
import FrameExtractor from './components/FrameExtractor';

export default function App() {
  const [page, setPage] = useState<'image' | 'music' | 'lyrics' | 'frames'>('image');
  const { lang, setLang } = useLang();
  const [showLangModal, setShowLangModal] = useState(false);

  // 调整页面顺序：图片转换 → 帧提取 → 音乐转换 → 歌词转换
  const pages = [
    { key: 'image' as const, label: '图片转换', icon: Image },
    { key: 'frames' as const, label: '帧提取', icon: Film },
    { key: 'music' as const, label: '音乐转换', icon: Music },
    { key: 'lyrics' as const, label: '歌词转换', icon: FileText },
  ];

  return (
    <div className="min-h-screen">
      <nav className="max-w-[1200px] mx-auto mt-4 px-4">
        <div className="glass-panel p-2 flex items-center justify-between">
          <div className="flex gap-2">
            {pages.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setPage(key)}
                className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
                  page === key ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-gray-100'
                }`}
              >
                <Icon size={20} /> {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowLangModal(true)}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-white/60 rounded-full hover:bg-white/90"
          >
            <Globe size={16} /> {LANGUAGES.find(l => l.code === lang)?.label}
          </button>
        </div>
      </nav>

      {page === 'image' && <ImageConverter />}
      {page === 'frames' && <FrameExtractor />}
      {page === 'music' && <MusicConverter />}
      {page === 'lyrics' && <LyricsConverter />}

      {showLangModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowLangModal(false)}
        >
          <div
            className="bg-white/90 backdrop-blur-xl rounded-2xl p-6 w-64"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold mb-4 text-center">🌐 选择语言</h2>
            <div className="space-y-2">
              {LANGUAGES.map(item => (
                <button
                  key={item.code}
                  onClick={() => {
                    setLang(item.code);
                    setShowLangModal(false);
                  }}
                  className={`w-full text-left px-4 py-2 rounded-lg ${
                    lang === item.code
                      ? 'bg-indigo-100 text-indigo-700 font-medium'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}