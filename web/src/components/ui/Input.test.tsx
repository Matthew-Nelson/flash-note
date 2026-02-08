import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from './Input';

describe('Input', () => {
  it('should render a text input', () => {
    render(<Input name="email" />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('should render label when provided', () => {
    render(<Input label="Email" name="email" />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('should associate label with input via id', () => {
    render(<Input label="Username" id="username" />);
    const input = screen.getByLabelText('Username');
    expect(input).toHaveAttribute('id', 'username');
  });

  it('should fall back to name as id when no id provided', () => {
    render(<Input label="Field" name="my-field" />);
    const input = screen.getByLabelText('Field');
    expect(input).toHaveAttribute('id', 'my-field');
  });

  it('should show error message', () => {
    render(<Input name="email" error="Required" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });

  it('should set aria-invalid when error is present', () => {
    render(<Input name="email" error="Required" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('should set aria-describedby to error element id', () => {
    render(<Input name="email" error="Bad" />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-describedby', 'email-error');
  });

  it('should NOT set aria-invalid when no error', () => {
    render(<Input name="email" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'false');
  });

  it('should show hint when provided and no error', () => {
    render(<Input name="email" hint="Enter your email" />);
    expect(screen.getByText('Enter your email')).toBeInTheDocument();
  });

  it('should hide hint when error is present', () => {
    render(<Input name="email" hint="Enter your email" error="Required" />);
    expect(screen.queryByText('Enter your email')).not.toBeInTheDocument();
  });

  it('should accept user input', async () => {
    const user = userEvent.setup();
    render(<Input name="email" />);
    const input = screen.getByRole('textbox');

    await user.type(input, 'test@example.com');
    expect(input).toHaveValue('test@example.com');
  });

  it('should forward ref', () => {
    const ref = vi.fn();
    render(<Input name="test" ref={ref} />);
    expect(ref).toHaveBeenCalledWith(expect.any(HTMLInputElement));
  });
});
