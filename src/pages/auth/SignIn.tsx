import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Mail, Lock, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';

export function SignIn() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
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
          <h2 className="text-xl font-bold text-jic-text mb-1">Sign In</h2>
          <p className="text-sm text-jic-text-secondary mb-6">Use the account provisioned for you by JIC.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-semibold text-jic-text">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-jic-text-secondary" />
                <input id="email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@jecrc.ac.in" className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-jic-border text-sm focus:outline-none focus:ring-2 focus:ring-jic-orange/20 focus:border-jic-orange transition-all" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-semibold text-jic-text">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-jic-text-secondary" />
                <input id="password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-jic-border text-sm focus:outline-none focus:ring-2 focus:ring-jic-orange/20 focus:border-jic-orange transition-all" />
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full bg-jic-orange hover:bg-jic-orange-deep text-white font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? 'Signing in...' : 'Sign In'}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-jic-border text-center">
            <p className="text-sm text-jic-text-secondary">New to JIC? Contact an authorised JIC administrator to set up your account.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
