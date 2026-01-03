import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DerivedTask, Metrics, Task } from '@/types';
import {
  computeAverageROI,
  computePerformanceGrade,
  computeRevenuePerHour,
  computeTimeEfficiency,
  computeTotalRevenue,
  withDerived,
  sortTasks as sortDerived,
} from '@/utils/logic';
import { generateSalesTasks } from '@/utils/seed';

interface UseTasksState {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  derivedSorted: DerivedTask[];
  metrics: Metrics;
  lastDeleted: Task | null;

  addTask: (
    task: Omit<Task, 'id' | 'createdAt' | 'completedAt'> & { id?: string }
  ) => void;

  updateTask: (id: string, patch: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  undoDelete: () => void;
  clearLastDeleted: () => void;
}

const INITIAL_METRICS: Metrics = {
  totalRevenue: 0,
  totalTimeTaken: 0,
  timeEfficiencyPct: 0,
  revenuePerHour: 0,
  averageROI: 0,
  performanceGrade: 'Needs Improvement',
};

export function useTasks(): UseTasksState {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastDeleted, setLastDeleted] = useState<Task | null>(null);
  const fetchedRef = useRef(false);

  function normalizeTasks(input: any[]): Task[] {
    const now = Date.now();
    return (Array.isArray(input) ? input : []).map((t, idx) => {
      const created = t.createdAt
        ? new Date(t.createdAt)
        : new Date(now - (idx + 1) * 24 * 3600 * 1000);

      const completed =
        t.completedAt ||
        (t.status === 'Done'
          ? new Date(created.getTime() + 24 * 3600 * 1000).toISOString()
          : undefined);

      return {
        id: t.id,
        title: t.title,
        revenue: Number(t.revenue) ?? 0,
        timeTaken: Number(t.timeTaken) > 0 ? Number(t.timeTaken) : 1,
        priority: t.priority,
        status: t.status,
        notes: t.notes,
        createdAt: created.toISOString(),
        completedAt: completed,
      } as Task;
    });
  }

  useEffect(() => {
    let mounted = true;
  
    async function load() {
      if (fetchedRef.current) {
        if (mounted) setLoading(false); // ✅ FIX
        return;
      }
  
      fetchedRef.current = true;
  
      try {
        const res = await fetch('/tasks.json');
        if (!res.ok) throw new Error('Failed to load tasks.json');
        const data = await res.json();
        const normalized = normalizeTasks(data);
        const finalData =
          normalized.length > 0 ? normalized : generateSalesTasks(50);
        if (mounted) setTasks(finalData);
      } catch (e: any) {
        if (mounted) setError(e?.message ?? 'Failed to load tasks');
      } finally {
        if (mounted) setLoading(false);
      }
    }
  
    load();
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    let mounted = true;
  
    async function load() {
      if (fetchedRef.current) {
        if (mounted) setLoading(false); // ✅ FIX
        return;
      }
  
      fetchedRef.current = true;
  
      try {
        const res = await fetch('/tasks.json');
        if (!res.ok) throw new Error('Failed to load tasks.json');
        const data = await res.json();
        const normalized = normalizeTasks(data);
        const finalData =
          normalized.length > 0 ? normalized : generateSalesTasks(50);
        if (mounted) setTasks(finalData);
      } catch (e: any) {
        if (mounted) setError(e?.message ?? 'Failed to load tasks');
      } finally {
        if (mounted) setLoading(false);
      }
    }
  
    load();
    return () => {
      mounted = false;
    };
  }, []);    

  const derivedSorted = useMemo(() => {
    return sortDerived(tasks.map(withDerived));
  }, [tasks]);

  const metrics = useMemo(() => {
    if (!tasks.length) return INITIAL_METRICS;

    const totalRevenue = computeTotalRevenue(tasks);
    const totalTimeTaken = tasks.reduce((s, t) => s + t.timeTaken, 0);
    const timeEfficiencyPct = computeTimeEfficiency(tasks);
    const revenuePerHour = computeRevenuePerHour(tasks);
    const averageROI = computeAverageROI(tasks);
    const performanceGrade = computePerformanceGrade(averageROI);

    return {
      totalRevenue,
      totalTimeTaken,
      timeEfficiencyPct,
      revenuePerHour,
      averageROI,
      performanceGrade,
    };
  }, [tasks]);

  const addTask = useCallback(
    (task: Omit<Task, 'id' | 'createdAt' | 'completedAt'> & { id?: string }) => {
      setTasks(prev => {
        const id = task.id ?? crypto.randomUUID();
        const createdAt = new Date().toISOString();
        const completedAt =
          task.status === 'Done' ? createdAt : undefined;

        return [
          ...prev,
          {
            ...task,
            id,
            createdAt,
            completedAt,
            timeTaken: task.timeTaken > 0 ? task.timeTaken : 1,
          },
        ];
      });
    },
    []
  );

  const updateTask = useCallback((id: string, patch: Partial<Task>) => {
    setTasks(prev =>
      prev.map(t => {
        if (t.id !== id) return t;
        const updated = { ...t, ...patch };
        if (t.status !== 'Done' && updated.status === 'Done') {
          updated.completedAt = new Date().toISOString();
        }
        return updated;
      })
    );
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks(prev => {
      const target = prev.find(t => t.id === id) || null;
      setLastDeleted(target);
      return prev.filter(t => t.id !== id);
    });
  }, []);

  const undoDelete = useCallback(() => {
    if (!lastDeleted) return;
    setTasks(prev => [...prev, lastDeleted]);
    setLastDeleted(null);
  }, [lastDeleted]);

  const clearLastDeleted = useCallback(() => {
    setLastDeleted(null);
  }, []);

  return {
    tasks,
    loading,
    error,
    derivedSorted,
    metrics,
    lastDeleted,
    addTask,
    updateTask,
    deleteTask,
    undoDelete,
    clearLastDeleted,
  };
}
