export const ACCOUNT_CATEGORY_OPTIONS = [
  { value: 'cash', label: 'Cash Accounts', badge: 'info' },
  { value: 'bank', label: 'Bank Accounts', badge: 'primary' },
  { value: 'pos', label: 'POS Accounts', badge: 'success' },
  { value: 'partner', label: 'Partner Accounts', badge: 'warning' },
  { value: 'credit_card', label: 'Credit Cards', badge: 'danger' },
  { value: 'liability', label: 'Liability Accounts', badge: 'secondary' },
  { value: 'other', label: 'Other Accounts', badge: 'dark' },
];

export const ACCOUNT_CATEGORY_MAP = ACCOUNT_CATEGORY_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option;
  return acc;
}, {});

export const getCategoryConfig = (category) =>
  ACCOUNT_CATEGORY_MAP[category] || ACCOUNT_CATEGORY_MAP.other;
