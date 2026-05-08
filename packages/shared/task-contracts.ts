export const CONTRACT_VERSION = "v1";

export type TaskStatus = "todo" | "in_progress" | "done";

export interface Task {
  id: string;
  title: string;
  description?: string;
  assignee?: string;
  dueDate?: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  assignee?: string;
  dueDate?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  assignee?: string;
  dueDate?: string;
  status?: TaskStatus;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface ApiHealthResponse {
  status: "ok";
  contractVersion: typeof CONTRACT_VERSION;
}

export interface ListTasksResponse {
  tasks: Task[];
}

export type GetTaskResponse = Task | ErrorResponse;
export type CreateTaskResponse = Task | ErrorResponse;
export type UpdateTaskResponse = Task | ErrorResponse;
export type DeleteTaskResponse = { success: true } | ErrorResponse;
