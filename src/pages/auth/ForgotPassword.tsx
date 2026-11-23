import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowLeft, ArrowRight, CheckCircle2, Mail } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}#/reset-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (resetError) {
        setError(resetError.message);
        return;
      }
      setSubmitted(true);
    } catch {
      setError('Unable to send a reset link right now. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-jic-bg p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-jic-orange to-jic-orange-deep flex items-center justify-center shadow-lg shadow-jic-orange/20 mb-4"><Activity className="w-9 h-9 text-white" /></div>
          <h1 className="text-2xl font-bold text-jic-text">JIC YUVA PULSE</h1>
          <p className="text-sm text-jic-text-secondary mt-1">Powering People. Tracking Progress.</p>
        </div>

        <div className="bg-white rounded-2xl border border-jic-border shadow-sm p-6">
          {submitted ? (
            <div className="text-center py-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><CheckCircle2 className="w-8 h-8" /></div>
              <h2 className="text-xl font-bold text-jic-text mt-4">Check your email</h2>
              <p className="text-sm leading-6 text-jic-text-secondary mt-2">If an account exists for that email address, a password reset link has been sent. Open the link on this device to choose a new password.</p>
              <Link to="/signin" className="mt-6 w-full bg-jic-orange hover:bg-jic-orange-deep text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"><ArrowLeft className="w-4 h-4" /> Back to sign in</Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-jic-text">Reset your password</h2>
              <p className="text-sm leading-6 text-jic-text-secondary mt-1 mb-6">Enter the email address associated with your JIC account. We'll send you a secure reset link.</p>
              {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="reset-email" className="text-sm font-semibold text-jic-text">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-jic-text-secondary" />
                    <input id="reset-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@jecrc.ac.in" className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-jic-border text-sm focus:outline-none focus:ring-2 focus:ring-jic-orange/20 focus:border-jic-orange transition-all" />
                  </div>
                </div>
                <button type="submit" disabled={loading} className="w-full bg-jic-orange hover:bg-jic-orange-deep text-white font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50">{loading ? 'Sending link...' : 'Send reset link'} {!loading && <ArrowRight className="w-4 h-4" />}</button>
              </form>
              <div className="mt-6 pt-4 border-t border-jic-border text-center">
                <Link to="/signin" className="inline-flex items-center gap-2 text-sm font-semibold text-jic-orange hover:text-jic-orange-deep"><ArrowLeft className="w-4 h-4" /> Back to sign in</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
