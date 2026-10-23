import { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, CalendarDays, CheckCircle2, ClipboardCheck, RefreshCw, Share2, Target, Users,
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/EmptyState';

type ProfileRow = { id: string; role: string; status: string; created_at: string | null };
type TaskRow = { id: string; status: string; priority: string; deadline: string | null; completed_at: string | null; created_at: string | null };
type ProjectRow = { id: string; status: string; priority: string; start_date: string | null; target_completion: string | null };
type PostRow = { id: string; platform: string; likes: number | null; comments: number | null; shares: number | null; impressions: number | null; reach: number | null; views: number | null; saves: number | null; published_at: string | null; created_at: string | null; caption: string | null; post_url: string | null };
type ContributionRow = { id: string; review_status: string; submitted_at: string | null; campaign_id: string | null; member_id: string };
type EventRow = { id: string; title: string; status: string; start_time: string | null; end_time: string | null; venue: string | null };
type AssignmentRow = { id: string; status: string; member_id: string; created_at: string | null };
type CampaignRow = { id: string; status: string; platform: string | null; start_date: string | null; end_date: string | null };

type AnalyticsData = {
  profiles: ProfileRow[]; tasks: TaskRow[]; projects: ProjectRow[]; posts: PostRow[];
  contributions: ContributionRow[]; events: EventRow[]; assignments: AssignmentRow[]; campaigns: CampaignRow[];
};

const chartColors = ['#F97316', '#2563EB', '#16A34A', '#EAB308', '#7C3AED', '#64748B', '#DC2626'];
const isDone = (status: string) => ['completed', 'cancelled'].includes(status);
const safeNumber = (value: number | null | undefined) => Number(value || 0);
const engagement = (post: PostRow) => safeNumber(post.likes) + safeNumber(post.comments) + safeNumber(post.shares) + safeNumber(post.saves);
const formatNumber = (value: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value);
const formatDate = (value: string | null) => value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date not set';

function MetricCard({ label, value, helper, icon: Icon, tone = 'orange' }: {
  label: string; value: string | number; helper: string; icon: typeof Users; tone?: 'orange' | 'blue' | 'green' | 'yellow' | 'red' | 'purple';
}) {
  const tones = {
    orange: 'bg-orange-50 text-orange-700',
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    yellow: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    purple: 'bg-violet-50 text-violet-700',
  };
  return (
    <Card>
      <CardBody className="p-4 lg:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-jic-text-secondary">{label}</p>
            <p className="text-2xl lg:text-3xl font-bold text-jic-text mt-2">{value}</p>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tones[tone]}`}><Icon className="w-5 h-5" /></div>
        </div>
        <p className="mt-3 text-xs text-jic-text-secondary">{helper}</p>
      </CardBody>
    </Card>
  );
}

function PanelEmpty({ message }: { message: string }) {
  return <div className="py-10 text-center text-sm text-jic-text-secondary">{message}</div>;
}

export function Analytics() {
  const [data, setData] = useState<AnalyticsData>({ profiles: [], tasks: [], projects: [], posts: [], contributions: [], events: [], assignments: [], campaigns: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState('90');
  const [error, setError] = useState('');

  async function loadAnalytics(isRefresh = false) {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError('');
    const [profilesR, tasksR, projectsR, postsR, contributionsR, eventsR, assignmentsR, campaignsR] = await Promise.all([
      supabase.from('profiles').select('id, role, status, created_at'),
      supabase.from('tasks').select('id, status, priority, deadline, completed_at, created_at'),
      supabase.from('projects').select('id, status, priority, start_date, target_completion'),
      supabase.from('social_posts').select('id, platform, likes, comments, shares, impressions, reach, views, saves, published_at, created_at, caption, post_url'),
      supabase.from('campaign_contributions').select('id, review_status, submitted_at, campaign_id, member_id'),
      supabase.from('events').select('id, title, status, start_time, end_time, venue'),
      supabase.from('event_assignments').select('id, status, member_id, created_at'),
      supabase.from('campaigns').select('id, status, platform, start_date, end_date'),
    ]);
    const failures = [profilesR.error, tasksR.error, projectsR.error, postsR.error, contributionsR.error, eventsR.error, assignmentsR.error, campaignsR.error].filter(Boolean);
    setData({
      profiles: (profilesR.data || []) as ProfileRow[],
      tasks: (tasksR.data || []) as TaskRow[],
      projects: (projectsR.data || []) as ProjectRow[],
      posts: (postsR.data || []) as PostRow[],
      contributions: (contributionsR.data || []) as ContributionRow[],
      events: (eventsR.data || []) as EventRow[],
      assignments: (assignmentsR.data || []) as AssignmentRow[],
      campaigns: (campaignsR.data || []) as CampaignRow[],
    });
    if (failures.length) setError('Some data could not be loaded. Check table permissions in Supabase and refresh.');
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { void loadAnalytics(); }, []);

  const cutoff = useMemo(() => {
    if (range === 'all') return null;
    const date = new Date();
    date.setDate(date.getDate() - Number(range));
    return date;
  }, [range]);
  const inRange = (value: string | null | undefined) => !cutoff || (Boolean(value) && new Date(value as string) >= cutoff);

  const activeMembers = data.profiles.filter(profile => profile.status === 'active');
  const openTasks = data.tasks.filter(task => !isDone(task.status));
  const overdueTasks = openTasks.filter(task => task.deadline && new Date(task.deadline + 'T23:59:59') < new Date());
  const completedTasks = data.tasks.filter(task => task.status === 'completed');
  const taskCompletion = data.tasks.length ? Math.round((completedTasks.length / data.tasks.length) * 100) : 0;
  const currentCampaigns = data.campaigns.filter(campaign => campaign.status === 'active');
  const approvedContributions = data.contributions.filter(item => item.review_status === 'approved');
  const pendingContributions = data.contributions.filter(item => item.review_status === 'pending');
  const upcomingEvents = data.events.filter(event => event.start_time && new Date(event.start_time) >= new Date() && !['cancelled', 'completed'].includes(event.status)).sort((a, b) => new Date(a.start_time || '').getTime() - new Date(b.start_time || '').getTime());
  const activeAssignments = data.assignments.filter(item => ['assigned', 'confirmed', 'completed'].includes(item.status));
  const publishedPosts = data.posts.filter(post => inRange(post.published_at || post.created_at));
  const recentContributions = data.contributions.filter(item => inRange(item.submitted_at));
  const recentCompleted = completedTasks.filter(task => inRange(task.completed_at || task.created_at));

  const taskStatusData = useMemo(() => {
    const groups = [
      ['Open', ['open', 'assigned', 'not_started']],
      ['In progress', ['in_progress']],
      ['Blocked', ['blocked']],
      ['Submitted', ['submitted']],
      ['Revision', ['revision_requested']],
      ['Completed', ['completed']],
      ['Cancelled', ['cancelled']],
    ];
    return groups.map(([name, statuses]) => ({ name: String(name), tasks: data.tasks.filter(task => (statuses as string[]).includes(task.status)).length }));
  }, [data.tasks]);

  const monthlyActivity = useMemo(() => {
    const months: { key: string; month: string; completed: number; posts: number; contributions: number }[] = [];
    const count = range === '30' ? 4 : range === '365' || range === 'all' ? 12 : 6;
    const now = new Date();
    for (let i = count - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      months.push({ key, month: date.toLocaleDateString('en-IN', { month: 'short' }), completed: 0, posts: 0, contributions: 0 });
    }
    const findMonth = (value: string | null) => {
      if (!value) return undefined;
      const date = new Date(value);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      return months.find(item => item.key === key);
    };
    recentCompleted.forEach(task => { const month = findMonth(task.completed_at || task.created_at); if (month) month.completed += 1; });
    publishedPosts.forEach(post => { const month = findMonth(post.published_at || post.created_at); if (month) month.posts += 1; });
    recentContributions.forEach(item => { const month = findMonth(item.submitted_at); if (month) month.contributions += 1; });
    return months;
  }, [recentCompleted, publishedPosts, recentContributions, range]);

  const platformData = useMemo(() => ['instagram', 'linkedin'].map(platform => {
    const rows = publishedPosts.filter(post => post.platform === platform);
    return { platform: platform === 'instagram' ? 'Instagram' : 'LinkedIn', posts: rows.length, engagement: rows.reduce((sum, post) => sum + engagement(post), 0), reach: rows.reduce((sum, post) => sum + safeNumber(post.reach), 0), impressions: rows.reduce((sum, post) => sum + safeNumber(post.impressions), 0) };
  }), [publishedPosts]);

  const contributionStatus = useMemo(() => [
    { name: 'Approved', value: data.contributions.filter(item => item.review_status === 'approved').length },
    { name: 'Pending', value: data.contributions.filter(item => item.review_status === 'pending').length },
    { name: 'Revision requested', value: data.contributions.filter(item => item.review_status === 'revision_requested').length },
    { name: 'Rejected', value: data.contributions.filter(item => item.review_status === 'rejected').length },
  ].filter(row => row.value > 0), [data.contributions]);

  const topPosts = useMemo(() => [...publishedPosts].sort((a, b) => engagement(b) - engagement(a)).slice(0, 5), [publishedPosts]);
  const projectStatus = useMemo(() => [
    { name: 'Active', value: data.projects.filter(project => project.status === 'active').length },
    { name: 'Planning', value: data.projects.filter(project => project.status === 'planning').length },
    { name: 'At risk', value: data.projects.filter(project => project.status === 'at_risk').length },
    { name: 'Completed', value: data.projects.filter(project => project.status === 'completed').length },
    { name: 'Other', value: data.projects.filter(project => !['active', 'planning', 'at_risk', 'completed'].includes(project.status)).length },
  ].filter(row => row.value > 0), [data.projects]);

  if (loading) return <LoadingState message="Building your JIC analytics..." />;

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-fade-in">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-jic-orange uppercase tracking-wide">JIC YUVA PULSE</p>
          <h1 className="text-3xl font-bold text-jic-text mt-1">Analytics & Insights</h1>
          <p className="text-jic-text-secondary mt-2">A live operational snapshot of people, delivery, campaigns, and events.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-jic-text-secondary flex items-center gap-2">Activity range
            <select value={range} onChange={event => setRange(event.target.value)} className="border border-jic-border bg-white rounded-xl px-3 py-2.5 text-sm text-jic-text">
              <option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last 12 months</option><option value="all">All activity</option>
            </select>
          </label>
          <button onClick={() => void loadAnalytics(true)} disabled={refreshing} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-jic-border bg-white text-sm font-semibold text-jic-text hover:bg-jic-muted disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </header>

      {error && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex gap-3 items-start text-sm text-amber-900"><AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" /><div><p className="font-semibold">Partial analytics data</p><p className="mt-1">{error}</p></div></div>}

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <MetricCard label="Active YUVAs" value={formatNumber(activeMembers.filter(item => item.role === 'yuva' || item.role === 'lead').length)} helper={`${activeMembers.length} active profiles including admin`} icon={Users} tone="blue" />
        <MetricCard label="Task completion" value={`${taskCompletion}%`} helper={`${completedTasks.length} of ${data.tasks.length} total tasks completed`} icon={CheckCircle2} tone="green" />
        <MetricCard label="Overdue tasks" value={formatNumber(overdueTasks.length)} helper="Open tasks past their deadline" icon={AlertTriangle} tone={overdueTasks.length ? 'red' : 'green'} />
        <MetricCard label="Active campaigns" value={formatNumber(currentCampaigns.length)} helper={`${publishedPosts.length} posts in selected activity range`} icon={Target} tone="orange" />
        <MetricCard label="Social engagement" value={formatNumber(publishedPosts.reduce((sum, post) => sum + engagement(post), 0))} helper="Likes, comments, shares and saves" icon={Share2} tone="purple" />
        <MetricCard label="Contributions approved" value={formatNumber(approvedContributions.length)} helper={`${pendingContributions.length} awaiting review`} icon={ClipboardCheck} tone="green" />
        <MetricCard label="Upcoming events" value={formatNumber(upcomingEvents.length)} helper={`${activeAssignments.length} event assignments recorded`} icon={CalendarDays} tone="blue" />
        <MetricCard label="Projects" value={formatNumber(data.projects.length)} helper={`${data.projects.filter(project => project.status === 'active').length} currently active`} icon={Activity} tone="yellow" />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Task status distribution" subtitle="Current state of all recorded tasks" />
          <CardBody className="h-[300px]">
            {data.tasks.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={taskStatusData} margin={{ top: 10, right: 8, left: -18, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" /><XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip /><Bar dataKey="tasks" name="Tasks" radius={[6, 6, 0, 0]}>{taskStatusData.map((row, index) => <Cell key={row.name} fill={chartColors[index % chartColors.length]} />)}</Bar>
            </BarChart></ResponsiveContainer> : <PanelEmpty message="Task data will appear here after tasks are created." />}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Monthly activity" subtitle="Completed tasks, social posts, and submitted contributions" />
          <CardBody className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%"><BarChart data={monthlyActivity} margin={{ top: 10, right: 8, left: -18, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" /><XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip /><Legend /><Bar dataKey="completed" name="Tasks completed" stackId="activity" fill="#16A34A" radius={[3, 3, 0, 0]} /><Bar dataKey="posts" name="Social posts" stackId="activity" fill="#2563EB" /><Bar dataKey="contributions" name="Contributions" stackId="activity" fill="#F97316" />
            </BarChart></ResponsiveContainer>
          </CardBody>
        </Card>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <Card className="xl:col-span-2">
          <CardHeader title="Social performance by platform" subtitle={`Recorded performance for ${range === 'all' ? 'all activity' : `the last ${range} days`}`} />
          <CardBody className="space-y-4">
            {platformData.map((platform, index) => <div key={platform.platform} className="rounded-xl border border-jic-border p-4">
              <div className="flex items-center justify-between gap-3"><div><p className="font-bold text-jic-text">{platform.platform}</p><p className="text-xs text-jic-text-secondary mt-1">{platform.posts} recorded posts</p></div><Badge className={index === 0 ? 'bg-pink-100 text-pink-800' : 'bg-blue-100 text-blue-800'}>{platform.platform}</Badge></div>
              <div className="grid grid-cols-3 gap-3 mt-4"><div><p className="text-xs text-jic-text-secondary">Engagements</p><p className="text-lg font-bold text-jic-text mt-1">{formatNumber(platform.engagement)}</p></div><div><p className="text-xs text-jic-text-secondary">Reach</p><p className="text-lg font-bold text-jic-text mt-1">{formatNumber(platform.reach)}</p></div><div><p className="text-xs text-jic-text-secondary">Impressions</p><p className="text-lg font-bold text-jic-text mt-1">{formatNumber(platform.impressions)}</p></div></div>
            </div>)}
            {publishedPosts.length === 0 && <PanelEmpty message="No social posts have been recorded in this activity range." />}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Contribution reviews" subtitle="All submitted member contributions" />
          <CardBody className="h-[280px]">
            {contributionStatus.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={contributionStatus} dataKey="value" nameKey="name" cx="50%" cy="46%" innerRadius={58} outerRadius={92} paddingAngle={3}>{contributionStatus.map((row, index) => <Cell key={row.name} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip /><Legend verticalAlign="bottom" height={48} wrapperStyle={{ fontSize: 11 }} /></PieChart></ResponsiveContainer> : <PanelEmpty message="No contributions submitted yet." />}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Project portfolio" subtitle="Projects by current status" />
          <CardBody className="h-[280px]">
            {projectStatus.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={projectStatus} dataKey="value" nameKey="name" cx="50%" cy="46%" innerRadius={50} outerRadius={82} paddingAngle={3}>{projectStatus.map((row, index) => <Cell key={row.name} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip /><Legend verticalAlign="bottom" height={48} wrapperStyle={{ fontSize: 11 }} /></PieChart></ResponsiveContainer> : <PanelEmpty message="Create projects to see portfolio status here." />}
          </CardBody>
        </Card>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Top social posts" subtitle="Ranked by recorded engagements" />
          <CardBody className="p-0">
            {topPosts.length ? <div className="divide-y divide-jic-border">{topPosts.map((post, index) => <div key={post.id} className="px-5 py-4 flex items-start gap-3"><div className="w-9 h-9 rounded-xl bg-jic-muted text-jic-text-secondary font-bold text-sm flex items-center justify-center shrink-0">{index + 1}</div><div className="min-w-0 flex-1"><p className="font-semibold text-sm text-jic-text truncate">{post.caption?.trim() || `${post.platform} post`}</p><p className="text-xs text-jic-text-secondary mt-1">{post.platform === 'instagram' ? 'Instagram' : 'LinkedIn'} · {formatDate(post.published_at || post.created_at)}</p>{post.post_url && <a href={post.post_url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-jic-orange hover:underline inline-block mt-1">Open post</a>}</div><div className="text-right shrink-0"><p className="font-bold text-jic-text">{formatNumber(engagement(post))}</p><p className="text-xs text-jic-text-secondary">engagements</p></div></div>)}</div> : <PanelEmpty message="Add social posts to see the highest-performing content." />}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Upcoming events" subtitle="Next scheduled events" />
          <CardBody className="p-0">
            {upcomingEvents.length ? <div className="divide-y divide-jic-border">{upcomingEvents.slice(0, 5).map(event => <div key={event.id} className="px-5 py-4 flex items-start gap-3"><div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0"><CalendarDays className="w-5 h-5" /></div><div className="min-w-0 flex-1"><p className="font-semibold text-sm text-jic-text">{event.title}</p><p className="text-xs text-jic-text-secondary mt-1">{formatDate(event.start_time)}{event.venue ? ` · ${event.venue}` : ''}</p></div><Badge className="bg-blue-100 text-blue-800">{event.status.split('_').join(' ')}</Badge></div>)}</div> : <PanelEmpty message="No upcoming events have been scheduled." />}
          </CardBody>
        </Card>
      </section>

      <p className="text-xs text-jic-text-secondary flex items-center gap-2"><Activity className="w-4 h-4" /> Analytics are calculated from records stored in Supabase. Social metrics are based on manually recorded figures and are not fetched directly from Instagram or LinkedIn.</p>
    </div>
  );
}
