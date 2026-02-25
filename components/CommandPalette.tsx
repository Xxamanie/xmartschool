import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { api } from '../services/api';
import { LiveClass, School, Student, Subject, User, UserRole } from '../types';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  user?: User | null;
}

type CommandItem = {
  id: string;
  title: string;
  subtitle: string;
  path: string;
  roles?: UserRole[];
};

type IndexedItem = {
  id: string;
  title: string;
  subtitle: string;
  path: string;
  type: 'student' | 'teacher' | 'subject' | 'class' | 'school' | 'live_class';
  roles?: UserRole[];
  keywords: string;
};

type PaletteResult = {
  id: string;
  title: string;
  subtitle: string;
  path: string;
  group: 'Commands' | 'Students' | 'Teachers' | 'Subjects' | 'Classes' | 'Schools' | 'Live Classes';
  score: number;
};

const COMMANDS: CommandItem[] = [
  { id: 'dashboard', title: 'Open Dashboard', subtitle: 'Overview and priorities', path: '/' },
  { id: 'students', title: 'Manage Students', subtitle: 'Add, update, or remove learners', path: '/students', roles: [UserRole.ADMIN, UserRole.TEACHER] },
  { id: 'create-student', title: 'Create Student', subtitle: 'Quick action: open Add Student form', path: '/students?quick=create-student', roles: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
  { id: 'teachers', title: 'Manage Teachers', subtitle: 'Staff records and assignments', path: '/teachers', roles: [UserRole.ADMIN, UserRole.TEACHER] },
  { id: 'create-teacher', title: 'Create Teacher', subtitle: 'Quick action: open Add Teacher form', path: '/teachers?quick=create-teacher', roles: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
  { id: 'classes', title: 'Open Classes', subtitle: 'Class structure and enrollment', path: '/classes', roles: [UserRole.ADMIN, UserRole.TEACHER] },
  { id: 'create-class', title: 'Create Class', subtitle: 'Quick action: open class creation form', path: '/classes?quick=create-class', roles: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
  { id: 'subjects', title: 'Open Subjects', subtitle: 'Curriculum and subject ownership', path: '/subjects', roles: [UserRole.ADMIN, UserRole.TEACHER] },
  { id: 'enroll-subjects', title: 'Enroll Subjects', subtitle: 'Quick action: open curriculum enrollment', path: '/subjects?quick=enroll-subjects', roles: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
  { id: 'attendance', title: 'Take Attendance', subtitle: 'Daily presence tracking', path: '/attendance', roles: [UserRole.ADMIN, UserRole.TEACHER] },
  { id: 'assessments', title: 'Open Assessments', subtitle: 'Continuous assessment workflow', path: '/assessments', roles: [UserRole.ADMIN, UserRole.TEACHER] },
  { id: 'results', title: 'Publish Results', subtitle: 'Result computation and release', path: '/results', roles: [UserRole.ADMIN, UserRole.TEACHER] },
  { id: 'scheme', title: 'Scheme Of Work', subtitle: 'Plan and track scheme coverage', path: '/scheme-of-work', roles: [UserRole.ADMIN, UserRole.TEACHER] },
  { id: 'live', title: 'Open Live Classes', subtitle: 'Classroom sessions and recordings', path: '/live-classes' },
  { id: 'schools', title: 'Schools Registry', subtitle: 'Global school management', path: '/schools', roles: [UserRole.SUPER_ADMIN] },
  { id: 'portal', title: 'Student Portal', subtitle: 'Check result slip and summary', path: '/student-portal', roles: [UserRole.STUDENT] },
  { id: 'settings', title: 'Open Settings', subtitle: 'Profile and platform preferences', path: '/settings' },
];

const GROUP_ORDER: PaletteResult['group'][] = ['Commands', 'Students', 'Teachers', 'Subjects', 'Classes', 'Schools', 'Live Classes'];

const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, ' ').trim();

const buildFuzzyMatchIndexes = (text: string, query: string): Set<number> => {
  const matches = new Set<number>();
  if (!query) return matches;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  let cursor = 0;
  for (const ch of lowerQuery) {
    if (ch === ' ') continue;
    const found = lowerText.indexOf(ch, cursor);
    if (found === -1) return new Set<number>();
    matches.add(found);
    cursor = found + 1;
  }
  return matches;
};

const renderHighlightedText = (text: string, query: string) => {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return text;

  const lowerText = text.toLowerCase();
  const exactIndex = lowerText.indexOf(normalizedQuery);
  if (exactIndex >= 0) {
    const before = text.slice(0, exactIndex);
    const match = text.slice(exactIndex, exactIndex + normalizedQuery.length);
    const after = text.slice(exactIndex + normalizedQuery.length);
    return (
      <>
        {before}
        <span className="bg-indigo-100 text-indigo-700 rounded px-0.5">{match}</span>
        {after}
      </>
    );
  }

  const fuzzyIndexes = buildFuzzyMatchIndexes(text, normalizedQuery);
  if (fuzzyIndexes.size === 0) return text;

  return (
    <>
      {text.split('').map((ch, index) =>
        fuzzyIndexes.has(index) ? (
          <span key={`${ch}-${index}`} className="bg-indigo-100 text-indigo-700 rounded px-0.5">
            {ch}
          </span>
        ) : (
          <span key={`${ch}-${index}`}>{ch}</span>
        ),
      )}
    </>
  );
};

const fuzzyScore = (text: string, query: string): number => {
  const t = normalize(text);
  const q = normalize(query);
  if (!q) return 0;

  const exactIndex = t.indexOf(q);
  if (exactIndex >= 0) return 1000 - exactIndex;

  let textIndex = 0;
  let streak = 0;
  let score = 0;

  for (const char of q) {
    if (char === ' ') continue;
    const foundAt = t.indexOf(char, textIndex);
    if (foundAt === -1) return -1;

    const jump = foundAt - textIndex;
    streak = jump === 0 ? streak + 1 : 1;
    score += 8 + streak * 2 - Math.min(jump, 6);
    textIndex = foundAt + 1;
  }
  return score;
};

const toGroup = (type: IndexedItem['type']): PaletteResult['group'] => {
  if (type === 'student') return 'Students';
  if (type === 'teacher') return 'Teachers';
  if (type === 'subject') return 'Subjects';
  if (type === 'class') return 'Classes';
  if (type === 'school') return 'Schools';
  return 'Live Classes';
};

export const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onClose, user }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loadingIndex, setLoadingIndex] = useState(false);
  const [indexedItems, setIndexedItems] = useState<IndexedItem[]>([]);
  const role = user?.role;

  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [open]);

  useEffect(() => {
    const loadIndex = async () => {
      if (!open || !role || role === UserRole.STUDENT) return;
      setLoadingIndex(true);
      try {
        const [schoolsRes, usersRes, studentsRes, subjectsRes, liveClassesRes] = await Promise.all([
          api.getSchools(),
          api.getAllUsers(),
          api.getStudents(user?.schoolId),
          api.getSubjects(),
          api.getLiveClasses(),
        ]);

        const schools = schoolsRes.ok ? schoolsRes.data : [];
        const users = usersRes.ok ? usersRes.data : [];
        const students = studentsRes.ok ? studentsRes.data : [];
        const subjects = subjectsRes.ok ? subjectsRes.data : [];
        const liveClasses = liveClassesRes.ok ? liveClassesRes.data : [];

        const schoolMap = new Map<string, School>();
        schools.forEach((school) => schoolMap.set(school.id, school));

        const usersByRole = users.filter((entry) => {
          if (entry.role !== UserRole.TEACHER && entry.role !== UserRole.ADMIN) return false;
          if (role === UserRole.SUPER_ADMIN) return true;
          return !!user?.schoolId && entry.schoolId === user.schoolId;
        });

        const roleScopedStudents = students.filter((student) => role === UserRole.SUPER_ADMIN || (!!user?.schoolId && student.schoolId === user.schoolId));
        const roleScopedSubjects = subjects.filter((subject) => {
          if (role === UserRole.SUPER_ADMIN) return true;
          if (role === UserRole.TEACHER) return subject.teacherId === user?.id;
          return true;
        });
        const roleScopedLiveClasses = liveClasses.filter((liveClass) => {
          if (role === UserRole.SUPER_ADMIN) return true;
          if (role === UserRole.TEACHER) return liveClass.teacherId === user?.id;
          return true;
        });

        const studentItems: IndexedItem[] = roleScopedStudents.map((student: Student) => {
          const school = schoolMap.get(student.schoolId);
          return {
            id: `student-${student.id}`,
            title: student.name,
            subtitle: `Student | ${student.grade} | ${school?.code || 'School'}`,
            path: '/students',
            type: 'student',
            roles: [UserRole.ADMIN, UserRole.TEACHER, UserRole.SUPER_ADMIN],
            keywords: `${student.name} ${student.grade} ${student.accessCode} ${school?.name || ''} ${school?.code || ''}`.toLowerCase(),
          };
        });

        const teacherItems: IndexedItem[] = usersByRole.map((entry) => ({
          id: `teacher-${entry.id}`,
          title: entry.name,
          subtitle: `${entry.role === UserRole.ADMIN ? 'Admin' : 'Teacher'} | ${entry.email || 'No email'}`,
          path: '/teachers',
          type: 'teacher',
          roles: [UserRole.ADMIN, UserRole.TEACHER, UserRole.SUPER_ADMIN],
          keywords: `${entry.name} ${entry.email || ''} ${entry.role}`.toLowerCase(),
        }));

        const subjectItems: IndexedItem[] = roleScopedSubjects.map((subject: Subject) => ({
          id: `subject-${subject.id}`,
          title: subject.name,
          subtitle: `Subject | ${subject.schedule || 'Schedule TBD'} | ${subject.room || 'Room TBD'}`,
          path: '/subjects',
          type: 'subject',
          roles: [UserRole.ADMIN, UserRole.TEACHER, UserRole.SUPER_ADMIN],
          keywords: `${subject.name} ${subject.schedule || ''} ${subject.room || ''}`.toLowerCase(),
        }));

        const schoolItems: IndexedItem[] = schools
          .filter((school) => role === UserRole.SUPER_ADMIN || school.id === user?.schoolId)
          .map((school) => ({
            id: `school-${school.id}`,
            title: school.name,
            subtitle: `School | ${school.code} | ${school.region || 'Region N/A'}`,
            path: role === UserRole.SUPER_ADMIN ? `/schools/${school.id}` : '/',
            type: 'school',
            roles: [UserRole.ADMIN, UserRole.TEACHER, UserRole.SUPER_ADMIN],
            keywords: `${school.name} ${school.code} ${school.region || ''}`.toLowerCase(),
          }));

        let classItems: IndexedItem[] = [];
        if (user?.schoolId) {
          const classRes = await api.getSchoolClasses(user.schoolId);
          if (classRes.ok) {
            classItems = classRes.data.map((className: string) => ({
              id: `class-${className}`,
              title: className,
              subtitle: 'Class | Enrollment and structure',
              path: '/classes',
              type: 'class',
              roles: [UserRole.ADMIN, UserRole.TEACHER],
              keywords: `${className} class enrollment grade`.toLowerCase(),
            }));
          }
        }

        const liveClassItems: IndexedItem[] = roleScopedLiveClasses.map((liveClass: LiveClass) => ({
          id: `live-${liveClass.id}`,
          title: `Live Class ${liveClass.id.slice(0, 6).toUpperCase()}`,
          subtitle: `Live Class | ${liveClass.status} | ${new Date(liveClass.scheduledTime).toLocaleString()}`,
          path: '/live-classes',
          type: 'live_class',
          roles: [UserRole.ADMIN, UserRole.TEACHER, UserRole.SUPER_ADMIN],
          keywords: `${liveClass.status} live class ${liveClass.meetingLink || ''}`.toLowerCase(),
        }));

        setIndexedItems([...schoolItems, ...classItems, ...studentItems, ...teacherItems, ...subjectItems, ...liveClassItems]);
      } catch (error) {
        console.error('Failed to build global search index', error);
        setIndexedItems([]);
      } finally {
        setLoadingIndex(false);
      }
    };

    loadIndex();
  }, [open, role, user?.id, user?.schoolId]);

  const visibleResults = useMemo(() => {
    const filteredByRole = COMMANDS.filter((command) => !command.roles || (role && command.roles.includes(role)));
    const q = normalize(query);

    const commandResults: PaletteResult[] = filteredByRole
      .map((command) => ({
        id: command.id,
        title: command.title,
        subtitle: command.subtitle,
        path: command.path,
        group: 'Commands' as const,
        score: q ? fuzzyScore(`${command.title} ${command.subtitle}`, q) : 1,
      }))
      .filter((result) => result.score >= 0);

    const indexedResults: PaletteResult[] = indexedItems
      .filter((item) => !item.roles || (role && item.roles.includes(role)))
      .map((item) => {
        const score = q
          ? Math.max(
              fuzzyScore(item.title, q) + 40,
              fuzzyScore(item.subtitle, q) + 15,
              fuzzyScore(item.keywords, q),
            )
          : 1;
        return {
          id: item.id,
          title: item.title,
          subtitle: item.subtitle,
          path: item.path,
          group: toGroup(item.type),
          score,
        };
      })
      .filter((result) => result.score >= 0);

    if (!q) {
      return [...commandResults, ...indexedResults.sort((a, b) => a.title.localeCompare(b.title)).slice(0, 12)];
    }

    return [...commandResults, ...indexedResults]
      .sort((a, b) => b.score - a.score)
      .slice(0, 36);
  }, [query, role, indexedItems]);

  const groupedResults = useMemo(() => {
    const buckets = new Map<PaletteResult['group'], PaletteResult[]>();
    GROUP_ORDER.forEach((group) => buckets.set(group, []));
    visibleResults.forEach((result) => {
      buckets.get(result.group)?.push(result);
    });
    return GROUP_ORDER
      .map((group) => ({ group, items: buckets.get(group) || [] }))
      .filter((section) => section.items.length > 0);
  }, [visibleResults]);

  const flattenedResults = useMemo(() => groupedResults.flatMap((section) => section.items), [groupedResults]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, groupedResults.length]);

  const activateResult = (index: number) => {
    const item = flattenedResults[index];
    if (!item) return;
    navigate(item.path);
    onClose();
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, Math.max(flattenedResults.length - 1, 0)));
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      activateResult(selectedIndex);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-start justify-center p-4 pt-24" onClick={onClose}>
      <div className="w-full max-w-2xl bg-white rounded-2xl border border-gray-200 shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3">
          <Search size={18} className="text-gray-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="Jump to anything..."
            className="w-full text-sm text-gray-800 placeholder-gray-400 bg-transparent outline-none"
          />
          <button className="text-xs text-gray-500 border border-gray-200 rounded px-2 py-1">Esc</button>
        </div>
        <div className="max-h-[420px] overflow-y-auto p-2">
          {loadingIndex && query.trim() ? (
            <div className="px-3 py-8 text-center text-sm text-gray-500">Building search index...</div>
          ) : flattenedResults.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-gray-500">No matching commands or records.</div>
          ) : (
            <div className="space-y-2">
              {(() => {
                let runningIndex = 0;
                return groupedResults.map((section) => {
                  const sectionStart = runningIndex;
                  runningIndex += section.items.length;
                  return (
                    <div key={section.group}>
                      <p className="px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-gray-500">{section.group}</p>
                      <ul className="space-y-1">
                        {section.items.map((result, localIndex) => {
                          const globalIndex = sectionStart + localIndex;
                          return (
                            <li key={result.id}>
                              <button
                                className={`w-full text-left px-3 py-3 rounded-lg transition-colors ${selectedIndex === globalIndex ? 'bg-indigo-50 border border-indigo-100' : 'hover:bg-gray-50 border border-transparent'}`}
                                onMouseEnter={() => setSelectedIndex(globalIndex)}
                                onClick={() => activateResult(globalIndex)}
                              >
                                <p className="text-sm font-semibold text-gray-900">{renderHighlightedText(result.title, query)}</p>
                                <p className="text-xs text-gray-500">{renderHighlightedText(result.subtitle, query)}</p>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
