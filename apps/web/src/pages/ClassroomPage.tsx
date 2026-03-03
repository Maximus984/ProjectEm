import { useMutation, useQuery } from "@tanstack/react-query";
import { isAdminRole, isFamilyRole, isStaffRole, type UserRole } from "@projectm/contracts";
import { useEffect, useMemo, useState } from "react";
import { RoleBadge } from "../components/RoleBadge";
import { api } from "../lib/api";
import { useAuthStore } from "../store/auth-store";

type StaffMember = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
};

type ClassItem = {
  id: string;
  name: string;
  description: string | null;
  mentorName: string | null;
  enrollmentCount: number;
  assignmentCount: number;
};

type ChildOption = {
  id: string;
  firstName: string;
  lastName: string;
  gradeLevel?: string | null;
};

type RosterMember = {
  childId: string;
  childName: string;
  gradeLevel?: string | null;
};

type FamilyProfileResponse = {
  familyId: string;
  children: ChildOption[];
};

type AssignmentItem = {
  id: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  isPublished: boolean;
  submissionCount: number;
};

type ChildAssignment = {
  assignmentId: string;
  classId: string;
  className: string;
  title: string;
  description: string | null;
  dueAt: string | null;
  isPublished: boolean;
  submission: {
    id: string;
    content: string;
    score: number | null;
    submittedAt: string;
  } | null;
};

type GradeSummary = {
  childId: string;
  childName: string;
  entries: number;
  weightedAverage: number | null;
  categories: Array<{ category: string; average: number | null }>;
};

type AttendanceResponse = {
  attendancePercent: number;
  records: Array<{
    id: string;
    status: "PRESENT" | "TARDY" | "ABSENT" | "EXCUSED";
    date: string;
    notes?: string | null;
  }>;
};

const attendanceStatuses = ["PRESENT", "TARDY", "ABSENT", "EXCUSED"] as const;

function todayDateValue() {
  return new Date().toISOString().slice(0, 10);
}

export function ClassroomPage() {
  const token = useAuthStore((state) => state.accessToken);
  const role = useAuthStore((state) => state.role);

  const canManage = Boolean(role && (isAdminRole(role) || role === "MENTOR"));
  const canSeeChildView = Boolean(role && isFamilyRole(role));

  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedChildId, setSelectedChildId] = useState("");
  const [assignmentDraft, setAssignmentDraft] = useState({
    title: "",
    description: "",
    dueAt: "",
    isPublished: true
  });
  const [classDraft, setClassDraft] = useState({
    name: "",
    description: ""
  });
  const [attendanceDate, setAttendanceDate] = useState(todayDateValue());
  const [attendanceDraft, setAttendanceDraft] = useState<Record<string, (typeof attendanceStatuses)[number]>>({});
  const [gradeCategory, setGradeCategory] = useState("PROJECT");
  const [gradeWeight, setGradeWeight] = useState("30");
  const [gradeDraft, setGradeDraft] = useState<Record<string, string>>({});
  const [submissionDraft, setSubmissionDraft] = useState<Record<string, string>>({});

  const staffQuery = useQuery({
    queryKey: ["staff-roster", token],
    queryFn: () => api<{ staff: StaffMember[] }>("/support/staff", { token: token ?? undefined }),
    enabled: Boolean(token)
  });

  const classesQuery = useQuery({
    queryKey: ["classroom-classes", token],
    queryFn: () => api<{ classes: ClassItem[] }>("/classes", { token: token ?? undefined }),
    enabled: Boolean(token)
  });

  const familyQuery = useQuery({
    queryKey: ["family-profile", token],
    queryFn: () => api<FamilyProfileResponse>("/families/me", { token: token ?? undefined }),
    enabled: Boolean(token && canSeeChildView)
  });

  useEffect(() => {
    if (!selectedClassId && classesQuery.data?.classes.length) {
      setSelectedClassId(classesQuery.data.classes[0].id);
    }
  }, [classesQuery.data, selectedClassId]);

  useEffect(() => {
    if (!selectedChildId && familyQuery.data?.children.length) {
      setSelectedChildId(familyQuery.data.children[0].id);
    }
  }, [familyQuery.data, selectedChildId]);

  const rosterQuery = useQuery({
    queryKey: ["classroom-roster", selectedClassId, token],
    queryFn: () =>
      api<{ roster: RosterMember[] }>(`/classes/${selectedClassId}/roster`, {
        token: token ?? undefined
      }),
    enabled: Boolean(token && selectedClassId)
  });

  useEffect(() => {
    if (!rosterQuery.data?.roster.length) {
      return;
    }

    setAttendanceDraft((previous) => {
      const next = { ...previous };
      for (const member of rosterQuery.data!.roster) {
        if (!next[member.childId]) {
          next[member.childId] = "PRESENT";
        }
      }
      return next;
    });
  }, [rosterQuery.data]);

  const assignmentsQuery = useQuery({
    queryKey: ["classroom-assignments", selectedClassId, token],
    queryFn: () =>
      api<{ assignments: AssignmentItem[] }>(`/classes/${selectedClassId}/assignments`, {
        token: token ?? undefined
      }),
    enabled: Boolean(token && selectedClassId)
  });

  const childAssignmentsQuery = useQuery({
    queryKey: ["child-assignments", selectedChildId, token],
    queryFn: () =>
      api<{ assignments: ChildAssignment[] }>(`/children/${selectedChildId}/assignments`, {
        token: token ?? undefined
      }),
    enabled: Boolean(token && selectedChildId && canSeeChildView)
  });

  const attendanceQuery = useQuery({
    queryKey: ["child-attendance", selectedChildId, token],
    queryFn: () =>
      api<AttendanceResponse>(`/children/${selectedChildId}/attendance`, {
        token: token ?? undefined
      }),
    enabled: Boolean(token && selectedChildId && canSeeChildView)
  });

  const gradeSummaryQuery = useQuery({
    queryKey: ["grade-summary", selectedClassId, token],
    queryFn: () =>
      api<{ students: GradeSummary[] }>(`/gradebook/${selectedClassId}/summary`, {
        token: token ?? undefined
      }),
    enabled: Boolean(token && selectedClassId)
  });

  const createClassMutation = useMutation({
    mutationFn: () =>
      api<{ id: string }>("/classes", {
        method: "POST",
        token: token ?? undefined,
        body: JSON.stringify({
          name: classDraft.name,
          description: classDraft.description || undefined
        })
      }),
    onSuccess: () => {
      setClassDraft({ name: "", description: "" });
      void classesQuery.refetch();
    }
  });

  const createAssignmentMutation = useMutation({
    mutationFn: () =>
      api<{ id: string }>(`/classes/${selectedClassId}/assignments`, {
        method: "POST",
        token: token ?? undefined,
        body: JSON.stringify({
          title: assignmentDraft.title,
          description: assignmentDraft.description || undefined,
          dueAt: assignmentDraft.dueAt ? new Date(assignmentDraft.dueAt).toISOString() : undefined,
          isPublished: assignmentDraft.isPublished
        })
      }),
    onSuccess: () => {
      setAssignmentDraft({ title: "", description: "", dueAt: "", isPublished: true });
      void assignmentsQuery.refetch();
      void classesQuery.refetch();
    }
  });

  const publishAssignmentMutation = useMutation({
    mutationFn: ({ assignmentId, isPublished }: { assignmentId: string; isPublished: boolean }) =>
      api(`/assignments/${assignmentId}/publish`, {
        method: "PATCH",
        token: token ?? undefined,
        body: JSON.stringify({ isPublished })
      }),
    onSuccess: () => {
      void assignmentsQuery.refetch();
    }
  });

  const submitAssignmentMutation = useMutation({
    mutationFn: ({ assignmentId, childId, content }: { assignmentId: string; childId: string; content: string }) =>
      api(`/assignments/${assignmentId}/submissions`, {
        method: "POST",
        token: token ?? undefined,
        body: JSON.stringify({ childId, content })
      }),
    onSuccess: (_response, variables) => {
      setSubmissionDraft((previous) => ({ ...previous, [variables.assignmentId]: "" }));
      void childAssignmentsQuery.refetch();
      void assignmentsQuery.refetch();
    }
  });

  const saveAttendanceMutation = useMutation({
    mutationFn: () =>
      api("/attendance/mark-bulk", {
        method: "POST",
        token: token ?? undefined,
        body: JSON.stringify({
          date: attendanceDate,
          entries: (rosterQuery.data?.roster ?? []).map((member) => ({
            childId: member.childId,
            status: attendanceDraft[member.childId] ?? "PRESENT"
          }))
        })
      })
  });

  const saveGradesMutation = useMutation({
    mutationFn: () =>
      api(`/gradebook/${selectedClassId}/bulk-entry`, {
        method: "POST",
        token: token ?? undefined,
        body: JSON.stringify({
          entries: (rosterQuery.data?.roster ?? [])
            .map((member) => ({
              childId: member.childId,
              category: gradeCategory,
              weight: Number(gradeWeight),
              score: Number(gradeDraft[member.childId]),
              isPublished: true
            }))
            .filter((entry) => !Number.isNaN(entry.score))
        })
      }),
    onSuccess: () => {
      setGradeDraft({});
      void gradeSummaryQuery.refetch();
    }
  });

  const className = useMemo(() => {
    const classItem = classesQuery.data?.classes.find((item) => item.id === selectedClassId);
    return classItem?.name ?? "No class selected";
  }, [classesQuery.data, selectedClassId]);

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-3xl text-white md:text-4xl">Classroom Mechanics Center</h1>
        <p className="text-sm text-mist">
          Google Classroom-style assignment workflows with PowerSchool-style attendance and weighted gradebook controls.
        </p>
      </header>

      <article className="panel rounded-2xl p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg text-white">Staff Roster</h2>
          <span className="text-xs text-mist">Every staff role has a unique color badge.</span>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {staffQuery.data?.staff.map((member) => (
            <div key={member.id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-white">
                  {member.firstName} {member.lastName}
                </p>
                <RoleBadge role={member.role} compact />
              </div>
              <p className="mt-1 text-xs text-mist">{member.email}</p>
            </div>
          ))}
        </div>
      </article>

      <article className="panel rounded-2xl p-5">
        <h2 className="font-display text-lg text-white">Classroom Selector</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <select
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
            value={selectedClassId}
            onChange={(event) => setSelectedClassId(event.target.value)}
          >
            <option value="">Select class</option>
            {classesQuery.data?.classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.enrollmentCount} students)
              </option>
            ))}
          </select>
          {canSeeChildView ? (
            <select
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
              value={selectedChildId}
              onChange={(event) => setSelectedChildId(event.target.value)}
            >
              <option value="">Select child</option>
              {familyQuery.data?.children.map((child) => (
                <option key={child.id} value={child.id}>
                  {child.firstName} {child.lastName}
                </option>
              ))}
            </select>
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-mist">
              Active class: {className}
            </div>
          )}
        </div>

        {canManage ? (
          <div className="mt-4 grid gap-2 rounded-xl border border-white/10 bg-white/5 p-3 md:grid-cols-3">
            <input
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
              placeholder="New class name"
              value={classDraft.name}
              onChange={(event) => setClassDraft((prev) => ({ ...prev, name: event.target.value }))}
            />
            <input
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
              placeholder="Description"
              value={classDraft.description}
              onChange={(event) => setClassDraft((prev) => ({ ...prev, description: event.target.value }))}
            />
            <button
              className="rounded-full bg-aurora px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
              onClick={() => createClassMutation.mutate()}
              disabled={createClassMutation.isPending || !classDraft.name.trim()}
              type="button"
            >
              {createClassMutation.isPending ? "Creating..." : "Create Class"}
            </button>
          </div>
        ) : null}
      </article>

      <div className="grid gap-6 xl:grid-cols-2">
        <article className="panel rounded-2xl p-5">
          <h2 className="font-display text-lg text-white">Google Classroom Mechanics</h2>
          <p className="mt-1 text-xs text-mist">Assignments, publishing, submissions, and deadlines.</p>

          {canManage ? (
            <div className="mt-3 grid gap-2 rounded-xl border border-white/10 bg-white/5 p-3">
              <input
                className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
                placeholder="Assignment title"
                value={assignmentDraft.title}
                onChange={(event) => setAssignmentDraft((prev) => ({ ...prev, title: event.target.value }))}
              />
              <textarea
                className="min-h-20 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
                placeholder="Instructions"
                value={assignmentDraft.description}
                onChange={(event) => setAssignmentDraft((prev) => ({ ...prev, description: event.target.value }))}
              />
              <div className="grid gap-2 md:grid-cols-2">
                <input
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
                  type="datetime-local"
                  value={assignmentDraft.dueAt}
                  onChange={(event) => setAssignmentDraft((prev) => ({ ...prev, dueAt: event.target.value }))}
                />
                <label className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-mist">
                  <input
                    type="checkbox"
                    checked={assignmentDraft.isPublished}
                    onChange={(event) => setAssignmentDraft((prev) => ({ ...prev, isPublished: event.target.checked }))}
                  />
                  Publish now
                </label>
              </div>
              <button
                type="button"
                className="rounded-full bg-aurora px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
                disabled={createAssignmentMutation.isPending || !selectedClassId || !assignmentDraft.title.trim()}
                onClick={() => createAssignmentMutation.mutate()}
              >
                {createAssignmentMutation.isPending ? "Posting..." : "Post Assignment"}
              </button>
            </div>
          ) : null}

          <div className="mt-4 space-y-2">
            {assignmentsQuery.data?.assignments.map((assignment) => (
              <div key={assignment.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{assignment.title}</p>
                  <span className={assignment.isPublished ? "text-xs text-aurora" : "text-xs text-amber-300"}>
                    {assignment.isPublished ? "PUBLISHED" : "DRAFT"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-mist">{assignment.description || "No description"}</p>
                <p className="mt-2 text-[11px] text-mist">
                  Due: {assignment.dueAt ? new Date(assignment.dueAt).toLocaleString() : "No due date"} | Submissions:{" "}
                  {assignment.submissionCount}
                </p>
                {canManage ? (
                  <button
                    type="button"
                    className="mt-2 rounded-full border border-white/20 px-3 py-1 text-xs"
                    onClick={() =>
                      publishAssignmentMutation.mutate({
                        assignmentId: assignment.id,
                        isPublished: !assignment.isPublished
                      })
                    }
                  >
                    {assignment.isPublished ? "Unpublish" : "Publish"}
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          {canSeeChildView ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-aurora">Child Assignment Submission</p>
              <div className="mt-2 space-y-2">
                {childAssignmentsQuery.data?.assignments.map((item) => (
                  <div key={item.assignmentId} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-sm text-white">{item.className} • {item.title}</p>
                    <p className="mt-1 text-xs text-mist">{item.description || "No instructions"}</p>
                    {item.submission ? (
                      <p className="mt-1 text-xs text-aurora">
                        Submitted • Score: {item.submission.score ?? "Pending"}
                      </p>
                    ) : null}
                    <textarea
                      className="mt-2 min-h-16 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
                      placeholder="Submit work update"
                      value={submissionDraft[item.assignmentId] ?? ""}
                      onChange={(event) =>
                        setSubmissionDraft((prev) => ({
                          ...prev,
                          [item.assignmentId]: event.target.value
                        }))
                      }
                    />
                    <button
                      className="mt-2 rounded-full bg-aurora px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-50"
                      type="button"
                      onClick={() =>
                        submitAssignmentMutation.mutate({
                          assignmentId: item.assignmentId,
                          childId: selectedChildId,
                          content: submissionDraft[item.assignmentId] ?? ""
                        })
                      }
                      disabled={!selectedChildId || !(submissionDraft[item.assignmentId] ?? "").trim()}
                    >
                      Submit Assignment Work
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </article>

        <article className="panel rounded-2xl p-5">
          <h2 className="font-display text-lg text-white">PowerSchool Mechanics</h2>
          <p className="mt-1 text-xs text-mist">Bulk attendance marking, weighted grade entries, and summary averages.</p>

          {canManage ? (
            <div className="mt-3 space-y-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-mist">Attendance date</label>
                <input
                  type="date"
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm"
                  value={attendanceDate}
                  onChange={(event) => setAttendanceDate(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                {rosterQuery.data?.roster.map((member) => (
                  <div key={member.childId} className="grid items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 md:grid-cols-3">
                    <p className="text-xs text-white">{member.childName}</p>
                    <select
                      className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs"
                      value={attendanceDraft[member.childId] ?? "PRESENT"}
                      onChange={(event) =>
                        setAttendanceDraft((prev) => ({
                          ...prev,
                          [member.childId]: event.target.value as (typeof attendanceStatuses)[number]
                        }))
                      }
                    >
                      {attendanceStatuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <input
                      className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs"
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      placeholder="Score"
                      value={gradeDraft[member.childId] ?? ""}
                      onChange={(event) =>
                        setGradeDraft((prev) => ({
                          ...prev,
                          [member.childId]: event.target.value
                        }))
                      }
                    />
                  </div>
                ))}
              </div>

              <div className="grid gap-2 md:grid-cols-3">
                <input
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs"
                  placeholder="Grade category"
                  value={gradeCategory}
                  onChange={(event) => setGradeCategory(event.target.value)}
                />
                <input
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs"
                  type="number"
                  min={1}
                  max={100}
                  placeholder="Weight"
                  value={gradeWeight}
                  onChange={(event) => setGradeWeight(event.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="w-full rounded-full border border-white/20 px-3 py-2 text-xs"
                    onClick={() => saveAttendanceMutation.mutate()}
                    disabled={saveAttendanceMutation.isPending || !selectedClassId}
                  >
                    Save Attendance
                  </button>
                  <button
                    type="button"
                    className="w-full rounded-full bg-aurora px-3 py-2 text-xs font-semibold text-ink disabled:opacity-50"
                    onClick={() => saveGradesMutation.mutate()}
                    disabled={saveGradesMutation.isPending || !selectedClassId}
                  >
                    Save Grades
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {canSeeChildView ? (
            <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase tracking-[0.14em] text-aurora">Attendance Overview</p>
              <p className="mt-2 text-sm text-white">
                Attendance: <strong>{attendanceQuery.data?.attendancePercent ?? 0}%</strong>
              </p>
            </div>
          ) : null}

          <div className="mt-4 space-y-2">
            {gradeSummaryQuery.data?.students.map((student) => (
              <div key={student.childId} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="text-sm text-white">{student.childName}</p>
                <p className="mt-1 text-xs text-mist">
                  Weighted average: {student.weightedAverage ?? "N/A"} | Entries: {student.entries}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {student.categories.map((category) => (
                    <span key={category.category} className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-mist">
                      {category.category}: {category.average ?? "N/A"}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>

      {classesQuery.error ? <p className="text-sm text-red-300">{classesQuery.error.message}</p> : null}
      {staffQuery.error ? <p className="text-sm text-red-300">{staffQuery.error.message}</p> : null}
      {saveAttendanceMutation.error ? <p className="text-sm text-red-300">{saveAttendanceMutation.error.message}</p> : null}
      {saveGradesMutation.error ? <p className="text-sm text-red-300">{saveGradesMutation.error.message}</p> : null}
    </section>
  );
}
