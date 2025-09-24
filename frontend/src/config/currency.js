import axiosInstance from '../utils/axiosInstance';

let baseCurrency = 'USD';
let currencyOptions = [];

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
    }
  } catch (err) {
    console.error('Failed to fetch currency options', err);
  }
  return currencyOptions;
};

export const clearCachedCurrencies = () => {
  currencyOptions = [];
};

