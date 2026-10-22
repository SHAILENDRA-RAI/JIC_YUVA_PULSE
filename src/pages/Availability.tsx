import { useEffect, useMemo, useState } from 'react';
import { Activity, Check, Clock3, RefreshCw, Users, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, LoadingState } from '@/components/ui/EmptyState';
import type { AvailabilityUpdate, Profile } from '@/types';

type Member = Pick<Profile, 'id' | 'full_name' | 'designation' | 'status'>;
type AvailabilityChoice = 'available' | 'limited' | 'busy' | 'unavailable';

const statusOptions: { value: AvailabilityChoice; label: string; description: string; style: string; dot: string }[] = [
  { value: 'available', label: 'Available', description: 'I can take on new work.', style: 'border-emerald-300 bg-emerald-50 text-emerald-800', dot: 'bg-emerald-500' },
  { value: 'limited', label: 'Limited', description: 'I have some capacity.', style: 'border-amber-300 bg-amber-50 text-amber-800', dot: 'bg-amber-500' },
  { value: 'busy', label: 'Busy', description: 'I am focused on current work.', style: 'border-blue-300 bg-blue-50 text-blue-800', dot: 'bg-blue-500' },
  { value: 'unavailable', label: 'Unavailable', description: 'I cannot take on work right now.', style: 'border-slate-300 bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
];
const durationOptions = [
  { value: 4, label: '4 hours' },
  { value: 8, label: '8 hours' },
  { value: 24, label: '24 hours' },
  { value: 72, label: '3 days' },
];

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || 'YU';
}
function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function getCurrentStatus(update: AvailabilityUpdate | undefined, now: number) {
  if (!update || new Date(update.expiry_time).getTime() <= now) return 'needs_update';
  return update.status;
}
function statusLabel(status: string) {
  if (status === 'needs_update') return 'Needs update';
  return statusOptions.find(option => option.value === status)?.label || status;
}
function statusBadge(status: string) {
  if (status === 'available') return 'bg-emerald-100 text-emerald-800';
  if (status === 'limited') return 'bg-amber-100 text-amber-800';
  if (status === 'busy') return 'bg-blue-100 text-blue-800';
  if (status === 'unavailable') return 'bg-slate-100 text-slate-700';
  return 'bg-slate-100 text-slate-500';
}

export function Availability() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [updates, setUpdates] = useState<AvailabilityUpdate[]>([]);
  const [status, setStatus] = useState<AvailabilityChoice>('available');
  const [duration, setDuration] = useState(8);
  const [capacity, setCapacity] = useState('');
  const [categories, setCategories] = useState('');
  const [note, setNote] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());

  async function loadAvailability() {
    setLoading(true);
    setError('');
    const [membersResult, updatesResult] = await Promise.all([
      supabase.from('profiles').select('id, full_name, designation, status').eq('status', 'active').order('full_name', { ascending: true }),
      supabase.from('availability_updates').select('*').order('created_at', { ascending: false }).limit(1000),
    ]);
    if (membersResult.error) {
      setError(membersResult.error.message);
      setMembers([]);
    } else {
      setMembers((membersResult.data || []) as Member[]);
    }
    if (updatesResult.error) {
      const updateErrorMessage = updatesResult.error.message;
      setError(current => current || updateErrorMessage);
      setUpdates([]);
    } else {
      setUpdates((updatesResult.data || []) as AvailabilityUpdate[]);
    }
    setNow(Date.now());
    setLoading(false);
  }

  useEffect(() => { void loadAvailability(); }, []);

  const latestByMember = useMemo(() => {
    const result = new Map<string, AvailabilityUpdate>();
    [...updates].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).forEach(update => {
      if (!result.has(update.member_id)) result.set(update.member_id, update);
    });
    return result;
  }, [updates]);

  const memberRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return members.filter(member => !needle || `${member.full_name} ${member.designation || ''}`.toLowerCase().includes(needle))
      .map(member => ({ member, update: latestByMember.get(member.id), currentStatus: getCurrentStatus(latestByMember.get(member.id), now) }));
  }, [members, latestByMember, search, now]);

  const counts = useMemo(() => {
    const values = { available: 0, limited: 0, busy: 0, unavailable: 0, needs_update: 0 };
    members.forEach(member => {
      const current = getCurrentStatus(latestByMember.get(member.id), now) as keyof typeof values;
      values[current] = (values[current] || 0) + 1;
    });
    return values;
  }, [members, latestByMember, now]);

  const myUpdate = profile ? latestByMember.get(profile.id) : undefined;
  const myStatus = getCurrentStatus(myUpdate, now);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile?.id) {
      showToast('error', 'Your profile is still loading. Refresh and try again.');
      return;
    }
    setSaving(true);
    const expiry = new Date(Date.now() + duration * 60 * 60 * 1000).toISOString();
    const preferredCategories = categories.split(',').map(value => value.trim()).filter(Boolean).slice(0, 12);
    const { error: insertError } = await supabase.from('availability_updates').insert({
      member_id: profile.id,
      status,
      start_time: new Date().toISOString(),
      expiry_time: expiry,
      capacity: capacity.trim() || null,
      preferred_categories: preferredCategories,
      note: note.trim() || null,
    });
    setSaving(false);
    if (insertError) {
      showToast('error', `Could not save availability: ${insertError.message}`);
      return;
    }
    showToast('success', 'Your availability has been updated.');
    setNow(Date.now());
    await loadAvailability();
  }

  if (loading) return <LoadingState message="Loading the availability tracker..." />;

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-fade-in">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-jic-orange uppercase tracking-wide">JIC YUVA PULSE</p>
          <h1 className="text-3xl font-bold text-jic-text mt-1">Availability Tracker</h1>
          <p className="text-jic-text-secondary mt-2">Share your current capacity so the team can plan work realistically.</p>
        </div>
        <button onClick={() => void loadAvailability()} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-jic-border bg-white text-sm font-semibold text-jic-text hover:bg-jic-muted transition-colors">
          <RefreshCw className="w-4 h-4" /> Refresh tracker
        </button>
      </header>

      <section className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        <Card><CardBody className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><Zap className="w-5 h-5" /></div><div><p className="text-xs text-jic-text-secondary">Available</p><p className="text-2xl font-bold text-jic-text">{counts.available}</p></div></CardBody></Card>
        <Card><CardBody className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center"><Activity className="w-5 h-5" /></div><div><p className="text-xs text-jic-text-secondary">Limited</p><p className="text-2xl font-bold text-jic-text">{counts.limited}</p></div></CardBody></Card>
        <Card><CardBody className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center"><Clock3 className="w-5 h-5" /></div><div><p className="text-xs text-jic-text-secondary">Busy</p><p className="text-2xl font-bold text-jic-text">{counts.busy}</p></div></CardBody></Card>
        <Card><CardBody className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center"><Users className="w-5 h-5" /></div><div><p className="text-xs text-jic-text-secondary">Unavailable</p><p className="text-2xl font-bold text-jic-text">{counts.unavailable}</p></div></CardBody></Card>
        <Card><CardBody className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-orange-50 text-jic-orange flex items-center justify-center"><Clock3 className="w-5 h-5" /></div><div><p className="text-xs text-jic-text-secondary">Needs update</p><p className="text-2xl font-bold text-jic-text">{counts.needs_update}</p></div></CardBody></Card>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-6 items-start">
        <Card>
          <CardHeader title="Update your availability" subtitle="Your declaration automatically expires after the selected duration." />
          <CardBody>
            {myUpdate && <div className="mb-4 rounded-xl border border-jic-border bg-jic-muted/40 p-3 flex items-center justify-between gap-3"><div><p className="text-xs text-jic-text-secondary">Current declaration</p><p className="font-semibold text-jic-text mt-0.5">{statusLabel(myStatus)}</p><p className="text-xs text-jic-text-secondary mt-1">{myStatus === 'needs_update' ? 'Your previous declaration has expired.' : `Expires ${formatDateTime(myUpdate.expiry_time)}`}</p></div><Badge className={statusBadge(myStatus)}>{myStatus === 'needs_update' ? 'Expired' : 'Active'}</Badge></div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <fieldset>
                <legend className="text-sm font-semibold text-jic-text mb-2">What is your current capacity?</legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {statusOptions.map(option => (
                    <button key={option.value} type="button" onClick={() => setStatus(option.value)} className={`rounded-xl border p-3 text-left transition-all ${status === option.value ? option.style + ' ring-2 ring-offset-1 ring-current/20' : 'border-jic-border bg-white hover:bg-jic-muted/50'}`}>
                      <span className="flex items-center justify-between gap-2"><span className="font-semibold text-sm">{option.label}</span>{status === option.value && <Check className="w-4 h-4" />}</span>
                      <span className="block text-xs mt-1 opacity-80">{option.description}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <label className="block"><span className="block text-sm font-semibold text-jic-text mb-1.5">How long should this declaration last?</span><select value={duration} onChange={event => setDuration(Number(event.target.value))} className="w-full rounded-xl border border-jic-border bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-jic-orange/20 focus:border-jic-orange">{durationOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <label className="block"><span className="block text-sm font-semibold text-jic-text mb-1.5">Capacity (optional)</span><input value={capacity} onChange={event => setCapacity(event.target.value)} maxLength={80} placeholder="e.g. 4 hours this week" className="w-full rounded-xl border border-jic-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-jic-orange/20 focus:border-jic-orange" /></label>
              <label className="block"><span className="block text-sm font-semibold text-jic-text mb-1.5">Preferred work categories (optional)</span><input value={categories} onChange={event => setCategories(event.target.value)} maxLength={240} placeholder="e.g. Outreach, Events, Design" className="w-full rounded-xl border border-jic-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-jic-orange/20 focus:border-jic-orange" /><span className="block text-xs text-jic-text-secondary mt-1">Separate categories with commas.</span></label>
              <label className="block"><span className="block text-sm font-semibold text-jic-text mb-1.5">Note for the team (optional)</span><textarea value={note} onChange={event => setNote(event.target.value)} rows={3} maxLength={500} placeholder="Anything the team should know about your capacity?" className="w-full resize-y rounded-xl border border-jic-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-jic-orange/20 focus:border-jic-orange" /></label>
              <button type="submit" disabled={saving || !profile?.id} className="w-full rounded-xl bg-jic-orange hover:bg-jic-orange-deep disabled:opacity-60 text-white font-semibold px-4 py-3 flex items-center justify-center gap-2 transition-colors">{saving ? 'Saving declaration...' : 'Save availability'} <Check className="w-4 h-4" /></button>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Team availability" subtitle="Only the latest unexpired declaration is treated as current." />
          <CardBody>
            {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4"><p className="font-semibold text-red-800">Tracker data could not fully load</p><p className="text-sm text-red-700 mt-1">{error}</p><button onClick={() => void loadAvailability()} className="mt-3 text-sm font-semibold text-red-800 underline">Try again</button></div> : <>
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search team members..." aria-label="Search team members" className="w-full rounded-xl border border-jic-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-jic-orange/20 focus:border-jic-orange" />
              {memberRows.length === 0 ? <div className="mt-4"><EmptyState icon={<Users className="w-8 h-8" />} title="No active members found" description="Active team profiles will appear here." /></div> : <div className="mt-4 divide-y divide-jic-border">{memberRows.map(({ member, update, currentStatus }) => (
                <div key={member.id} className="py-3 first:pt-0 last:pb-0 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-jic-orange-soft text-jic-orange flex items-center justify-center font-bold text-sm shrink-0">{initials(member.full_name)}</div>
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-sm text-jic-text">{member.full_name}</p><Badge className={statusBadge(currentStatus)}>{statusLabel(currentStatus)}</Badge></div><p className="text-xs text-jic-text-secondary mt-0.5">{member.designation || 'Designation not set'}</p>{update && <><p className="text-xs text-jic-text-secondary mt-1">{new Date(update.expiry_time).getTime() > now ? `Until ${formatDateTime(update.expiry_time)}` : `Last declared ${formatDateTime(update.created_at)}`}</p>{new Date(update.expiry_time).getTime() > now && update.capacity && <p className="text-xs text-jic-text mt-1">Capacity: {update.capacity}</p>}{new Date(update.expiry_time).getTime() > now && update.note && <p className="text-sm text-jic-text-secondary mt-1 break-words">{update.note}</p>}{new Date(update.expiry_time).getTime() > now && update.preferred_categories?.length > 0 && <div className="flex flex-wrap gap-1.5 mt-2">{update.preferred_categories.slice(0, 5).map(category => <span key={category} className="rounded-lg bg-jic-muted px-2 py-1 text-xs text-jic-text">{category}</span>)}</div>}</>}</div>
                </div>
              ))}</div>}
            </>}
          </CardBody>
        </Card>
      </div>
      <p className="text-xs text-jic-text-secondary">Availability is self-declared. Expired declarations are shown as “Needs update” and are not counted as current capacity.</p>
    </div>
  );
}
