import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, ArrowLeft, ArrowRight, CheckCircle2, Lock, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export function ResetPassword() {
  const navigate = useNavigate();
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' && active) setRecoveryReady(true);
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (active) {
        // The recovery link establishes a temporary authenticated session.
        // An already-authenticated user can also use this screen to change their password.
        setRecoveryReady((current) => current || Boolean(session));
        setCheckingSession(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Use at least 8 characters for your new password.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setCompleted(true);
      await supabase.auth.signOut();
    } catch {
      setError('Unable to update your password. Request a fresh reset link and try again.');
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
          {completed ? (
            <div className="text-center py-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><CheckCircle2 className="w-8 h-8" /></div>
              <h2 className="text-xl font-bold text-jic-text mt-4">Password updated</h2>
              <p className="text-sm leading-6 text-jic-text-secondary mt-2">Your password has been changed. Sign in with your new password.</p>
              <button type="button" onClick={() => navigate('/signin', { replace: true })} className="mt-6 w-full bg-jic-orange hover:bg-jic-orange-deep text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2">Continue to sign in <ArrowRight className="w-4 h-4" /></button>
            </div>
          ) : checkingSession ? (
            <div className="py-8 text-center text-sm text-jic-text-secondary">Verifying your secure reset session...</div>
          ) : !recoveryReady ? (
            <div className="text-center py-3">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-orange-50 text-jic-orange flex items-center justify-center"><ShieldCheck className="w-8 h-8" /></div>
              <h2 className="text-xl font-bold text-jic-text mt-4">Reset link required</h2>
              <p className="text-sm leading-6 text-jic-text-secondary mt-2">This page needs a valid password-reset link. Request a new link and open it from your email.</p>
              <Link to="/forgot-password" className="mt-6 w-full bg-jic-orange hover:bg-jic-orange-deep text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2">Request reset link <ArrowRight className="w-4 h-4" /></Link>
              <Link to="/signin" className="inline-flex items-center gap-2 mt-4 text-sm font-semibold text-jic-orange hover:text-jic-orange-deep"><ArrowLeft className="w-4 h-4" /> Back to sign in</Link>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-jic-text">Choose a new password</h2>
              <p className="text-sm text-jic-text-secondary mt-1 mb-6">Use at least 8 characters. You will need this password next time you sign in.</p>
              {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
