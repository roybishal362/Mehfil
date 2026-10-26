/** Adding, editing and removing tasks. A task's lead time always follows its due date. */
import { LIMITS, type EventPlan, type Task } from '../../schemas/plan';
import { diffDays } from '../../utils/dates';
import { ensureRoom, removeById, replaceById, type ApplyContext, type Op } from './core';

/** How far before (positive) or after (negative) the event a task may sit, in days. */
const clampLead = (days: number) => Math.min(730, Math.max(-90, days));

export function addTask(plan: EventPlan, op: Op<'task.add'>, ctx: ApplyContext): EventPlan {
  ensureRoom(plan.tasks.length, 1, LIMITS.tasks, 'tasks');
  const task: Task = {
    id: ctx.makeId('task'),
    title: op.task.title,
    ...(op.task.notes ? { notes: op.task.notes } : {}),
    dueDate: op.task.dueDate,
    daysBefore: clampLead(diffDays(plan.brief.date, op.task.dueDate)),
    priority: op.task.priority,
    status: 'todo',
    category: op.task.category,
    compressed: false,
    source: ctx.source,
  };
  return { ...plan, tasks: [...plan.tasks, task] };
}

export function updateTask(plan: EventPlan, op: Op<'task.update'>): EventPlan {
  const { dueDate } = op.patch;
  // A new due date is the user's choice, so the task is no longer "brought forward".
  const lead = dueDate
    ? { daysBefore: clampLead(diffDays(plan.brief.date, dueDate)), compressed: false }
    : {};
  return {
    ...plan,
    tasks: replaceById(plan.tasks, op.id, 'Task', (task) => ({ ...task, ...op.patch, ...lead })),
  };
}

export function removeTask(plan: EventPlan, op: Op<'task.remove'>): EventPlan {
  return { ...plan, tasks: removeById(plan.tasks, op.id, 'Task') };
}
