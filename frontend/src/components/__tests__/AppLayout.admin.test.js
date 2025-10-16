import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import AppLayout from '../AppLayout';
import { useProfile } from '../../context/ProfileContext';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key) => key,
  }),
}));

jest.mock('../LanguageSwitcher', () => () => <div data-testid="language-switcher" />);

jest.mock(
  '../../context/ProfileContext',
  () => {
    const React = require('react');
    const mockedUseProfile = jest.fn();
    return {
      __esModule: true,
      default: React.createContext({}),
      ProfileProvider: ({ children }) => <>{children}</>,
      useProfile: mockedUseProfile,
      hasAdminAccess: jest.fn((profile) => Boolean(profile?.is_staff || profile?.isAdmin)),
    };
  },
);

const mockNavigate = jest.fn();
let mockLocation = { pathname: '/dashboard' };

jest.mock(
  'react-router-dom',
  () => {
    const mockReact = require('react');
    return {
      NavLink: mockReact.forwardRef(({ children, className, to, ...rest }, ref) => (
        <a
          href={typeof to === 'string' ? to : '#'}
          ref={ref}
          className={typeof className === 'function' ? className({ isActive: false }) : className}
          {...rest}
        >
          {children}
        </a>
      )),
      useNavigate: () => mockNavigate,
      useLocation: () => mockLocation,
    };
  },
  { virtual: true },
);

describe('AppLayout admin navigation', () => {
  beforeEach(() => {
    localStorage.clear();
    mockLocation = { pathname: '/dashboard' };
    useProfile.mockReset();
  });

  test('shows admin navigation toggle for staff users', async () => {
    useProfile.mockReturnValue({ profile: { username: 'admin-user', is_staff: true }, loading: false, error: null });

    render(
      <AppLayout>
        <div>Child content</div>
      </AppLayout>,
    );

    const adminToggle = screen.getByRole('button', { name: /Admin/i });
    expect(adminToggle).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(adminToggle);
    });

    expect(await screen.findByRole('link', { name: /Accounts/i })).toBeInTheDocument();
  });

  test('hides admin navigation for non-privileged users', () => {
    useProfile.mockReturnValue({ profile: { username: 'user', roles: ['member'] }, loading: false, error: null });

    render(
      <AppLayout>
        <div>Child content</div>
      </AppLayout>,
    );

    expect(screen.queryByRole('button', { name: /Admin/i })).not.toBeInTheDocument();
  });
});
