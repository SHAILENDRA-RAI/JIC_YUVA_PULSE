import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, ArrowRight, CheckCircle2, Clock3, ListTodo, Users, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { EmptyState, LoadingState } from '@/components/ui/EmptyState';
import { KPICard } from '@/components/ui/KPICard';
import { Badge } from '@/components/ui/Badge';
import { formatDate, getTaskStatusDisplay, isOverdue, timeAgo } from '@/lib/utils';
import type { Profile, Task, AvailabilityUpdate } from '@/types';

interface ActivityItem {
  id: string;
  title: string;
  detail: string;
  created_at: string;
}

export function Overview() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [availability, setAvailability] = useState<AvailabilityUpdate[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  useEffect(() => {
    let active = true;
    async function loadOverview() {
      setLoading(true);
      const [profilesResult, tasksResult, availabilityResult, updatesResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('status', 'active').order('full_name'),
        supabase.from('tasks').select('*').order('deadline', { ascending: true, nullsFirst: false }).limit(100),
        supabase.from('availability_updates').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('task_updates').select('id, update_text, created_at, task_id').order('created_at', { ascending: false }).limit(5),
      ]);
      if (!active) return;
      setProfiles((profilesResult.data || []) as Profile[]);
      setTasks((tasksResult.data || []) as Task[]);
      setAvailability((availabilityResult.data || []) as AvailabilityUpdate[]);
      setActivities((updatesResult.data || []).map(update => ({
        id: update.id,
        title: 'Task activity recorded',
        detail: update.update_text || 'A task was updated',
        created_at: update.created_at,
      })));
      setLoading(false);
    }
    loadOverview();
    return () => { active = false; };
  }, []);

  const latestAvailability = useMemo(() => {
    const map = new Map<string, AvailabilityUpdate>();
    availability.forEach(item => {
      if (!map.has(item.member_id)) map.set(item.member_id, item);
    });
    return Array.from(map.values());
  }, [availability]);

  const availableCount = latestAvailability.filter(item => item.status === 'available' && new Date(item.expiry_time) > new Date()).length;
  const limitedCount = latestAvailability.filter(item => item.status === 'limited' && new Date(item.expiry_time) > new Date()).length;
  const busyCount = latestAvailability.filter(item => item.status === 'busy' && new Date(item.expiry_time) > new Date()).length;
  const openTasks = tasks.filter(task => !['completed', 'cancelled'].includes(task.status));
  const overdueTasks = openTasks.filter(task => isOverdue(task.deadline));
  const inReviewTasks = tasks.filter(task => task.status === 'submitted');
  const completedTasks = tasks.filter(task => task.status === 'completed');
  const attentionTasks = [...overdueTasks, ...openTasks.filter(task => task.status === 'blocked' && !overdueTasks.includes(task))].slice(0, 6);

  const profileMap = useMemo(() => new Map(profiles.map(item => [item.id, item])), [profiles]);

  if (loading) return <LoadingState message="Loading your command centre..." />;

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-fade-in">
      <section className="relative overflow-hidden rounded-3xl bg-jic-navy p-6 lg:p-8 text-white">
        <div className="absolute -right-16 -top-24 w-80 h-80 rounded-full border-[28px] border-jic-orange/20" />
        <div className="absolute right-20 -bottom-32 w-72 h-72 rounded-full border-[22px] border-jic-blue/20" />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-jic-orange text-sm font-semibold mb-2">
              <Activity className="w-4 h-4" />
              <span>JIC YUVA PULSE</span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-bold">Namaskar, {profile?.full_name?.split(' ')[0] || 'there'}.</h1>
            <p className="text-slate-300 mt-2 max-w-xl">Powering people, tracking progress, and building the next big thing from one connected workspace.</p>
            <p className="text-xs text-slate-400 mt-4">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/availability" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-semibold transition-colors">
              <Clock3 className="w-4 h-4" /> Update availability
            </Link>
            <Link to="/tasks" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-jic-orange hover:bg-jic-orange-deep text-sm font-semibold transition-colors">
              <ListTodo className="w-4 h-4" /> View work <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 xl:grid-cols-6 gap-3">
        <KPICard label="Active YUVAs" value={profiles.length} icon={Users} color="blue" onClick={() => {}} />
        <KPICard label="Available now" value={availableCount} icon={Zap} color="green" onClick={() => {}} />
        <KPICard label="Limited" value={limitedCount} icon={Clock3} color="yellow" onClick={() => {}} />
        <KPICard label="Open tasks" value={openTasks.length} icon={ListTodo} color="orange" onClick={() => {}} />
        <KPICard label="Needs review" value={inReviewTasks.length} icon={AlertTriangle} color="yellow" onClick={() => {}} />
        <KPICard label="Completed" value={completedTasks.length} icon={CheckCircle2} color="green" onClick={() => {}} />
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-2">
          <CardHeader title="Tasks requiring attention" subtitle="Overdue and blocked work across your visible workspace" action={<Link to="/tasks" className="text-xs font-semibold text-jic-orange hover:underline">View all</Link>} />
          {attentionTasks.length === 0 ? (
            <EmptyState icon={<CheckCircle2 className="w-8 h-8 text-jic-green" />} title="No urgent tasks" description="There are no overdue or blocked tasks in the workspace." />
          ) : (
            <div className="divide-y divide-jic-border">
              {attentionTasks.map(task => {
                const status = getTaskStatusDisplay(task.status);
                const owner = task.assignee_id ? profileMap.get(task.assignee_id) : null;
                return (
                  <div key={task.id} className="px-5 py-4 flex items-center gap-4 hover:bg-jic-muted/50 transition-colors">
                    <div className={`w-2 h-10 rounded-full ${task.status === 'blocked' ? 'bg-red-500' : 'bg-jic-orange'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-jic-text truncate">{task.title}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-jic-text-secondary">
                        <span>{task.deadline ? `${isOverdue(task.deadline) ? 'Overdue' : 'Due'} ${formatDate(task.deadline)}` : 'No deadline'}</span>
                        {owner && <><span>•</span><span>{owner.full_name}</span></>}
                      </div>
                    </div>
                    <Badge className={`${status.bgColor} ${status.textColor}`}>{status.label}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Availability snapshot" subtitle="Latest declared capacity" action={<Link to="/availability" className="text-xs font-semibold text-jic-orange hover:underline">Open tracker</Link>} />
          <CardBody className="space-y-4">
            {[['Available', availableCount, 'bg-green-500', 'text-green-700'], ['Limited', limitedCount, 'bg-yellow-500', 'text-yellow-700'], ['Busy', busyCount, 'bg-blue-500', 'text-blue-700'], ['Needs update', Math.max(profiles.length - latestAvailability.length, 0), 'bg-slate-400', 'text-slate-600']].map(([label, value, dot, text]) => (
              <div key={String(label)} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5"><span className={`w-2.5 h-2.5 rounded-full ${dot}`} /><span className="text-sm text-jic-text-secondary">{label}</span></div>
                <span className={`font-bold ${text}`}>{value}</span>
              </div>
            ))}
            <div className="pt-3 border-t border-jic-border">
              <div className="flex items-center justify-between text-xs text-jic-text-secondary mb-2"><span>Members with a declaration</span><span>{latestAvailability.length} / {profiles.length}</span></div>
              <div className="h-2 bg-jic-muted rounded-full overflow-hidden"><div className="h-full bg-jic-green rounded-full transition-all" style={{ width: `${profiles.length ? Math.min((latestAvailability.length / profiles.length) * 100, 100) : 0}%` }} /></div>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Department capacity" subtitle="Workload visibility from actual assignments" />
          {profiles.length === 0 ? <EmptyState title="No member data yet" description="Add your first authorised member to start tracking capacity." /> : (
            <div className="p-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-jic-blue-pale p-4"><p className="text-xs text-jic-text-secondary">Team members</p><p className="text-2xl font-bold text-jic-blue mt-1">{profiles.length}</p></div>
              <div className="rounded-xl bg-jic-orange-pale p-4"><p className="text-xs text-jic-text-secondary">Open workload</p><p className="text-2xl font-bold text-jic-orange mt-1">{openTasks.length}</p></div>
              <div className="rounded-xl bg-jic-green-pale p-4"><p className="text-xs text-jic-text-secondary">Available capacity</p><p className="text-2xl font-bold text-jic-green mt-1">{availableCount}</p></div>
              <div className="rounded-xl bg-jic-yellow-pale p-4"><p className="text-xs text-jic-text-secondary">Overdue work</p><p className="text-2xl font-bold text-jic-yellow mt-1">{overdueTasks.length}</p></div>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Recent activity" subtitle="Recorded work updates" action={<Link to="/tasks" className="text-xs font-semibold text-jic-orange hover:underline">Activity</Link>} />
          {activities.length === 0 ? <EmptyState icon={<Activity className="w-8 h-8" />} title="No activity recorded yet" description="Task updates and meaningful workspace events will appear here." /> : (
            <div className="divide-y divide-jic-border">
              {activities.map(activity => (
                <div key={activity.id} className="px-5 py-3.5 flex items-start gap-3"><div className="w-8 h-8 rounded-lg bg-jic-blue-soft flex items-center justify-center flex-shrink-0"><Activity className="w-4 h-4 text-jic-blue" /></div><div className="min-w-0"><p className="text-sm font-semibold text-jic-text">{activity.title}</p><p className="text-xs text-jic-text-secondary mt-0.5 truncate">{activity.detail}</p><p className="text-xs text-jic-text-secondary/70 mt-1">{timeAgo(activity.created_at)}</p></div></div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
