import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  UserRound,
} from 'lucide-react';

import { supabase } from '@/lib/supabase';

export function SignUp() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
      setError(
        'Registration failed. Check your connection and try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-jic-bg p-4">
      <div className="w-full max-w-md">

        {/* Branding */}
        <div className="flex flex-col items-center mb-7">
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
            /* Registration success */
            <div className="text-center py-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <h2 className="text-xl font-bold text-jic-text mt-4">
                Check your email
              </h2>

              <p className="text-sm leading-6 text-jic-text-secondary mt-3">
                Your registration request has been submitted.
                Open the verification link sent to your email address.
                After verification, your account will remain pending
                until a JIC administrator approves it.
              </p>

              <div className="mt-5 rounded-xl border border-orange-100 bg-orange-50/70 p-4 text-left">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-jic-orange shrink-0" />
                  <p className="text-sm font-semibold text-jic-text">
                    Approval required
                  </p>
                </div>

                <p className="text-xs leading-5 text-jic-text-secondary mt-2">
                  You can access the workspace after your account
                  has been approved by a JIC administrator.
                </p>
              </div>

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

              <p className="text-sm text-jic-text-secondary mt-1">
                Join the JIC YUVA PULSE workspace.
              </p>

              {/* Registration steps */}
              <div className="mt-4 mb-5 rounded-xl border border-orange-100 bg-orange-50/60 p-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-jic-orange shrink-0" />

                  <h3 className="text-sm font-semibold text-jic-text">
                    What happens next?
                  </h3>
                </div>

                <div className="mt-3 space-y-2">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 shrink-0 rounded-full bg-white border border-orange-200 text-jic-orange text-xs font-bold flex items-center justify-center">
                      1
                    </span>

                    <p className="text-xs leading-5 text-jic-text-secondary">
                      <span className="font-semibold text-jic-text">
                        Verify your email.
                      </span>{' '}
                      Open the verification link sent to your inbox.
                    </p>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 shrink-0 rounded-full bg-white border border-orange-200 text-jic-orange text-xs font-bold flex items-center justify-center">
                      2
                    </span>

                    <p className="text-xs leading-5 text-jic-text-secondary">
                      <span className="font-semibold text-jic-text">
                        Await approval.
                      </span>{' '}
                      A JIC administrator will review your request.
                    </p>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 shrink-0 rounded-full bg-white border border-orange-200 text-jic-orange text-xs font-bold flex items-center justify-center">
                      3
                    </span>

                    <p className="text-xs leading-5 text-jic-text-secondary">
                      <span className="font-semibold text-jic-text">
                        Access your workspace.
                      </span>{' '}
                      Sign in after your account is approved.
                    </p>
                  </div>
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div
                  role="alert"
                  className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                >
                  {error}
                </div>
              )}

              {/* Registration form */}
              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Full name */}
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
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-jic-border text-sm focus:outline-none focus:ring-2 focus:ring-jic-orange/20 focus:border-jic-orange transition-all"
                    />
                  </div>
                </div>

                {/* Email */}
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
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-jic-border text-sm focus:outline-none focus:ring-2 focus:ring-jic-orange/20 focus:border-jic-orange transition-all"
                    />
                  </div>
                </div>

                {/* Password */}
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
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={password}
                      onChange={event => setPassword(event.target.value)}
                      placeholder="At least 8 characters"
                      className="w-full pl-10 pr-12 py-2.5 rounded-xl border border-jic-border text-sm focus:outline-none focus:ring-2 focus:ring-jic-orange/20 focus:border-jic-orange transition-all"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword(value => !value)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showPassword}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-jic-text-secondary hover:text-jic-text transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Confirm password */}
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
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={event => setConfirmPassword(event.target.value)}
                      placeholder="Enter your password again"
                      className="w-full pl-10 pr-12 py-2.5 rounded-xl border border-jic-border text-sm focus:outline-none focus:ring-2 focus:ring-jic-orange/20 focus:border-jic-orange transition-all"
                    />

                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(value => !value)}
                      aria-label={
                        showConfirmPassword
                          ? 'Hide confirmation password'
                          : 'Show confirmation password'
                      }
                      aria-pressed={showConfirmPassword}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-jic-text-secondary hover:text-jic-text transition-colors"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-jic-orange hover:bg-jic-orange-deep text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? 'Creating account...' : 'Create account'}

                  {!loading && <ArrowRight className="w-4 h-4" />}
                </button>
              </form>

              {/* Sign in link */}
              <div className="mt-6 pt-4 border-t border-jic-border text-center">
                <p className="text-sm text-jic-text-secondary">
                  Already have an account?
                </p>

                <Link
                  to="/signin"
                  className="inline-flex items-center gap-2 mt-2 text-sm font-semibold text-jic-orange hover:text-jic-orange-deep transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Sign in
                </Link>
              </div>
            </>
          )}
        </div>

        <p className="text-xs text-center text-jic-text-secondary mt-5 leading-5">
          Access to internal JIC information is restricted to approved members.
        </p>
      </div>
    </div>
  );
}
