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
