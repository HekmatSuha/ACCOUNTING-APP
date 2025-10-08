import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock(
  'react-router-dom',
  () => ({
    BrowserRouter: ({ children }) => <div>{children}</div>,
    Routes: ({ children }) => <div>{children}</div>,
    Route: ({ children }) => <div>{children}</div>,
    Navigate: () => null,
  }),
  { virtual: true }
);

jest.mock('axios', () => ({
  create: () => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    defaults: { baseURL: '' },
  }),
}));

jest.mock('./config/currency', () => ({
  ...jest.requireActual('./config/currency'),
  loadBaseCurrency: jest.fn().mockResolvedValue('USD'),
}));

test('renders without crashing', () => {
  render(<App />);
});
