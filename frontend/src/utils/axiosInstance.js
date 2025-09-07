// frontend/src/utils/axiosInstance.js

import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import dayjs from 'dayjs';

const baseURL = process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000/api';

const axiosInstance = axios.create({
    baseURL,
});

// Interceptor to add the token to every request
axiosInstance.interceptors.request.use(async req => {
    let accessToken = localStorage.getItem('accessToken');
    
    if (!accessToken) {
        return req;
    }

    let user;
    try {
        user = jwtDecode(accessToken);
    } catch (error) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return req;
    }
    const isExpired = dayjs.unix(user.exp).diff(dayjs()) < 1;

    if (!isExpired) {
        req.headers.Authorization = `Bearer ${accessToken}`;
        return req;
    }

    // Token is expired, try to refresh it
    const refreshToken = localStorage.getItem('refreshToken');
    try {
        const response = await axios.post(`${baseURL}/token/refresh/`, {
            refresh: refreshToken
        });
        
        localStorage.setItem('accessToken', response.data.access);
        req.headers.Authorization = `Bearer ${response.data.access}`;
        return req;

    } catch (error) {
        // If refresh fails, log the user out
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login'; 
    }

    return req;
});

// You need to install these new packages
// npm install jwt-decode dayjs

export default axiosInstance;
