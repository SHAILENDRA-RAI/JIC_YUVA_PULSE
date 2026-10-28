import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Building2, Check, Plus, RefreshCw, Save, Settings2, ShieldCheck, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/EmptyState';
import type { AppSetting, Department, MemberDepartment, Profile, ProfileStatus, Role } from '@/types';

type ProfileDraft = Pick<Profile, 'full_name' | 'designation' | 'role' | 'status' | 'phone'>;
type DepartmentDraft = {
  name: string;
  description: string;
  status: 'active' | 'inactive';
  color: string;
};
type TabKey = 'members' | 'departments' | 'settings';

// Preserve current database roles and permissions.
// Internal "lead" is displayed as YUVA.
// Internal "yuva" is displayed as NavYuva.
const roleOptions: { value: Role; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'lead', label: 'YUVA' },
  { value: 'yuva', label: 'NavYuva' },
];

const statusOptions: { value: ProfileStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'inactive', label: 'Inactive' },
];

const fieldClass =
  'w-full min-w-0 rounded-xl border border-jic-border bg-white px-3 py-2.5 text-sm text-jic-text focus:border-jic-orange focus:outline-none focus:ring-2 focus:ring-jic-orange/15';

function roleLabel(role: string) {
  if (role === 'admin') return 'Admin';
  if (role === 'lead') return 'YUVA';
  return 'NavYuva';
}

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

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0] || '')
    .join('')
    .toUpperCase() || 'YU';
}

export function Admin() {
  const { profile, refreshProfile } = useAuth();
  const { showToast } = useToast();

  const [tab, setTab] = useState<TabKey>('members');
  const [members, setMembers] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [memberDepartments, setMemberDepartments] = useState<MemberDepartment[]>([]);

  const [memberDrafts, setMemberDrafts] = useState<Record<string, ProfileDraft>>({});
  const [departmentDrafts, setDepartmentDrafts] = useState<Record<string, DepartmentDraft>>({});
  const [departmentLeadDrafts, setDepartmentLeadDrafts] = useState<Record<string, string[]>>({});
  const [settingDrafts, setSettingDrafts] = useState<Record<string, string>>({});

  const [newDepartment, setNewDepartment] = useState<DepartmentDraft>({
    name: '',
    description: '',
    status: 'active',
    color: '#F97316',
  });

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingKey, setSavingKey] = useState('');
  const [error, setError] = useState('');

  async function loadAdminData(quiet = false) {
    if (quiet) setRefreshing(true);
    else setLoading(true);

    setError('');

    const [
      membersResult,
      departmentsResult,
      settingsResult,
      membershipResult,
    ] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name', { ascending: true }),
      supabase.from('departments').select('*').order('name', { ascending: true }),
      supabase.from('app_settings').select('*').order('key', { ascending: true }),
      supabase.from('member_departments').select('*'),
    ]);

    const firstError =
      membersResult.error ||
      departmentsResult.error ||
      settingsResult.error ||
      membershipResult.error;

    if (firstError) {
      setError(firstError.message);
      showToast('error', `Could not load administration data: ${firstError.message}`);
    }

    const nextMembers = (membersResult.data || []) as Profile[];
    const nextDepartments = (departmentsResult.data || []) as Department[];
    const nextSettings = (settingsResult.data || []) as AppSetting[];
    const nextMemberships = (membershipResult.data || []) as MemberDepartment[];

    if (!membersResult.error) {
      setMembers(nextMembers);

      setMemberDrafts(
        Object.fromEntries(
          nextMembers.map(member => [
            member.id,
            {
              full_name: member.full_name || '',
              designation: member.designation || '',
              role: member.role,
              status: member.status,
              phone: member.phone || '',
            },
          ])
        )
      );
    }

    if (!departmentsResult.error) {
      setDepartments(nextDepartments);

      setDepartmentDrafts(
        Object.fromEntries(
          nextDepartments.map(department => [
            department.id,
            {
              name: department.name,
              description: department.description || '',
              status: department.status,
              color: department.color || '#F97316',
            },
          ])
        )
      );
    }

    if (!membershipResult.error) {
      setMemberDepartments(nextMemberships);

      const memberMap = new Map(nextMembers.map(member => [member.id, member]));

      setDepartmentLeadDrafts(
        Object.fromEntries(
          nextDepartments.map(department => {
            const assignedLeads = nextMemberships
              .filter(
                item =>
                  item.department_id === department.id &&
                  memberMap.get(item.member_id)?.role === 'lead'
              )
              .map(item => item.member_id);

            // Support the legacy single lead until it is represented
            // in the many-to-many membership table.
            if (
              department.lead_id &&
              memberMap.get(department.lead_id)?.role === 'lead' &&
              !assignedLeads.includes(department.lead_id)
            ) {
              assignedLeads.push(department.lead_id);
            }

            return [department.id, [...new Set(assignedLeads)]];
          })
        )
      );
    } else if (!departmentsResult.error && !membersResult.error) {
      const memberMap = new Map(nextMembers.map(member => [member.id, member]));

      setDepartmentLeadDrafts(
        Object.fromEntries(
          nextDepartments.map(department => [
            department.id,
            department.lead_id &&
            memberMap.get(department.lead_id)?.role === 'lead'
              ? [department.lead_id]
              : [],
          ])
        )
      );
    }

    if (!settingsResult.error) {
      setSettings(nextSettings);

      setSettingDrafts(
        Object.fromEntries(
          nextSettings.map(setting => [setting.id, jsonText(setting.value)])
        )
      );
    }

    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    void loadAdminData();
  }, []);

  const filteredMembers = useMemo(() => {
    const needle = search.trim().toLowerCase();

    if (!needle) return members;

    return members.filter(member =>
      [
        member.full_name,
        member.email,
        member.designation || '',
        roleLabel(member.role),
        member.status,
      ]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    );
  }, [members, search]);

  const activeYuvaLeads = useMemo(
    () => members.filter(member => member.status === 'active' && member.role === 'lead'),
    [members]
  );

  function initialLeadIds(department: Department) {
    const fromMemberships = memberDepartments
      .filter(
        item =>
          item.department_id === department.id &&
          members.some(member => member.id === item.member_id && member.role === 'lead')
      )
      .map(item => item.member_id);

    if (
      department.lead_id &&
      members.some(member => member.id === department.lead_id && member.role === 'lead')
    ) {
      fromMemberships.push(department.lead_id);
    }

    return [...new Set(fromMemberships)];
  }

  async function saveMember(member: Profile) {
    const draft = memberDrafts[member.id];

    if (!draft || !draft.full_name.trim()) {
      showToast('warning', 'A member name is required.');
      return;
    }

    if (member.id === profile?.id && (draft.role !== 'admin' || draft.status !== 'active')) {
      showToast(
        'warning',
        'For safety, you cannot remove your own Admin role or deactivate your own account here.'
      );
      return;
    }

    setSavingKey(`member:${member.id}`);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: draft.full_name.trim(),
        designation: draft.designation.trim() || null,
        role: draft.role,
        status: draft.status,
        phone: draft.phone.trim() || null,
      })
      .eq('id', member.id);

    setSavingKey('');

    if (updateError) {
      showToast('error', `Member update failed: ${updateError.message}`);
      return;
    }

    showToast('success', `Updated ${draft.full_name.trim()}.`);
    await loadAdminData(true);

    if (member.id === profile?.id) {
      await refreshProfile();
    }
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
      lead_id: null,
      status: newDepartment.status,
      color: newDepartment.color,
    });

    setSavingKey('');

    if (insertError) {
      showToast('error', `Could not create department: ${insertError.message}`);
      return;
    }

    showToast('success', 'Department created. Add one or more YUVA leads below.');

    setNewDepartment({
      name: '',
      description: '',
      status: 'active',
      color: '#F97316',
    });

    await loadAdminData(true);
  }

  async function saveDepartment(department: Department) {
    const draft = departmentDrafts[department.id];

    if (!draft || !draft.name.trim()) {
      showToast('warning', 'A department name is required.');
      return;
    }

    const selectedLeadIds = [
      ...new Set(
        departmentLeadDrafts[department.id] ?? initialLeadIds(department)
      ),
    ];

    if (
      selectedLeadIds.some(
        id => !activeYuvaLeads.some(member => member.id === id)
      )
    ) {
      showToast(
        'warning',
        'Only active members with the YUVA role can be department leads.'
      );
      return;
    }

    setSavingKey(`department:${department.id}`);

    const { error: updateError } = await supabase
      .from('departments')
      .update({
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        // Keep the first lead in the legacy column for older code.
        // All selected leads are also stored in member_departments.
        lead_id: selectedLeadIds[0] || null,
        status: draft.status,
        color: draft.color,
      })
      .eq('id', department.id);

    if (updateError) {
      setSavingKey('');
      showToast('error', `Department update failed: ${updateError.message}`);
      return;
    }

    const previousLeadIds = new Set([
      ...memberDepartments
        .filter(
          item =>
            item.department_id === department.id &&
            members.some(member => member.id === item.member_id && member.role === 'lead')
        )
        .map(item => item.member_id),
      ...(department.lead_id &&
      members.some(member => member.id === department.lead_id && member.role === 'lead')
        ? [department.lead_id]
        : []),
    ]);

    // Remove leads unchecked for this department.
    // NavYuva memberships are not changed by this list.
    for (const memberId of previousLeadIds) {
      if (selectedLeadIds.includes(memberId)) continue;

      const { error: deleteError } = await supabase
        .from('member_departments')
        .delete()
        .eq('department_id', department.id)
        .eq('member_id', memberId);

      if (deleteError) {
        setSavingKey('');
        showToast(
          'error',
          `Department details saved, but a lead assignment could not be removed: ${deleteError.message}`
        );
        await loadAdminData(true);
        return;
      }

      const { data: remaining, error: remainingError } = await supabase
        .from('member_departments')
        .select('department_id')
        .eq('member_id', memberId)
        .limit(1);

      if (remainingError) {
        setSavingKey('');
        showToast('error', `Could not refresh the remaining assignments: ${remainingError.message}`);
        await loadAdminData(true);
        return;
      }

      const nextDepartmentName =
        departments.find(item => item.id === remaining?.[0]?.department_id)?.name || null;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ designation: nextDepartmentName })
        .eq('id', memberId);

      if (profileError) {
        setSavingKey('');
        showToast('error', `Lead removed, but designation could not be synced: ${profileError.message}`);
        await loadAdminData(true);
        return;
      }
    }

    // A member can have one designation group at a time,
    // but each department can have several YUVA leads.
    for (const memberId of selectedLeadIds) {
      const { data: previousAssignments, error: previousError } = await supabase
        .from('member_departments')
        .select('department_id')
        .eq('member_id', memberId)
        .neq('department_id', department.id);

      if (previousError) {
        setSavingKey('');
        showToast('error', `Could not check the lead's existing department: ${previousError.message}`);
        await loadAdminData(true);
        return;
      }

      // Move the YUVA from any previous designation group.
      for (const assignment of previousAssignments || []) {
        const { error: moveError } = await supabase
          .from('member_departments')
          .delete()
          .eq('member_id', memberId)
          .eq('department_id', assignment.department_id);

        if (moveError) {
          setSavingKey('');
          showToast('error', `Could not move the YUVA to this department: ${moveError.message}`);
          await loadAdminData(true);
          return;
        }

        const previousDepartment = departments.find(
          item => item.id === assignment.department_id
        );

        if (previousDepartment?.lead_id === memberId) {
          const { error: clearLeadError } = await supabase
            .from('departments')
            .update({ lead_id: null })
            .eq('id', previousDepartment.id);

          if (clearLeadError) {
            showToast(
              'warning',
              `Membership moved, but a legacy lead reference could not be cleared: ${clearLeadError.message}`
            );
          }
        }
      }

      const { data: currentAssignment, error: currentError } = await supabase
        .from('member_departments')
        .select('id')
        .eq('member_id', memberId)
        .eq('department_id', department.id)
        .maybeSingle();

      if (currentError) {
        setSavingKey('');
        showToast('error', `Could not check the current department assignment: ${currentError.message}`);
        await loadAdminData(true);
        return;
      }

      if (!currentAssignment) {
        const { error: insertError } = await supabase
          .from('member_departments')
          .insert({
            member_id: memberId,
            department_id: department.id,
            assignment_type: 'primary',
          });

        if (insertError) {
          setSavingKey('');
          showToast(
            'error',
            `Department details saved, but a YUVA lead could not be assigned: ${insertError.message}`
          );
          await loadAdminData(true);
          return;
        }
      }

      const { error: designationError } = await supabase
        .from('profiles')
        .update({ designation: draft.name.trim() })
        .eq('id', memberId);

      if (designationError) {
        setSavingKey('');
        showToast('error', `Lead assigned, but designation could not be updated: ${designationError.message}`);
        await loadAdminData(true);
        return;
      }
    }

    // Keep designation names synced after a department rename,
    // including any NavYuva members already assigned to it.
    const { data: currentMembers, error: currentMembersError } = await supabase
      .from('member_departments')
      .select('member_id')
      .eq('department_id', department.id);

    if (!currentMembersError) {
      for (const item of currentMembers || []) {
        const { error: syncError } = await supabase
          .from('profiles')
          .update({ designation: draft.name.trim() })
          .eq('id', item.member_id);

        if (syncError) {
          setSavingKey('');
          showToast(
            'warning',
            `Department saved, but one member designation could not be synced: ${syncError.message}`
          );
          await loadAdminData(true);
          return;
        }
      }
    }

    setSavingKey('');
    showToast('success', `Saved ${draft.name.trim()} and its YUVA leads.`);
    await loadAdminData(true);
  }

  async function saveSetting(setting: AppSetting) {
    const draft = settingDrafts[setting.id] ?? '';
    let parsed: unknown;

    try {
      parsed = JSON.parse(draft);
    } catch {
      showToast(
        'warning',
        `Value for “${setting.key}” must be valid JSON. Use quotes for text, for example "JIC YUVA PULSE".`
      );
      return;
    }

    setSavingKey(`setting:${setting.id}`);

    const { error: updateError } = await supabase
      .from('app_settings')
      .update({
        value: parsed,
        updated_by: profile?.id || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', setting.id);

    setSavingKey('');

    if (updateError) {
      showToast('error', `Setting update failed: ${updateError.message}`);
      return;
    }

    showToast('success', `Saved ${setting.key}.`);
    await loadAdminData(true);
  }

  function toggleLead(
    departmentId: string,
    memberId: string,
    checked: boolean
  ) {
    setDepartmentLeadDrafts(previous => {
      const current = previous[departmentId] || [];

      return {
        ...previous,
        [departmentId]: checked
          ? [...new Set([...current, memberId])]
          : current.filter(id => id !== memberId),
      };
    });
  }

  if (loading) {
    return <LoadingState message="Loading administration workspace..." />;
  }

  const tabs: { key: TabKey; label: string; icon: typeof Users }[] = [
    { key: 'members', label: 'Members & roles', icon: Users },
    { key: 'departments', label: 'Departments', icon: Building2 },
    { key: 'settings', label: 'App settings', icon: Settings2 },
  ];

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-fade-in">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-jic-orange uppercase tracking-wide">
            JIC YUVA PULSE
          </p>
          <h1 className="text-3xl font-bold text-jic-text mt-1">
            Administration
          </h1>
          <p className="text-jic-text-secondary mt-2">
            Manage member roles, department leadership, and workspace settings.
          </p>
        </div>

        <button
          onClick={() => void loadAdminData(true)}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-jic-border bg-white text-sm font-semibold text-jic-text hover:bg-jic-muted disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh data
        </button>
      </header>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          Some administration data could not be loaded. Check permissions and refresh. {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardBody className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 text-jic-orange flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-jic-text-secondary">Active members</p>
              <p className="text-2xl font-bold text-jic-text">
                {members.filter(member => member.status === 'active').length}
              </p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-jic-text-secondary">Active departments</p>
              <p className="text-2xl font-bold text-jic-text">
                {departments.filter(department => department.status === 'active').length}
              </p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Settings2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-jic-text-secondary">Workspace settings</p>
              <p className="text-2xl font-bold text-jic-text">{settings.length}</p>
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-jic-border pb-3">
        {tabs.map(item => {
          const Icon = item.icon;

          return (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                tab === item.key
                  ? 'bg-jic-orange text-white'
                  : 'bg-white border border-jic-border text-jic-text hover:bg-jic-muted'
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === 'members' && (
        <Card>
          <CardHeader
            title="Member access"
            subtitle="YUVA members lead departments; NavYuva members are assigned to departments by their leads."
          />

          <CardBody>
            <input
              className={`${fieldClass} mb-4`}
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search by name, email, designation, or role..."
              aria-label="Search members"
            />

            <div className="mb-4 rounded-xl border border-jic-blue/15 bg-jic-blue-soft px-4 py-3 text-sm text-jic-text-secondary">
              <span className="font-semibold text-jic-text">Role guide:</span>{' '}
              YUVA = department lead. NavYuva = team member without lead permissions.
              Admin = workspace administrator.
            </div>

            <div className="space-y-4">
              {filteredMembers.length === 0 ? (
                <p className="py-8 text-center text-sm text-jic-text-secondary">
                  No matching member profiles found.
                </p>
              ) : (
                filteredMembers.map(member => {
                  const draft = memberDrafts[member.id] || {
                    full_name: member.full_name,
                    designation: member.designation || '',
                    role: member.role,
                    status: member.status,
                    phone: member.phone || '',
                  };

                  const saving = savingKey === `member:${member.id}`;

                  return (
                    <div key={member.id} className="rounded-2xl border border-jic-border p-4 space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-bold text-jic-text break-words">{member.full_name}</h3>
                          <p className="text-sm text-jic-text-secondary break-all">{member.email}</p>
                        </div>

                        <div className="flex gap-2 flex-wrap">
                          <Badge className={roleBadge(member.role)}>{roleLabel(member.role)}</Badge>
                          <Badge className={statusBadge(member.status)}>{member.status}</Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
                        <label className="text-xs font-semibold text-jic-text-secondary">
                          Full name
                          <input
                            className={`${fieldClass} mt-1.5`}
                            value={draft.full_name}
                            onChange={event =>
                              setMemberDrafts(previous => ({
                                ...previous,
                                [member.id]: { ...draft, full_name: event.target.value },
                              }))
                            }
                          />
                        </label>

                        <label className="text-xs font-semibold text-jic-text-secondary">
                          Designation
                          <input
                            className={`${fieldClass} mt-1.5`}
                            value={draft.designation || ''}
                            onChange={event =>
                              setMemberDrafts(previous => ({
                                ...previous,
                                [member.id]: { ...draft, designation: event.target.value },
                              }))
                            }
                            placeholder="e.g. COO"
                          />
                        </label>

                        <label className="text-xs font-semibold text-jic-text-secondary">
                          Role
                          <select
                            className={`${fieldClass} mt-1.5`}
                            value={draft.role}
                            onChange={event =>
                              setMemberDrafts(previous => ({
                                ...previous,
                                [member.id]: {
                                  ...draft,
                                  role: event.target.value as Role,
                                },
                              }))
                            }
                          >
                            {roleOptions.map(option => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="text-xs font-semibold text-jic-text-secondary">
                          Status
                          <select
                            className={`${fieldClass} mt-1.5`}
                            value={draft.status}
                            onChange={event =>
                              setMemberDrafts(previous => ({
                                ...previous,
                                [member.id]: {
                                  ...draft,
                                  status: event.target.value as ProfileStatus,
                                },
                              }))
                            }
                          >
                            {statusOptions.map(option => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="text-xs font-semibold text-jic-text-secondary">
                          Phone
                          <input
                            className={`${fieldClass} mt-1.5`}
                            value={draft.phone || ''}
                            onChange={event =>
                              setMemberDrafts(previous => ({
                                ...previous,
                                [member.id]: { ...draft, phone: event.target.value },
                              }))
                            }
                            placeholder="Optional"
                          />
                        </label>
                      </div>

                      <div className="flex justify-end">
                        <button
                          onClick={() => void saveMember(member)}
                          disabled={saving}
                          className="inline-flex items-center gap-2 rounded-xl bg-jic-orange px-4 py-2.5 text-sm font-semibold text-white hover:bg-jic-orange-deep disabled:opacity-50"
                        >
                          <Save className="w-4 h-4" />
                          {saving ? 'Saving...' : 'Save member'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {tab === 'departments' && (
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Create department"
              subtitle="Create the department first, then select as many YUVA leads as needed."
            />

            <CardBody>
              <form
                onSubmit={addDepartment}
                className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 items-end"
              >
                <label className="text-xs font-semibold text-jic-text-secondary">
                  Department name
                  <input
                    className={`${fieldClass} mt-1.5`}
                    required
                    value={newDepartment.name}
                    onChange={event =>
                      setNewDepartment(previous => ({ ...previous, name: event.target.value }))
                    }
                    placeholder="e.g. COO"
                  />
                </label>

                <label className="text-xs font-semibold text-jic-text-secondary">
                  Description
                  <input
                    className={`${fieldClass} mt-1.5`}
                    value={newDepartment.description}
                    onChange={event =>
                      setNewDepartment(previous => ({ ...previous, description: event.target.value }))
                    }
                    placeholder="Purpose or scope"
                  />
                </label>

                <label className="text-xs font-semibold text-jic-text-secondary">
                  Colour
                  <input
                    type="color"
                    className={`${fieldClass} mt-1.5 h-[42px]`}
                    value={newDepartment.color}
                    onChange={event =>
                      setNewDepartment(previous => ({ ...previous, color: event.target.value }))
                    }
                  />
                </label>

                <button
                  type="submit"
                  disabled={savingKey === 'department:new'}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-jic-orange px-4 py-2.5 text-sm font-semibold text-white hover:bg-jic-orange-deep disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  {savingKey === 'department:new' ? 'Creating...' : 'Add department'}
                </button>
              </form>
            </CardBody>
          </Card>

          <div className="space-y-3">
            {departments.map(department => {
              const draft = departmentDrafts[department.id] || {
                name: department.name,
                description: department.description || '',
                status: department.status,
                color: department.color || '#F97316',
              };

              const saving = savingKey === `department:${department.id}`;
              const selectedLeads =
                departmentLeadDrafts[department.id] ?? initialLeadIds(department);

              const assignedMembers = memberDepartments
                .filter(item => item.department_id === department.id)
                .map(item => members.find(member => member.id === item.member_id))
                .filter((member): member is Profile => Boolean(member));

              const navYuvaMembers = assignedMembers.filter(member => member.role === 'yuva');

              return (
                <Card key={department.id}>
                  <CardBody className="space-y-4">
                    <div className="flex items-center gap-3">
                      <span
                        className="h-10 w-2 rounded-full"
                        style={{ backgroundColor: draft.color || '#F97316' }}
                      />
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-jic-muted text-sm font-bold text-jic-text">
                        {initials(department.name)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-jic-text">{department.name}</p>
                        <p className="text-xs text-jic-text-secondary">
                          Created {new Date(department.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      <Badge className={draft.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}>
                        {draft.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                      <label className="text-xs font-semibold text-jic-text-secondary">
                        Name
                        <input
                          className={`${fieldClass} mt-1.5`}
                          value={draft.name}
                          onChange={event =>
                            setDepartmentDrafts(previous => ({
                              ...previous,
                              [department.id]: { ...draft, name: event.target.value },
                            }))
                          }
                        />
                      </label>

                      <label className="text-xs font-semibold text-jic-text-secondary">
                        Description
                        <input
                          className={`${fieldClass} mt-1.5`}
                          value={draft.description}
                          onChange={event =>
                            setDepartmentDrafts(previous => ({
                              ...previous,
                              [department.id]: { ...draft, description: event.target.value },
                            }))
                          }
                          placeholder="Purpose or scope"
                        />
                      </label>

                      <label className="text-xs font-semibold text-jic-text-secondary">
                        Status
                        <select
                          className={`${fieldClass} mt-1.5`}
                          value={draft.status}
                          onChange={event =>
                            setDepartmentDrafts(previous => ({
                              ...previous,
                              [department.id]: {
                                ...draft,
                                status: event.target.value as 'active' | 'inactive',
                              },
                            }))
                          }
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </label>

                      <label className="text-xs font-semibold text-jic-text-secondary">
                        Colour
                        <input
                          type="color"
                          className={`${fieldClass} mt-1.5 h-[42px]`}
                          value={draft.color}
                          onChange={event =>
                            setDepartmentDrafts(previous => ({
                              ...previous,
                              [department.id]: { ...draft, color: event.target.value },
                            }))
                          }
                        />
                      </label>
                    </div>

                    <div className="rounded-xl border border-jic-border p-3 sm:p-4">
                      <div className="mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-bold text-jic-text">YUVA leads</h4>
                          <p className="text-xs text-jic-text-secondary mt-0.5">
                            Select multiple leads for this department.
                          </p>
                        </div>

                        <span className="w-fit rounded-lg bg-jic-blue-soft px-2.5 py-1 text-xs font-semibold text-jic-blue">
                          {selectedLeads.length} selected
                        </span>
                      </div>

                      {activeYuvaLeads.length === 0 ? (
                        <p className="rounded-lg bg-jic-muted px-3 py-3 text-sm text-jic-text-secondary">
                          No active members currently have the YUVA role. Set a member's role to
                          YUVA in Members &amp; roles first.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                          {activeYuvaLeads.map(member => {
                            const checked = selectedLeads.includes(member.id);

                            return (
                              <label
                                key={member.id}
                                className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-3 transition-colors ${
                                  checked
                                    ? 'border-jic-orange/40 bg-jic-orange-pale'
                                    : 'border-jic-border hover:bg-jic-muted/60'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={event =>
                                    toggleLead(department.id, member.id, event.target.checked)
                                  }
                                  className="h-4 w-4 accent-orange-500"
                                />

                                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-jic-text">
                                  {initials(member.full_name)}
                                </span>

                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-semibold text-jic-text">
                                    {member.full_name}
                                  </span>
                                  <span className="block truncate text-xs text-jic-text-secondary">
                                    {member.designation || 'YUVA'}
                                  </span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}

                      {navYuvaMembers.length > 0 && (
                        <div className="mt-3 border-t border-jic-border pt-3">
                          <p className="text-xs font-semibold text-jic-text-secondary">
                            NavYuva members in this department
                          </p>

                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {navYuvaMembers.map(member => (
                              <span
                                key={member.id}
                                className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800"
                              >
                                {member.full_name}
                              </span>
                            ))}
                          </div>

                          <p className="mt-2 text-xs text-jic-text-secondary">
                            Manage NavYuva assignments in Department Membership.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={() => void saveDepartment(department)}
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-xl bg-jic-orange px-4 py-2.5 text-sm font-semibold text-white hover:bg-jic-orange-deep disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving...' : 'Save department'}
                      </button>
                    </div>
                  </CardBody>
                </Card>
              );
            })}

            {departments.length === 0 && (
              <Card>
                <CardBody className="py-8 text-center text-sm text-jic-text-secondary">
                  No departments yet. Create your first department above.
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <Card>
          <CardHeader
            title="Workspace settings"
            subtitle="Values are stored as JSON in Supabase. Preserve valid JSON formatting when editing a value."
          />

          <CardBody>
            <div className="space-y-4">
              {settings.map(setting => {
                const saving = savingKey === `setting:${setting.id}`;

                return (
                  <div
                    key={setting.id}
                    className="rounded-2xl border border-jic-border p-4 grid grid-cols-1 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto] gap-3 items-start"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-jic-text break-words">{setting.key}</p>
                      <p className="text-sm text-jic-text-secondary mt-1">
                        {setting.description || 'No description provided.'}
                      </p>
                    </div>

                    <textarea
                      rows={2}
                      spellCheck={false}
                      aria-label={`Value for ${setting.key}`}
                      className={`${fieldClass} font-mono`}
                      value={settingDrafts[setting.id] ?? ''}
                      onChange={event =>
                        setSettingDrafts(previous => ({
                          ...previous,
                          [setting.id]: event.target.value,
                        }))
                      }
                    />

                    <button
                      onClick={() => void saveSetting(setting)}
                      disabled={saving}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-jic-orange px-4 py-2.5 text-sm font-semibold text-white hover:bg-jic-orange-deep disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                );
              })}

              {settings.length === 0 && (
                <p className="py-8 text-center text-sm text-jic-text-secondary">
                  No settings were found in the database.
                </p>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      <p className="text-xs text-jic-text-secondary">
        Role access changes apply immediately. Create or invite login accounts through Supabase
        Authentication. Assign NavYuva members through Department Membership; each department can
        have multiple YUVA leads.
      </p>
    </div>
  );
}
