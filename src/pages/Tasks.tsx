import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FolderKanban,
  MessageSquareText,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, LoadingState } from '@/components/ui/EmptyState';
import type {
  Department,
  Priority,
  Profile,
  Project,
  Task,
  TaskAssignee,
  TaskUpdate,
} from '@/types';

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

type TaskView = 'all' | 'open' | 'mine' | 'completed';

const priorities: Priority[] = ['low', 'medium', 'high', 'critical'];

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
    : parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function isPastDue(task: Task) {
  return Boolean(
    task.deadline &&
    !['completed', 'cancelled'].includes(task.status) &&
    new Date(`${task.deadline.slice(0, 10)}T23:59:59`) < new Date()
  );
}

function displayStatus(task: Task) {
  if (task.status === 'completed') return 'Completed';
  if (task.status === 'cancelled') return 'Cancelled';
  if (task.status === 'open' && !task.assignee_id) return 'Open';
  if (['assigned', 'not_started', 'draft'].includes(task.status)) return 'Assigned';
  return 'In progress';
}

function statusClass(status: string) {
  if (status === 'Completed') return 'bg-emerald-100 text-emerald-800';
  if (status === 'Open') return 'bg-blue-100 text-blue-800';
  if (status === 'Cancelled') return 'bg-slate-100 text-slate-600';
  if (status === 'Assigned') return 'bg-violet-100 text-violet-800';
  return 'bg-amber-100 text-amber-800';
}

function priorityClass(priority: Priority) {
  if (priority === 'critical') return 'text-red-700';
  if (priority === 'high') return 'text-orange-700';
  if (priority === 'medium') return 'text-blue-700';
  return 'text-slate-500';
}

export function Tasks() {
  const { profile } = useAuth();
  const { showToast } = useToast();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskAssignees, setTaskAssignees] = useState<TaskAssignee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [taskUpdates, setTaskUpdates] = useState<TaskUpdate[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [activeTab, setActiveTab] = useState<'tasks' | 'projects'>('tasks');
  const [taskView, setTaskView] = useState<TaskView>('all');
  const [search, setSearch] = useState('');

  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(defaultTaskDraft);
  const [projectDraft, setProjectDraft] = useState<ProjectDraft>(defaultProjectDraft);
  const [expandedUpdateId, setExpandedUpdateId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const canManage = profile?.role === 'admin' || profile?.role === 'lead';
  const canDelete = profile?.role === 'admin';

  async function loadData(quiet = false) {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setLoadError('');

    const [taskResult, projectResult, memberResult, departmentResult] = await Promise.all([
      supabase.from('tasks').select('*').order('deadline', { ascending: true, nullsFirst: false }).limit(500),
      supabase.from('projects').select('*').order('created_at', { ascending: false }).limit(300),
      supabase.from('profiles').select('*').eq('status', 'active').order('full_name'),
      supabase.from('departments').select('*').eq('status', 'active').order('name'),
    ]);

    if (taskResult.error) {
      setLoadError(taskResult.error.message);
      setTasks([]);
      setTaskUpdates([]);
      setTaskAssignees([]);
    } else {
      const loadedTasks = (taskResult.data || []) as Task[];
      setTasks(loadedTasks);

      if (loadedTasks.length) {
        const [updateResult, assigneeResult] = await Promise.all([
          supabase
            .from('task_updates')
            .select('*')
            .in('task_id', loadedTasks.map(task => task.id))
            .order('created_at', { ascending: false })
            .limit(1000),
          supabase
            .from('task_assignees')
            .select('*')
            .in('task_id', loadedTasks.map(task => task.id))
            .eq('is_active', true),
        ]);

        if (updateResult.error) {
          setTaskUpdates([]);
          showToast('warning', `Tasks loaded, but progress history could not be loaded: ${updateResult.error.message}`);
        } else {
          setTaskUpdates((updateResult.data || []) as TaskUpdate[]);
        }

        if (assigneeResult.error) {
          setTaskAssignees([]);
          showToast('warning', `Tasks loaded, but task participants could not be loaded: ${assigneeResult.error.message}`);
        } else {
          setTaskAssignees((assigneeResult.data || []) as TaskAssignee[]);
        }
      } else {
        setTaskUpdates([]);
        setTaskAssignees([]);
      }
    }

    if (!projectResult.error) setProjects((projectResult.data || []) as Project[]);
    if (!memberResult.error) setMembers((memberResult.data || []) as Profile[]);
    if (!departmentResult.error) setDepartments((departmentResult.data || []) as Department[]);

    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    void loadData();
    // loadData is intentionally invoked once when the page mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const memberMap = useMemo(
    () => new Map(members.map(member => [member.id, member])),
    [members]
  );
  const departmentMap = useMemo(
    () => new Map(departments.map(department => [department.id, department])),
    [departments]
  );
  const updatesByTask = useMemo(() => {
    const map = new Map<string, TaskUpdate[]>();
    for (const update of taskUpdates) {
      const current = map.get(update.task_id) || [];
      current.push(update);
      map.set(update.task_id, current);
    }
    return map;
  }, [taskUpdates]);

  const assigneesByTask = useMemo(() => {
    const map = new Map<string, TaskAssignee[]>();
    for (const assignment of taskAssignees) {
      const current = map.get(assignment.task_id) || [];
      current.push(assignment);
      map.set(assignment.task_id, current);
    }
    return map;
  }, [taskAssignees]);

  const openTasks = tasks.filter(task =>
    task.is_claimable && !['completed', 'cancelled'].includes(task.status)
  );
  const myTasks = tasks.filter(task =>
    task.status !== 'completed' &&
    (
      task.assignee_id === profile?.id ||
      (assigneesByTask.get(task.id) || []).some(assignment => assignment.member_id === profile?.id)
    )
  );
  const overdueTasks = tasks.filter(isPastDue);
  const completedTasks = tasks.filter(task => task.status === 'completed');

  const filteredTasks = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return tasks.filter(task => {
      if (taskView === 'open' && !(task.is_claimable && !['completed', 'cancelled'].includes(task.status))) return false;
      if (taskView === 'mine' && !(
        task.assignee_id === profile?.id ||
        (assigneesByTask.get(task.id) || []).some(assignment => assignment.member_id === profile?.id)
      )) return false;
      if (taskView === 'completed' && task.status !== 'completed') return false;

      const assignee = task.assignee_id ? memberMap.get(task.assignee_id)?.full_name || '' : '';
      const participantNames = (assigneesByTask.get(task.id) || [])
        .map(assignment => memberMap.get(assignment.member_id)?.full_name || '');
      const department = task.department_id ? departmentMap.get(task.department_id)?.name || '' : '';
      const text = [task.title, task.description || '', assignee, ...participantNames, department].join(' ').toLowerCase();
      return !needle || text.includes(needle);
    });
  }, [tasks, taskView, profile?.id, search, memberMap, departmentMap, assigneesByTask]);

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
      is_claimable: !taskDraft.assignee_id,
      created_by: profile?.id || null,
    };

    const { error } = await supabase.from('tasks').insert(payload);
    setSaving(false);
    if (error) {
      showToast('error', `Task could not be created: ${error.message}`);
      return;
    }
    showToast('success', taskDraft.assignee_id ? 'Task assigned.' : 'Task published to the open task board.');
    setTaskDraft(defaultTaskDraft);
    setShowTaskForm(false);
    await loadData(true);
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || !projectDraft.name.trim()) return;

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
    const { error } = await supabase.from('projects').insert(payload);
    setSaving(false);
    if (error) {
      showToast('error', `Project could not be created: ${error.message}`);
      return;
    }
    showToast('success', 'Project created.');
    setProjectDraft(defaultProjectDraft);
    setShowProjectForm(false);
    setActiveTab('projects');
    await loadData(true);
  }

  async function claimTask(task: Task) {
    if (!profile?.id || !task.is_claimable || ['completed', 'cancelled'].includes(task.status)) return;
    setBusyTaskId(task.id);

    const { error } = await supabase.rpc('claim_task', { p_task_id: task.id });
    setBusyTaskId(null);

    if (error) {
      showToast('error', error.message.includes('no longer available')
        ? 'Someone else has already taken this task. Refresh the board.'
        : `Could not take this task: ${error.message}`);
      await loadData(true);
      return;
    }

    showToast('success', task.assignee_id
      ? 'You joined this task as a collaborator.'
      : 'Task is now assigned to you as its owner.');
    await loadData(true);
  }

  async function changeTaskStatus(task: Task, nextStatus: 'in_progress' | 'completed') {
    if (!profile?.id) return;
    setBusyTaskId(task.id);

    const { error } = await supabase
      .from('tasks')
      .update({
        status: nextStatus,
        completed_at: nextStatus === 'completed' ? new Date().toISOString() : null,
        is_claimable: false,
      })
      .eq('id', task.id);

    if (error) {
      setBusyTaskId(null);
      showToast('error', `Task update failed: ${error.message}`);
      return;
    }

    const note = nextStatus === 'completed' ? 'Marked this task as completed.' : 'Started working on this task.';
    const { error: historyError } = await supabase.from('task_updates').insert({
      task_id: task.id,
      author_id: profile.id,
      previous_status: task.status,
      new_status: nextStatus,
      update_text: note,
    });

    setBusyTaskId(null);
    if (historyError) showToast('warning', `Task status changed, but its activity note could not be saved: ${historyError.message}`);
    else showToast('success', nextStatus === 'completed' ? 'Task marked as completed.' : 'Task started.');
    await loadData(true);
  }

  async function saveProgressUpdate(task: Task) {
    const note = (noteDrafts[task.id] || '').trim();
    if (!profile?.id || !note) {
      showToast('warning', 'Write a short progress update first.');
      return;
    }

    setBusyTaskId(task.id);
    const { error } = await supabase.from('task_updates').insert({
      task_id: task.id,
      author_id: profile.id,
      previous_status: task.status,
      new_status: task.status,
      update_text: note,
    });
    setBusyTaskId(null);

    if (error) {
      showToast('error', `Progress update could not be saved: ${error.message}`);
      return;
    }

    setNoteDrafts(previous => ({ ...previous, [task.id]: '' }));
    setExpandedUpdateId(null);
    showToast('success', 'Progress update posted.');
    await loadData(true);
  }

  async function deleteTask(task: Task) {
    if (!canDelete) return;
    const confirmed = window.confirm(`Delete “${task.title}”? This also removes its progress history and cannot be undone.`);
    if (!confirmed) return;

    setBusyTaskId(task.id);
    const { error } = await supabase.from('tasks').delete().eq('id', task.id);
    setBusyTaskId(null);
    if (error) {
      showToast('error', `Task could not be deleted: ${error.message}`);
      return;
    }
    showToast('success', 'Task deleted.');
    await loadData(true);
  }

  if (loading) return <LoadingState message="Loading tasks and projects..." />;

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-fade-in">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-jic-orange uppercase tracking-wide">JIC YUVA PULSE</p>
          <h1 className="text-3xl font-bold text-jic-text mt-1">Tasks &amp; Projects</h1>
          <p className="text-jic-text-secondary mt-2">Clear ownership. Visible progress. Fewer status changes.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void loadData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-jic-border bg-white text-sm font-semibold text-jic-text hover:bg-jic-muted disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </button>
          {canManage && activeTab === 'tasks' && (
            <button type="button" onClick={() => setShowTaskForm(value => !value)} className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-jic-orange text-white text-sm font-semibold hover:bg-jic-orange-deep">
              <Plus className="w-4 h-4" /> New task
            </button>
          )}
          {canManage && activeTab === 'projects' && (
            <button type="button" onClick={() => setShowProjectForm(value => !value)} className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-jic-orange text-white text-sm font-semibold hover:bg-jic-orange-deep">
              <Plus className="w-4 h-4" /> New project
            </button>
          )}
        </div>
      </header>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="font-semibold text-red-800">Could not load tasks</p>
          <p className="text-sm text-red-700 mt-1">{loadError}</p>
          <button type="button" onClick={() => void loadData()} className="mt-2 text-sm font-semibold underline text-red-800">Try again</button>
        </div>
      )}

      <section className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Card><CardBody className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center"><ClipboardList className="w-5 h-5" /></div><div><p className="text-sm text-jic-text-secondary">Open to join</p><p className="text-2xl font-bold text-jic-text">{openTasks.length}</p></div></CardBody></Card>
        <Card><CardBody className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-700 flex items-center justify-center"><UserRound className="w-5 h-5" /></div><div><p className="text-sm text-jic-text-secondary">My active tasks</p><p className="text-2xl font-bold text-jic-text">{myTasks.length}</p></div></CardBody></Card>
        <Card><CardBody className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-red-50 text-red-700 flex items-center justify-center"><Clock3 className="w-5 h-5" /></div><div><p className="text-sm text-jic-text-secondary">Overdue</p><p className="text-2xl font-bold text-jic-text">{overdueTasks.length}</p></div></CardBody></Card>
        <Card><CardBody className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><CheckCircle2 className="w-5 h-5" /></div><div><p className="text-sm text-jic-text-secondary">Completed</p><p className="text-2xl font-bold text-jic-text">{completedTasks.length}</p></div></CardBody></Card>
      </section>

      <div className="flex gap-2 border-b border-jic-border">
        <button type="button" onClick={() => { setActiveTab('tasks'); setShowProjectForm(false); }} className={`px-4 py-3 text-sm font-semibold border-b-2 ${activeTab === 'tasks' ? 'border-jic-orange text-jic-orange' : 'border-transparent text-jic-text-secondary hover:text-jic-text'}`}>Tasks ({tasks.length})</button>
        <button type="button" onClick={() => { setActiveTab('projects'); setShowTaskForm(false); }} className={`px-4 py-3 text-sm font-semibold border-b-2 ${activeTab === 'projects' ? 'border-jic-orange text-jic-orange' : 'border-transparent text-jic-text-secondary hover:text-jic-text'}`}>Projects ({projects.length})</button>
      </div>

      {showTaskForm && activeTab === 'tasks' && canManage && (
        <Card>
          <CardHeader title="Create a task" subtitle="Assign it to someone directly, or leave it open for any active YUVA to claim." />
          <CardBody>
            <form onSubmit={createTask} className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <label className="text-sm font-semibold text-jic-text">Task title *
                  <input required maxLength={180} value={taskDraft.title} onChange={event => setTaskDraft({ ...taskDraft, title: event.target.value })} placeholder="e.g. Prepare launch campaign creatives" className="mt-1.5 w-full rounded-xl border border-jic-border px-3 py-2.5 font-normal focus:outline-none focus:ring-2 focus:ring-jic-orange/20" />
                </label>
                <label className="text-sm font-semibold text-jic-text">Assign to (optional)
                  <select value={taskDraft.assignee_id} onChange={event => {
                    const assigneeId = event.target.value;
                    const selectedMember = members.find(member => member.id === assigneeId);
                    const selectedDepartment = departments.find(department => department.name.trim().toLowerCase() === (selectedMember?.designation || '').trim().toLowerCase());
                    setTaskDraft({ ...taskDraft, assignee_id: assigneeId, department_id: selectedDepartment?.id || '' });
                  }} className="mt-1.5 w-full rounded-xl border border-jic-border bg-white px-3 py-2.5 font-normal">
                    <option value="">Leave open for YUVAs to claim</option>
                    {members.map(member => <option key={member.id} value={member.id}>{member.full_name} · {member.designation || pretty(member.role)}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold text-jic-text">Priority
                  <select value={taskDraft.priority} onChange={event => setTaskDraft({ ...taskDraft, priority: event.target.value as Priority })} className="mt-1.5 w-full rounded-xl border border-jic-border bg-white px-3 py-2.5 font-normal">
                    {priorities.map(priority => <option key={priority} value={priority}>{pretty(priority)}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold text-jic-text">Deadline
                  <input type="date" value={taskDraft.deadline} onChange={event => setTaskDraft({ ...taskDraft, deadline: event.target.value })} className="mt-1.5 w-full rounded-xl border border-jic-border bg-white px-3 py-2.5 font-normal" />
                </label>
                <label className="text-sm font-semibold text-jic-text">Start date
                  <input type="date" value={taskDraft.start_date} onChange={event => setTaskDraft({ ...taskDraft, start_date: event.target.value })} className="mt-1.5 w-full rounded-xl border border-jic-border bg-white px-3 py-2.5 font-normal" />
                </label>
                <label className="text-sm font-semibold text-jic-text lg:col-span-2">Description
                  <textarea rows={3} value={taskDraft.description} onChange={event => setTaskDraft({ ...taskDraft, description: event.target.value })} placeholder="What needs to be done? Include the expected result." className="mt-1.5 w-full resize-y rounded-xl border border-jic-border px-3 py-2.5 font-normal" />
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setShowTaskForm(false); setTaskDraft(defaultTaskDraft); }} className="px-4 py-2.5 rounded-xl border border-jic-border text-sm font-semibold">Cancel</button>
                <button disabled={saving} type="submit" className="px-4 py-2.5 rounded-xl bg-jic-orange text-white text-sm font-semibold disabled:opacity-50">{saving ? 'Creating...' : 'Publish task'}</button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {showProjectForm && activeTab === 'projects' && canManage && (
        <Card>
          <CardHeader title="Create a project" subtitle="Group related tasks and track a target completion date." />
          <CardBody>
            <form onSubmit={createProject} className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <label className="text-sm font-semibold text-jic-text">Project name *<input required maxLength={180} value={projectDraft.name} onChange={event => setProjectDraft({ ...projectDraft, name: event.target.value })} placeholder="e.g. JIC Recruitment Phase 2" className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-jic-border font-normal" /></label>
                <label className="text-sm font-semibold text-jic-text">Priority<select value={projectDraft.priority} onChange={event => setProjectDraft({ ...projectDraft, priority: event.target.value as Priority })} className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-jic-border bg-white font-normal">{priorities.map(priority => <option key={priority} value={priority}>{pretty(priority)}</option>)}</select></label>
                <label className="text-sm font-semibold text-jic-text">Start date<input type="date" value={projectDraft.start_date} onChange={event => setProjectDraft({ ...projectDraft, start_date: event.target.value })} className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-jic-border bg-white font-normal" /></label>
                <label className="text-sm font-semibold text-jic-text">Target completion<input type="date" value={projectDraft.target_completion} onChange={event => setProjectDraft({ ...projectDraft, target_completion: event.target.value })} className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-jic-border bg-white font-normal" /></label>
                <label className="text-sm font-semibold text-jic-text lg:col-span-2">Description<textarea rows={3} value={projectDraft.description} onChange={event => setProjectDraft({ ...projectDraft, description: event.target.value })} placeholder="Project goal and what success looks like..." className="mt-1.5 w-full px-3 py-2.5 rounded-xl border border-jic-border bg-white font-normal resize-y" /></label>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setShowProjectForm(false); setProjectDraft(defaultProjectDraft); }} className="px-4 py-2.5 rounded-xl border border-jic-border text-sm font-semibold">Cancel</button>
                <button disabled={saving} type="submit" className="px-4 py-2.5 rounded-xl bg-jic-orange text-white text-sm font-semibold disabled:opacity-50">{saving ? 'Creating...' : 'Create project'}</button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {activeTab === 'tasks' ? (
        <Card>
          <CardHeader title="Task board" subtitle="The first member becomes the task owner. Additional active YUVA members can join as collaborators and share progress updates." />
          <CardBody>
            <div className="flex flex-col gap-3 mb-5">
              <label className="relative block">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-jic-text-secondary" />
                <input aria-label="Search tasks" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search tasks or assignees..." className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-jic-border text-sm" />
              </label>
              <div className="flex flex-wrap gap-2">
                {([
                  ['all', `All tasks (${tasks.length})`],
                  ['open', `Open (${openTasks.length})`],
                  ['mine', `My tasks (${myTasks.length})`],
                  ['completed', `Completed (${completedTasks.length})`],
                ] as [TaskView, string][]).map(([value, label]) => (
                  <button key={value} type="button" onClick={() => setTaskView(value)} className={`rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${taskView === value ? 'bg-jic-navy text-white' : 'bg-jic-muted text-jic-text-secondary hover:text-jic-text'}`}>{label}</button>
                ))}
              </div>
            </div>

            {filteredTasks.length === 0 ? (
              <EmptyState icon={<ClipboardList className="w-8 h-8" />} title="No tasks found" description={tasks.length ? 'Try another tab or search term.' : 'Create the first task to start tracking JIC work.'} action={canManage ? <button type="button" onClick={() => setShowTaskForm(true)} className="px-4 py-2 rounded-xl bg-jic-orange text-white text-sm font-semibold">Create a task</button> : undefined} />
            ) : (
              <div className="space-y-3">
                {filteredTasks.map(task => {
                  const assignee = task.assignee_id ? memberMap.get(task.assignee_id) : undefined;
                  const department = task.department_id ? departmentMap.get(task.department_id) : undefined;
                  const taskStatus = displayStatus(task);
                  const taskParticipants = assigneesByTask.get(task.id) || [];
                  const isOwner = task.assignee_id === profile?.id;
                  const isCollaborator = taskParticipants.some(assignment => assignment.member_id === profile?.id);
                  const isMine = isOwner || isCollaborator;
                  const isAvailable = Boolean(
                    task.is_claimable &&
                    !['completed', 'cancelled'].includes(task.status) &&
                    !isMine
                  );
                  const participantNames = taskParticipants
                    .map(assignment => memberMap.get(assignment.member_id)?.full_name)
                    .filter((name): name is string => Boolean(name));
                  const canPostUpdate = Boolean(profile?.id && (isMine || canManage || task.created_by === profile.id));
                  const history = updatesByTask.get(task.id) || [];
                  const isBusy = busyTaskId === task.id;

                  return (
                    <article key={task.id} className="rounded-2xl border border-jic-border bg-white p-4 sm:p-5 hover:border-jic-orange/30 transition-colors">
                      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                        <div className={`w-1.5 rounded-full shrink-0 self-stretch min-h-16 ${task.priority === 'critical' ? 'bg-red-500' : task.priority === 'high' ? 'bg-orange-500' : task.priority === 'medium' ? 'bg-blue-500' : 'bg-slate-300'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-jic-text text-base">{task.title}</h3>
                            <Badge className={statusClass(taskStatus)}>{taskStatus}</Badge>
                            <span className={`text-[11px] font-bold uppercase tracking-wide ${priorityClass(task.priority)}`}>{task.priority} priority</span>
                            {isPastDue(task) && <Badge className="bg-red-100 text-red-800">Overdue</Badge>}
                          </div>
                          {task.description && <p className="text-sm text-jic-text-secondary mt-2 whitespace-pre-line leading-6">{task.description}</p>}
                          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 text-xs text-jic-text-secondary">
                            <span className="inline-flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />{participantNames.length ? participantNames.join(', ') : assignee?.full_name || 'Open to claim'}</span>
                            {department && <span>{department.name}</span>}
                            <span className="inline-flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" />{shortDate(task.deadline)}</span>
                          </div>

                          {history.length > 0 && (
                            <div className="mt-4 rounded-xl bg-jic-muted/60 px-3.5 py-3">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-jic-text-secondary mb-2">Latest progress</p>
                              <div className="space-y-2">
                                {history.slice(0, 2).map(update => (
                                  <div key={update.id} className="text-sm">
                                    <p className="text-jic-text whitespace-pre-line">{update.update_text || 'Task status updated.'}</p>
                                    <p className="text-[11px] text-jic-text-secondary mt-0.5">{memberMap.get(update.author_id)?.full_name || 'JIC member'} · {new Date(update.created_at).toLocaleString()}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {expandedUpdateId === task.id && canPostUpdate && (
                            <div className="mt-4 rounded-xl border border-jic-border p-3.5">
                              <label htmlFor={`progress-${task.id}`} className="block text-sm font-semibold text-jic-text mb-2">What have you completed? What's still pending?</label>
                              <textarea id={`progress-${task.id}`} rows={3} maxLength={1500} value={noteDrafts[task.id] || ''} onChange={event => setNoteDrafts(previous => ({ ...previous, [task.id]: event.target.value }))} placeholder="Example: Completed the first draft. 3 comments are still pending; I will finish them by tomorrow." className="w-full rounded-xl border border-jic-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-jic-orange/20" />
                              <div className="flex justify-end gap-2 mt-2">
                                <button type="button" onClick={() => setExpandedUpdateId(null)} className="px-3 py-2 rounded-lg border border-jic-border text-xs font-semibold">Cancel</button>
                                <button type="button" disabled={isBusy || !(noteDrafts[task.id] || '').trim()} onClick={() => void saveProgressUpdate(task)} className="px-3.5 py-2 rounded-lg bg-jic-orange text-white text-xs font-semibold disabled:opacity-50">{isBusy ? 'Posting...' : 'Post update'}</button>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap lg:flex-col lg:items-end gap-2 lg:min-w-[150px]">
                          {isAvailable && profile?.id && (
                            <button type="button" disabled={isBusy} onClick={() => void claimTask(task)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-jic-orange px-4 py-2.5 text-sm font-semibold text-white hover:bg-jic-orange-deep disabled:opacity-50">
                              <UserRound className="w-4 h-4" /> {isBusy ? 'Joining...' : task.assignee_id ? 'Join task' : 'Take task'}
                            </button>
                          )}
                          {isOwner && task.status !== 'completed' && task.status !== 'cancelled' && (
                            <>
                              {['assigned', 'not_started', 'open'].includes(task.status) && (
                                <button type="button" disabled={isBusy} onClick={() => void changeTaskStatus(task, 'in_progress')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-jic-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
                                  <Check className="w-4 h-4" /> Start task
                                </button>
                              )}
                              <button type="button" onClick={() => setExpandedUpdateId(expandedUpdateId === task.id ? null : task.id)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-jic-border px-4 py-2.5 text-sm font-semibold text-jic-text hover:bg-jic-muted">
                                <MessageSquareText className="w-4 h-4" /> Add update
                              </button>
                              <button type="button" disabled={isBusy} onClick={() => void changeTaskStatus(task, 'completed')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                                <CheckCircle2 className="w-4 h-4" /> Mark complete
                              </button>
                            </>
                          )}
                          {isMine && !isOwner && task.status !== 'completed' && task.status !== 'cancelled' && (
                            <button type="button" onClick={() => setExpandedUpdateId(expandedUpdateId === task.id ? null : task.id)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-jic-border px-4 py-2.5 text-sm font-semibold text-jic-text hover:bg-jic-muted"><MessageSquareText className="w-4 h-4" /> Add update</button>
                          )}
                          {canManage && !isMine && !isAvailable && task.status !== 'completed' && task.status !== 'cancelled' && (
                            <button type="button" onClick={() => setExpandedUpdateId(expandedUpdateId === task.id ? null : task.id)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-jic-border px-4 py-2.5 text-sm font-semibold text-jic-text hover:bg-jic-muted"><MessageSquareText className="w-4 h-4" /> Add update</button>
                          )}
                          {canDelete && (
                            <button type="button" disabled={isBusy} onClick={() => void deleteTask(task)} className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 className="w-3.5 h-3.5" /> Delete task</button>
                          )}
                        </div>
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
          <CardHeader title="Projects workspace" subtitle="Group related tasks and track target completion." />
          <CardBody>
            {projects.length === 0 ? (
              <EmptyState icon={<FolderKanban className="w-8 h-8" />} title="No projects yet" description="Create a project to group tasks, dates, and delivery." action={canManage ? <button type="button" onClick={() => setShowProjectForm(true)} className="px-4 py-2 rounded-xl bg-jic-orange text-white text-sm font-semibold">Create a project</button> : undefined} />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
                {projects.map(project => {
                  const owner = project.owner_id ? memberMap.get(project.owner_id) : undefined;
                  const relatedTasks = tasks.filter(task => task.project_id === project.id);
                  const done = relatedTasks.filter(task => task.status === 'completed').length;
                  const progress = relatedTasks.length ? Math.round((done / relatedTasks.length) * 100) : 0;
                  return (
                    <article key={project.id} className="rounded-2xl border border-jic-border p-4 flex flex-col">
                      <div className="flex items-start justify-between gap-3"><div className="w-11 h-11 rounded-xl bg-jic-orange-soft text-jic-orange flex items-center justify-center"><FolderKanban className="w-5 h-5" /></div><Badge className={project.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}>{pretty(project.status)}</Badge></div>
                      <h3 className="mt-4 font-bold text-lg text-jic-text">{project.name}</h3>
                      {project.description && <p className="mt-1 text-sm text-jic-text-secondary line-clamp-3">{project.description}</p>}
                      <div className="mt-4 text-sm text-jic-text-secondary space-y-1"><p>Owner: {owner?.full_name || 'Not set'}</p><p>Target: {shortDate(project.target_completion)}</p><p className={`font-semibold ${priorityClass(project.priority)}`}>{pretty(project.priority)} priority</p></div>
                      <div className="mt-4 pt-3 border-t border-jic-border"><div className="flex justify-between text-xs text-jic-text-secondary"><span>{relatedTasks.length} tasks</span><span>{progress}% completed</span></div><div className="mt-2 h-2 rounded-full bg-jic-muted overflow-hidden"><div className="h-full bg-jic-green rounded-full" style={{ width: `${progress}%` }} /></div></div>
                    </article>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {activeTab === 'tasks' && !canManage && (
        <p className="text-xs text-jic-text-secondary">Join a task open for collaboration. The first member becomes its owner; additional members join as collaborators and can post shared progress updates.</p>
      )}
    </div>
  );
}
