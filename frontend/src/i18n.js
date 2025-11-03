import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslations from './locales/en/translation.json';
import ruTranslations from './locales/ru/translation.json';
import trTranslations from './locales/tr/translation.json';

const supportedLngs = ['en', 'ru', 'tr'];

const resources = {
  en: { translation: enTranslations },
  ru: { translation: ruTranslations },
  tr: { translation: trTranslations },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    supportedLngs,
    fallbackLng: 'en',
    load: 'languageOnly',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['querystring', 'localStorage', 'cookie', 'navigator', 'htmlTag'],
      caches: ['localStorage', 'cookie'],
    },
    react: {
      useSuspense: true,
    },
  });

export default i18n;
