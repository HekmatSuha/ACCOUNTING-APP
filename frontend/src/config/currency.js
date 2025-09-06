import axios from 'axios';
import axiosInstance from '../utils/axiosInstance';

let baseCurrency = 'USD';

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

export const fetchExchangeRate = async (from, to) => {
  if (!from || !to || from === to) {
    return 1;
  }
  try {
    const res = await axios.get(`https://api.exchangerate.host/convert?from=${from}&to=${to}`);
    return res.data?.result || 1;
  } catch (err) {
    console.error('Failed to fetch exchange rate', err);
    return 1;
  }
};

export const currencyOptions = ['USD', 'EUR', 'KZT', 'TRY'];

