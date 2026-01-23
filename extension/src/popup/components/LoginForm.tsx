import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { validateLogin, validateRegister } from '../../shared/schemas';

export default function LoginForm() {
  const { login, register } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    // Validate input with Zod
    const validation = isSignUp
      ? validateRegister({ email, password })
      : validateLogin({ email, password });

    if (!validation.success) {
      setErrors(validation.errors);
      return;
    }

    setIsLoading(true);

    try {
      if (isSignUp) {
        await register(email, password);
      } else {
        await login(email, password);
      }
    } catch (err) {
      if (err instanceof Error) {
        setErrors([err.message]);
      } else {
        setErrors(['An unexpected error occurred']);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col justify-center min-h-[500px] px-6 py-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">FlashNote</h1>
        <p className="text-sm text-gray-600 mt-1">
          AI-powered SOAP notes for PTs
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            placeholder="you@clinic.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            placeholder={isSignUp ? 'Min 8 chars, 1 uppercase, 1 number' : '********'}
          />
        </div>

        {errors.length > 0 && (
          <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">
            {errors.length === 1 ? (
              errors[0]
            ) : (
              <ul className="list-disc list-inside space-y-1">
                {errors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Loading...
            </span>
          ) : isSignUp ? (
            'Create Account'
          ) : (
            'Sign In'
          )}
        </button>
      </form>

      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => setIsSignUp(!isSignUp)}
          className="text-sm text-primary-600 hover:text-primary-500"
        >
          {isSignUp
            ? 'Already have an account? Sign in'
            : "Don't have an account? Sign up"}
        </button>
      </div>
    </div>
  );
}
