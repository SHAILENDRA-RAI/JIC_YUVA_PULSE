import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Lock,
  Mail,
  UserRound,
} from 'lucide-react';

import { supabase } from '@/lib/supabase';

export function SignUp() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (fullName.trim().length < 2) {
      setError('Please enter your full name.');
      return;
    }

    if (password.length < 8) {
      setError('Your password must contain at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const redirectUrl =
        `${window.location.origin}${import.meta.env.BASE_URL}`;

      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
          emailRedirectTo: redirectUrl,
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      setSubmitted(true);
    } catch {
      setError('Registration failed. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-jic-bg p-4">
      <div className="w-full max-w-md">

        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-jic-orange to-jic-orange-deep flex items-center justify-center shadow-lg shadow-jic-orange/20 mb-4">
            <Activity className="w-9 h-9 text-white" />
          </div>

          <h1 className="text-2xl font-bold text-jic-text">
            JIC YUVA PULSE
          </h1>

          <p className="text-sm text-jic-text-secondary mt-1">
            Powering People. Tracking Progress.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-jic-border shadow-sm p-6">

          {submitted ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <h2 className="text-xl font-bold text-jic-text mt-4">
                Check your email
              </h2>

              <p className="text-sm leading-6 text-jic-text-secondary mt-3">
                Your registration request has been submitted.

                If email verification is enabled, open the verification
                link sent to your email address.

                Your JIC account will remain pending until an
                administrator approves it.
              </p>

              <Link
                to="/signin"
                className="mt-6 w-full bg-jic-orange hover:bg-jic-orange-deep text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
              >
                Continue to sign in
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-jic-text">
                Create your account
              </h2>

              <p className="text-sm text-jic-text-secondary mt-1 mb-6">
                Join the JIC YUVA PULSE workspace.
              </p>

              {error && (
                <div
                  role="alert"
                  className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                >
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="signup-name"
                    className="text-sm font-semibold text-jic-text"
                  >
                    Full name
                  </label>

                  <div className="relative">
                    <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-jic-text-secondary" />

                    <input
                      id="signup-name"
                      type="text"
                      autoComplete="name"
                      required
                      maxLength={100}
                      value={fullName}
                      onChange={event => setFullName(event.target.value)}
                      placeholder="Your full name"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-jic-border text-sm focus:outline-none focus:ring-2 focus:ring-jic-orange/20 focus:border-jic-orange"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="signup-email"
                    className="text-sm font-semibold text-jic-text"
                  >
                    Email
                  </label>

                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-jic-text-secondary" />

                    <input
                      id="signup-email"
                      type="email"
                      autoComplete="email"
                      required
                      maxLength={254}
                      value={email}
                      onChange={event => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-jic-border text-sm focus:outline-none focus:ring-2 focus:ring-jic-orange/20 focus:border-jic-orange"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="signup-password"
                    className="text-sm font-semibold text-jic-text"
                  >
                    Password
                  </label>

                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-jic-text-secondary" />

                    <input
                      id="signup-password"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={password}
                      onChange={event => setPassword(event.target.value)}
                      placeholder="At least 8 characters"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-jic-border text-sm focus:outline-none focus:ring-2 focus:ring-jic-orange/20 focus:border-jic-orange"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="signup-confirm"
                    className="text-sm font-semibold text-jic-text"
                  >
                    Confirm password
                  </label>

                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-jic-text-secondary" />

                    <input
                      id="signup-confirm"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={event => setConfirmPassword(event.target.value)}
                      placeholder="Enter your password again"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-jic-border text-sm focus:outline-none focus:ring-2 focus:ring-jic-orange/20 focus:border-jic-orange"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-jic-orange hover:bg-jic-orange-deep text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? 'Creating account...' : 'Create account'}
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </button>

              </form>

              <div className="mt-6 pt-4 border-t border-jic-border text-center">
                <p className="text-sm text-jic-text-secondary">
                  Already have an account?
                </p>

                <Link
                  to="/signin"
                  className="inline-flex items-center gap-2 mt-2 text-sm font-semibold text-jic-orange hover:text-jic-orange-deep"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Sign in
                </Link>
              </div>
            </>
          )}
        </div>

        <p className="text-xs text-center text-jic-text-secondary mt-5">
          Registration does not grant immediate access to JIC internal data.
          Your account must be verified and approved.
        </p>

      </div>
    </div>
  );
}
