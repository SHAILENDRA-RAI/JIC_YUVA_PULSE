                          {canManage && (
                            <>
                              <select aria-label={`Status for ${event.title}`} value={event.status} disabled={saving} onChange={change => void updateEventStatus(event, change.target.value as EventStatus)} className="rounded-xl border border-jic-border bg-white px-3 py-2 text-sm text-jic-text">
                                {eventStatuses.map(status => <option key={status} value={status}>{pretty(status)}</option>)}
                              </select>
                              <button type="button" onClick={() => startEditEvent(event)} className="inline-flex items-center gap-1.5 rounded-xl border border-jic-border px-3 py-2 text-sm font-semibold text-jic-text hover:bg-jic-muted"><Pencil className="h-4 w-4" /> Edit</button>
                            </>
                          )}
                          {isAdmin && (
                            <button type="button" disabled={saving} onClick={() => void deleteEvent(event)} className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-4 w-4" /> Delete</button>
                          )}
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-jic-border pt-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-jic-text"><ClipboardList className="h-4 w-4 text-jic-orange" /> Volunteer roles <span className="text-xs font-normal text-jic-text-secondary">({eventRoles.length})</span></div>
                        <div className="flex items-center gap-2">
                          {canManage && <button type="button" onClick={() => startCreateRole(event.id)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-jic-orange hover:bg-orange-50"><Plus className="h-3.5 w-3.5" /> Add role</button>}
                          <button type="button" onClick={() => toggleExpanded(event.id)} aria-expanded={expanded} className="inline-flex items-center gap-1.5 rounded-lg bg-jic-muted px-3 py-2 text-xs font-semibold text-jic-text-secondary hover:text-jic-text">{expanded ? 'Hide details' : 'View details'} <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} /></button>
                        </div>
                      </div>
                    </div>

                    {expanded && (
                      <div className="border-t border-jic-border bg-slate-50/60 p-4 sm:p-5">
                        {eventRoles.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-jic-border bg-white p-6 text-center">
                            <Users className="mx-auto h-7 w-7 text-jic-text-secondary" />
                            <p className="mt-2 text-sm font-semibold text-jic-text">No volunteer roles yet</p>
                            <p className="mt-1 text-xs text-jic-text-secondary">Add responsibilities so members can express interest and the team can coordinate coverage.</p>
                            {canManage && <button type="button" onClick={() => startCreateRole(event.id)} className="mt-3 rounded-xl bg-jic-orange px-3 py-2 text-xs font-semibold text-white">Add first role</button>}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {eventRoles.map(role => {
                              const responseRows = assignments.filter(item => item.responsibility_id === role.id);
                              const interestedOrAssigned = responseRows.filter(item => ['interested', 'assigned', 'confirmed', 'completed'].includes(item.status)).length;
                              const myResponse = responseRows.find(item => item.member_id === profile?.id);
                              const department = role.department_id ? departmentMap.get(role.department_id) : null;
                              const capacityFull = interestedOrAssigned >= role.required_capacity;

                              return (
                                <section key={role.id} className="rounded-xl border border-jic-border bg-white p-4">
                                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="font-bold text-jic-text">{role.name}</h3>
                                        <Badge className={role.status === 'open' ? 'bg-emerald-100 text-emerald-800' : role.status === 'filled' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'}>{pretty(role.status)}</Badge>
                                        <span className="text-xs text-jic-text-secondary">{interestedOrAssigned}/{role.required_capacity} responses</span>
                                      </div>
                                      {role.description && <p className="mt-1.5 text-sm leading-5 text-jic-text-secondary whitespace-pre-line">{role.description}</p>}
                                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-jic-text-secondary">
                                        <span>{department?.name || 'Any department'}</span>
                                        <span>Deadline: {formatDate(role.deadline)}</span>
                                      </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                      {!canManage && role.status === 'open' && (
                                        <button type="button" disabled={saving || Boolean(myResponse) || capacityFull} onClick={() => void expressInterest(role)} className="inline-flex items-center gap-1.5 rounded-xl bg-jic-orange px-3 py-2 text-sm font-semibold text-white hover:bg-jic-orange-deep disabled:cursor-not-allowed disabled:opacity-50">
                                          {myResponse ? <><Check className="h-4 w-4" /> {pretty(myResponse.status)}</> : capacityFull ? 'Capacity reached' : 'I’m interested'}
                                        </button>
                                      )}
                                      {canManage && (
                                        <>
                                          <button type="button" onClick={() => startEditRole(role)} className="inline-flex items-center gap-1.5 rounded-lg border border-jic-border px-2.5 py-2 text-xs font-semibold text-jic-text hover:bg-jic-muted"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                                          {isAdmin && <button type="button" disabled={saving} onClick={() => void deleteRole(role)} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-2.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /> Delete</button>}
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  {responseRows.length > 0 && (
                                    <div className="mt-4 border-t border-jic-border pt-3">
                                      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-jic-text-secondary">Volunteer responses</p>
                                      <div className="space-y-2">
                                        {responseRows.map(response => {
                                          const member = memberMap.get(response.member_id);
                                          return (
                                            <div key={response.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg bg-jic-muted/50 px-3 py-2">
                                              <div className="min-w-0">
                                                <p className="text-sm font-semibold text-jic-text">{member?.full_name || 'Member'}</p>
                                                {member?.designation && <p className="text-xs text-jic-text-secondary">{member.designation}</p>}
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <Badge className={assignmentStatusStyle[response.status] || 'bg-slate-100 text-slate-700'}>{pretty(response.status)}</Badge>
                                                {canManage && <select aria-label={`Update ${member?.full_name || 'member'} response`} disabled={saving} value={response.status} onChange={change => void updateAssignment(response, change.target.value as AssignmentStatus)} className="rounded-lg border border-jic-border bg-white px-2.5 py-1.5 text-xs">{assignmentStatuses.map(status => <option key={status} value={status}>{pretty(status)}</option>)}</select>}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </section>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {!canManage && <p className="text-xs text-jic-text-secondary">Browse open volunteer roles, express interest, and wait for a JIC lead or administrator to confirm your assignment.</p>}
      {isAdmin && <p className="text-xs text-jic-text-secondary">Admin controls: edit events and roles, update event and volunteer statuses, or delete records. Deleting an event also deletes its volunteer roles and responses.</p>}
    </div>
  );
}
