import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check, Clock3, Zap, Activity, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, LoadingState } from '@/components/ui/EmptyState';
import type { AvailabilityUpdate, Profile } from '@/types';

type Member = Pick<Profile, 'id' | 'full_name' | 'designation' | 'status'>;
type AvailabilityChoice = 'available' | 'limited' | 'busy' | 'unavailable';

const STATUS_OPTIONS: {
  value: AvailabilityChoice;
  label: string;
  description: string;
  badge: string;
  button: string;
}[] = [
  {
    value: 'available',
    label: 'Available',
    description: 'Ready for new work',
    badge: 'bg-emerald-100 text-emerald-800',
    button: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  },
  {
    value: 'limited',
    label: 'Limited',
    description: 'Some capacity available',
    badge: 'bg-amber-100 text-amber-800',
    button: 'border-amber-300 bg-amber-50 text-amber-900',
  },
  {
    value: 'busy',
    label: 'Busy',
    description: 'Focused on current work',
    badge: 'bg-blue-100 text-blue-800',
    button: 'border-blue-300 bg-blue-50 text-blue-900',
  },
  {
    value: 'unavailable',
    label: 'Unavailable',
    description: 'Cannot take on work now',
    badge: 'bg-slate-200 text-slate-700',
    button: 'border-slate-300 bg-slate-100 text-slate-800',
  },
];

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0] || '')
    .join('')
    .toUpperCase() || 'YU';
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function activeStatus(
  update: AvailabilityUpdate | undefined,
  now: number
): AvailabilityChoice | null {
  if (!update || new Date(update.expiry_time).getTime() <= now) {
    return null;
  }

  return STATUS_OPTIONS.some(option => option.value === update.status)
    ? update.status as AvailabilityChoice
    : null;
}

function statusStyle(status: AvailabilityChoice | null) {
  return (
    STATUS_OPTIONS.find(option => option.value === status)?.badge ||
    'bg-slate-100 text-slate-500'
  );
}

export function Availability() {
  const { profile } = useAuth();
  const { showToast } = useToast();

  const [members, setMembers] = useState<Member[]>([]);
  const [updates, setUpdates] = useState<AvailabilityUpdate[]>([]);
  const [status, setStatus] = useState<AvailabilityChoice>('available');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());

  async function loadAvailability(initial = false) {
    if (initial) setLoading(true);

    setError('');

    const [membersResult, updatesResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, designation, status')
        .eq('status', 'active')
        .order('full_name'),

      supabase
        .from('availability_updates')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000),
    ]);

    if (membersResult.error || updatesResult.error) {
      setError(
        membersResult.error?.message ||
        updatesResult.error?.message ||
        'Availability could not be loaded.'
      );
    } else {
      setMembers((membersResult.data || []) as Member[]);
      setUpdates((updatesResult.data || []) as AvailabilityUpdate[]);
    }

    setNow(Date.now());
    setLoading(false);
  }

  useEffect(() => {
    void loadAvailability(true);

    const channel = supabase
      .channel('availability-tracker-live')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'availability_updates',
        },
        () => {
          void loadAvailability();
        }
      )
      .subscribe();

    const handleFocus = () => {
      void loadAvailability();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      void supabase.removeChannel(channel);
    };
  }, []);

  const latestByMember = useMemo(() => {
    const latest = new Map<string, AvailabilityUpdate>();

    [...updates]
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
      )
      .forEach(update => {
        if (!latest.has(update.member_id)) {
          latest.set(update.member_id, update);
        }
      });

    return latest;
  }, [updates]);

  const counts = useMemo(() => {
    const result: Record<AvailabilityChoice, number> = {
      available: 0,
      limited: 0,
      busy: 0,
      unavailable: 0,
    };

    members.forEach(member => {
      const current = activeStatus(latestByMember.get(member.id), now);

      if (current) {
        result[current] += 1;
      }
    });

    return result;
  }, [members, latestByMember, now]);

  const myUpdate = profile
    ? latestByMember.get(profile.id)
    : undefined;

  const myCurrentStatus = activeStatus(myUpdate, now);

  const teamRows = useMemo(
    () =>
      members.map(member => ({
        member,
        update: latestByMember.get(member.id),
        currentStatus: activeStatus(
          latestByMember.get(member.id),
          now
        ),
      })),
    [members, latestByMember, now]
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!profile?.id) {
      showToast(
        'error',
        'Your profile is still loading. Refresh and try again.'
      );
      return;
    }

    setSaving(true);

    const startTime = new Date();

    const { error: insertError } = await supabase
      .from('availability_updates')
      .insert({
        member_id: profile.id,
        status,
        start_time: startTime.toISOString(),
        expiry_time: new Date(
          startTime.getTime() + 24 * 60 * 60 * 1000
        ).toISOString(),
      });

    setSaving(false);

    if (insertError) {
      showToast(
        'error',
        `Could not save availability: ${insertError.message}`
      );
      return;
    }

    showToast(
      'success',
      `Status set to ${
        STATUS_OPTIONS.find(option => option.value === status)?.label ||
        status
      } for 24 hours.`
    );

    setNow(Date.now());
    await loadAvailability();
  }

  if (loading) {
    return <LoadingState message="Loading availability..." />;
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 animate-fade-in">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-jic-orange">
          JIC YUVA PULSE
        </p>

        <h1 className="mt-1 text-3xl font-bold text-jic-text">
          Availability
        </h1>

        <p className="mt-2 text-sm text-jic-text-secondary">
          Choose one status. It stays active for 24 hours.
        </p>
      </header>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}

          <button
            onClick={() => void loadAvailability()}
            className="ml-2 font-semibold underline"
          >
            Try again
          </button>
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {STATUS_OPTIONS.map(option => {
          const Icon =
            option.value === 'available'
              ? Zap
              : option.value === 'limited'
                ? Activity
                : option.value === 'busy'
                  ? Clock3
                  : Users;

          return (
            <Card key={option.value}>
              <CardBody className="flex items-center gap-3 p-4">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${option.badge}`}
                >
                  <Icon className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-sm text-jic-text-secondary">
                    {option.label}
                  </p>

                  <p className="mt-0.5 text-2xl font-bold text-jic-text">
                    {counts[option.value]}
                  </p>
                </div>
              </CardBody>
            </Card>
          );
        })}
      </section>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Card>
          <CardHeader
            title="Set your status"
            subtitle={
              myCurrentStatus && myUpdate
                ? `Current: ${
                    STATUS_OPTIONS.find(
                      option => option.value === myCurrentStatus
                    )?.label
                  }. Expires ${formatDateTime(myUpdate.expiry_time)}.`
                : 'No active status set.'
            }
          />

          <CardBody>
            <form onSubmit={handleSubmit} className="space-y-3">
              <fieldset>
                <legend className="mb-3 text-sm font-semibold text-jic-text">
                  How are you right now?
                </legend>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {STATUS_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={status === option.value}
                      onClick={() => setStatus(option.value)}
                      className={`rounded-xl border p-4 text-left transition-all ${
                        status === option.value
                          ? `${option.button} ring-2 ring-current/15`
                          : 'border-jic-border bg-white text-jic-text hover:bg-jic-muted/60'
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-semibold">
                          {option.label}
                        </span>

                        {status === option.value && (
                          <Check className="h-4 w-4" />
                        )}
                      </span>

                      <span className="mt-1 block text-xs opacity-75">
                        {option.description}
                      </span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <button
                type="submit"
                disabled={saving || !profile?.id}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-jic-orange px-4 py-3 font-semibold text-white transition-colors hover:bg-jic-orange-deep disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save status'}

                <Check className="h-4 w-4" />
              </button>

              <p className="text-center text-xs text-jic-text-secondary">
                Your status automatically expires after 24 hours.
              </p>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Team availability"
            subtitle={`${teamRows.length} active ${
              teamRows.length === 1 ? 'member' : 'members'
            }`}
          />

          <CardBody>
            {teamRows.length === 0 ? (
              <EmptyState
                icon={<Users className="h-8 w-8" />}
                title="No active members"
                description="Active team members will appear here."
              />
            ) : (
              <div className="divide-y divide-jic-border">
                {teamRows.map(({ member, update, currentStatus }) => {
                  const option = STATUS_OPTIONS.find(
                    item => item.value === currentStatus
                  );

                  return (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-jic-orange-soft text-sm font-bold text-jic-orange">
                        {initials(member.full_name)}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-jic-text">
                          {member.full_name}
                        </p>

                        <p className="mt-0.5 text-xs text-jic-text-secondary">
                          {member.designation || 'JIC member'}
                        </p>

                        {currentStatus && update && (
                          <p className="mt-1 text-xs text-jic-text-secondary">
                            Until {formatDateTime(update.expiry_time)}
                          </p>
                        )}
                      </div>

                      <Badge className={statusStyle(currentStatus)}>
                        {option?.label || 'Not set'}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
