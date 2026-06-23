export type Role = "OWNER" | "REVIEWER" | "VIEWER";
export type WorkflowStatus = "OPEN" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "MERGED";

export type User = {
  id: string;
  name: string;
  email: string;
};

export type DocumentSummary = {
  id: string;
  title: string;
  language: string;
  updatedAt: string;
  role: Role;
  status: WorkflowStatus;
  ownerName: string;
  contributors: number;
  activeUsers: PresenceUser[];
  lastEditedLabel: string;
  comments: number;
  suggestions: number;
  approvalRate: number;
  avgResolutionTime: string;
};

export type ReviewComment = {
  id: string;
  authorName: string;
  line: number;
  body: string;
  resolved: boolean;
  createdAt: string;
};

export type Suggestion = {
  id: string;
  authorName: string;
  reviewerName?: string;
  reason?: string;
  startLine: number;
  endLine: number;
  replacementText: string;
  status: "OPEN" | "APPROVED" | "REJECTED";
  createdAt: string;
};

export type Version = {
  id: string;
  label: string;
  content: string;
  createdAt: string;
  authorName?: string;
  commitMessage?: string;
};

export type ActivityEvent = {
  id: string;
  actorName: string;
  action: string;
  target: string;
  createdAt: string;
};

export type DocumentDetail = {
  id: string;
  title: string;
  language: string;
  content: string;
  role: Role;
  status: WorkflowStatus;
  ownerName: string;
  contributors: number;
  activeUsers: PresenceUser[];
  lastEditedLabel: string;
  approvalRate: number;
  avgResolutionTime: string;
  comments: ReviewComment[];
  suggestions: Suggestion[];
  versions: Version[];
  activity: ActivityEvent[];
};

export type PresenceUser = {
  id: string;
  name: string;
  color: string;
  mode?: "editing" | "viewing";
  line?: number;
  column?: number;
};
