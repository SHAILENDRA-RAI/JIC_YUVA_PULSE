import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
} from 'lucide-react';

import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';

type SignInMode = 'password' | 'phone';

function normalizePhoneNumber(value: string): string | null {
  const trimmed = value.trim();
  const compact = trimmed.replace(/[\s()-]/g, '');

  if (/^\d{10}$/.test(compact)) return `+91${compact}`;
  if (/^91\d{10}$/.test(compact)) return `+${compact}`;
  if (/^\+[1-9]\d{7,14}$/.test(compact)) return compact;
  return null;
}

export function SignIn() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [mode, setMode] = useState<SignInMode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [normalizedPhone, setNormalizedPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setResendSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  async function handlePasswordSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        showToast('error', error.message);
        return;
      }

      showToast('success', 'Signed in successfully.');
      navigate('/', { replace: true });
    } catch {
      showToast('error', 'Unable to sign in right now. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function sendPhoneOtp(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const formattedPhone = normalizePhoneNumber(phone);

    if (!formattedPhone) {
      showToast('error', 'Enter a valid mobile number. Use 10 digits for India or include the country code, such as +91.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
        options: {
          shouldCreateUser: false,
          channel: 'sms',
        },
      });

      if (error) {
        showToast('error', error.message);
        return;
      }

      setNormalizedPhone(formattedPhone);
      setOtpSent(true);
      setOtp('');
      setResendSeconds(60);
      showToast('success', `Verification code sent to ${formattedPhone}.`);
    } catch {
      showToast('error', 'Could not send the verification code. Check your mobile number and SMS authentication settings.');
    } finally {
      setLoading(false);
    }
  }

  async function verifyPhoneOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp.trim())) {
      showToast('error', 'Enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: normalizedPhone,
        token: otp.trim(),
        type: 'sms',
      });

      if (error) {
        showToast('error', error.message);
        return;
      }

      showToast('success', 'Mobile number verified. Signed in successfully.');
      navigate('/', { replace: true });
    } catch {
      showToast('error', 'Unable to verify the code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function switchMode(nextMode: SignInMode) {
    setMode(nextMode);
    setOtpSent(false);
    setOtp('');
    setNormalizedPhone('');
    setResendSeconds(0);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-jic-bg p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-jic-orange to-jic-orange-deep flex items-center justify-center shadow-lg shadow-jic-orange/20 mb-4">
            <Activity className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-jic-text">JIC YUVA PULSE</h1>
          <p className="text-sm text-jic-text-secondary mt-1">Powering People. Tracking Progress.</p>
        </div>

        <div className="bg-white rounded-2xl border border-jic-border shadow-sm p-6">
          <h2 className="text-xl font-bold text-jic-text mb-1">Welcome back</h2>
          <p className="text-sm text-jic-text-secondary mb-5">Sign in to access your JIC workspace.</p>

          <div className="grid grid-cols-2 gap-2 rounded-xl bg-jic-muted p-1 mb-5" role="tablist" aria-label="Sign-in method">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'password'}
              onClick={() => switchMode('password')}
              className={`rounded-lg py-2.5 text-sm font-semibold transition-colors ${mode === 'password' ? 'bg-white text-jic-text shadow-sm' : 'text-jic-text-secondary hover:text-jic-text'}`}
            >
              Email & Password
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'phone'}
              onClick={() => switchMode('phone')}
              className={`rounded-lg py-2.5 text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${mode === 'phone' ? 'bg-white text-jic-text shadow-sm' : 'text-jic-text-secondary hover:text-jic-text'}`}
            >
              <Phone className="w-4 h-4" /> Mobile OTP
            </button>
          </div>

          {mode === 'password' ? (
            <form onSubmit={handlePasswordSignIn} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="signin-email" className="text-sm font-semibold text-jic-text">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-jic-text-secondary" />
                  <input
                    id="signin-email"
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@jecrc.ac.in"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-jic-border text-sm focus:outline-none focus:ring-2 focus:ring-jic-orange/20 focus:border-jic-orange transition-all"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="signin-password" className="text-sm font-semibold text-jic-text">Password</label>
                  <Link to="/forgot-password" className="text-xs font-semibold text-jic-orange hover:text-jic-orange-deep">Forgot password?</Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-jic-text-secondary" />
                  <input
                    id="signin-password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Your password"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-jic-border text-sm focus:outline-none focus:ring-2 focus:ring-jic-orange/20 focus:border-jic-orange transition-all"
                  />
                </div>
              </div>

              <button type="submit" disabled={loading} className="w-full bg-jic-orange hover:bg-jic-orange-deep text-white font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {loading ? 'Signing in...' : 'Sign In'}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          ) : (
            <div>
              {!otpSent ? (
                <form onSubmit={(event) => void sendPhoneOtp(event)} className="space-y-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="signin-phone" className="text-sm font-semibold text-jic-text">Mobile number</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-jic-text-secondary" />
                      <input
                        id="signin-phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        required
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        placeholder="+91 98765 43210"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-jic-border text-sm focus:outline-none focus:ring-2 focus:ring-jic-orange/20 focus:border-jic-orange transition-all"
                      />
                    </div>
                    <p className="text-xs leading-5 text-jic-text-secondary">Use the mobile number already linked to your JIC account. Indian 10-digit numbers are accepted.</p>
                  </div>
                  <button type="submit" disabled={loading} className="w-full bg-jic-orange hover:bg-jic-orange-deep text-white font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                    {loading ? 'Sending code...' : 'Send OTP'}
                    {!loading && <ArrowRight className="w-4 h-4" />}
                  </button>
                  <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50/70 p-3">
                    <ShieldCheck className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" />
                    <p className="text-xs leading-5 text-blue-800">OTP sign-in is limited to existing JIC accounts. It will not create a new account.</p>
                  </div>
                </form>
              ) : (
                <form onSubmit={verifyPhoneOtp} className="space-y-4">
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
                    <p className="text-xs leading-5 text-emerald-800">A 6-digit code was sent to <strong>{normalizedPhone}</strong>.</p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="signin-otp" className="text-sm font-semibold text-jic-text">Verification code</label>
                    <input
                      id="signin-otp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      required
                      value={otp}
                      onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Enter 6-digit OTP"
                      className="w-full px-4 py-3 rounded-xl border border-jic-border text-center text-lg tracking-[0.35em] font-bold focus:outline-none focus:ring-2 focus:ring-jic-orange/20 focus:border-jic-orange transition-all"
                    />
                  </div>
                  <button type="submit" disabled={loading || otp.length !== 6} className="w-full bg-jic-orange hover:bg-jic-orange-deep text-white font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                    {loading ? 'Verifying...' : 'Verify & Sign In'}
                    {!loading && <ArrowRight className="w-4 h-4" />}
                  </button>
                  <div className="flex items-center justify-between text-xs">
                    <button type="button" onClick={() => { setOtpSent(false); setOtp(''); }} className="font-semibold text-jic-text-secondary hover:text-jic-text">Change number</button>
                    <button type="button" onClick={() => void sendPhoneOtp()} disabled={loading || resendSeconds > 0} className="font-semibold text-jic-orange hover:text-jic-orange-deep disabled:text-jic-text-secondary disabled:cursor-not-allowed">
                      {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : 'Resend OTP'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          <div className="mt-6 pt-5 border-t border-jic-border text-center">
            <p className="text-sm text-jic-text-secondary">New to JIC?</p>
            <Link to="/signup" className="inline-flex items-center gap-1 mt-2 text-sm font-semibold text-jic-orange hover:text-jic-orange-deep transition-colors">
              Create an account <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <p className="text-xs text-center text-jic-text-secondary mt-5">Access is available only to approved JIC members.</p>
      </div>
    </div>
  );
}
