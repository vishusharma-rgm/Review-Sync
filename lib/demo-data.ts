import type { DocumentDetail, DocumentSummary, User } from "@/lib/types";

const now = new Date();
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString();
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

export const demoUser: User = {
  id: "user-current",
  name: "Project Lead",
  email: "lead@reviewsync.dev"
};

export const demoDocuments: DocumentDetail[] = [
  {
    id: "doc-auth-review",
    title: "access-policy.ts",
    language: "typescript",
    ownerName: "Platform Team",
    role: "OWNER",
    status: "IN_REVIEW",
    contributors: 4,
    activeUsers: [
      { id: "user-current", name: "Vishu", color: "#14b8a6", mode: "editing", line: 6, column: 12 },
      { id: "user-rahul", name: "Rahul", color: "#60a5fa", mode: "viewing", line: 10, column: 3 },
      { id: "user-aman", name: "Aman", color: "#f59e0b", mode: "editing", line: 4, column: 18 }
    ],
    lastEditedLabel: "3 min ago",
    approvalRate: 82,
    avgResolutionTime: "18m",
    content: `import { NextRequest } from "next/server";

export function requireRole(request: NextRequest, allowedRoles: string[]) {
  const role = request.headers.get("x-review-role");

  if (!role || !allowedRoles.includes(role)) {
    throw new Error("Forbidden");
  }

  return role;
}
`,
    comments: [
      {
        id: "comment-1",
        authorName: "Security Review",
        line: 4,
        body: "Validate the role source before using it for access decisions.",
        resolved: false,
        createdAt: minutesAgo(15)
      }
    ],
    suggestions: [
      {
        id: "suggestion-1",
        authorName: "Backend Review",
        reviewerName: "Rahul",
        reason: "Security vulnerability",
        startLine: 6,
        endLine: 6,
        replacementText: `    throw new Response("Forbidden", { status: 403 });`,
        status: "OPEN",
        createdAt: minutesAgo(11)
      }
    ],
    versions: [
      {
        id: "version-12",
        label: "Version 12",
        authorName: "Vishu",
        commitMessage: "Restrict reviewer access",
        content: `import { NextRequest } from "next/server";

export function requireRole(request: NextRequest, allowedRoles: string[]) {
  const role = request.headers.get("x-review-role");

  if (!role || !allowedRoles.includes(role)) {
    throw new Error("Forbidden");
  }

  return role;
}
`,
        createdAt: minutesAgo(2)
      },
      {
        id: "version-11",
        label: "Version 11",
        authorName: "Rahul",
        commitMessage: "Return null for missing role",
        content: `import { NextRequest } from "next/server";

export function requireRole(request: NextRequest, allowedRoles: string[]) {
  const role = request.headers.get("x-review-role");

  if (!role || !allowedRoles.includes(role)) {
    return null;
  }

  return role;
}
`,
        createdAt: minutesAgo(15)
      },
      {
        id: "version-10",
        label: "Version 10",
        authorName: "Aman",
        commitMessage: "Initial open access helper",
        content: `export function allowAllUsers() {
  return true;
}
`,
        createdAt: daysAgo(1)
      }
    ],
    activity: [
      { id: "activity-1", actorName: "Rahul", action: "commented on", target: "line 4", createdAt: minutesAgo(4) },
      { id: "activity-2", actorName: "Aman", action: "approved", target: "suggestion #18", createdAt: minutesAgo(9) },
      { id: "activity-3", actorName: "Vishu", action: "created", target: "Version 12", createdAt: minutesAgo(12) }
    ]
  },
  {
    id: "doc-yjs-sync",
    title: "sync-protocol.md",
    language: "markdown",
    ownerName: "Collaboration Team",
    role: "REVIEWER",
    status: "APPROVED",
    contributors: 3,
    activeUsers: [
      { id: "user-neha", name: "Neha", color: "#a78bfa", mode: "viewing", line: 2, column: 1 },
      { id: "user-current", name: "Vishu", color: "#14b8a6", mode: "editing", line: 5, column: 4 }
    ],
    lastEditedLabel: "12 min ago",
    approvalRate: 94,
    avgResolutionTime: "11m",
    content: `# Sync Protocol

- Use Y.Text as the shared source of truth.
- Broadcast binary updates over Socket.IO rooms.
- Persist snapshots on autosave and before version creation.
- Rehydrate clients from the latest saved snapshot.
`,
    comments: [],
    suggestions: [],
    versions: [
      {
        id: "version-7",
        label: "Version 7",
        authorName: "Neha",
        commitMessage: "Document CRDT snapshot flow",
        content: `# Sync Protocol

- Use Y.Text as the shared source of truth.
- Broadcast binary updates over Socket.IO rooms.
- Persist snapshots on autosave and before version creation.
`,
        createdAt: hoursAgo(2)
      }
    ],
    activity: [
      { id: "activity-4", actorName: "Neha", action: "approved", target: "sync protocol", createdAt: minutesAgo(12) },
      { id: "activity-5", actorName: "Vishu", action: "updated", target: "reconnect notes", createdAt: minutesAgo(18) }
    ]
  },
  {
    id: "doc-payment-review",
    title: "payment-state-machine.go",
    language: "go",
    ownerName: "Payments Team",
    role: "VIEWER",
    status: "OPEN",
    contributors: 5,
    activeUsers: [{ id: "user-isha", name: "Isha", color: "#fb7185", mode: "viewing", line: 18, column: 1 }],
    lastEditedLabel: "28 min ago",
    approvalRate: 61,
    avgResolutionTime: "34m",
    content: `package payments

func canCapture(state string) bool {
  return state == "authorized"
}
`,
    comments: [],
    suggestions: [],
    versions: [],
    activity: [{ id: "activity-6", actorName: "Isha", action: "opened", target: "payment review", createdAt: minutesAgo(28) }]
  }
];

export function getDocumentSummaries(query = ""): DocumentSummary[] {
  const lowerQuery = query.trim().toLowerCase();

  return demoDocuments
    .filter((doc) => {
      if (!lowerQuery) return true;
      return doc.title.toLowerCase().includes(lowerQuery) || doc.content.toLowerCase().includes(lowerQuery);
    })
    .map((doc) => ({
      id: doc.id,
      title: doc.title,
      language: doc.language,
      role: doc.role,
      status: doc.status,
      updatedAt: now.toISOString(),
      ownerName: doc.ownerName,
      contributors: doc.contributors,
      activeUsers: doc.activeUsers,
      lastEditedLabel: doc.lastEditedLabel,
      comments: doc.comments.length,
      suggestions: doc.suggestions.filter((suggestion) => suggestion.status === "OPEN").length,
      approvalRate: doc.approvalRate,
      avgResolutionTime: doc.avgResolutionTime
    }));
}

export function getDocument(id: string) {
  return demoDocuments.find((doc) => doc.id === id);
}
