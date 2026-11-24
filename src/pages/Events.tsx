import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  CalendarDays,
  Check,
  Clock3,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Users,
  Pencil,
  Trash2,
  X,
  ClipboardList,
  ChevronDown,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, LoadingState } from '@/components/ui/EmptyState';
import type {
  Department,
  Event as JICEvent,
  EventAssignment,
  EventResponsibility,
  Profile,
} from '@/types';

type EventDraft = {
  title: string;
  description: string;
  venue: string;
  start_time: string;
  end_time: string;
};

type RoleDraft = {
  event_id: string;
  name: string;
  description: string;
  department_id: string;
  required_capacity: number;
  deadline: string;
};

type Member = Pick<Profile, 'id' | 'full_name' | 'designation' | 'status'>;
type EventFilter = 'all' | 'upcoming' | 'past';

type EventStatus = 'planning' | 'preparing' | 'ready' | 'live' | 'completed' | 'cancelled';
type AssignmentStatus = 'interested' | 'assigned' | 'confirmed' | 'declined' | 'completed';

const eventStatuses: EventStatus[] = ['planning', 'preparing', 'ready', 'live', 'completed', 'cancelled'];
const assignmentStatuses: AssignmentStatus[] = ['interested', 'assigned', 'confirmed', 'declined', 'completed'];

const eventStatusStyle: Record<string, string> = {
  planning: 'bg-slate-100 text-slate-700',
  preparing: 'bg-blue-100 text-blue-800',
  ready: 'bg-emerald-100 text-emerald-800',
  live: 'bg-orange-100 text-orange-800',
  completed: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-red-100 text-red-800',
};

const assignmentStatusStyle: Record<string, string> = {
  interested: 'bg-amber-100 text-amber-800',
  assigned: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-emerald-100 text-emerald-800',
  declined: 'bg-slate-100 text-slate-600',
  completed: 'bg-teal-100 text-teal-800',
};

const emptyEventDraft: EventDraft = {
  title: '',
  description: '',
  venue: '',
  start_time: '',
  end_time: '',
};

const emptyRoleDraft: RoleDraft = {
  event_id: '',
  name: '',
  description: '',
  department_id: '',
  required_capacity: 1,
  deadline: '',
};

function pretty(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, character => character.toUpperCase());
}

function formatDateTime(value: string | null) {
  if (!value) return 'Time to be announced';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time to be announced';
  return date.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function toLocalDateTime(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function formatDate(value: string | null) {
  if (!value) return 'No deadline';
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function isUpcoming(event: JICEvent) {
  return Boolean(
    event.start_time &&
    new Date(event.start_time).getTime() >= Date.now() &&
    !['completed', 'cancelled'].includes(event.status)
  );
}

function isPast(event: JICEvent) {
  return Boolean(
    event.start_time &&
    new Date(event.start_time).getTime() < Date.now() &&
    !['completed', 'cancelled'].includes(event.status)
  );
}

export function Events() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const canManage = profile?.role === 'admin' || profile?.role === 'lead';
  const isAdmin = profile?.role === 'admin';

  const [events, setEvents] = useState<JICEvent[]>([]);
  const [responsibilities, setResponsibilities] = useState<EventResponsibility[]>([]);
  const [assignments, setAssignments] = useState<EventAssignment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [eventDraft, setEventDraft] = useState<EventDraft>(emptyEventDraft);
  const [roleDraft, setRoleDraft] = useState<RoleDraft>(emptyRoleDraft);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [showEventForm, setShowEventForm] = useState(false);
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());

  const [filter, setFilter] = useState<EventFilter>('all');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  async function loadEvents(quiet = false) {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const [eventResult, roleResult, assignmentResult, memberResult, departmentResult] = await Promise.all([
        supabase.from('events').select('*').order('start_time', { ascending: true, nullsFirst: false }),
        supabase.from('event_responsibilities').select('*').order('deadline', { ascending: true, nullsFirst: false }),
        supabase.from('event_assignments').select('*').order('created_at', { ascending: true }),
        supabase.from('profiles').select('id, full_name, designation, status').eq('status', 'active').order('full_name'),
        supabase.from('departments').select('*').eq('status', 'active').order('name'),
      ]);

      if (eventResult.error) throw eventResult.error;
      if (roleResult.error) throw roleResult.error;
      if (assignmentResult.error) throw assignmentResult.error;
      if (memberResult.error) throw memberResult.error;
      if (departmentResult.error) throw departmentResult.error;

      setEvents((eventResult.data || []) as JICEvent[]);
      setResponsibilities((roleResult.data || []) as EventResponsibility[]);
      setAssignments((assignmentResult.data || []) as EventAssignment[]);
      setMembers((memberResult.data || []) as Member[]);
      setDepartments((departmentResult.data || []) as Department[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load event records.';
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadEvents();
  }, []);

  const memberMap = useMemo(() => new Map(members.map(member => [member.id, member])), [members]);
  const departmentMap = useMemo(() => new Map(departments.map(department => [department.id, department])), [departments]);

  const interestedCount = assignments.filter(item => item.status === 'interested').length;
  const confirmedCount = assignments.filter(item => ['assigned', 'confirmed'].includes(item.status)).length;
  const upcomingCount = events.filter(isUpcoming).length;
  const openRoleCount = responsibilities.filter(item => item.status === 'open').length;

  const visibleEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    return events.filter(event => {
      if (filter === 'upcoming' && !isUpcoming(event)) return false;
      if (filter === 'past' && !isPast(event) && !['completed', 'cancelled'].includes(event.status)) return false;
      const eventRoles = responsibilities.filter(role => role.event_id === event.id);
      const searchable = [
        event.title,
        event.description || '',
        event.venue || '',
        ...eventRoles.map(role => `${role.name} ${role.description || ''}`),
      ].join(' ').toLowerCase();
      return !query || searchable.includes(query);
    });
  }, [events, responsibilities, filter, search]);

  function closeEventForm() {
    setShowEventForm(false);
    setEditingEventId(null);
    setEventDraft(emptyEventDraft);
  }

  function closeRoleForm() {
    setShowRoleForm(false);
    setEditingRoleId(null);
    setRoleDraft(emptyRoleDraft);
  }

  function startCreateEvent() {
    closeRoleForm();
    setEditingEventId(null);
    setEventDraft(emptyEventDraft);
    setShowEventForm(true);
  }

  function startEditEvent(event: JICEvent) {
    closeRoleForm();
    setEditingEventId(event.id);
    setEventDraft({
      title: event.title,
      description: event.description || '',
      venue: event.venue || '',
      start_time: toLocalDateTime(event.start_time),
      end_time: toLocalDateTime(event.end_time),
    });
    setShowEventForm(true);
  }

  function startCreateRole(eventId?: string) {
    closeEventForm();
    setEditingRoleId(null);
    setRoleDraft({ ...emptyRoleDraft, event_id: eventId || events[0]?.id || '' });
    setShowRoleForm(true);
  }

  function startEditRole(role: EventResponsibility) {
    closeEventForm();
    setEditingRoleId(role.id);
    setRoleDraft({
      event_id: role.event_id,
      name: role.name,
      description: role.description || '',
      department_id: role.department_id || '',
      required_capacity: role.required_capacity,
      deadline: role.deadline || '',
    });
    setShowRoleForm(true);
  }

  async function saveEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || !profile) return;

    if (eventDraft.end_time && eventDraft.start_time && new Date(eventDraft.end_time) < new Date(eventDraft.start_time)) {
      showToast('error', 'Event end time must be after its start time.');
      return;
    }

    setSaving(true);
    const payload = {
      title: eventDraft.title.trim(),
      description: eventDraft.description.trim() || null,
      venue: eventDraft.venue.trim() || null,
      start_time: eventDraft.start_time ? new Date(eventDraft.start_time).toISOString() : null,
      end_time: eventDraft.end_time ? new Date(eventDraft.end_time).toISOString() : null,
    };

    try {
      const result = editingEventId
        ? await supabase.from('events').update(payload).eq('id', editingEventId)
        : await supabase.from('events').insert({ ...payload, owner_id: profile.id, status: 'planning' });
      if (result.error) throw result.error;
      showToast('success', editingEventId ? 'Event details updated.' : 'Event created.');
      closeEventForm();
      await loadEvents(true);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Could not save event.');
    } finally {
      setSaving(false);
    }
  }

  async function saveRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || !profile) return;
    if (!roleDraft.event_id || !roleDraft.name.trim()) {
      showToast('error', 'Select an event and enter a role name.');
      return;
    }

    setSaving(true);
    const payload = {
      event_id: roleDraft.event_id,
      name: roleDraft.name.trim(),
      description: roleDraft.description.trim() || null,
      department_id: roleDraft.department_id || null,
      required_capacity: Math.max(1, Number(roleDraft.required_capacity) || 1),
      deadline: roleDraft.deadline || null,
    };

    try {
      const result = editingRoleId
        ? await supabase.from('event_responsibilities').update(payload).eq('id', editingRoleId)
        : await supabase.from('event_responsibilities').insert({ ...payload, owner_id: profile.id, status: 'open' });
      if (result.error) throw result.error;
      showToast('success', editingRoleId ? 'Volunteer role updated.' : 'Volunteer role added.');
      closeRoleForm();
      await loadEvents(true);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Could not save volunteer role.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent(event: JICEvent) {
    if (!isAdmin) return;
    const confirmed = window.confirm(
      `Delete “${event.title}”? This will also permanently delete its volunteer roles and responses. This cannot be undone.`
    );
    if (!confirmed) return;

    setSaving(true);
    try {
      const { error: deleteError } = await supabase.from('events').delete().eq('id', event.id);
      if (deleteError) throw deleteError;
      showToast('success', `“${event.title}” was deleted.`);
      await loadEvents(true);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Could not delete event.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteRole(role: EventResponsibility) {
    if (!isAdmin) return;
    const confirmed = window.confirm(
      `Delete the “${role.name}” volunteer role? All responses for this role will also be deleted.`
    );
    if (!confirmed) return;

    setSaving(true);
    try {
      const { error: deleteError } = await supabase.from('event_responsibilities').delete().eq('id', role.id);
      if (deleteError) throw deleteError;
      showToast('success', `“${role.name}” was deleted.`);
      await loadEvents(true);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Could not delete volunteer role.');
    } finally {
      setSaving(false);
    }
  }

  async function expressInterest(role: EventResponsibility) {
    if (!profile) return;
    const existing = assignments.find(item => item.responsibility_id === role.id && item.member_id === profile.id);
    if (existing) {
      showToast('info', `Your response is already recorded as ${pretty(existing.status)}.`);
      return;
    }

    setSaving(true);
    try {
      const { error: insertError } = await supabase.from('event_assignments').insert({
        responsibility_id: role.id,
        member_id: profile.id,
        status: 'interested',
      });
      if (insertError) throw insertError;
      showToast('success', 'Your interest has been submitted.');
      await loadEvents(true);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Could not submit interest.');
    } finally {
      setSaving(false);
    }
  }

  async function updateAssignment(assignment: EventAssignment, status: AssignmentStatus) {
    if (!canManage) return;
    setSaving(true);
    try {
      const { error: updateError } = await supabase.from('event_assignments').update({ status }).eq('id', assignment.id);
      if (updateError) throw updateError;
      showToast('success', 'Volunteer response updated.');
      await loadEvents(true);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Could not update volunteer response.');
    } finally {
      setSaving(false);
    }
  }

  async function updateEventStatus(event: JICEvent, status: EventStatus) {
    if (!canManage) return;
    setSaving(true);
    try {
      const { error: updateError } = await supabase.from('events').update({ status }).eq('id', event.id);
      if (updateError) throw updateError;
      showToast('success', 'Event status updated.');
      await loadEvents(true);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Could not update event status.');
    } finally {
      setSaving(false);
    }
  }

  function toggleExpanded(eventId: string) {
    setExpandedEvents(previous => {
      const next = new Set(previous);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  }

  if (loading) return <LoadingState message="Loading events and volunteer responsibilities..." />;

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-fade-in">
      <header className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-jic-orange uppercase tracking-wide">JIC YUVA PULSE</p>
          <h1 className="text-3xl font-bold text-jic-text mt-1">Events &amp; Volunteering</h1>
          <p className="text-jic-text-secondary mt-2">Plan events, publish volunteer roles, and coordinate the team in one place.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadEvents(true)}
            disabled={refreshing || saving}
            className="inline-flex items-center gap-2 rounded-xl border border-jic-border bg-white px-4 py-2.5 text-sm font-semibold text-jic-text hover:bg-jic-muted disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
          {canManage && (
            <>
              <button type="button" onClick={startCreateEvent} className="inline-flex items-center gap-2 rounded-xl bg-jic-orange px-4 py-2.5 text-sm font-semibold text-white hover:bg-jic-orange-deep">
                <Plus className="w-4 h-4" /> Create event
              </button>
              <button type="button" onClick={() => startCreateRole()} disabled={events.length === 0} className="inline-flex items-center gap-2 rounded-xl border border-jic-border bg-white px-4 py-2.5 text-sm font-semibold text-jic-text hover:bg-jic-muted disabled:opacity-50">
                <Users className="w-4 h-4" /> Add volunteer role
              </button>
            </>
          )}
        </div>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <Card><CardBody className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center"><CalendarDays className="w-5 h-5" /></div><div><p className="text-xs text-jic-text-secondary">Upcoming events</p><p className="text-2xl font-bold text-jic-text">{upcomingCount}</p></div></CardBody></Card>
        <Card><CardBody className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-orange-50 text-jic-orange flex items-center justify-center"><ClipboardList className="w-5 h-5" /></div><div><p className="text-xs text-jic-text-secondary">Open volunteer roles</p><p className="text-2xl font-bold text-jic-text">{openRoleCount}</p></div></CardBody></Card>
        <Card><CardBody className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center"><Users className="w-5 h-5" /></div><div><p className="text-xs text-jic-text-secondary">Interests received</p><p className="text-2xl font-bold text-jic-text">{interestedCount}</p></div></CardBody></Card>
        <Card><CardBody className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><Check className="w-5 h-5" /></div><div><p className="text-xs text-jic-text-secondary">Assigned / confirmed</p><p className="text-2xl font-bold text-jic-text">{confirmedCount}</p></div></CardBody></Card>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="font-semibold text-red-800">Could not load events</p>
          <p className="mt-1 text-sm text-red-700">{error}</p>
          <button type="button" onClick={() => void loadEvents()} className="mt-2 text-sm font-semibold text-red-800 underline">Try again</button>
        </div>
      )}

      {(showEventForm || showRoleForm) && (
        <Card>
          <CardHeader
            title={showEventForm ? (editingEventId ? 'Edit event' : 'Create an event') : (editingRoleId ? 'Edit volunteer role' : 'Add a volunteer role')}
            subtitle={showEventForm ? 'Keep the event details clear so members know where and when to show up.' : 'Define the work, team, volunteer capacity, and response deadline.'}
            action={<button type="button" onClick={() => { closeEventForm(); closeRoleForm(); }} aria-label="Close form" className="rounded-lg p-2 text-jic-text-secondary hover:bg-jic-muted"><X className="w-4 h-4" /></button>}
          />
          <CardBody>
            {showEventForm ? (
              <form onSubmit={saveEvent} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="text-sm font-semibold text-jic-text md:col-span-2">Event name *
                  <input required maxLength={160} value={eventDraft.title} onChange={event => setEventDraft({ ...eventDraft, title: event.target.value })} className="mt-1.5 w-full rounded-xl border border-jic-border px-3 py-2.5 font-normal" placeholder="e.g. JIC Founder Mixer" />
                </label>
                <label className="text-sm font-semibold text-jic-text">Venue
                  <input value={eventDraft.venue} onChange={event => setEventDraft({ ...eventDraft, venue: event.target.value })} className="mt-1.5 w-full rounded-xl border border-jic-border px-3 py-2.5 font-normal" placeholder="Venue or online" />
                </label>
                <label className="text-sm font-semibold text-jic-text">Start date &amp; time
                  <input type="datetime-local" value={eventDraft.start_time} onChange={event => setEventDraft({ ...eventDraft, start_time: event.target.value })} className="mt-1.5 w-full rounded-xl border border-jic-border px-3 py-2.5 font-normal" />
                </label>
                <label className="text-sm font-semibold text-jic-text">End date &amp; time
                  <input type="datetime-local" value={eventDraft.end_time} onChange={event => setEventDraft({ ...eventDraft, end_time: event.target.value })} className="mt-1.5 w-full rounded-xl border border-jic-border px-3 py-2.5 font-normal" />
                </label>
                <label className="text-sm font-semibold text-jic-text md:col-span-2">Event overview
                  <textarea rows={3} value={eventDraft.description} onChange={event => setEventDraft({ ...eventDraft, description: event.target.value })} className="mt-1.5 w-full rounded-xl border border-jic-border px-3 py-2.5 font-normal" placeholder="Purpose, audience, schedule highlights, and key details" />
                </label>
                <div className="md:col-span-2 flex justify-end gap-2">
                  <button type="button" onClick={closeEventForm} className="rounded-xl border border-jic-border px-4 py-2.5 text-sm font-semibold">Cancel</button>
                  <button disabled={saving} className="rounded-xl bg-jic-orange px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving...' : editingEventId ? 'Save changes' : 'Create event'}</button>
                </div>
              </form>
            ) : (
              <form onSubmit={saveRole} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="text-sm font-semibold text-jic-text">Event *
                  <select required value={roleDraft.event_id} onChange={event => setRoleDraft({ ...roleDraft, event_id: event.target.value })} className="mt-1.5 w-full rounded-xl border border-jic-border bg-white px-3 py-2.5 font-normal"><option value="">Select event</option>{events.filter(item => !['completed', 'cancelled'].includes(item.status)).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
                </label>
                <label className="text-sm font-semibold text-jic-text">Role / responsibility *
                  <input required maxLength={120} value={roleDraft.name} onChange={event => setRoleDraft({ ...roleDraft, name: event.target.value })} className="mt-1.5 w-full rounded-xl border border-jic-border px-3 py-2.5 font-normal" placeholder="e.g. Registration desk" />
                </label>
                <label className="text-sm font-semibold text-jic-text">Department
                  <select value={roleDraft.department_id} onChange={event => setRoleDraft({ ...roleDraft, department_id: event.target.value })} className="mt-1.5 w-full rounded-xl border border-jic-border bg-white px-3 py-2.5 font-normal"><option value="">Any department</option>{departments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}</select>
                </label>
                <label className="text-sm font-semibold text-jic-text">Volunteers required
                  <input type="number" min={1} max={500} value={roleDraft.required_capacity} onChange={event => setRoleDraft({ ...roleDraft, required_capacity: Number(event.target.value) })} className="mt-1.5 w-full rounded-xl border border-jic-border px-3 py-2.5 font-normal" />
                </label>
                <label className="text-sm font-semibold text-jic-text">Response deadline
                  <input type="date" value={roleDraft.deadline} onChange={event => setRoleDraft({ ...roleDraft, deadline: event.target.value })} className="mt-1.5 w-full rounded-xl border border-jic-border px-3 py-2.5 font-normal" />
                </label>
                <label className="text-sm font-semibold text-jic-text md:col-span-2">Instructions / details
                  <textarea rows={3} value={roleDraft.description} onChange={event => setRoleDraft({ ...roleDraft, description: event.target.value })} className="mt-1.5 w-full rounded-xl border border-jic-border px-3 py-2.5 font-normal" placeholder="What will volunteers do? Mention expectations and deliverables." />
                </label>
                <div className="md:col-span-2 flex justify-end gap-2">
                  <button type="button" onClick={closeRoleForm} className="rounded-xl border border-jic-border px-4 py-2.5 text-sm font-semibold">Cancel</button>
                  <button disabled={saving} className="rounded-xl bg-jic-orange px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving...' : editingRoleId ? 'Save changes' : 'Add role'}</button>
                </div>
              </form>
            )}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Event schedule" subtitle="Each event contains its own volunteer roles, responses, and coordination status." action={<span className="text-xs text-jic-text-secondary">{visibleEvents.length} of {events.length} events</span>} />
        <CardBody>
          <div className="flex flex-col lg:flex-row gap-3 mb-5">
            <label className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-jic-text-secondary" />
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search events, venues, volunteer roles..." aria-label="Search events" className="w-full rounded-xl border border-jic-border py-2.5 pl-9 pr-3 text-sm" />
            </label>
            <div className="flex rounded-xl border border-jic-border bg-jic-muted/60 p-1">
              {(['all', 'upcoming', 'past'] as EventFilter[]).map(item => (
                <button key={item} type="button" onClick={() => setFilter(item)} className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${filter === item ? 'bg-white text-jic-text shadow-sm' : 'text-jic-text-secondary hover:text-jic-text'}`}>{pretty(item)}</button>
              ))}
            </div>
          </div>

          {visibleEvents.length === 0 ? (
            <EmptyState
              icon={<CalendarDays className="w-8 h-8" />}
              title={events.length ? 'No matching events' : 'No events yet'}
              description={events.length ? 'Change the search or event filter.' : (canManage ? 'Create your first event, then add volunteer roles to organise the work.' : 'Events organised by JIC will appear here.')}
              action={canManage && events.length === 0 ? <button type="button" onClick={startCreateEvent} className="rounded-xl bg-jic-orange px-4 py-2 text-sm font-semibold text-white">Create event</button> : undefined}
            />
          ) : (
            <div className="space-y-4">
              {visibleEvents.map(event => {
                const eventRoles = responsibilities.filter(role => role.event_id === event.id);
                const eventResponseCount = assignments.filter(assignment => eventRoles.some(role => role.id === assignment.responsibility_id)).length;
                const expanded = expandedEvents.has(event.id);

                return (
                  <article key={event.id} className="overflow-hidden rounded-2xl border border-jic-border bg-white transition-shadow hover:shadow-sm">
                    <div className="p-4 sm:p-5">
                      <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={eventStatusStyle[event.status] || 'bg-slate-100 text-slate-700'}>{pretty(event.status)}</Badge>
                            {isUpcoming(event) && <Badge className="bg-blue-50 text-blue-700">Upcoming</Badge>}
                            <span className="text-xs text-jic-text-secondary">Created {formatDate(event.created_at)}</span>
                          </div>
                          <h2 className="mt-2 text-xl font-bold text-jic-text break-words">{event.title}</h2>
                          {event.description && <p className="mt-1.5 max-w-4xl text-sm leading-6 text-jic-text-secondary whitespace-pre-line">{event.description}</p>}
                          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-jic-text-secondary">
                            <span className="inline-flex items-center gap-1.5"><Clock3 className="h-4 w-4" />{formatDateTime(event.start_time)}{event.end_time ? ` – ${new Date(event.end_time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : ''}</span>
                            {event.venue && <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" />{event.venue}</span>}
                            <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4" />{eventRoles.length} roles · {eventResponseCount} responses</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                          {canManage && (
                            <>
                              <select aria-label={`Status for ${event.title}`} value={event.status} disabled={saving} onChange={change => void updateEventStatus(event, change.target.value as EventStatus)} className="rounded-xl border border-jic-border bg-white px-3 py-2 text-sm text-jic-text">
                                {eventStatuses.map(status => <option key={status} value={status}>{pretty(status)}</option>)}
                              </select>
                              <button type="button" onClick={() => startEditEvent(event)} className="inline-flex items-center gap-1.5 rounded-xl border border-jic-border px-3 py-2 text-sm font-semibold text-jic-text hover:bg-jic-muted"><Pencil className="h-4 w-4" /> Edit</button>
                            </>
                          )}
                          {isAdmin && (
                            <button type="button" disabled={saving} onClick={() => void deleteEvent(event)} className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-4 w-4" /> Delete</button>
                          )}
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-jic-border pt-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-jic-text"><ClipboardList className="h-4 w-4 text-jic-orange" /> Volunteer roles <span className="text-xs font-normal text-jic-text-secondary">({eventRoles.length})</span></div>
                        <div className="flex items-center gap-2">
                          {canManage && <button type="button" onClick={() => startCreateRole(event.id)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-jic-orange hover:bg-orange-50"><Plus className="h-3.5 w-3.5" /> Add role</button>}
                          <button type="button" onClick={() => toggleExpanded(event.id)} aria-expanded={expanded} className="inline-flex items-center gap-1.5 rounded-lg bg-jic-muted px-3 py-2 text-xs font-semibold text-jic-text-secondary hover:text-jic-text">{expanded ? 'Hide details' : 'View details'} <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} /></button>
                        </div>
                      </div>
                    </div>

                    {expanded && (
                      <div className="border-t border-jic-border bg-slate-50/60 p-4 sm:p-5">
                        {eventRoles.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-jic-border bg-white p-6 text-center">
                            <Users className="mx-auto h-7 w-7 text-jic-text-secondary" />
                            <p className="mt-2 text-sm font-semibold text-jic-text">No volunteer roles yet</p>
                            <p className="mt-1 text-xs text-jic-text-secondary">Add responsibilities so members can express interest and the team can coordinate coverage.</p>
                            {canManage && <button type="button" onClick={() => startCreateRole(event.id)} className="mt-3 rounded-xl bg-jic-orange px-3 py-2 text-xs font-semibold text-white">Add first role</button>}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {eventRoles.map(role => {
                              const responseRows = assignments.filter(item => item.responsibility_id === role.id);
                              const interestedOrAssigned = responseRows.filter(item => ['interested', 'assigned', 'confirmed', 'completed'].includes(item.status)).length;
                              const myResponse = responseRows.find(item => item.member_id === profile?.id);
                              const department = role.department_id ? departmentMap.get(role.department_id) : null;
                              const capacityFull = interestedOrAssigned >= role.required_capacity;

                              return (
                                <section key={role.id} className="rounded-xl border border-jic-border bg-white p-4">
                                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="font-bold text-jic-text">{role.name}</h3>
                                        <Badge className={role.status === 'open' ? 'bg-emerald-100 text-emerald-800' : role.status === 'filled' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'}>{pretty(role.status)}</Badge>
                                        <span className="text-xs text-jic-text-secondary">{interestedOrAssigned}/{role.required_capacity} responses</span>
                                      </div>
                                      {role.description && <p className="mt-1.5 text-sm leading-5 text-jic-text-secondary whitespace-pre-line">{role.description}</p>}
                                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-jic-text-secondary">
                                        <span>{department?.name || 'Any department'}</span>
                                        <span>Deadline: {formatDate(role.deadline)}</span>
                                      </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                      {!canManage && role.status === 'open' && (
                                        <button type="button" disabled={saving || Boolean(myResponse) || capacityFull} onClick={() => void expressInterest(role)} className="inline-flex items-center gap-1.5 rounded-xl bg-jic-orange px-3 py-2 text-sm font-semibold text-white hover:bg-jic-orange-deep disabled:cursor-not-allowed disabled:opacity-50">
                                          {myResponse ? <><Check className="h-4 w-4" /> {pretty(myResponse.status)}</> : capacityFull ? 'Capacity reached' : 'I’m interested'}
                                        </button>
                                      )}
                                      {canManage && (
                                        <>
                                          <button type="button" onClick={() => startEditRole(role)} className="inline-flex items-center gap-1.5 rounded-lg border border-jic-border px-2.5 py-2 text-xs font-semibold text-jic-text hover:bg-jic-muted"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                                          {isAdmin && <button type="button" disabled={saving} onClick={() => void deleteRole(role)} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /> Delete</button>}
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  {responseRows.length > 0 && (
                                    <div className="mt-4 border-t border-jic-border pt-3">
                                      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-jic-text-secondary">Volunteer responses</p>
                                      <div className="space-y-2">
                                        {responseRows.map(response => {
                                          const member = memberMap.get(response.member_id);
                                          return (
                                            <div key={response.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg bg-jic-muted/50 px-3 py-2">
                                              <div className="min-w-0">
                                                <p className="text-sm font-semibold text-jic-text">{member?.full_name || 'Member'}</p>
                                                {member?.designation && <p className="text-xs text-jic-text-secondary">{member.designation}</p>}
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <Badge className={assignmentStatusStyle[response.status] || 'bg-slate-100 text-slate-700'}>{pretty(response.status)}</Badge>
                                                {canManage && <select aria-label={`Update ${member?.full_name || 'member'} response`} disabled={saving} value={response.status} onChange={change => void updateAssignment(response, change.target.value as AssignmentStatus)} className="rounded-lg border border-jic-border bg-white px-2.5 py-1.5 text-xs">{assignmentStatuses.map(status => <option key={status} value={status}>{pretty(status)}</option>)}</select>}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </section>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {!canManage && <p className="text-xs text-jic-text-secondary">Browse open volunteer roles, express interest, and wait for a JIC lead or administrator to confirm your assignment.</p>}
      {isAdmin && <p className="text-xs text-jic-text-secondary">Admin controls: edit events and roles, update event and volunteer statuses, or delete records. Deleting an event also deletes its volunteer roles and responses.</p>}
    </div>
  );
}
