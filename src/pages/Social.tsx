import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { BarChart3, ExternalLink, Heart, MessageCircle, PlusCircle, RefreshCw, Share2, Target, TrendingUp, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, LoadingState } from '@/components/ui/EmptyState';
import type { Campaign, CampaignContribution, Profile, SocialPost } from '@/types';

const platforms = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'linkedin', label: 'LinkedIn' },
] as const;

const campaignStatusStyles: Record<string, string> = {
  planning: 'bg-slate-100 text-slate-700',
  active: 'bg-emerald-100 text-emerald-800',
  paused: 'bg-amber-100 text-amber-800',
  completed: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-red-100 text-red-800',
};

const reviewStyles: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
  revision_requested: 'bg-blue-100 text-blue-800',
};

function numberField(value: FormDataEntryValue | null) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}
function formatNumber(value: number) {
  return new Intl.NumberFormat('en-IN', { notation: value >= 10000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value);
}
function formatDate(value: string | null | undefined) {
  if (!value) return 'Not published';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Date unavailable' : parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
function platformLabel(value: string | null | undefined) {
  if (value === 'instagram') return 'Instagram';
  if (value === 'linkedin') return 'LinkedIn';
  if (value === 'both') return 'Instagram + LinkedIn';
  return 'Other';
}
function safeUrl(value: string | null | undefined) {
  if (!value) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
  } catch {
    return '';
  }
}

export function Social() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [contributions, setContributions] = useState<CampaignContribution[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [campaignFilter, setCampaignFilter] = useState('all');

  const canManage = profile?.role === 'admin' || profile?.role === 'lead';

  async function loadData() {
    setLoading(true);
    setError('');
    const [campaignResult, postResult, contributionResult, profileResult] = await Promise.all([
      supabase.from('campaigns').select('*').order('created_at', { ascending: false }),
      supabase.from('social_posts').select('*').order('published_at', { ascending: false, nullsFirst: false }).limit(200),
      supabase.from('campaign_contributions').select('*').order('submitted_at', { ascending: false }).limit(200),
      supabase.from('profiles').select('id, full_name, email, avatar_url, designation, role, status, skills, interests, join_date, phone, bio, created_at, updated_at').order('full_name'),
    ]);

    const firstError = campaignResult.error || postResult.error || contributionResult.error || profileResult.error;
    if (firstError) setError(firstError.message);
    setCampaigns((campaignResult.data || []) as Campaign[]);
    setPosts((postResult.data || []) as SocialPost[]);
    setContributions((contributionResult.data || []) as CampaignContribution[]);
    setProfiles((profileResult.data || []) as Profile[]);
    setLoading(false);
  }

  useEffect(() => { void loadData(); }, []);

  const campaignMap = useMemo(() => new Map(campaigns.map(campaign => [campaign.id, campaign])), [campaigns]);
  const profileMap = useMemo(() => new Map(profiles.map(member => [member.id, member])), [profiles]);
  const visiblePosts = useMemo(() => posts.filter(post => {
    if (platformFilter !== 'all' && post.platform !== platformFilter) return false;
    if (campaignFilter !== 'all' && post.campaign_id !== campaignFilter) return false;
    return true;
  }), [posts, platformFilter, campaignFilter]);

  const reachTotal = posts.reduce((sum, post) => sum + (post.reach || 0), 0);
  const engagementTotal = posts.reduce((sum, post) => sum + (post.likes || 0) + (post.comments || 0) + (post.shares || 0) + (post.saves || 0), 0);
  const activeCampaigns = campaigns.filter(campaign => campaign.status === 'active').length;
  const pendingContributions = contributions.filter(item => item.review_status === 'pending').length;

  async function createCampaign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (!profile || !canManage) return;
    setBusy(true);
    const form = new FormData(formElement);
    const startDate = String(form.get('start_date') || '') || null;
    const endDate = String(form.get('end_date') || '') || null;
    const target = String(form.get('target_contributions') || '');
    const { error: insertError } = await supabase.from('campaigns').insert({
      name: String(form.get('name') || '').trim(),
      description: String(form.get('description') || '').trim() || null,
      objectives: String(form.get('objectives') || '').trim() || null,
      platform: String(form.get('platform') || 'both'),
      start_date: startDate,
      end_date: endDate,
      target_contributions: target ? numberField(target) : null,
      status: 'planning',
      owner_id: profile.id,
      expected_actions: [],
    });
    setBusy(false);
    if (insertError) {
      showToast('error', `Could not create campaign: ${insertError.message}`);
      return;
    }
    formElement.reset();
    showToast('success', 'Campaign created.');
    await loadData();
  }

  async function recordPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (!profile || !canManage) return;
    setBusy(true);
    const form = new FormData(formElement);
    const dateText = String(form.get('published_at') || '');
    const metrics = {
      likes: numberField(form.get('likes')),
      comments: numberField(form.get('comments')),
      shares: numberField(form.get('shares')),
      impressions: numberField(form.get('impressions')),
      reach: numberField(form.get('reach')),
      views: numberField(form.get('views')),
      saves: numberField(form.get('saves')),
      follower_change: Number(form.get('follower_change') || 0) || 0,
    };
    const { error: insertError } = await supabase.from('social_posts').insert({
      platform: String(form.get('platform') || 'instagram'),
      campaign_id: String(form.get('campaign_id') || '') || null,
      post_url: String(form.get('post_url') || '').trim() || null,
      post_type: String(form.get('post_type') || '').trim() || null,
      caption: String(form.get('caption') || '').trim() || null,
      published_at: dateText ? new Date(dateText).toISOString() : null,
      ...metrics,
      metrics_source: 'manual',
      last_metrics_update: new Date().toISOString(),
      metrics_updated_by: profile.id,
      created_by: profile.id,
    });
    setBusy(false);
    if (insertError) {
      showToast('error', `Could not save post: ${insertError.message}`);
      return;
    }
    formElement.reset();
    showToast('success', 'Social post and metrics saved.');
    await loadData();
  }

  async function submitContribution(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (!profile) return;
    setBusy(true);
    const form = new FormData(formElement);
    const evidence = String(form.get('evidence_url') || '').trim();
    if (evidence && !safeUrl(evidence)) {
      showToast('error', 'Enter a valid http or https evidence link.');
      setBusy(false);
      return;
    }
    const { error: insertError } = await supabase.from('campaign_contributions').insert({
      campaign_id: String(form.get('campaign_id') || ''),
      member_id: profile.id,
      contribution_type: String(form.get('contribution_type') || 'Other'),
      evidence_url: evidence || null,
      description: String(form.get('description') || '').trim() || null,
      review_status: 'pending',
    });
    setBusy(false);
    if (insertError) {
      showToast('error', `Could not submit contribution: ${insertError.message}`);
      return;
    }
    formElement.reset();
    showToast('success', 'Contribution submitted for review.');
    await loadData();
  }

  if (loading) return <LoadingState message="Loading social campaigns and engagement..." />;

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-fade-in">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-jic-orange uppercase tracking-wide">JIC YUVA PULSE</p>
          <h1 className="text-3xl font-bold text-jic-text mt-1">Social Engagement</h1>
          <p className="text-jic-text-secondary mt-2">Coordinate Instagram and LinkedIn campaigns, record post performance, and collect member contributions.</p>
        </div>
        <button onClick={() => void loadData()} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-jic-border bg-white text-sm font-semibold text-jic-text hover:bg-jic-muted transition-colors">
          <RefreshCw className="w-4 h-4" /> Refresh data
        </button>
      </header>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><strong>Some social data could not be loaded.</strong><p className="mt-1">{error}</p></div>}

      <section className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Card><CardBody className="flex items-center gap-3"><div className="w-11 h-11 rounded-xl bg-orange-50 text-jic-orange flex items-center justify-center"><Target className="w-5 h-5" /></div><div><p className="text-sm text-jic-text-secondary">Active campaigns</p><p className="text-2xl font-bold text-jic-text">{activeCampaigns}</p></div></CardBody></Card>
        <Card><CardBody className="flex items-center gap-3"><div className="w-11 h-11 rounded-xl bg-blue-50 text-jic-blue flex items-center justify-center"><BarChart3 className="w-5 h-5" /></div><div><p className="text-sm text-jic-text-secondary">Posts recorded</p><p className="text-2xl font-bold text-jic-text">{posts.length}</p></div></CardBody></Card>
        <Card><CardBody className="flex items-center gap-3"><div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><TrendingUp className="w-5 h-5" /></div><div><p className="text-sm text-jic-text-secondary">Total reach</p><p className="text-2xl font-bold text-jic-text">{formatNumber(reachTotal)}</p></div></CardBody></Card>
        <Card><CardBody className="flex items-center gap-3"><div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center"><Users className="w-5 h-5" /></div><div><p className="text-sm text-jic-text-secondary">Pending contributions</p><p className="text-2xl font-bold text-jic-text">{pendingContributions}</p></div></CardBody></Card>
      </section>

      {canManage && <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader title="Create a campaign" subtitle="Set up a new Instagram or LinkedIn activity." />
          <CardBody>
            <form onSubmit={createCampaign} className="space-y-3">
              <div><label className="block text-sm font-semibold text-jic-text mb-1" htmlFor="campaign-name">Campaign name *</label><input id="campaign-name" name="name" required maxLength={140} placeholder="e.g. VentureVerse registrations" className="w-full rounded-xl border border-jic-border px-3 py-2.5 text-sm" /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold text-jic-text mb-1" htmlFor="campaign-platform">Platform</label><select id="campaign-platform" name="platform" className="w-full rounded-xl border border-jic-border bg-white px-3 py-2.5 text-sm"><option value="both">Instagram + LinkedIn</option><option value="instagram">Instagram</option><option value="linkedin">LinkedIn</option><option value="other">Other</option></select></div>
                <div><label className="block text-sm font-semibold text-jic-text mb-1" htmlFor="campaign-target">Target contributions</label><input id="campaign-target" name="target_contributions" type="number" min="0" step="1" placeholder="e.g. 50" className="w-full rounded-xl border border-jic-border px-3 py-2.5 text-sm" /></div>
                <div><label className="block text-sm font-semibold text-jic-text mb-1" htmlFor="campaign-start">Start date</label><input id="campaign-start" name="start_date" type="date" className="w-full rounded-xl border border-jic-border px-3 py-2.5 text-sm" /></div>
                <div><label className="block text-sm font-semibold text-jic-text mb-1" htmlFor="campaign-end">End date</label><input id="campaign-end" name="end_date" type="date" className="w-full rounded-xl border border-jic-border px-3 py-2.5 text-sm" /></div>
              </div>
              <div><label className="block text-sm font-semibold text-jic-text mb-1" htmlFor="campaign-description">Description</label><textarea id="campaign-description" name="description" rows={2} maxLength={1200} placeholder="What is this campaign about?" className="w-full rounded-xl border border-jic-border px-3 py-2.5 text-sm" /></div>
              <div><label className="block text-sm font-semibold text-jic-text mb-1" htmlFor="campaign-objectives">Objectives</label><textarea id="campaign-objectives" name="objectives" rows={2} maxLength={1200} placeholder="What outcome are we aiming for?" className="w-full rounded-xl border border-jic-border px-3 py-2.5 text-sm" /></div>
              <button disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-jic-orange px-4 py-2.5 text-sm font-semibold text-white hover:bg-jic-orange-deep disabled:opacity-50"><PlusCircle className="w-4 h-4" /> Create campaign</button>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Record a social post" subtitle="Enter post details and the latest manually checked metrics." />
          <CardBody>
            <form onSubmit={recordPost} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="block text-sm font-semibold text-jic-text mb-1" htmlFor="post-platform">Platform *</label><select id="post-platform" name="platform" required className="w-full rounded-xl border border-jic-border bg-white px-3 py-2.5 text-sm"><option value="instagram">Instagram</option><option value="linkedin">LinkedIn</option></select></div>
                <div><label className="block text-sm font-semibold text-jic-text mb-1" htmlFor="post-campaign">Campaign</label><select id="post-campaign" name="campaign_id" defaultValue="" className="w-full rounded-xl border border-jic-border bg-white px-3 py-2.5 text-sm"><option value="">No linked campaign</option>{campaigns.map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></div>
                <div><label className="block text-sm font-semibold text-jic-text mb-1" htmlFor="post-date">Published date</label><input id="post-date" name="published_at" type="datetime-local" className="w-full rounded-xl border border-jic-border px-3 py-2.5 text-sm" /></div>
                <div><label className="block text-sm font-semibold text-jic-text mb-1" htmlFor="post-type">Post type</label><select id="post-type" name="post_type" className="w-full rounded-xl border border-jic-border bg-white px-3 py-2.5 text-sm"><option value="feed">Feed post</option><option value="reel">Reel</option><option value="story">Story</option><option value="carousel">Carousel</option><option value="video">Video</option><option value="other">Other</option></select></div>
              </div>
              <div><label className="block text-sm font-semibold text-jic-text mb-1" htmlFor="post-url">Post URL</label><input id="post-url" name="post_url" type="url" placeholder="https://..." className="w-full rounded-xl border border-jic-border px-3 py-2.5 text-sm" /></div>
              <div><label className="block text-sm font-semibold text-jic-text mb-1" htmlFor="post-caption">Caption / short description</label><textarea id="post-caption" name="caption" rows={2} maxLength={1000} placeholder="What was published?" className="w-full rounded-xl border border-jic-border px-3 py-2.5 text-sm" /></div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(['likes', 'comments', 'shares', 'saves', 'reach', 'impressions', 'views'] as const).map(metric => <div key={metric}><label className="block text-xs font-semibold text-jic-text-secondary mb-1 capitalize" htmlFor={`post-${metric}`}>{metric}</label><input id={`post-${metric}`} name={metric} type="number" min="0" step="1" defaultValue="0" className="w-full rounded-xl border border-jic-border px-3 py-2 text-sm" /></div>)}
                <div><label className="block text-xs font-semibold text-jic-text-secondary mb-1" htmlFor="post-follower-change">Follower change</label><input id="post-follower-change" name="follower_change" type="number" step="1" defaultValue="0" className="w-full rounded-xl border border-jic-border px-3 py-2 text-sm" /></div>
              </div>
              <button disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-jic-orange px-4 py-2.5 text-sm font-semibold text-white hover:bg-jic-orange-deep disabled:opacity-50"><PlusCircle className="w-4 h-4" /> Save post metrics</button>
            </form>
          </CardBody>
        </Card>
      </section>}

      {!canManage && <Card><CardBody><p className="text-sm text-jic-text-secondary">Campaign creation and social metric entry are restricted to administrators and department leads. You can submit your campaign contribution below.</p></CardBody></Card>}

      <Card>
        <CardHeader title="Campaigns" subtitle={`${campaigns.length} campaigns in the workspace`} />
        {campaigns.length === 0 ? <EmptyState icon={<Target className="w-8 h-8" />} title="No campaigns yet" description="An administrator or department lead can create the first campaign." /> : <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3 p-4">
          {campaigns.map(campaign => {
            const relatedPosts = posts.filter(post => post.campaign_id === campaign.id);
            const relatedContributions = contributions.filter(item => item.campaign_id === campaign.id);
            const approved = relatedContributions.filter(item => item.review_status === 'approved').length;
            return <article key={campaign.id} className="rounded-2xl border border-jic-border p-4 min-w-0">
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-bold text-jic-text break-words">{campaign.name}</h3><p className="text-sm text-jic-text-secondary mt-1">{platformLabel(campaign.platform)}</p></div><Badge className={campaignStatusStyles[campaign.status] || 'bg-slate-100 text-slate-700'}>{campaign.status.replace('_', ' ')}</Badge></div>
              {campaign.description && <p className="text-sm text-jic-text-secondary mt-3 line-clamp-3">{campaign.description}</p>}
              <div className="grid grid-cols-3 gap-2 mt-4"><div className="rounded-xl bg-jic-muted p-2"><p className="text-xs text-jic-text-secondary">Posts</p><p className="font-bold text-jic-text">{relatedPosts.length}</p></div><div className="rounded-xl bg-jic-muted p-2"><p className="text-xs text-jic-text-secondary">Contributions</p><p className="font-bold text-jic-text">{relatedContributions.length}</p></div><div className="rounded-xl bg-jic-muted p-2"><p className="text-xs text-jic-text-secondary">Approved</p><p className="font-bold text-jic-text">{approved}</p></div></div>
              <div className="mt-3 text-xs text-jic-text-secondary flex items-center justify-between gap-3"><span>{campaign.start_date ? formatDate(campaign.start_date) : 'Start date not set'}{campaign.end_date ? ` – ${formatDate(campaign.end_date)}` : ''}</span>{campaign.target_contributions != null && <span>Target: {campaign.target_contributions}</span>}</div>
              {campaign.campaign_post_url && safeUrl(campaign.campaign_post_url) && <a href={safeUrl(campaign.campaign_post_url)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-jic-orange font-semibold mt-3">Campaign link <ExternalLink className="w-3 h-3" /></a>}
            </article>;
          })}
        </div>}
      </Card>

      <Card>
        <CardHeader title="Social post performance" subtitle={`${visiblePosts.length} of ${posts.length} recorded posts`} action={<span className="text-xs font-semibold text-jic-text-secondary">Engagement total: {formatNumber(engagementTotal)}</span>} />
        <CardBody>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <select value={platformFilter} onChange={event => setPlatformFilter(event.target.value)} aria-label="Filter posts by platform" className="w-full rounded-xl border border-jic-border bg-white px-3 py-2.5 text-sm"><option value="all">All platforms</option><option value="instagram">Instagram</option><option value="linkedin">LinkedIn</option></select>
            <select value={campaignFilter} onChange={event => setCampaignFilter(event.target.value)} aria-label="Filter posts by campaign" className="w-full rounded-xl border border-jic-border bg-white px-3 py-2.5 text-sm"><option value="all">All campaigns</option>{campaigns.map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select>
          </div>
          {visiblePosts.length === 0 ? <EmptyState icon={<BarChart3 className="w-8 h-8" />} title="No matching posts" description="Social posts recorded by the authorised team will appear here." /> : <div className="space-y-3">
            {visiblePosts.map(post => {
              const campaign = post.campaign_id ? campaignMap.get(post.campaign_id) : undefined;
              const url = safeUrl(post.post_url);
              const engagement = (post.likes || 0) + (post.comments || 0) + (post.shares || 0) + (post.saves || 0);
              return <article key={post.id} className="rounded-2xl border border-jic-border p-4">
                <div className="flex flex-col lg:flex-row lg:items-start gap-4 justify-between"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Badge className={post.platform === 'instagram' ? 'bg-pink-100 text-pink-800' : 'bg-blue-100 text-blue-800'}>{platformLabel(post.platform)}</Badge>{post.post_type && <Badge className="bg-slate-100 text-slate-700">{post.post_type}</Badge>}<span className="text-xs text-jic-text-secondary">{formatDate(post.published_at)}</span></div><h3 className="font-bold text-jic-text mt-2">{campaign?.name || post.caption || 'Social post'}</h3>{post.caption && campaign && <p className="text-sm text-jic-text-secondary mt-1 line-clamp-2">{post.caption}</p>}{url && <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-jic-orange mt-2">Open post <ExternalLink className="w-3 h-3" /></a>}<p className="text-xs text-jic-text-secondary mt-2">Metrics last updated: {post.last_metrics_update ? formatDate(post.last_metrics_update) : 'Not recorded'}{post.metrics_updated_by && profileMap.get(post.metrics_updated_by) ? ` · ${profileMap.get(post.metrics_updated_by)?.full_name}` : ''}</p></div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:min-w-[360px]">{[{ label: 'Reach', value: post.reach || 0, icon: Users }, { label: 'Likes', value: post.likes || 0, icon: Heart }, { label: 'Comments', value: post.comments || 0, icon: MessageCircle }, { label: 'Shares', value: (post.shares || 0) + (post.saves || 0), icon: Share2 }].map(metric => { const Icon = metric.icon; return <div key={metric.label} className="rounded-xl bg-jic-muted p-2.5"><div className="flex items-center gap-1.5 text-xs text-jic-text-secondary"><Icon className="w-3.5 h-3.5" />{metric.label}</div><p className="font-bold text-jic-text mt-1">{formatNumber(metric.value)}</p></div>; })}</div>
                  <p className="text-xs text-jic-text-secondary lg:w-28 lg:text-right">{formatNumber(engagement)} total interactions</p>
                </div>
              </article>;
            })}
          </div>}
        </CardBody>
      </Card>

      <section className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-6">
        <Card>
          <CardHeader title="Submit your contribution" subtitle="Log your work to support a campaign and send it for review." />
          <CardBody>
            {campaigns.filter(campaign => !['cancelled', 'completed'].includes(campaign.status)).length === 0 ? <EmptyState icon={<Users className="w-8 h-8" />} title="No open campaigns" description="There are no campaigns accepting contributions right now." /> : <form onSubmit={submitContribution} className="space-y-3">
              <div><label className="block text-sm font-semibold text-jic-text mb-1" htmlFor="contribution-campaign">Campaign *</label><select id="contribution-campaign" name="campaign_id" required defaultValue="" className="w-full rounded-xl border border-jic-border bg-white px-3 py-2.5 text-sm"><option value="" disabled>Select a campaign</option>{campaigns.filter(campaign => !['cancelled', 'completed'].includes(campaign.status)).map(campaign => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></div>
              <div><label className="block text-sm font-semibold text-jic-text mb-1" htmlFor="contribution-type">Contribution type *</label><select id="contribution-type" name="contribution_type" required className="w-full rounded-xl border border-jic-border bg-white px-3 py-2.5 text-sm"><option value="Content creation">Content creation</option><option value="Repost / share">Repost / share</option><option value="Comment / engagement">Comment / engagement</option><option value="Story share">Story share</option><option value="Outreach">Outreach</option><option value="Creative / design">Creative / design</option><option value="Other">Other</option></select></div>
              <div><label className="block text-sm font-semibold text-jic-text mb-1" htmlFor="contribution-evidence">Evidence URL</label><input id="contribution-evidence" name="evidence_url" type="url" placeholder="https://..." className="w-full rounded-xl border border-jic-border px-3 py-2.5 text-sm" /></div>
              <div><label className="block text-sm font-semibold text-jic-text mb-1" htmlFor="contribution-description">Description</label><textarea id="contribution-description" name="description" rows={3} maxLength={1500} placeholder="Briefly describe what you contributed." className="w-full rounded-xl border border-jic-border px-3 py-2.5 text-sm" /></div>
              <button disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-jic-orange px-4 py-2.5 text-sm font-semibold text-white hover:bg-jic-orange-deep disabled:opacity-50"><PlusCircle className="w-4 h-4" /> Submit for review</button>
            </form>}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Recent contributions" subtitle="Submitted campaign activity and current review status." />
          {contributions.length === 0 ? <EmptyState icon={<Users className="w-8 h-8" />} title="No contributions yet" description="Your team's submissions will appear here." /> : <div className="divide-y divide-jic-border">{contributions.slice(0, 20).map(item => {
            const member = profileMap.get(item.member_id);
            const campaign = campaignMap.get(item.campaign_id);
            return <div key={item.id} className="p-4 flex items-start gap-3"><div className="w-9 h-9 rounded-xl bg-jic-orange-soft text-jic-orange font-bold text-xs flex items-center justify-center shrink-0">{(member?.full_name || 'YU').split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase()}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-sm text-jic-text">{member?.full_name || 'JIC member'}</p><Badge className={reviewStyles[item.review_status] || 'bg-slate-100 text-slate-700'}>{item.review_status.replace('_', ' ')}</Badge></div><p className="text-xs text-jic-text-secondary mt-1">{campaign?.name || 'Campaign'} · {item.contribution_type} · {formatDate(item.submitted_at)}</p>{item.description && <p className="text-sm text-jic-text-secondary mt-2 break-words">{item.description}</p>}{item.evidence_url && safeUrl(item.evidence_url) && <a className="inline-flex items-center gap-1 text-xs text-jic-orange font-semibold mt-2" href={safeUrl(item.evidence_url)} target="_blank" rel="noreferrer">View evidence <ExternalLink className="w-3 h-3" /></a>}{item.review_feedback && <p className="text-xs text-jic-text-secondary mt-2">Review note: {item.review_feedback}</p>}</div></div>;
          })}</div>}
        </Card>
      </section>
    </div>
  );
}
