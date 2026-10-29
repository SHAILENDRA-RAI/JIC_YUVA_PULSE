import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  Activity,
  Clock3,
  RefreshCw,
  LogOut,
  ShieldCheck,
} from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import { LoadingState } from '@/components/ui/EmptyState';

export function PendingApproval() {
  const {
    session,
    profile,
    loading,
    refreshProfile,
    signOut,
  } = useAuth();

  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);

  async function checkStatus() {
    setChecking(true);

    try {
      await refreshProfile();
    } finally {
      setChecking(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    navigate('/signin', { replace: true });
  }

  if (loading) {
    return <LoadingState message="Checking your account status..." />;
  }

  if (!session) {
    return <Navigate to="/signin" replace />;
  }

  if (profile?.status === 'active') {
    return <Navigate to="/" replace />;
  }

  const inactive = profile?.status === 'inactive';

  return (
    <div className="min-h-screen flex items-center justify-center bg-jic-bg p-4">
      <div className="w-full max-w-lg">

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

        <div className="bg-white rounded-2xl border border-jic-border shadow-sm p-7">

          <div className="flex justify-center mb-5">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
              inactive
                ? 'bg-red-50 text-red-600'
                : 'bg-amber-50 text-amber-600'
            }`}>
              {inactive
                ? <ShieldCheck className="w-8 h-8" />
                : <Clock3 className="w-8 h-8" />
              }
            </div>
          </div>

          <div className="text-center">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
              inactive
                ? 'bg-red-100 text-red-800'
                : 'bg-amber-100 text-amber-800'
            }`}>
              {inactive ? 'Access disabled' : 'Approval pending'}
            </span>

            <h2 className="text-xl font-bold text-jic-text mt-4">
              {inactive
                ? 'Your account is inactive'
                : 'Your account is awaiting approval'
              }
            </h2>

            <p className="text-sm text-jic-text-secondary leading-6 mt-3">
              {inactive
                ? 'Your JIC workspace access is currently disabled. Please contact a JIC administrator for assistance.'
                : 'Your registration has been received. Please verify your email if required and wait for a JIC administrator to approve your account.'
              }
            </p>

            {profile && (
              <div className="mt-5 rounded-xl bg-jic-muted p-4 text-left">
                <p className="text-xs text-jic-text-secondary">
                  Registered account
                </p>

                <p className="text-sm font-semibold text-jic-text mt-1 break-all">
                  {profile.email}
                </p>

                <p className="text-xs text-jic-text-secondary mt-2">
                  {profile.full_name}
                </p>
              </div>
            )}

            {!profile && (
              <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
                Your profile could not be loaded. Please sign out and contact
                a JIC administrator.
              </p>
            )}

            {!inactive && (
              <button
                onClick={() => void checkStatus()}
                disabled={checking}
                className="mt-6 w-full rounded-xl bg-jic-orange hover:bg-jic-orange-deep disabled:opacity-50 text-white font-semibold py-3 flex items-center justify-center gap-2 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
                {checking ? 'Checking status...' : 'Check approval status'}
              </button>
            )}

            <button
              onClick={() => void handleSignOut()}
              className="mt-3 w-full rounded-xl border border-jic-border bg-white hover:bg-jic-muted text-jic-text font-semibold py-3 flex items-center justify-center gap-2 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>

        <p className="text-xs text-center text-jic-text-secondary mt-5">
          Access to JIC internal information is restricted to approved members.
        </p>

      </div>
    </div>
  );
}
