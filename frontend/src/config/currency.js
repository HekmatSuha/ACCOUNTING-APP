import axiosInstance from '../utils/axiosInstance';

let baseCurrency = 'USD';
let currencyOptions = [];
let currencyRates = {};

export const getBaseCurrency = () => baseCurrency;

export const loadBaseCurrency = async () => {
  try {
    const res = await axiosInstance.get('/settings/');
    if (res.data && res.data.base_currency) {
      baseCurrency = res.data.base_currency;
    }
  } catch (err) {
    console.error('Failed to fetch base currency', err);
  }
  return baseCurrency;
};

export const getCurrencyOptions = () => currencyOptions;

export const loadCurrencyOptions = async () => {
  try {
    const res = await axiosInstance.get('/currencies/');
    if (res.data && Array.isArray(res.data)) {
      currencyOptions = res.data.map((currency) => {
        const code = currency.code || '';
        const name = currency.name || code;
        const label = name.includes(code) ? name : `${name} (${code})`;
        return [code, label];
      });
      currencyRates = res.data.reduce((acc, currency) => {
        if (currency?.code) {
          acc[currency.code] = Number(currency.exchange_rate) || 0;
        }
        return acc;
      }, {});
    }
  } catch (err) {
    console.error('Failed to fetch currency options', err);
  }
  return currencyOptions;
};

export const clearCachedCurrencies = () => {
  currencyOptions = [];
  currencyRates = {};
};

export const getCurrencyRates = () => currencyRates;

export const loadCurrencyRates = async () => {
  if (Object.keys(currencyRates).length > 0) {
    return currencyRates;
  }
  try {
    const res = await axiosInstance.get('/currencies/');
    if (res.data && Array.isArray(res.data)) {
      currencyRates = res.data.reduce((acc, currency) => {
        if (currency?.code) {
          acc[currency.code] = Number(currency.exchange_rate) || 0;
        }
        return acc;
      }, {});

      if (currencyOptions.length === 0) {
        currencyOptions = res.data.map((currency) => {
          const code = currency.code || '';
          const name = currency.name || code;
          const label = name.includes(code) ? name : `${name} (${code})`;
          return [code, label];
        });
      }
    }
  } catch (err) {
    console.error('Failed to fetch currency rates', err);
  }
  return currencyRates;
};

