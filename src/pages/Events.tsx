import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CalendarDays, Check, Clock3, MapPin, Plus, RefreshCw, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, LoadingState } from '@/components/ui/EmptyState';
import type { Department, Event as JICEvent, EventAssignment, EventResponsibility, Profile } from '@/types';

type EventDraft = { title: string; description: string; venue: string; start_time: string; end_time: string };
type ResponsibilityDraft = { event_id: string; name: string; description: string; department_id: string; required_capacity: number; deadline: string };
type Member = Pick<Profile, 'id' | 'full_name' | 'designation' | 'status'>;

const eventStatuses = ['planning', 'preparing', 'ready', 'live', 'completed', 'cancelled'] as const;
const assignmentStatuses = ['interested', 'assigned', 'confirmed', 'declined', 'completed'] as const;

const eventStatusStyle: Record<string, string> = {
  planning: 'bg-slate-100 text-slate-700', preparing: 'bg-blue-100 text-blue-800', ready: 'bg-emerald-100 text-emerald-800',
  live: 'bg-orange-100 text-orange-800', completed: 'bg-slate-100 text-slate-600', cancelled: 'bg-red-100 text-red-800',
};
const assignmentStatusStyle: Record<string, string> = {
  interested: 'bg-amber-100 text-amber-800', assigned: 'bg-blue-100 text-blue-800', confirmed: 'bg-emerald-100 text-emerald-800',
  declined: 'bg-slate-100 text-slate-600', completed: 'bg-teal-100 text-teal-800',
};
const emptyEventDraft: EventDraft = { title: '', description: '', venue: '', start_time: '', end_time: '' };
const emptyResponsibilityDraft: ResponsibilityDraft = { event_id: '', name: '', description: '', department_id: '', required_capacity: 1, deadline: '' };

function formatDateTime(value: string | null) {
  if (!value) return 'Time to be announced';
  return new Date(value).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function niceStatus(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, character => character.toUpperCase());
}

export function Events() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const canManage = profile?.role === 'admin' || profile?.role === 'lead';
  const [events, setEvents] = useState<JICEvent[]>([]);
  const [responsibilities, setResponsibilities] = useState<EventResponsibility[]>([]);
  const [assignments, setAssignments] = useState<EventAssignment[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [eventDraft, setEventDraft] = useState<EventDraft>(emptyEventDraft);
  const [responsibilityDraft, setResponsibilityDraft] = useState<ResponsibilityDraft>(emptyResponsibilityDraft);
  const [showEventForm, setShowEventForm] = useState(false);
  const [showResponsibilityForm, setShowResponsibilityForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadEvents() {
    setLoading(true);
    setError('');
    try {
      const [eventResult, responsibilityResult, assignmentResult, memberResult, departmentResult] = await Promise.all([
        supabase.from('events').select('*').order('start_time', { ascending: true, nullsFirst: false }),
        supabase.from('event_responsibilities').select('*').order('deadline', { ascending: true, nullsFirst: false }),
        supabase.from('event_assignments').select('*'),
        supabase.from('profiles').select('id, full_name, designation, status').eq('status', 'active').order('full_name'),
        supabase.from('departments').select('*').eq('status', 'active').order('name'),
      ]);
      if (eventResult.error) throw eventResult.error;
      setEvents((eventResult.data || []) as JICEvent[]);
      setResponsibilities((responsibilityResult.data || []) as EventResponsibility[]);
      setAssignments((assignmentResult.data || []) as EventAssignment[]);
      setMembers((memberResult.data || []) as Member[]);
      setDepartments((departmentResult.data || []) as Department[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load event records.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadEvents(); }, []);

  const memberMap = useMemo(() => new Map(members.map(member => [member.id, member])), [members]);
  const departmentMap = useMemo(() => new Map(departments.map(department => [department.id, department])), [departments]);
  const interestedCount = assignments.filter(item => item.status === 'interested').length;
  const confirmedCount = assignments.filter(item => ['confirmed', 'assigned'].includes(item.status)).length;
  const upcomingCount = events.filter(item => item.start_time && new Date(item.start_time).getTime() >= Date.now() && !['completed', 'cancelled'].includes(item.status)).length;

  async function createEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || !profile) return;
    if (eventDraft.end_time && eventDraft.start_time && new Date(eventDraft.end_time) < new Date(eventDraft.start_time)) {
      showToast('error', 'Event end time must be after the start time.');
      return;
    }
    setSaving(true);
    try {
      const { error: insertError } = await supabase.from('events').insert({
        title: eventDraft.title.trim(),
        description: eventDraft.description.trim() || null,
        venue: eventDraft.venue.trim() || null,
        start_time: eventDraft.start_time ? new Date(eventDraft.start_time).toISOString() : null,
        end_time: eventDraft.end_time ? new Date(eventDraft.end_time).toISOString() : null,
        owner_id: profile.id,
        status: 'planning',
      });
      if (insertError) throw insertError;
      showToast('success', 'Event created.');
      setEventDraft(emptyEventDraft);
      setShowEventForm(false);
      await loadEvents();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Could not create event.');
    } finally {
      setSaving(false);
    }
  }

  async function createResponsibility(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || !profile) return;
    setSaving(true);
    try {
      const { error: insertError } = await supabase.from('event_responsibilities').insert({
        event_id: responsibilityDraft.event_id,
        name: responsibilityDraft.name.trim(),
        description: responsibilityDraft.description.trim() || null,
        department_id: responsibilityDraft.department_id || null,
        required_capacity: Math.max(1, Number(responsibilityDraft.required_capacity) || 1),
        deadline: responsibilityDraft.deadline || null,
        owner_id: profile.id,
        status: 'open',
      });
      if (insertError) throw insertError;
      showToast('success', 'Volunteer responsibility added.');
      setResponsibilityDraft(emptyResponsibilityDraft);
      setShowResponsibilityForm(false);
      await loadEvents();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Could not add responsibility.');
    } finally {
      setSaving(false);
    }
  }

  async function expressInterest(responsibility: EventResponsibility) {
    if (!profile) return;
    const existing = assignments.find(item => item.responsibility_id === responsibility.id && item.member_id === profile.id);
    if (existing) {
      showToast('info', `Your response is already recorded as ${niceStatus(existing.status)}.`);
      return;
    }
    setSaving(true);
    try {
      const { error: insertError } = await supabase.from('event_assignments').insert({
        responsibility_id: responsibility.id,
        member_id: profile.id,
        status: 'interested',
      });
      if (insertError) throw insertError;
      showToast('success', 'Your interest has been submitted.');
      await loadEvents();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Could not submit interest.');
    } finally {
      setSaving(false);
    }
  }

  async function updateAssignment(assignment: EventAssignment, status: string) {
    if (!canManage) return;
    setSaving(true);
    try {
      const { error: updateError } = await supabase.from('event_assignments').update({ status }).eq('id', assignment.id);
      if (updateError) throw updateError;
      showToast('success', 'Volunteer status updated.');
      await loadEvents();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Could not update volunteer status.');
    } finally {
      setSaving(false);
    }
  }

  async function updateEventStatus(event: JICEvent, status: string) {
    if (!canManage) return;
    setSaving(true);
    try {
      const { error: updateError } = await supabase.from('events').update({ status }).eq('id', event.id);
      if (updateError) throw updateError;
      showToast('success', 'Event status updated.');
      await loadEvents();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Could not update event status.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState message="Loading events and volunteer responsibilities..." />;

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-fade-in">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-jic-orange uppercase tracking-wide">JIC YUVA PULSE</p>
          <h1 className="text-3xl font-bold text-jic-text mt-1">Events & Volunteering</h1>
          <p className="text-jic-text-secondary mt-2">Plan events, coordinate responsibilities, and keep volunteer sign-ups visible.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void loadEvents()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-jic-border bg-white px-4 py-2.5 text-sm font-semibold text-jic-text hover:bg-jic-muted"><RefreshCw className="w-4 h-4" /> Refresh</button>
          {canManage && <button onClick={() => setShowEventForm(value => !value)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-jic-orange px-4 py-2.5 text-sm font-semibold text-white hover:bg-jic-orange-deep"><Plus className="w-4 h-4" /> Create event</button>}
          {canManage && <button onClick={() => { setResponsibilityDraft(draft => ({ ...draft, event_id: draft.event_id || events[0]?.id || '' })); setShowResponsibilityForm(value => !value); }} disabled={events.length === 0} className="inline-flex items-center justify-center gap-2 rounded-xl border border-jic-border bg-white px-4 py-2.5 text-sm font-semibold text-jic-text hover:bg-jic-muted disabled:opacity-50"><Users className="w-4 h-4" /> Add volunteer role</button>}
        </div>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card><CardBody className="flex items-center gap-4"><div className="w-11 h-11 rounded-xl bg-blue-50 text-jic-blue flex items-center justify-center"><CalendarDays className="w-5 h-5" /></div><div><p className="text-sm text-jic-text-secondary">Upcoming events</p><p className="text-2xl font-bold text-jic-text">{upcomingCount}</p></div></CardBody></Card>
        <Card><CardBody className="flex items-center gap-4"><div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center"><Users className="w-5 h-5" /></div><div><p className="text-sm text-jic-text-secondary">Interest submitted</p><p className="text-2xl font-bold text-jic-text">{interestedCount}</p></div></CardBody></Card>
        <Card><CardBody className="flex items-center gap-4"><div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><Check className="w-5 h-5" /></div><div><p className="text-sm text-jic-text-secondary">Assigned / confirmed</p><p className="text-2xl font-bold text-jic-text">{confirmedCount}</p></div></CardBody></Card>
      </section>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4"><p className="font-semibold text-red-800">Could not load events</p><p className="mt-1 text-sm text-red-700">{error}</p><button onClick={() => void loadEvents()} className="mt-2 text-sm font-semibold text-red-800 underline">Try again</button></div>}

      {showEventForm && canManage && <Card><CardHeader title="Create an event" subtitle="Add the event details. You can add volunteer responsibilities after saving." /><CardBody><form onSubmit={createEvent} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="text-sm font-semibold text-jic-text md:col-span-2">Event title *<input required maxLength={160} value={eventDraft.title} onChange={event => setEventDraft({ ...eventDraft, title: event.target.value })} className="mt-1 w-full rounded-xl border border-jic-border px-3 py-2.5 font-normal" placeholder="e.g. JIC Founder Mixer" /></label>
        <label className="text-sm font-semibold text-jic-text">Venue<input value={eventDraft.venue} onChange={event => setEventDraft({ ...eventDraft, venue: event.target.value })} className="mt-1 w-full rounded-xl border border-jic-border px-3 py-2.5 font-normal" placeholder="Venue or online" /></label>
        <label className="text-sm font-semibold text-jic-text">Start time<input type="datetime-local" value={eventDraft.start_time} onChange={event => setEventDraft({ ...eventDraft, start_time: event.target.value })} className="mt-1 w-full rounded-xl border border-jic-border px-3 py-2.5 font-normal" /></label>
        <label className="text-sm font-semibold text-jic-text">End time<input type="datetime-local" value={eventDraft.end_time} onChange={event => setEventDraft({ ...eventDraft, end_time: event.target.value })} className="mt-1 w-full rounded-xl border border-jic-border px-3 py-2.5 font-normal" /></label>
        <label className="text-sm font-semibold text-jic-text md:col-span-2">Description<textarea rows={3} value={eventDraft.description} onChange={event => setEventDraft({ ...eventDraft, description: event.target.value })} className="mt-1 w-full rounded-xl border border-jic-border px-3 py-2.5 font-normal" placeholder="Purpose, audience, and key details" /></label>
        <div className="md:col-span-2 flex gap-2"><button disabled={saving} className="rounded-xl bg-jic-orange px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving...' : 'Save event'}</button><button type="button" onClick={() => setShowEventForm(false)} className="rounded-xl border border-jic-border px-4 py-2.5 text-sm font-semibold">Cancel</button></div>
      </form></CardBody></Card>}

      {showResponsibilityForm && canManage && <Card><CardHeader title="Add a volunteer responsibility" subtitle="Members can express interest; authorised leads can review and assign responses." /><CardBody><form onSubmit={createResponsibility} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="text-sm font-semibold text-jic-text">Event *<select required value={responsibilityDraft.event_id} onChange={event => setResponsibilityDraft({ ...responsibilityDraft, event_id: event.target.value })} className="mt-1 w-full rounded-xl border border-jic-border px-3 py-2.5 font-normal"><option value="">Select event</option>{events.filter(item => !['completed', 'cancelled'].includes(item.status)).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        <label className="text-sm font-semibold text-jic-text">Responsibility name *<input required maxLength={120} value={responsibilityDraft.name} onChange={event => setResponsibilityDraft({ ...responsibilityDraft, name: event.target.value })} className="mt-1 w-full rounded-xl border border-jic-border px-3 py-2.5 font-normal" placeholder="e.g. Registration desk" /></label>
        <label className="text-sm font-semibold text-jic-text">Department<select value={responsibilityDraft.department_id} onChange={event => setResponsibilityDraft({ ...responsibilityDraft, department_id: event.target.value })} className="mt-1 w-full rounded-xl border border-jic-border px-3 py-2.5 font-normal"><option value="">Any department</option>{departments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
        <label className="text-sm font-semibold text-jic-text">Volunteers needed<input type="number" min={1} max={500} value={responsibilityDraft.required_capacity} onChange={event => setResponsibilityDraft({ ...responsibilityDraft, required_capacity: Number(event.target.value) })} className="mt-1 w-full rounded-xl border border-jic-border px-3 py-2.5 font-normal" /></label>
        <label className="text-sm font-semibold text-jic-text">Deadline<input type="date" value={responsibilityDraft.deadline} onChange={event => setResponsibilityDraft({ ...responsibilityDraft, deadline: event.target.value })} className="mt-1 w-full rounded-xl border border-jic-border px-3 py-2.5 font-normal" /></label>
        <label className="text-sm font-semibold text-jic-text md:col-span-2">Details<textarea rows={2} value={responsibilityDraft.description} onChange={event => setResponsibilityDraft({ ...responsibilityDraft, description: event.target.value })} className="mt-1 w-full rounded-xl border border-jic-border px-3 py-2.5 font-normal" placeholder="Key responsibilities and expectations" /></label>
        <div className="md:col-span-2 flex gap-2"><button disabled={saving || !events.some(item => item.id === responsibilityDraft.event_id)} className="rounded-xl bg-jic-orange px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Saving...' : 'Save responsibility'}</button><button type="button" onClick={() => setShowResponsibilityForm(false)} className="rounded-xl border border-jic-border px-4 py-2.5 text-sm font-semibold">Cancel</button></div>
      </form></CardBody></Card>}

      {events.length === 0 && !error ? <Card><CardBody><EmptyState icon={<CalendarDays className="w-8 h-8" />} title="No events yet" description={canManage ? 'Create the first event to start coordinating responsibilities.' : 'Events organised by JIC will appear here.'} /></CardBody></Card> : (
        <div className="space-y-5">
          {events.map(event => {
            const eventResponsibilities = responsibilities.filter(item => item.event_id === event.id);
            return <Card key={event.id}>
              <div className="p-5 lg:p-6">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><Badge className={eventStatusStyle[event.status] || 'bg-slate-100 text-slate-700'}>{niceStatus(event.status)}</Badge><span className="text-xs text-jic-text-secondary">Created {new Date(event.created_at).toLocaleDateString()}</span></div>
                    <h2 className="mt-2 text-xl font-bold text-jic-text">{event.title}</h2>
                    {event.description && <p className="mt-1 text-sm text-jic-text-secondary whitespace-pre-line">{event.description}</p>}
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-jic-text-secondary"><span className="inline-flex items-center gap-1.5"><Clock3 className="w-4 h-4" />{formatDateTime(event.start_time)}{event.end_time ? ` – ${new Date(event.end_time).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : ''}</span>{event.venue && <span className="inline-flex items-center gap-1.5"><MapPin className="w-4 h-4" />{event.venue}</span>}</div>
                  </div>
                  {canManage && <label className="text-xs font-semibold text-jic-text-secondary">Event status<select value={event.status} disabled={saving} onChange={change => void updateEventStatus(event, change.target.value)} className="mt-1 block w-full rounded-lg border border-jic-border bg-white px-2.5 py-2 text-sm text-jic-text">{eventStatuses.map(status => <option key={status} value={status}>{niceStatus(status)}</option>)}</select></label>}
                </div>

                <div className="mt-5 border-t border-jic-border pt-4">
                  <div className="flex items-center justify-between gap-3"><h3 className="font-bold text-jic-text">Volunteer responsibilities</h3><span className="text-xs text-jic-text-secondary">{eventResponsibilities.length} role{eventResponsibilities.length === 1 ? '' : 's'}</span></div>
                  {eventResponsibilities.length === 0 ? <p className="mt-3 rounded-xl bg-jic-muted/50 p-4 text-sm text-jic-text-secondary">No volunteer roles have been added to this event yet.</p> : <div className="mt-3 space-y-3">
                    {eventResponsibilities.map(responsibility => {
                      const responseRows = assignments.filter(item => item.responsibility_id === responsibility.id);
                      const myResponse = responseRows.find(item => item.member_id === profile?.id);
                      const interestedOrAssigned = responseRows.filter(item => ['interested', 'assigned', 'confirmed', 'completed'].includes(item.status)).length;
                      const department = responsibility.department_id ? departmentMap.get(responsibility.department_id) : null;
                      return <div key={responsibility.id} className="rounded-xl border border-jic-border p-4">
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold text-jic-text">{responsibility.name}</h4><Badge className={responsibility.status === 'open' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}>{niceStatus(responsibility.status)}</Badge></div>{responsibility.description && <p className="mt-1 text-sm text-jic-text-secondary">{responsibility.description}</p>}<p className="mt-2 text-xs text-jic-text-secondary">{department?.name || 'Any department'} · {interestedOrAssigned}/{responsibility.required_capacity} volunteer responses{responsibility.deadline ? ` · Deadline ${new Date(`${responsibility.deadline}T00:00:00`).toLocaleDateString()}` : ''}</p></div>
                          {!canManage && responsibility.status === 'open' && <button disabled={saving || Boolean(myResponse)} onClick={() => void expressInterest(responsibility)} className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-jic-orange px-3 py-2 text-sm font-semibold text-white hover:bg-jic-orange-deep disabled:opacity-50">{myResponse ? <><Check className="w-4 h-4" /> {niceStatus(myResponse.status)}</> : 'I’m interested'}</button>}
                        </div>
                        {responseRows.length > 0 && <div className="mt-3 border-t border-jic-border pt-3"><p className="text-xs font-semibold uppercase tracking-wide text-jic-text-secondary mb-2">Responses</p><div className="space-y-2">{responseRows.map(response => { const member = memberMap.get(response.member_id); return <div key={response.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"><div className="text-sm text-jic-text">{member?.full_name || 'Member'}{member?.designation ? <span className="text-jic-text-secondary"> · {member.designation}</span> : null}</div><div className="flex items-center gap-2"><Badge className={assignmentStatusStyle[response.status] || 'bg-slate-100 text-slate-700'}>{niceStatus(response.status)}</Badge>{canManage && <select aria-label={`Update ${member?.full_name || 'member'} status`} disabled={saving} value={response.status} onChange={change => void updateAssignment(response, change.target.value)} className="rounded-lg border border-jic-border bg-white px-2 py-1 text-xs">{assignmentStatuses.map(status => <option key={status} value={status}>{niceStatus(status)}</option>)}</select>}</div></div>; })}</div></div>}
                      </div>;
                    })}
                  </div>}
                </div>
              </div>
            </Card>;
          })}
        </div>
      )}
    </div>
  );
}
