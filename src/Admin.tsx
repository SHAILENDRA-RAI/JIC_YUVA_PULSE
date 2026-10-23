import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Building2, Check, Plus, RefreshCw, Save, Settings2, ShieldCheck, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/EmptyState';
import type { AppSetting, Department, Profile, ProfileStatus, Role } from '@/types';

type ProfileDraft = Pick<Profile, 'full_name' | 'designation' | 'role' | 'status' | 'phone'>;
type DepartmentDraft = Pick<Department, 'name' | 'description' | 'lead_id' | 'status' | 'color'>;
type TabKey = 'members' | 'departments' | 'settings';

const roleOptions: { value: Role; label: string }[] = [
  { value: 'yuva', label: 'YUVA' },
  { value: 'lead', label: 'Department lead' },
  { value: 'admin', label: 'Admin' },
];
const statusOptions: { value: ProfileStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'inactive', label: 'Inactive' },
];
const fieldClass = 'w-full min-w-0 rounded-xl border border-jic-border bg-white px-3 py-2.5 text-sm text-jic-text focus:border-jic-orange focus:outline-none focus:ring-2 focus:ring-jic-orange/15';

function roleBadge(role: string) {
  if (role === 'admin') return 'bg-orange-100 text-orange-800';
  if (role === 'lead') return 'bg-blue-100 text-blue-800';
  return 'bg-emerald-100 text-emerald-800';
}
function statusBadge(status: string) {
  if (status === 'active') return 'bg-emerald-100 text-emerald-800';
  if (status === 'pending') return 'bg-amber-100 text-amber-800';
  return 'bg-slate-100 text-slate-700';
}
function jsonText(value: unknown) {
  return JSON.stringify(value, null, 2) ?? 'null';
}

export function Admin() {
  const { profile, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState<TabKey>('members');
  const [members, setMembers] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [memberDrafts, setMemberDrafts] = useState<Record<string, ProfileDraft>>({});
  const [departmentDrafts, setDepartmentDrafts] = useState<Record<string, DepartmentDraft>>({});
  const [settingDrafts, setSettingDrafts] = useState<Record<string, string>>({});
  const [newDepartment, setNewDepartment] = useState<DepartmentDraft>({ name: '', description: '', lead_id: null, status: 'active', color: '#F97316' });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingKey, setSavingKey] = useState('');
  const [error, setError] = useState('');

  async function loadAdminData(quiet = false) {
    if (quiet) setRefreshing(true); else setLoading(true);
    setError('');
    const [membersResult, departmentsResult, settingsResult] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name', { ascending: true }),
      supabase.from('departments').select('*').order('name', { ascending: true }),
      supabase.from('app_settings').select('*').order('key', { ascending: true }),
    ]);
    const firstError = membersResult.error || departmentsResult.error || settingsResult.error;
    if (firstError) {
      setError(firstError.message);
      showToast('error', `Could not load administration data: ${firstError.message}`);
    }
    const nextMembers = (membersResult.data || []) as Profile[];
    const nextDepartments = (departmentsResult.data || []) as Department[];
    const nextSettings = (settingsResult.data || []) as AppSetting[];
    if (!membersResult.error) {
      setMembers(nextMembers);
      setMemberDrafts(Object.fromEntries(nextMembers.map(member => [member.id, {
        full_name: member.full_name || '', designation: member.designation || '', role: member.role,
        status: member.status, phone: member.phone || '',
      }])));
    }
    if (!departmentsResult.error) {
      setDepartments(nextDepartments);
      setDepartmentDrafts(Object.fromEntries(nextDepartments.map(department => [department.id, {
        name: department.name, description: department.description || '', lead_id: department.lead_id,
        status: department.status, color: department.color || '#F97316',
      }])));
    }
    if (!settingsResult.error) {
      setSettings(nextSettings);
      setSettingDrafts(Object.fromEntries(nextSettings.map(setting => [setting.id, jsonText(setting.value)])));
    }
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { void loadAdminData(); }, []);

  const filteredMembers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return members;
    return members.filter(member => [member.full_name, member.email, member.designation || '', member.role, member.status]
      .join(' ').toLowerCase().includes(needle));
  }, [members, search]);

  async function saveMember(member: Profile) {
    const draft = memberDrafts[member.id];
    if (!draft || !draft.full_name.trim()) {
      showToast('warning', 'A member name is required.');
      return;
    }
    if (member.id === profile?.id && (draft.role !== 'admin' || draft.status !== 'active')) {
      showToast('warning', 'For safety, you cannot remove your own Admin role or deactivate your own account here.');
      return;
    }
    setSavingKey(`member:${member.id}`);
    const { error: updateError } = await supabase.from('profiles').update({
      full_name: draft.full_name.trim(),
      designation: draft.designation.trim() || null,
      role: draft.role,
      status: draft.status,
      phone: draft.phone.trim() || null,
    }).eq('id', member.id);
    setSavingKey('');
    if (updateError) {
      showToast('error', `Member update failed: ${updateError.message}`);
      return;
    }
    showToast('success', `Updated ${draft.full_name.trim()}.`);
    await loadAdminData(true);
    if (member.id === profile?.id) await refreshProfile();
  }

  async function addDepartment(event: FormEvent) {
    event.preventDefault();
    if (!newDepartment.name.trim()) {
      showToast('warning', 'Enter a department name.');
      return;
    }
    setSavingKey('department:new');
    const { error: insertError } = await supabase.from('departments').insert({
      name: newDepartment.name.trim(),
      description: newDepartment.description.trim() || null,
      lead_id: newDepartment.lead_id || null,
      status: newDepartment.status,
      color: newDepartment.color,
    });
    setSavingKey('');
    if (insertError) {
      showToast('error', `Could not create department: ${insertError.message}`);
      return;
    }
    showToast('success', 'Department created.');
    setNewDepartment({ name: '', description: '', lead_id: null, status: 'active', color: '#F97316' });
    await loadAdminData(true);
  }

  async function saveDepartment(department: Department) {
    const draft = departmentDrafts[department.id];
    if (!draft || !draft.name.trim()) {
      showToast('warning', 'A department name is required.');
      return;
    }
    setSavingKey(`department:${department.id}`);
    const { error: updateError } = await supabase.from('departments').update({
      name: draft.name.trim(), description: draft.description.trim() || null,
      lead_id: draft.lead_id || null, status: draft.status, color: draft.color,
    }).eq('id', department.id);
    setSavingKey('');
    if (updateError) {
      showToast('error', `Department update failed: ${updateError.message}`);
      return;
    }
    showToast('success', `Saved ${draft.name.trim()}.`);
    await loadAdminData(true);
  }

  async function saveSetting(setting: AppSetting) {
    const draft = settingDrafts[setting.id] ?? '';
    let parsed: unknown;
    try {
      parsed = JSON.parse(draft);
    } catch {
      showToast('warning', `Value for “${setting.key}” must be valid JSON. Use quotes for text, for example "JIC YUVA PULSE".`);
      return;
    }
    setSavingKey(`setting:${setting.id}`);
    const { error: updateError } = await supabase.from('app_settings').update({
      value: parsed, updated_by: profile?.id || null, updated_at: new Date().toISOString(),
    }).eq('id', setting.id);
    setSavingKey('');
    if (updateError) {
      showToast('error', `Setting update failed: ${updateError.message}`);
      return;
    }
    showToast('success', `Saved ${setting.key}.`);
    await loadAdminData(true);
  }

  if (loading) return <LoadingState message="Loading administration workspace..." />;

  const tabs: { key: TabKey; label: string; icon: typeof Users }[] = [
    { key: 'members', label: 'Members & roles', icon: Users },
    { key: 'departments', label: 'Departments', icon: Building2 },
    { key: 'settings', label: 'App settings', icon: Settings2 },
  ];

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-fade-in">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-jic-orange uppercase tracking-wide">JIC YUVA PULSE</p>
          <h1 className="text-3xl font-bold text-jic-text mt-1">Administration</h1>
          <p className="text-jic-text-secondary mt-2">Manage access, departments, and workspace configuration.</p>
        </div>
        <button onClick={() => void loadAdminData(true)} disabled={refreshing} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-jic-border bg-white text-sm font-semibold text-jic-text hover:bg-jic-muted disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh data
        </button>
      </header>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Some administration data could not be loaded. Check the permissions and try refreshing. {error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card><CardBody className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-orange-50 text-jic-orange flex items-center justify-center"><ShieldCheck className="w-5 h-5" /></div><div><p className="text-sm text-jic-text-secondary">Active members</p><p className="text-2xl font-bold text-jic-text">{members.filter(member => member.status === 'active').length}</p></div></CardBody></Card>
        <Card><CardBody className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center"><Building2 className="w-5 h-5" /></div><div><p className="text-sm text-jic-text-secondary">Active departments</p><p className="text-2xl font-bold text-jic-text">{departments.filter(department => department.status === 'active').length}</p></div></CardBody></Card>
        <Card><CardBody className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><Settings2 className="w-5 h-5" /></div><div><p className="text-sm text-jic-text-secondary">Workspace settings</p><p className="text-2xl font-bold text-jic-text">{settings.length}</p></div></CardBody></Card>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-jic-border pb-3">
        {tabs.map(item => {
          const Icon = item.icon;
          return <button key={item.key} onClick={() => setTab(item.key)} className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${tab === item.key ? 'bg-jic-orange text-white' : 'bg-white border border-jic-border text-jic-text hover:bg-jic-muted'}`}><Icon className="w-4 h-4" />{item.label}</button>;
        })}
      </div>

      {tab === 'members' && <Card>
        <CardHeader title="Member access" subtitle="Edit names, designations, roles, and account status. New login accounts must be created in Supabase Authentication." />
        <CardBody>
          <input className={`${fieldClass} mb-4`} value={search} onChange={event => setSearch(event.target.value)} placeholder="Search members by name, email, designation, or role..." aria-label="Search members" />
          <div className="space-y-4">
            {filteredMembers.length === 0 ? <p className="py-8 text-center text-sm text-jic-text-secondary">No matching member profiles found.</p> : filteredMembers.map(member => {
              const draft = memberDrafts[member.id] || { full_name: member.full_name, designation: member.designation || '', role: member.role, status: member.status, phone: member.phone || '' };
              const saving = savingKey === `member:${member.id}`;
              return <div key={member.id} className="rounded-2xl border border-jic-border p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="min-w-0"><h3 className="font-bold text-jic-text break-words">{member.full_name}</h3><p className="text-sm text-jic-text-secondary break-all">{member.email}</p></div>
                  <div className="flex gap-2 flex-wrap"><Badge className={roleBadge(member.role)}>{member.role === 'lead' ? 'Department lead' : member.role === 'admin' ? 'Admin' : 'YUVA'}</Badge><Badge className={statusBadge(member.status)}>{member.status}</Badge></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
                  <label className="text-xs font-semibold text-jic-text-secondary">Full name<input className={`${fieldClass} mt-1.5`} value={draft.full_name} onChange={event => setMemberDrafts(prev => ({ ...prev, [member.id]: { ...draft, full_name: event.target.value } }))} /></label>
                  <label className="text-xs font-semibold text-jic-text-secondary">Designation<input className={`${fieldClass} mt-1.5`} value={draft.designation || ''} onChange={event => setMemberDrafts(prev => ({ ...prev, [member.id]: { ...draft, designation: event.target.value } }))} placeholder="e.g. Outreach Officer" /></label>
                  <label className="text-xs font-semibold text-jic-text-secondary">Role<select className={`${fieldClass} mt-1.5`} value={draft.role} onChange={event => setMemberDrafts(prev => ({ ...prev, [member.id]: { ...draft, role: event.target.value as Role } }))}>{roleOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                  <label className="text-xs font-semibold text-jic-text-secondary">Status<select className={`${fieldClass} mt-1.5`} value={draft.status} onChange={event => setMemberDrafts(prev => ({ ...prev, [member.id]: { ...draft, status: event.target.value as ProfileStatus } }))}>{statusOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
                  <label className="text-xs font-semibold text-jic-text-secondary">Phone<input className={`${fieldClass} mt-1.5`} value={draft.phone || ''} onChange={event => setMemberDrafts(prev => ({ ...prev, [member.id]: { ...draft, phone: event.target.value } }))} placeholder="Optional" /></label>
                </div>
                <div className="flex justify-end"><button onClick={() => void saveMember(member)} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-jic-orange px-4 py-2.5 text-sm font-semibold text-white hover:bg-jic-orange-deep disabled:opacity-50"><Save className="w-4 h-4" />{saving ? 'Saving...' : 'Save member'}</button></div>
              </div>;
            })}
          </div>
        </CardBody>
      </Card>}

      {tab === 'departments' && <div className="space-y-5">
        <Card><CardHeader title="Create department" subtitle="Add a department to the shared JIC directory." /><CardBody>
          <form onSubmit={addDepartment} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 items-end">
            <label className="text-xs font-semibold text-jic-text-secondary">Department name<input className={`${fieldClass} mt-1.5`} required value={newDepartment.name} onChange={event => setNewDepartment(prev => ({ ...prev, name: event.target.value }))} placeholder="e.g. Outreach" /></label>
            <label className="text-xs font-semibold text-jic-text-secondary">Description<input className={`${fieldClass} mt-1.5`} value={newDepartment.description || ''} onChange={event => setNewDepartment(prev => ({ ...prev, description: event.target.value }))} placeholder="Purpose or scope" /></label>
            <label className="text-xs font-semibold text-jic-text-secondary">Department lead<select className={`${fieldClass} mt-1.5`} value={newDepartment.lead_id || ''} onChange={event => setNewDepartment(prev => ({ ...prev, lead_id: event.target.value || null }))}><option value="">Unassigned</option>{members.filter(member => member.status === 'active').map(member => <option key={member.id} value={member.id}>{member.full_name}</option>)}</select></label>
            <label className="text-xs font-semibold text-jic-text-secondary">Colour<input type="color" className={`${fieldClass} mt-1.5 h-[42px]`} value={newDepartment.color || '#F97316'} onChange={event => setNewDepartment(prev => ({ ...prev, color: event.target.value }))} /></label>
            <button type="submit" disabled={savingKey === 'department:new'} className="inline-flex items-center justify-center gap-2 rounded-xl bg-jic-orange px-4 py-2.5 text-sm font-semibold text-white hover:bg-jic-orange-deep disabled:opacity-50"><Plus className="w-4 h-4" />{savingKey === 'department:new' ? 'Creating...' : 'Add department'}</button>
          </form>
        </CardBody></Card>
        <div className="space-y-3">
          {departments.map(department => {
            const draft = departmentDrafts[department.id] || { name: department.name, description: department.description || '', lead_id: department.lead_id, status: department.status, color: department.color || '#F97316' };
            const saving = savingKey === `department:${department.id}`;
            return <Card key={department.id}><CardBody className="space-y-3">
              <div className="flex items-center gap-3"><span className="h-9 w-2 rounded-full" style={{ backgroundColor: draft.color || '#F97316' }} /><div className="flex-1 min-w-0"><p className="font-bold text-jic-text">{department.name}</p><p className="text-xs text-jic-text-secondary">Created {new Date(department.created_at).toLocaleDateString()}</p></div><Badge className={draft.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}>{draft.status}</Badge></div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
                <label className="text-xs font-semibold text-jic-text-secondary">Name<input className={`${fieldClass} mt-1.5`} value={draft.name} onChange={event => setDepartmentDrafts(prev => ({ ...prev, [department.id]: { ...draft, name: event.target.value } }))} /></label>
                <label className="text-xs font-semibold text-jic-text-secondary">Description<input className={`${fieldClass} mt-1.5`} value={draft.description || ''} onChange={event => setDepartmentDrafts(prev => ({ ...prev, [department.id]: { ...draft, description: event.target.value } }))} /></label>
                <label className="text-xs font-semibold text-jic-text-secondary">Lead<select className={`${fieldClass} mt-1.5`} value={draft.lead_id || ''} onChange={event => setDepartmentDrafts(prev => ({ ...prev, [department.id]: { ...draft, lead_id: event.target.value || null } }))}><option value="">Unassigned</option>{members.filter(member => member.status === 'active').map(member => <option key={member.id} value={member.id}>{member.full_name}</option>)}</select></label>
                <label className="text-xs font-semibold text-jic-text-secondary">Status<select className={`${fieldClass} mt-1.5`} value={draft.status} onChange={event => setDepartmentDrafts(prev => ({ ...prev, [department.id]: { ...draft, status: event.target.value as 'active' | 'inactive' } }))}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
                <label className="text-xs font-semibold text-jic-text-secondary">Colour<input type="color" className={`${fieldClass} mt-1.5 h-[42px]`} value={draft.color || '#F97316'} onChange={event => setDepartmentDrafts(prev => ({ ...prev, [department.id]: { ...draft, color: event.target.value } }))} /></label>
              </div>
              <div className="flex justify-end"><button onClick={() => void saveDepartment(department)} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-jic-orange px-4 py-2.5 text-sm font-semibold text-white hover:bg-jic-orange-deep disabled:opacity-50"><Save className="w-4 h-4" />{saving ? 'Saving...' : 'Save department'}</button></div>
            </CardBody></Card>;
          })}
          {departments.length === 0 && <Card><CardBody className="py-8 text-center text-sm text-jic-text-secondary">No departments yet. Create your first department above.</CardBody></Card>}
        </div>
      </div>}

      {tab === 'settings' && <Card>
        <CardHeader title="Workspace settings" subtitle="Values are stored as JSON in Supabase. Preserve valid JSON formatting when editing a value." />
        <CardBody><div className="space-y-4">
          {settings.map(setting => {
            const saving = savingKey === `setting:${setting.id}`;
            return <div key={setting.id} className="rounded-2xl border border-jic-border p-4 grid grid-cols-1 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto] gap-3 items-start">
              <div className="min-w-0"><p className="font-semibold text-jic-text break-words">{setting.key}</p><p className="text-sm text-jic-text-secondary mt-1">{setting.description || 'No description provided.'}</p></div>
              <textarea rows={2} spellCheck={false} aria-label={`Value for ${setting.key}`} className={`${fieldClass} font-mono`} value={settingDrafts[setting.id] ?? ''} onChange={event => setSettingDrafts(prev => ({ ...prev, [setting.id]: event.target.value }))} />
              <button onClick={() => void saveSetting(setting)} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-jic-orange px-4 py-2.5 text-sm font-semibold text-white hover:bg-jic-orange-deep disabled:opacity-50"><Check className="w-4 h-4" />{saving ? 'Saving...' : 'Save'}</button>
            </div>;
          })}
          {settings.length === 0 && <p className="py-8 text-center text-sm text-jic-text-secondary">No settings were found in the database.</p>}
        </div></CardBody>
      </Card>}

      <p className="text-xs text-jic-text-secondary">Access changes affect shared workspace permissions immediately. Create or invite login accounts separately through Supabase Authentication; this screen manages profiles after the account exists.</p>
    </div>
  );
}
