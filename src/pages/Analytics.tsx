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
