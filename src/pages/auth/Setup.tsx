import { Link } from 'react-router-dom';
import { Activity, ShieldCheck, ArrowLeft } from 'lucide-react';

export function Setup() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-jic-bg p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-jic-orange to-jic-orange-deep flex items-center justify-center shadow-lg shadow-jic-orange/20 mb-4">
            <Activity className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-jic-text">JIC YUVA PULSE</h1>
          <p className="text-sm text-jic-text-secondary mt-1">Secure community workspace</p>
        </div>

        <div className="bg-white rounded-2xl border border-jic-border shadow-sm p-6">
          <div className="w-12 h-12 rounded-xl bg-jic-orange-soft flex items-center justify-center mb-4">
            <ShieldCheck className="w-6 h-6 text-jic-orange" />
          </div>
          <h2 className="text-xl font-bold text-jic-text mb-2">Account setup is managed by JIC</h2>
          <p className="text-sm leading-6 text-jic-text-secondary">
            For security, public self-registration is currently disabled. Ask an authorised JIC administrator to provision your account. Your designation and department will be assigned as part of onboarding.
          </p>
          <Link to="/signin" className="mt-6 w-full bg-jic-orange hover:bg-jic-orange-deep text-white font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
