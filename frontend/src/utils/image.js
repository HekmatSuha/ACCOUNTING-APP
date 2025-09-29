// frontend/src/utils/image.js

import axiosInstance from './axiosInstance';

let cachedBaseUrl = null;

export const getBaseApiUrl = () => {
    if (cachedBaseUrl !== null) {
        return cachedBaseUrl;
    }

    const apiBase = axiosInstance.defaults.baseURL || '';
    cachedBaseUrl = apiBase.replace(/\/?api\/?$/, '');
    return cachedBaseUrl;
};

export const resolveImageUrl = (imagePath, baseUrl = getBaseApiUrl()) => {
    if (!imagePath) {
        return null;
    }

    if (/^https?:\/\//i.test(imagePath)) {
        return imagePath;
    }

    const normalizedBase = (baseUrl || '').replace(/\/$/, '');
    if (!normalizedBase) {
        return imagePath;
    }

    const normalizedPath = imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
    return `${normalizedBase}${normalizedPath}`;
};

export const getImageInitial = (name) => {
    if (!name) {
        return '?';
    }

    const trimmed = name.trim();
    if (!trimmed) {
        return '?';
    }

    return trimmed.charAt(0).toUpperCase();
};
