import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMutation, useQuery } from "@tanstack/react-query";
import { isAdminRole, isFamilyRole } from "@projectm/contracts";
import { useEffect, useMemo, useState } from "react";
import { RoleBadge } from "../components/RoleBadge";
import { api } from "../lib/api";
import { useAuthStore } from "../store/auth-store";
const attendanceStatuses = ["PRESENT", "TARDY", "ABSENT", "EXCUSED"];
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
    const [attendanceDraft, setAttendanceDraft] = useState({});
    const [gradeCategory, setGradeCategory] = useState("PROJECT");
    const [gradeWeight, setGradeWeight] = useState("30");
    const [gradeDraft, setGradeDraft] = useState({});
    const [submissionDraft, setSubmissionDraft] = useState({});
    const staffQuery = useQuery({
        queryKey: ["staff-roster", token],
        queryFn: () => api("/support/staff", { token: token ?? undefined }),
        enabled: Boolean(token)
    });
    const classesQuery = useQuery({
        queryKey: ["classroom-classes", token],
        queryFn: () => api("/classes", { token: token ?? undefined }),
        enabled: Boolean(token)
    });
    const familyQuery = useQuery({
        queryKey: ["family-profile", token],
        queryFn: () => api("/families/me", { token: token ?? undefined }),
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
        queryFn: () => api(`/classes/${selectedClassId}/roster`, {
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
            for (const member of rosterQuery.data.roster) {
                if (!next[member.childId]) {
                    next[member.childId] = "PRESENT";
                }
            }
            return next;
        });
    }, [rosterQuery.data]);
    const assignmentsQuery = useQuery({
        queryKey: ["classroom-assignments", selectedClassId, token],
        queryFn: () => api(`/classes/${selectedClassId}/assignments`, {
            token: token ?? undefined
        }),
        enabled: Boolean(token && selectedClassId)
    });
    const childAssignmentsQuery = useQuery({
        queryKey: ["child-assignments", selectedChildId, token],
        queryFn: () => api(`/children/${selectedChildId}/assignments`, {
            token: token ?? undefined
        }),
        enabled: Boolean(token && selectedChildId && canSeeChildView)
    });
    const attendanceQuery = useQuery({
        queryKey: ["child-attendance", selectedChildId, token],
        queryFn: () => api(`/children/${selectedChildId}/attendance`, {
            token: token ?? undefined
        }),
        enabled: Boolean(token && selectedChildId && canSeeChildView)
    });
    const gradeSummaryQuery = useQuery({
        queryKey: ["grade-summary", selectedClassId, token],
        queryFn: () => api(`/gradebook/${selectedClassId}/summary`, {
            token: token ?? undefined
        }),
        enabled: Boolean(token && selectedClassId)
    });
    const createClassMutation = useMutation({
        mutationFn: () => api("/classes", {
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
        mutationFn: () => api(`/classes/${selectedClassId}/assignments`, {
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
        mutationFn: ({ assignmentId, isPublished }) => api(`/assignments/${assignmentId}/publish`, {
            method: "PATCH",
            token: token ?? undefined,
            body: JSON.stringify({ isPublished })
        }),
        onSuccess: () => {
            void assignmentsQuery.refetch();
        }
    });
    const submitAssignmentMutation = useMutation({
        mutationFn: ({ assignmentId, childId, content }) => api(`/assignments/${assignmentId}/submissions`, {
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
        mutationFn: () => api("/attendance/mark-bulk", {
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
        mutationFn: () => api(`/gradebook/${selectedClassId}/bulk-entry`, {
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
    return (_jsxs("section", { className: "space-y-6", children: [_jsxs("header", { className: "space-y-2", children: [_jsx("h1", { className: "font-display text-3xl text-white md:text-4xl", children: "Classroom Mechanics Center" }), _jsx("p", { className: "text-sm text-mist", children: "Google Classroom-style assignment workflows with PowerSchool-style attendance and weighted gradebook controls." })] }), _jsxs("article", { className: "panel rounded-2xl p-5", children: [_jsxs("div", { className: "mb-3 flex items-center justify-between", children: [_jsx("h2", { className: "font-display text-lg text-white", children: "Staff Roster" }), _jsx("span", { className: "text-xs text-mist", children: "Every staff role has a unique color badge." })] }), _jsx("div", { className: "grid gap-2 md:grid-cols-2 xl:grid-cols-3", children: staffQuery.data?.staff.map((member) => (_jsxs("div", { className: "rounded-xl border border-white/10 bg-white/5 px-3 py-2", children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsxs("p", { className: "text-sm text-white", children: [member.firstName, " ", member.lastName] }), _jsx(RoleBadge, { role: member.role, compact: true })] }), _jsx("p", { className: "mt-1 text-xs text-mist", children: member.email })] }, member.id))) })] }), _jsxs("article", { className: "panel rounded-2xl p-5", children: [_jsx("h2", { className: "font-display text-lg text-white", children: "Classroom Selector" }), _jsxs("div", { className: "mt-3 grid gap-3 md:grid-cols-2", children: [_jsxs("select", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", value: selectedClassId, onChange: (event) => setSelectedClassId(event.target.value), children: [_jsx("option", { value: "", children: "Select class" }), classesQuery.data?.classes.map((item) => (_jsxs("option", { value: item.id, children: [item.name, " (", item.enrollmentCount, " students)"] }, item.id)))] }), canSeeChildView ? (_jsxs("select", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", value: selectedChildId, onChange: (event) => setSelectedChildId(event.target.value), children: [_jsx("option", { value: "", children: "Select child" }), familyQuery.data?.children.map((child) => (_jsxs("option", { value: child.id, children: [child.firstName, " ", child.lastName] }, child.id)))] })) : (_jsxs("div", { className: "rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-mist", children: ["Active class: ", className] }))] }), canManage ? (_jsxs("div", { className: "mt-4 grid gap-2 rounded-xl border border-white/10 bg-white/5 p-3 md:grid-cols-3", children: [_jsx("input", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", placeholder: "New class name", value: classDraft.name, onChange: (event) => setClassDraft((prev) => ({ ...prev, name: event.target.value })) }), _jsx("input", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", placeholder: "Description", value: classDraft.description, onChange: (event) => setClassDraft((prev) => ({ ...prev, description: event.target.value })) }), _jsx("button", { className: "rounded-full bg-aurora px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50", onClick: () => createClassMutation.mutate(), disabled: createClassMutation.isPending || !classDraft.name.trim(), type: "button", children: createClassMutation.isPending ? "Creating..." : "Create Class" })] })) : null] }), _jsxs("div", { className: "grid gap-6 xl:grid-cols-2", children: [_jsxs("article", { className: "panel rounded-2xl p-5", children: [_jsx("h2", { className: "font-display text-lg text-white", children: "Google Classroom Mechanics" }), _jsx("p", { className: "mt-1 text-xs text-mist", children: "Assignments, publishing, submissions, and deadlines." }), canManage ? (_jsxs("div", { className: "mt-3 grid gap-2 rounded-xl border border-white/10 bg-white/5 p-3", children: [_jsx("input", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", placeholder: "Assignment title", value: assignmentDraft.title, onChange: (event) => setAssignmentDraft((prev) => ({ ...prev, title: event.target.value })) }), _jsx("textarea", { className: "min-h-20 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", placeholder: "Instructions", value: assignmentDraft.description, onChange: (event) => setAssignmentDraft((prev) => ({ ...prev, description: event.target.value })) }), _jsxs("div", { className: "grid gap-2 md:grid-cols-2", children: [_jsx("input", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", type: "datetime-local", value: assignmentDraft.dueAt, onChange: (event) => setAssignmentDraft((prev) => ({ ...prev, dueAt: event.target.value })) }), _jsxs("label", { className: "flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-mist", children: [_jsx("input", { type: "checkbox", checked: assignmentDraft.isPublished, onChange: (event) => setAssignmentDraft((prev) => ({ ...prev, isPublished: event.target.checked })) }), "Publish now"] })] }), _jsx("button", { type: "button", className: "rounded-full bg-aurora px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50", disabled: createAssignmentMutation.isPending || !selectedClassId || !assignmentDraft.title.trim(), onClick: () => createAssignmentMutation.mutate(), children: createAssignmentMutation.isPending ? "Posting..." : "Post Assignment" })] })) : null, _jsx("div", { className: "mt-4 space-y-2", children: assignmentsQuery.data?.assignments.map((assignment) => (_jsxs("div", { className: "rounded-xl border border-white/10 bg-white/5 p-3", children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx("p", { className: "text-sm font-semibold text-white", children: assignment.title }), _jsx("span", { className: assignment.isPublished ? "text-xs text-aurora" : "text-xs text-amber-300", children: assignment.isPublished ? "PUBLISHED" : "DRAFT" })] }), _jsx("p", { className: "mt-1 text-xs text-mist", children: assignment.description || "No description" }), _jsxs("p", { className: "mt-2 text-[11px] text-mist", children: ["Due: ", assignment.dueAt ? new Date(assignment.dueAt).toLocaleString() : "No due date", " | Submissions:", " ", assignment.submissionCount] }), canManage ? (_jsx("button", { type: "button", className: "mt-2 rounded-full border border-white/20 px-3 py-1 text-xs", onClick: () => publishAssignmentMutation.mutate({
                                                assignmentId: assignment.id,
                                                isPublished: !assignment.isPublished
                                            }), children: assignment.isPublished ? "Unpublish" : "Publish" })) : null] }, assignment.id))) }), canSeeChildView ? (_jsxs("div", { className: "mt-4 rounded-xl border border-white/10 bg-white/5 p-3", children: [_jsx("p", { className: "text-xs uppercase tracking-[0.14em] text-aurora", children: "Child Assignment Submission" }), _jsx("div", { className: "mt-2 space-y-2", children: childAssignmentsQuery.data?.assignments.map((item) => (_jsxs("div", { className: "rounded-xl border border-white/10 bg-white/5 p-3", children: [_jsxs("p", { className: "text-sm text-white", children: [item.className, " \u2022 ", item.title] }), _jsx("p", { className: "mt-1 text-xs text-mist", children: item.description || "No instructions" }), item.submission ? (_jsxs("p", { className: "mt-1 text-xs text-aurora", children: ["Submitted \u2022 Score: ", item.submission.score ?? "Pending"] })) : null, _jsx("textarea", { className: "mt-2 min-h-16 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", placeholder: "Submit work update", value: submissionDraft[item.assignmentId] ?? "", onChange: (event) => setSubmissionDraft((prev) => ({
                                                        ...prev,
                                                        [item.assignmentId]: event.target.value
                                                    })) }), _jsx("button", { className: "mt-2 rounded-full bg-aurora px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-50", type: "button", onClick: () => submitAssignmentMutation.mutate({
                                                        assignmentId: item.assignmentId,
                                                        childId: selectedChildId,
                                                        content: submissionDraft[item.assignmentId] ?? ""
                                                    }), disabled: !selectedChildId || !(submissionDraft[item.assignmentId] ?? "").trim(), children: "Submit Assignment Work" })] }, item.assignmentId))) })] })) : null] }), _jsxs("article", { className: "panel rounded-2xl p-5", children: [_jsx("h2", { className: "font-display text-lg text-white", children: "PowerSchool Mechanics" }), _jsx("p", { className: "mt-1 text-xs text-mist", children: "Bulk attendance marking, weighted grade entries, and summary averages." }), canManage ? (_jsxs("div", { className: "mt-3 space-y-3 rounded-xl border border-white/10 bg-white/5 p-3", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("label", { className: "text-xs text-mist", children: "Attendance date" }), _jsx("input", { type: "date", className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm", value: attendanceDate, onChange: (event) => setAttendanceDate(event.target.value) })] }), _jsx("div", { className: "space-y-2", children: rosterQuery.data?.roster.map((member) => (_jsxs("div", { className: "grid items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 md:grid-cols-3", children: [_jsx("p", { className: "text-xs text-white", children: member.childName }), _jsx("select", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs", value: attendanceDraft[member.childId] ?? "PRESENT", onChange: (event) => setAttendanceDraft((prev) => ({
                                                        ...prev,
                                                        [member.childId]: event.target.value
                                                    })), children: attendanceStatuses.map((status) => (_jsx("option", { value: status, children: status }, status))) }), _jsx("input", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs", type: "number", min: 0, max: 100, step: "0.1", placeholder: "Score", value: gradeDraft[member.childId] ?? "", onChange: (event) => setGradeDraft((prev) => ({
                                                        ...prev,
                                                        [member.childId]: event.target.value
                                                    })) })] }, member.childId))) }), _jsxs("div", { className: "grid gap-2 md:grid-cols-3", children: [_jsx("input", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs", placeholder: "Grade category", value: gradeCategory, onChange: (event) => setGradeCategory(event.target.value) }), _jsx("input", { className: "rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs", type: "number", min: 1, max: 100, placeholder: "Weight", value: gradeWeight, onChange: (event) => setGradeWeight(event.target.value) }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "button", className: "w-full rounded-full border border-white/20 px-3 py-2 text-xs", onClick: () => saveAttendanceMutation.mutate(), disabled: saveAttendanceMutation.isPending || !selectedClassId, children: "Save Attendance" }), _jsx("button", { type: "button", className: "w-full rounded-full bg-aurora px-3 py-2 text-xs font-semibold text-ink disabled:opacity-50", onClick: () => saveGradesMutation.mutate(), disabled: saveGradesMutation.isPending || !selectedClassId, children: "Save Grades" })] })] })] })) : null, canSeeChildView ? (_jsxs("div", { className: "mt-3 rounded-xl border border-white/10 bg-white/5 p-3", children: [_jsx("p", { className: "text-xs uppercase tracking-[0.14em] text-aurora", children: "Attendance Overview" }), _jsxs("p", { className: "mt-2 text-sm text-white", children: ["Attendance: ", _jsxs("strong", { children: [attendanceQuery.data?.attendancePercent ?? 0, "%"] })] })] })) : null, _jsx("div", { className: "mt-4 space-y-2", children: gradeSummaryQuery.data?.students.map((student) => (_jsxs("div", { className: "rounded-xl border border-white/10 bg-white/5 p-3", children: [_jsx("p", { className: "text-sm text-white", children: student.childName }), _jsxs("p", { className: "mt-1 text-xs text-mist", children: ["Weighted average: ", student.weightedAverage ?? "N/A", " | Entries: ", student.entries] }), _jsx("div", { className: "mt-1 flex flex-wrap gap-1", children: student.categories.map((category) => (_jsxs("span", { className: "rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-mist", children: [category.category, ": ", category.average ?? "N/A"] }, category.category))) })] }, student.childId))) })] })] }), classesQuery.error ? _jsx("p", { className: "text-sm text-red-300", children: classesQuery.error.message }) : null, staffQuery.error ? _jsx("p", { className: "text-sm text-red-300", children: staffQuery.error.message }) : null, saveAttendanceMutation.error ? _jsx("p", { className: "text-sm text-red-300", children: saveAttendanceMutation.error.message }) : null, saveGradesMutation.error ? _jsx("p", { className: "text-sm text-red-300", children: saveGradesMutation.error.message }) : null] }));
}
