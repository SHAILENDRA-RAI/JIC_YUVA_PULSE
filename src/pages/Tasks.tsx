import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertCircle, CalendarDays, CheckCircle2, ClipboardList, FolderKanban, Plus, RefreshCw, Search, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, LoadingState } from '@/components/ui/EmptyState';
import type { Department, Priority, Profile, Project, Task, TaskStatus } from '@/types';

type TaskDraft = {
  title: string;
  description: string;
  department_id: string;
  assignee_id: string;
  priority: Priority;
  start_date: string;
  deadline: string;
};

type ProjectDraft = {
  name: string;
  description: string;
  priority: Priority;
  start_date: string;
  target_completion: string;
};

const taskStatuses: TaskStatus[] = ['open', 'assigned', 'not_started', 'in_progress', 'blocked', 'submitted', 'revision_requested', 'completed', 'cancelled'];
const priorities: Priority[] = ['low', 'medium', 'high', 'critical'];

const taskStatusStyle: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700', open: 'bg-blue-100 text-blue-800', assigned: 'bg-indigo-100 text-indigo-800',
  not_started: 'bg-slate-100 text-slate-700', in_progress: 'bg-amber-100 text-amber-800', blocked: 'bg-red-100 text-red-800',
  submitted: 'bg-violet-100 text-violet-800', revision_requested: 'bg-orange-100 text-orange-800', completed: 'bg-emerald-100 text-emerald-800', cancelled: 'bg-slate-100 text-slate-500',
};

const projectStatusStyle: Record<string, string> = {
  planning: 'bg-slate-100 text-slate-700', active: 'bg-emerald-100 text-emerald-800', paused: 'bg-amber-100 text-amber-800',
  at_risk: 'bg-red-100 text-red-800', completed: 'bg-blue-100 text-blue-800', cancelled: 'bg-slate-100 text-slate-500',
};

const priorityStyle: Record<string, string> = {
  low: 'text-slate-500', medium: 'text-blue-700', high: 'text-orange-700', critical: 'text-red-700',
};

const defaultTaskDraft: TaskDraft = {
  title: '',
  description: '',
  department_id: '',
  assignee_id: '',
  priority: 'medium',
  start_date: '',
  deadline: '',
};

const defaultProjectDraft: ProjectDraft = {
  name: '',
  description: '',
  priority: 'medium',
  start_date: '',
  target_completion: '',
};

function pretty(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function shortDate(value: string | null) {
  if (!value) return 'No deadline';

  const parsed = new Date(`${value.slice(0, 10)}T12:00:00`);

  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
}

function isPastDue(task: Task) {
  return Boolean(
    task.deadline &&
    !['completed', 'cancelled'].includes(task.status) &&
    new Date(`${task.deadline.slice(0, 10)}T23:59:59`) < new Date()
  );
}

export function Tasks() {
  const { profile } = useAuth();
  const { showToast } = useToast();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeTab, setActiveTab] = useState<'tasks' | 'projects'>('tasks');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [taskDraft, setTaskDraft] = useState<TaskDraft>(defaultTaskDraft);
  const [projectDraft, setProjectDraft] = useState<ProjectDraft>(defaultProjectDraft);

  const canManage = profile?.role === 'admin' || profile?.role === 'lead';

  async function loadData() {
    setLoading(true);
    setLoadError('');

    const [taskResult, projectResult, memberResult, departmentResult] = await Promise.all([
      supabase
        .from('tasks')
        .select('*')
        .order('deadline', { ascending: true, nullsFirst: false })
        .limit(500),

      supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300),

      supabase
        .from('profiles')
        .select('*')
        .eq('status', 'active')
        .order('full_name'),

      supabase
        .from('departments')
        .select('*')
        .eq('status', 'active')
        .order('name'),
    ]);

    if (taskResult.error) {
      setLoadError(taskResult.error.message);
      setTasks([]);
    } else {
      setTasks((taskResult.data || []) as Task[]);
    }

    if (!projectResult.error) {
      setProjects((projectResult.data || []) as Project[]);
    }

    if (!memberResult.error) {
      setMembers((memberResult.data || []) as Profile[]);
    }

    if (!departmentResult.error) {
      setDepartments((departmentResult.data || []) as Department[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    void loadData();
  }, []);

  const memberMap = useMemo(
    () => new Map(members.map(member => [member.id, member])),
    [members]
  );

  const projectMap = useMemo(
    () => new Map(projects.map(project => [project.id, project])),
    [projects]
  );

  const departmentMap = useMemo(
    () => new Map(departments.map(department => [department.id, department])),
    [departments]
  );

  const filteredTasks = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return tasks.filter(task => {
      if (statusFilter !== 'all' && task.status !== statusFilter) {
        return false;
      }

      const haystack = [
        task.title,
        task.description || '',
        memberMap.get(task.assignee_id || '')?.full_name || '',
        projectMap.get(task.project_id || '')?.name || '',
        departmentMap.get(task.department_id || '')?.name || '',
      ].join(' ').toLowerCase();

      return !needle || haystack.includes(needle);
    });
  }, [tasks, search, statusFilter, memberMap, projectMap, departmentMap]);

  const openCount = tasks.filter(
    task => !['completed', 'cancelled'].includes(task.status)
  ).length;

  const overdueCount = tasks.filter(isPastDue).length;

  const reviewCount = tasks.filter(
    task => task.status === 'submitted'
  ).length;

  const completedCount = tasks.filter(
    task => task.status === 'completed'
  ).length;

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManage) {
      showToast('error', 'Only an administrator or authorised lead can create tasks.');
      return;
    }

    if (!taskDraft.title.trim()) return;

    setSaving(true);

    const payload = {
      title: taskDraft.title.trim(),
      description: taskDraft.description.trim() || null,
      department_id: taskDraft.department_id || null,
      assignee_id: taskDraft.assignee_id || null,
      priority: taskDraft.priority,
      start_date: taskDraft.start_date || null,
      deadline: taskDraft.deadline || null,
      status: taskDraft.assignee_id ? 'assigned' : 'open',
      created_by: profile?.id || null,
    };

    const { error } = await supabase
      .from('tasks')
      .insert(payload);

    setSaving(false);

    if (error) {
      showToast('error', `Task could not be created: ${error.message}`);
      return;
    }

    showToast('success', 'Task created.');
    setTaskDraft(defaultTaskDraft);
    setShowTaskForm(false);

    await loadData();
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManage) {
      showToast('error', 'Only an administrator or authorised lead can create projects.');
      return;
    }

    if (!projectDraft.name.trim()) return;

    setSaving(true);

    const payload = {
      name: projectDraft.name.trim(),
      description: projectDraft.description.trim() || null,
      owner_id: profile?.id || null,
      status: 'planning',
      priority: projectDraft.priority,
      start_date: projectDraft.start_date || null,
      target_completion: projectDraft.target_completion || null,
    };

    const { error } = await supabase
      .from('projects')
      .insert(payload);

    setSaving(false);

    if (error) {
      showToast('error', `Project could not be created: ${error.message}`);
      return;
    }

    showToast('success', 'Project created.');
    setProjectDraft(defaultProjectDraft);
    setShowProjectForm(false);
    setActiveTab('projects');

    await loadData();
  }

  async function changeTaskStatus(task: Task, nextStatus: TaskStatus) {
    if (nextStatus === task.status) return;

    const completedAt = nextStatus === 'completed'
      ? new Date().toISOString()
      : null;

    const { error } = await supabase
      .from('tasks')
      .update({
        status: nextStatus,
        completed_at: completedAt,
      })
      .eq('id', task.id);

    if (error) {
      showToast('error', `Status update failed: ${error.message}`);
      return;
    }

    showToast('success', `Task marked ${pretty(nextStatus).toLowerCase()}.`);

    await loadData();
  }

  if (loading) {
    return <LoadingState message="Loading tasks and projects..." />;
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-fade-in">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-jic-orange uppercase tracking-wide">
            JIC YUVA PULSE
          </p>

          <h1 className="text-3xl font-bold text-jic-text mt-1">
            Tasks &amp; Projects
          </h1>

          <p className="text-jic-text-secondary mt-2">
            Assign ownership, track deadlines, and keep delivery moving.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void loadData()}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-jic-border bg-white text-sm font-semibold text-jic-text hover:bg-jic-muted"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>

          {canManage && activeTab === 'tasks' && (
            <button
              onClick={() => setShowTaskForm(value => !value)}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-jic-orange text-white text-sm font-semibold hover:bg-jic-orange-deep"
            >
              <Plus className="w-4 h-4" />
              New task
            </button>
          )}

          {canManage && activeTab === 'projects' && (
            <button
              onClick={() => setShowProjectForm(value => !value)}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-jic-orange text-white text-sm font-semibold hover:bg-jic-orange-deep"
            >
              <Plus className="w-4 h-4" />
              New project
            </button>
          )}
        </div>
      </header>

      <section className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Card>
          <CardBody className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-jic-text-secondary">Open tasks</p>
              <p className="text-2xl font-bold text-jic-text">{openCount}</p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-700 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-jic-text-secondary">Overdue</p>
              <p className="text-2xl font-bold text-jic-text">{overdueCount}</p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-jic-text-secondary">Awaiting review</p>
              <p className="text-2xl font-bold text-jic-text">{reviewCount}</p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-jic-text-secondary">Completed</p>
              <p className="text-2xl font-bold text-jic-text">{completedCount}</p>
            </div>
          </CardBody>
        </Card>
      </section>

      <div className="flex gap-2 border-b border-jic-border">
        <button
          onClick={() => {
            setActiveTab('tasks');
            setShowProjectForm(false);
          }}
          className={`px-4 py-3 text-sm font-semibold border-b-2 ${
            activeTab === 'tasks'
              ? 'border-jic-orange text-jic-orange'
              : 'border-transparent text-jic-text-secondary hover:text-jic-text'
          }`}
        >
          Tasks ({tasks.length})
        </button>

        <button
          onClick={() => {
            setActiveTab('projects');
            setShowTaskForm(false);
          }}
          className={`px-4 py-3 text-sm font-semibold border-b-2 ${
            activeTab === 'projects'
              ? 'border-jic-orange text-jic-orange'
              : 'border-transparent text-jic-text-secondary hover:text-jic-text'
          }`}
        >
          Projects ({projects.length})
        </button>
      </div>

      {showTaskForm && activeTab === 'tasks' && canManage && (
        <Card>
          <CardHeader
            title="Create a task"
            subtitle="Add a title, choose an owner, and set a deadline."
          />

          <CardBody>
            <form onSubmit={createTask} className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <label className="text-sm font-semibold text-jic-text">
                  Task title *
                  <input
                    required
                    maxLength={180}
                    value={taskDraft.title}
                    onChange={event =>
                      setTaskDraft({ ...taskDraft, title: event.target.value })
                    }
                    placeholder="e.g. Prepare launch campaign creatives"
                    className="mt-1.5 w-full rounded-xl border border-jic-border px-3 py-2.5 font-normal focus:outline-none focus:ring-2 focus:ring-jic-orange/20"
                  />
                </label>

                <label className="text-sm font-semibold text-jic-text">
                  Assign to
                  <select
                    value={taskDraft.assignee_id}
                    onChange={event => {
                      const assigneeId = event.target.value;
                      const selectedMember = members.find(
                        member => member.id === assigneeId
                      );

                      const selectedDepartment = departments.find(
                        department =>
                          department.name.trim().toLowerCase() ===
                          (selectedMember?.designation || '').trim().toLowerCase()
                      );

                      setTaskDraft({
                        ...taskDraft,
                        assignee_id: assigneeId,
                        department_id: selectedDepartment?.id || '',
                      });
                    }}
                    className="mt-1.5 w-full rounded-xl border border-jic-border bg-white px-3 py-2.5 font-normal"
                  >
                    <option value="">Unassigned</option>

                    {members.map(member => (
                      <option key={member.id} value={member.id}>
                        {member.full_name} · {member.designation || pretty(member.role)}
                      </option>
                    ))}
                  </select>

                  <span className="mt-1 block text-xs font-normal text-jic-text-secondary">
                    Department is assigned automatically from the selected member's designation.
                  </span>
                </label>

                <label className="text-sm font-semibold text-jic-text">
                  Priority
                  <select
                    value={taskDraft.priority}
                    onChange={event =>
                      setTaskDraft({
                        ...taskDraft,
                        priority: event.target.value as Priority,
                      })
                    }
                    className="mt-1.5 w-full rounded-xl border border-jic-border bg-white px-3 py-2.5 font-normal"
                  >
                    {priorities.map(priority => (
                      <option key={priority} value={priority}>
                        {pretty(priority)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-semibold text-jic-text">
                  Start date
                  <input
                    type="date"
                    value={taskDraft.start_date}
                    onChange={event =>
                      setTaskDraft({ ...taskDraft, start_date: event.target.value })
                    }
                    className="mt-1.5 w-full rounded-xl border border-jic-border bg-white px-3 py-2.5 font-normal"
                  />
                </label>

                <label className="text-sm font-semibold text-jic-text">
                  Deadline
                  <input
                    type="date"
                    value={taskDraft.deadline}
                    onChange={event =>
                      setTaskDraft({ ...taskDraft, deadline: event.target.value })
                    }
                    className="mt-1.5 w-full rounded-xl border border-jic-border bg-white px-3 py-2.5 font-normal"
                  />
                </label>

                <label className="text-sm font-semibold text-jic-text lg:col-span-2">
                  Description
                  <textarea
                    rows={3}
                    value={taskDraft.description}
                    onChange={event =>
                      setTaskDraft({ ...taskDraft, description: event.target.value })
                    }
                    placeholder="What needs to be done? Include the expected outcome or deliverable."
                    className="mt-1.5 w-full resize-y rounded-xl border border-jic-border px-3 py-2.5 font-normal"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowTaskForm(false);
                    setTaskDraft(defaultTaskDraft);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-jic-border text-sm font-semibold"
                >
                  Cancel
                </button>

                <button
                  disabled={saving}
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-jic-orange text-white text-sm font-semibold disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Create task'}
                </button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {showProjectForm && activeTab === 'projects' && canManage && (
        <Card>
          <CardHeader
            title="Create a project"
            subtitle="Use projects to group related tasks and deliverables."
          />

          <CardBody>
            <form onSubmit={createProject} className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <label className="text-sm font-semibold text-jic-text">
                  Project name *
                  <input
                    required
                    maxLength={180}
                    value={projectDraft.name}
                    onChange={event =>
                      setProjectDraft({ ...projectDraft, name: event.target.value })
                    }
                    placeholder="e.g. JIC Recruitment Phase 2"
                    className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-jic-border font-normal"
                  />
                </label>

                <label className="text-sm font-semibold text-jic-text">
                  Priority
                  <select
                    value={projectDraft.priority}
                    onChange={event =>
                      setProjectDraft({
                        ...projectDraft,
                        priority: event.target.value as Priority,
                      })
                    }
                    className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-jic-border bg-white font-normal"
                  >
                    {priorities.map(priority => (
                      <option key={priority} value={priority}>
                        {pretty(priority)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm font-semibold text-jic-text">
                  Start date
                  <input
                    type="date"
                    value={projectDraft.start_date}
                    onChange={event =>
                      setProjectDraft({
                        ...projectDraft,
                        start_date: event.target.value,
                      })
                    }
                    className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-jic-border bg-white font-normal"
                  />
                </label>

                <label className="text-sm font-semibold text-jic-text">
                  Target completion
                  <input
                    type="date"
                    value={projectDraft.target_completion}
                    onChange={event =>
                      setProjectDraft({
                        ...projectDraft,
                        target_completion: event.target.value,
                      })
                    }
                    className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-jic-border bg-white font-normal"
                  />
                </label>

                <label className="text-sm font-semibold text-jic-text lg:col-span-2">
                  Description
                  <textarea
                    rows={3}
                    value={projectDraft.description}
                    onChange={event =>
                      setProjectDraft({
                        ...projectDraft,
                        description: event.target.value,
                      })
                    }
                    placeholder="Project goal and what success looks like..."
                    className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-jic-border bg-white font-normal resize-y"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowProjectForm(false);
                    setProjectDraft(defaultProjectDraft);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-jic-border text-sm font-semibold"
                >
                  Cancel
                </button>

                <button
                  disabled={saving}
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-jic-orange text-white text-sm font-semibold disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Create project'}
                </button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="font-semibold text-red-800">Could not load tasks</p>
          <p className="text-sm text-red-700 mt-1">{loadError}</p>
          <button
            onClick={() => void loadData()}
            className="mt-2 text-sm font-semibold underline text-red-800"
          >
            Try again
          </button>
        </div>
      )}

      {activeTab === 'tasks' ? (
        <Card>
          <CardHeader
            title="Task board"
            subtitle="Filter by title, owner, project, department, or status."
          />

          <CardBody>
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_220px] gap-3 mb-4">
              <label className="relative block">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-jic-text-secondary" />
                <input
                  aria-label="Search tasks"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Search tasks, people, projects..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-jic-border text-sm"
                />
              </label>

              <select
                aria-label="Filter by task status"
                value={statusFilter}
                onChange={event => setStatusFilter(event.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-jic-border text-sm bg-white"
              >
                <option value="all">All statuses</option>
                {taskStatuses.map(status => (
                  <option key={status} value={status}>
                    {pretty(status)}
                  </option>
                ))}
              </select>
            </div>

            {filteredTasks.length === 0 ? (
              <EmptyState
                icon={<ClipboardList className="w-8 h-8" />}
                title="No tasks found"
                description={
                  tasks.length
                    ? 'Try another search or status filter.'
                    : 'Create the first task to start tracking JIC work.'
                }
                action={
                  canManage ? (
                    <button
                      onClick={() => setShowTaskForm(true)}
                      className="px-4 py-2 rounded-xl bg-jic-orange text-white text-sm font-semibold"
                    >
                      Create a task
                    </button>
                  ) : undefined
                }
              />
            ) : (
              <div className="space-y-3">
                {filteredTasks.map(task => {
                  const assignee = task.assignee_id
                    ? memberMap.get(task.assignee_id)
                    : undefined;

                  const department = task.department_id
                    ? departmentMap.get(task.department_id)
                    : undefined;

                  const canUpdate =
                    canManage ||
                    task.assignee_id === profile?.id ||
                    task.reviewer_id === profile?.id;

                  const allowedStatuses = canManage
                    ? taskStatuses
                    : task.reviewer_id === profile?.id &&
                      task.assignee_id !== profile?.id &&
                      task.status === 'submitted'
                      ? ['completed', 'revision_requested'] as TaskStatus[]
                      : ['not_started', 'in_progress', 'blocked', 'submitted'] as TaskStatus[];

                  return (
                    <article
                      key={task.id}
                      className="rounded-2xl border border-jic-border p-4 hover:border-jic-orange/30 transition-colors"
                    >
                      <div className="flex flex-col xl:flex-row xl:items-start gap-4">
                        <div
                          className={`w-1.5 rounded-full shrink-0 self-stretch min-h-12 ${
                            task.priority === 'critical'
                              ? 'bg-red-500'
                              : task.priority === 'high'
                                ? 'bg-orange-500'
                                : task.priority === 'medium'
                                  ? 'bg-blue-500'
                                  : 'bg-slate-300'
                          }`}
                        />

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-jic-text">{task.title}</h3>
                            <Badge className={taskStatusStyle[task.status] || 'bg-slate-100 text-slate-700'}>
                              {pretty(task.status)}
                            </Badge>
                            <span className={`text-xs font-bold uppercase ${priorityStyle[task.priority] || ''}`}>
                              {task.priority} priority
                            </span>
                            {isPastDue(task) && (
                              <Badge className="bg-red-100 text-red-800">Overdue</Badge>
                            )}
                          </div>

                          {task.description && (
                            <p className="text-sm text-jic-text-secondary mt-1.5 whitespace-pre-line">
                              {task.description}
                            </p>
                          )}

                          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 text-xs text-jic-text-secondary">
                            <span className="inline-flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5" />
                              {assignee?.full_name || 'Unassigned'}
                            </span>

                            {department && <span>{department.name}</span>}

                            <span className="inline-flex items-center gap-1.5">
                              <CalendarDays className="w-3.5 h-3.5" />
                              {shortDate(task.deadline)}
                            </span>
                          </div>
                        </div>

                        {canUpdate && task.status !== 'cancelled' && (
                          <div className="xl:w-44 shrink-0">
                            <label
                              className="block text-xs font-semibold text-jic-text-secondary mb-1"
                              htmlFor={`status-${task.id}`}
                            >
                              Update status
                            </label>

                            <select
                              id={`status-${task.id}`}
                              value={task.status}
                              onChange={event =>
                                void changeTaskStatus(task, event.target.value as TaskStatus)
                              }
                              className="w-full px-2.5 py-2 rounded-lg border border-jic-border bg-white text-sm"
                            >
                              {!allowedStatuses.includes(task.status) && (
                                <option value={task.status}>{pretty(task.status)}</option>
                              )}

                              {allowedStatuses.map(status => (
                                <option key={status} value={status}>
                                  {pretty(status)}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader
            title="Projects workspace"
            subtitle="Group tasks into projects and track target completion."
          />

          <CardBody>
            {projects.length === 0 ? (
              <EmptyState
                icon={<FolderKanban className="w-8 h-8" />}
                title="No projects yet"
                description="Create a project to group tasks, dates, and delivery."
                action={
                  canManage ? (
                    <button
                      onClick={() => setShowProjectForm(true)}
                      className="px-4 py-2 rounded-xl bg-jic-orange text-white text-sm font-semibold"
                    >
                      Create a project
                    </button>
                  ) : undefined
                }
              />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
                {projects.map(project => {
                  const owner = project.owner_id
                    ? memberMap.get(project.owner_id)
                    : undefined;

                  const relatedTasks = tasks.filter(
                    task => task.project_id === project.id
                  );

                  const done = relatedTasks.filter(
                    task => task.status === 'completed'
                  ).length;

                  return (
                    <article
                      key={project.id}
                      className="rounded-2xl border border-jic-border p-4 flex flex-col"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="w-11 h-11 rounded-xl bg-jic-orange-soft text-jic-orange flex items-center justify-center">
                          <FolderKanban className="w-5 h-5" />
                        </div>

                        <Badge className={projectStatusStyle[project.status] || 'bg-slate-100 text-slate-700'}>
                          {pretty(project.status)}
                        </Badge>
                      </div>

                      <h3 className="mt-4 font-bold text-lg text-jic-text">
                        {project.name}
                      </h3>

                      {project.description && (
                        <p className="mt-1 text-sm text-jic-text-secondary line-clamp-3">
                          {project.description}
                        </p>
                      )}

                      <div className="mt-4 text-sm text-jic-text-secondary space-y-1">
                        <p>Owner: {owner?.full_name || 'Not set'}</p>
                        <p>Target: {shortDate(project.target_completion)}</p>
                        <p className={`font-semibold ${priorityStyle[project.priority]}`}>
                          {pretty(project.priority)} priority
                        </p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-jic-border">
                        <div className="flex justify-between text-xs text-jic-text-secondary">
                          <span>{relatedTasks.length} tasks</span>
                          <span>{done} completed</span>
                        </div>

                        <div className="mt-2 h-2 rounded-full bg-jic-muted overflow-hidden">
                          <div
                            className="h-full bg-jic-green rounded-full"
                            style={{
                              width: `${relatedTasks.length ? (done / relatedTasks.length) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {!canManage && (
        <p className="text-xs text-jic-text-secondary">
          You can update progress on tasks assigned to you. Task and project creation is reserved for administrators and authorised leads.
        </p>
      )}
    </div>
  );
}
