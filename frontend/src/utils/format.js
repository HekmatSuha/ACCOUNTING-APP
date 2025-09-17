const DEFAULT_LOCALE = 'en-US';
const DEFAULT_MIN_FRACTION_DIGITS = 2;
const DEFAULT_MAX_FRACTION_DIGITS = 2;

const toNumericValue = (value) => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
    }

    if (typeof value === 'string') {
        // Remove common formatting characters such as commas before parsing
        const normalised = value.replace(/,/g, '').trim();
        const parsed = Number(normalised);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

export const formatNumber = (
    value,
    {
        locale = DEFAULT_LOCALE,
        minimumFractionDigits = DEFAULT_MIN_FRACTION_DIGITS,
        maximumFractionDigits = DEFAULT_MAX_FRACTION_DIGITS,
    } = {},
) => {
    const numericValue = toNumericValue(value);

    try {
        return new Intl.NumberFormat(locale, {
            minimumFractionDigits,
            maximumFractionDigits,
        }).format(numericValue);
    } catch (error) {
        // Fallback to a simple fixed decimal representation if Intl fails
        const fractionDigits = Math.min(
            Math.max(minimumFractionDigits ?? DEFAULT_MIN_FRACTION_DIGITS, 0),
            Math.max(maximumFractionDigits ?? DEFAULT_MAX_FRACTION_DIGITS, 20),
        );
        return numericValue.toFixed(fractionDigits);
    }
};

export const formatCurrency = (
    value,
    currency = 'USD',
    {
        locale = DEFAULT_LOCALE,
        minimumFractionDigits = DEFAULT_MIN_FRACTION_DIGITS,
        maximumFractionDigits = DEFAULT_MAX_FRACTION_DIGITS,
    } = {},
) => {
    const numericValue = toNumericValue(value);

    try {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency,
            minimumFractionDigits,
            maximumFractionDigits,
        }).format(numericValue);
    } catch (error) {
        const formattedNumber = formatNumber(numericValue, {
            locale,
            minimumFractionDigits,
            maximumFractionDigits,
        });
        return currency ? `${currency} ${formattedNumber}` : formattedNumber;
    }
};
