import { useEffect, useMemo, useState } from 'react';
import { Building2, Check, RefreshCw, Search, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { LoadingState } from '@/components/ui/EmptyState';
import type { Department, MemberDepartment, Profile } from '@/types';

type Member = Pick<Profile, 'id' | 'full_name' | 'email' | 'designation' | 'role' | 'status'>;

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || 'YU';
}

export function DepartmentAssignments() {
  const { showToast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [assignments, setAssignments] = useState<MemberDepartment[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyKey, setBusyKey] = useState('');
  const [error, setError] = useState('');

  async function loadData(quiet = false) {
    if (quiet) setRefreshing(true); else setLoading(true);
    setError('');
    const [membersResult, departmentsResult, assignmentsResult] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, designation, role, status').order('full_name', { ascending: true }),
      supabase.from('departments').select('*').order('name', { ascending: true }),
      supabase.from('member_departments').select('*'),
    ]);
    const firstError = membersResult.error || departmentsResult.error || assignmentsResult.error;
    if (firstError) {
      setError(firstError.message);
    } else {
      setMembers((membersResult.data || []) as Member[]);
      setDepartments((departmentsResult.data || []) as Department[]);
      setAssignments((assignmentsResult.data || []) as MemberDepartment[]);
    }
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => { void loadData(); }, []);

  const activeMembers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return members.filter(member => member.status === 'active' && (
      !needle || [member.full_name, member.email, member.designation || '', member.role].join(' ').toLowerCase().includes(needle)
    ));
  }, [members, search]);

  const assignedIdsByDepartment = useMemo(() => {
    const map = new Map<string, Set<string>>();
    assignments.forEach(item => {
      const set = map.get(item.department_id) || new Set<string>();
      set.add(item.member_id);
      map.set(item.department_id, set);
    });
    return map;
  }, [assignments]);

  async function toggleMember(department: Department, member: Member, checked: boolean) {
    const key = `${department.id}:${member.id}`;
    setBusyKey(key);
    let failure = '';

    if (checked) {
      const { error: insertError } = await supabase.from('member_departments').insert({
        member_id: member.id,
        department_id: department.id,
        assignment_type: 'primary',
      });
      if (insertError) {
        failure = insertError.message;
      } else {
        setAssignments(previous => [...previous, {
          id: `local-${department.id}-${member.id}`,
          member_id: member.id,
          department_id: department.id,
          assignment_type: 'primary',
          start_date: new Date().toISOString().slice(0, 10),
          end_date: null,
        } as MemberDepartment]);
        const { error: profileError } = await supabase.from('profiles').update({ designation: department.name }).eq('id', member.id);
        if (profileError) {
          showToast('warning', `Assigned ${member.full_name} to ${department.name}, but could not sync their designation: ${profileError.message}`);
        } else {
          setMembers(previous => previous.map(row => row.id === member.id ? { ...row, designation: department.name } : row));
          showToast('success', `${member.full_name} added to ${department.name}.`);
        }
      }
    } else {
      const { error: deleteError } = await supabase.from('member_departments').delete()
        .eq('member_id', member.id)
        .eq('department_id', department.id);
      if (deleteError) {
        failure = deleteError.message;
      } else {
        setAssignments(previous => previous.filter(item => !(item.member_id === member.id && item.department_id === department.id)));
        const otherAssignments = assignments.filter(item => item.member_id === member.id && item.department_id !== department.id);
        const nextDepartment = departments.find(item => item.id === otherAssignments[0]?.department_id);
        const nextDesignation = nextDepartment?.name || null;
        const { error: profileError } = await supabase.from('profiles').update({ designation: nextDesignation }).eq('id', member.id);
        if (profileError) {
          showToast('warning', `Removed ${member.full_name} from ${department.name}, but could not sync their designation: ${profileError.message}`);
        } else {
          setMembers(previous => previous.map(row => row.id === member.id ? { ...row, designation: nextDesignation } : row));
          showToast('success', `${member.full_name} removed from ${department.name}.`);
        }
      }
    }

    if (failure) showToast('error', `Could not update department membership: ${failure}`);
    setBusyKey('');
  }

  if (loading) return <LoadingState message="Loading department membership..." />;

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-fade-in">
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-jic-orange uppercase tracking-wide">JIC YUVA PULSE</p>
          <h1 className="text-3xl font-bold text-jic-text mt-1">Department Membership</h1>
          <p className="text-jic-text-secondary mt-2 max-w-3xl">In JIC, labels such as CPO, CCO and COO are department/designation groups. Each group can have several YUVAs; assigning a member here also synchronises their profile designation.</p>
        </div>
        <button onClick={() => void loadData(true)} disabled={refreshing} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-jic-border bg-white text-sm font-semibold text-jic-text hover:bg-jic-muted disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card><CardBody className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center"><Building2 className="w-5 h-5" /></div><div><p className="text-sm text-jic-text-secondary">Designation groups</p><p className="text-2xl font-bold text-jic-text">{departments.length}</p></div></CardBody></Card>
        <Card><CardBody className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center"><Users className="w-5 h-5" /></div><div><p className="text-sm text-jic-text-secondary">Active members</p><p className="text-2xl font-bold text-jic-text">{members.filter(member => member.status === 'active').length}</p></div></CardBody></Card>
        <Card><CardBody className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-orange-50 text-jic-orange flex items-center justify-center"><Check className="w-5 h-5" /></div><div><p className="text-sm text-jic-text-secondary">Memberships assigned</p><p className="text-2xl font-bold text-jic-text">{assignments.length}</p></div></CardBody></Card>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Could not load department membership: {error}. Check permissions, then refresh.</div>}

      <Card>
        <CardHeader title="Assign YUVAs to groups" subtitle="Select multiple people in each group. A group is not limited to one lead or one member." />
        <CardBody>
          <label className="relative block mb-5">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-jic-text-secondary" />
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search active members by name, email, designation, or role..." aria-label="Search active members" className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-jic-border text-sm focus:outline-none focus:ring-2 focus:ring-jic-orange/20 focus:border-jic-orange" />
          </label>

          {departments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-jic-border p-8 text-center"><Building2 className="w-8 h-8 text-jic-text-secondary mx-auto mb-3" /><h2 className="font-bold text-jic-text">Create your groups first</h2><p className="text-sm text-jic-text-secondary mt-1">In Administration → Departments, add one group for each designation, such as CPO, CCO, COO, and CVO. Return here to assign several members to each group.</p></div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {departments.map(department => {
                const assigned = assignedIdsByDepartment.get(department.id) || new Set<string>();
                const departmentMembers = members.filter(member => assigned.has(member.id));
                return <section key={department.id} className="rounded-2xl border border-jic-border overflow-hidden">
                  <div className="p-4 bg-jic-muted/50 flex items-start gap-3">
                    <span className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ backgroundColor: department.color || '#F97316' }}>{initials(department.name)}</span>
                    <div className="min-w-0 flex-1"><h3 className="font-bold text-jic-text">{department.name}</h3><p className="text-xs text-jic-text-secondary mt-0.5">{department.description || 'Department / designation group'}</p></div>
                    <span className="text-sm font-semibold text-jic-text bg-white border border-jic-border rounded-lg px-2.5 py-1">{departmentMembers.length} assigned</span>
                  </div>
                  <div className="p-3 max-h-[420px] overflow-y-auto space-y-1">
                    {activeMembers.length === 0 ? <p className="text-sm text-jic-text-secondary p-3">No active members match this search.</p> : activeMembers.map(member => {
                      const key = `${department.id}:${member.id}`;
                      const busy = busyKey === key;
                      const isAssigned = assigned.has(member.id);
                      return <label key={member.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors cursor-pointer ${isAssigned ? 'border-jic-orange/40 bg-orange-50/60' : 'border-transparent hover:border-jic-border hover:bg-jic-muted/40'} ${busy ? 'opacity-60' : ''}`}>
                        <input type="checkbox" checked={isAssigned} disabled={busy} onChange={event => void toggleMember(department, member, event.target.checked)} className="w-4 h-4 accent-orange-500 shrink-0" />
                        <span className="w-9 h-9 rounded-full bg-white border border-jic-border flex items-center justify-center text-xs font-bold text-jic-text shrink-0">{initials(member.full_name)}</span>
                        <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-jic-text truncate">{member.full_name}</span><span className="block text-xs text-jic-text-secondary truncate">{member.email}</span></span>
                        {busy && <span className="text-xs text-jic-text-secondary">Saving...</span>}
                      </label>;
                    })}
                  </div>
                </section>;
              })}
            </div>
          )}
        </CardBody>
      </Card>
      <p className="text-xs text-jic-text-secondary">Tip: add CPO, CCO, COO, and other group names in Administration → Departments first. Every group can have multiple members. The optional Department Lead field elsewhere is only a point of contact, not the member list.</p>
    </div>
  );
}
