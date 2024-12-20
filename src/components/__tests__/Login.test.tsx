import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Login from '../Login';

describe('Login Component', () => {
  const mockOnLogin = jest.fn();

  beforeEach(() => {
    render(<Login onLogin={mockOnLogin} />);
  });

  it('renders login form', () => {
    expect(screen.getByText('Login to AI Cover Letter Generator')).toBeInTheDocument();
    expect(screen.getByLabelText(/Email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Login/i })).toBeInTheDocument();
  });

  it('disables the login button when fields are empty', () => {
    const loginButton = screen.getByRole('button', { name: /Login/i });
    expect(loginButton).toBeDisabled();
  });

  it('validates empty fields', async () => {
    fireEvent.click(screen.getByRole('button', { name: /Login/i }));

    await waitFor(() => {
      expect(screen.getByText('Email is required')).toBeInTheDocument();
      expect(screen.getByText('Password is required')).toBeInTheDocument();
    });

    expect(mockOnLogin).not.toHaveBeenCalled();
  });

  it('validates invalid email', async () => {
    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'invalid-email' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /Login/i }));

    await waitFor(() => {
      expect(screen.getByText('Email is invalid')).toBeInTheDocument();
    });

    expect(mockOnLogin).not.toHaveBeenCalled();
  });

  it('submits form with valid data', async () => {
    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /Login/i }));

    await waitFor(() => {
      expect(mockOnLogin).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  it('shows loading indicator during submission', async () => {
    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /Login/i }));

    expect(screen.getByText(/loading/i)).toBeInTheDocument(); // Adjust according to your loading implementation
  });

  it('displays error message on failed login', async () => {
    // Mock the onLogin function to simulate a failed login
    mockOnLogin.mockImplementationOnce(() => {
      throw new Error('Invalid credentials');
    });

    fireEvent.change(screen.getByLabelText(/Email address/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'wrongpassword' } });
    fireEvent.click(screen.getByRole('button', { name: /Login/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });
});
