import React from 'react';
import { Dropdown } from 'react-bootstrap';
import { useTranslation } from 'react-i18next';

const languageOrder = ['en', 'ru', 'tr'];

function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const currentLanguage = i18n.resolvedLanguage || i18n.language || 'en';

  const handleChange = (code) => {
    if (code !== currentLanguage) {
      i18n.changeLanguage(code);
    }
  };

  return (
    <Dropdown align="end">
      <Dropdown.Toggle variant="light" size="sm" id="language-switcher">
        {t('languageSwitcher.label')}: {t(`languageSwitcher.options.${currentLanguage}`)}
      </Dropdown.Toggle>
      <Dropdown.Menu>
        {languageOrder.map((code) => (
          <Dropdown.Item
            key={code}
            active={code === currentLanguage}
            onClick={() => handleChange(code)}
          >
            {t(`languageSwitcher.options.${code}`)}
          </Dropdown.Item>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  );
}

export default LanguageSwitcher;
