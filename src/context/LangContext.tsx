import React, { createContext, useContext, useState, useCallback } from 'react';
import zhCN from '../lang/zh_cn.json';
import enUS from '../lang/en_us.json';
import esES from '../lang/es_es.json';
import jaJP from '../lang/ja_jp.json';
import ruRU from '../lang/ru_ru.json';
import frFR from '../lang/fr_fr.json';

export type Lang = 'zh' | 'en' | 'es' | 'ja' | 'ru' | 'fr';

export const LANGUAGES: { code: Lang; label: string }[] = [
  { code: 'zh', label: '🇨🇳 中文' },
  { code: 'en', label: '🇺🇸 English' },
  { code: 'es', label: '🇪🇸 Español' },
  { code: 'ja', label: '🇯🇵 日本語' },
  { code: 'ru', label: '🇷🇺 Русский' },
  { code: 'fr', label: '🇫🇷 Français' },
];

const messagesMap: Record<Lang, typeof zhCN> = {
  zh: zhCN,
  en: enUS,
  es: esES,
  ja: jaJP,
  ru: ruRU,
  fr: frFR,
};

interface LangContextValue {
  lang: Lang;
  messages: typeof zhCN;
  setLang: (l: Lang) => void;
}

const LangContext = createContext<LangContextValue>({
  lang: 'zh',
  messages: zhCN,
  setLang: () => {},
});

export const useLang = () => useContext(LangContext);

export const LangProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Lang>('zh');
  const messages = messagesMap[lang];

  return (
    <LangContext.Provider value={{ lang, messages, setLang }}>
      {children}
    </LangContext.Provider>
  );
};