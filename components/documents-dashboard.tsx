"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Code2, FilePlus2, GitBranch, History, MessageSquare, Search, SlidersHorizontal, UsersRound, X } from "lucide-react";
import type { ActivityEvent, DocumentDetail, Suggestion, Version, WorkflowStatus } from "@/lib/types";
import { localDocumentsKey, makeBlankDocument, mergeDocumentDefaults } from "@/lib/local-documents";

type View = "documents" | "reviews" | "suggestions" | "versions" | "roles";

type Props = {
  initialDocuments: DocumentDetail[];
  initialQuery: string;
  view: View;
};

const statusLabels: Record<WorkflowStatus, string> = {
  OPEN: "Open",
  IN_REVIEW: "In Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  MERGED: "Merged"
};

const roleRows = [
  { user: "Vishu", role: "Owner", permission: "Full access", status: "Active" },
  { user: "Rahul", role: "Reviewer", permission: "Comment + approve", status: "Active" },
  { user: "Aman", role: "Viewer", permission: "Read only", status: "Invited" },
  { user: "Neha", role: "Reviewer", permission: "Suggest changes", status: "Active" }
];

function loadDocuments(initialDocuments: DocumentDetail[]) {
  if (typeof window === "undefined") return initialDocuments;
  const stored = window.localStorage.getItem(localDocumentsKey);
  if (!stored) {
    window.localStorage.setItem(localDocumentsKey, JSON.stringify(initialDocuments));
    return initialDocuments;
  }

  try {
    const storedDocuments = JSON.parse(stored) as DocumentDetail[];
    const merged = new Map<string, DocumentDetail>();
    initialDocuments.forEach((doc) => merged.set(doc.id, doc));
    storedDocuments.forEach((doc) => merged.set(doc.id, mergeDocumentDefaults(merged.get(doc.id) ?? doc, doc)));
    const documents = Array.from(merged.values());
    window.localStorage.setItem(localDocumentsKey, JSON.stringify(documents));
    return documents;
  } catch {
    window.localStorage.setItem(localDocumentsKey, JSON.stringify(initialDocuments));
    return initialDocuments;
  }
}

function saveDocuments(documents: DocumentDetail[]) {
  window.localStorage.setItem(localDocumentsKey, JSON.stringify(documents));
}

function relativeTime(iso: string) {
  const delta = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(1, Math.round(delta / 60_000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return "Yesterday";
}

function latestVersion(doc: DocumentDetail) {
  return doc.versions[0]?.label.replace("Version ", "") ?? "0";
}

function openComments(doc: DocumentDetail) {
  return doc.comments.filter((comment) => !comment.resolved).length;
}

function syncLabel(doc: DocumentDetail) {
  if (doc.id === "doc-auth-review") return "2s";
  if (doc.id === "doc-yjs-sync") return "12m";
  if (doc.id === "doc-payment-review") return "28m";
  return doc.lastEditedLabel.replace(" ago", "");
}

function allActivity(documents: DocumentDetail[]) {
  return documents
    .flatMap((doc) => doc.activity.map((event) => ({ ...event, file: doc.title })))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);
}

function versionDiff(version: Version | undefined, doc: DocumentDetail | undefined) {
  if (!version || !doc) return { oldLines: [], newLines: [] };
  return {
    oldLines: version.content.split("\n").slice(0, 12),
    newLines: doc.content.split("\n").slice(0, 12)
  };
}

export function DocumentsDashboard({ initialDocuments, initialQuery, view }: Props) {
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentDetail[]>(() => loadDocuments(initialDocuments));
  const [query, setQuery] = useState(initialQuery);
  const [roleFilter, setRoleFilter] = useState("all");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState("service-review.ts");
  const [language, setLanguage] = useState("typescript");
  const [selectedVersionId, setSelectedVersionId] = useState(documents[0]?.versions[0]?.id ?? "");
  const languages = useMemo(() => Array.from(new Set(documents.map((doc) => doc.language))), [documents]);
  const primaryDoc = documents[0];
  const activity = allActivity(documents);

  const filteredDocuments = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();

    return documents.filter((doc) => {
      const matchesQuery =
        !lowerQuery || doc.title.toLowerCase().includes(lowerQuery) || doc.content.toLowerCase().includes(lowerQuery);
      const matchesRole = roleFilter === "all" || doc.role === roleFilter;
      const matchesLanguage = languageFilter === "all" || doc.language === languageFilter;
      return matchesQuery && matchesRole && matchesLanguage;
    });
  }, [documents, languageFilter, query, roleFilter]);

  const comments = documents.reduce((total, doc) => total + doc.comments.length, 0);
  const suggestions = documents.reduce((total, doc) => total + doc.suggestions.length, 0);
  const versions = documents.reduce((total, doc) => total + doc.versions.length, 0);
  const contributors = documents.reduce((ids, doc) => {
    doc.activeUsers.forEach((user) => ids.add(user.id));
    return ids;
  }, new Set<string>()).size;

  const reviewItems = documents
    .filter((doc) => doc.status === "IN_REVIEW" || doc.status === "OPEN" || doc.comments.some((comment) => !comment.resolved))
    .map((doc, index) => ({
      id: `Review #${124 + index}`,
      doc,
      reviewer: doc.activeUsers.find((user) => user.id !== "user-current")?.name ?? "Rahul",
      pendingComments: doc.comments.filter((comment) => !comment.resolved).length
    }));

  const suggestionItems = documents.flatMap((doc) =>
    doc.suggestions.map((suggestion) => ({
      doc,
      suggestion
    }))
  );

  const versionItems = documents.flatMap((doc) => doc.versions.map((version) => ({ doc, version })));
  const selectedVersion = versionItems.find((item) => item.version.id === selectedVersionId) ?? versionItems[0];
  const diff = versionDiff(selectedVersion?.version, selectedVersion?.doc);

  function createDocument() {
    const safeTitle = title.trim() || "untitled.ts";
    const nextDocument = makeBlankDocument(safeTitle, language);
    const nextDocuments = [nextDocument, ...documents];
    setDocuments(nextDocuments);
    saveDocuments(nextDocuments);
    setIsCreating(false);
    router.push(`/documents/${nextDocument.id}`);
  }

  function updateDocument(documentId: string, updater: (doc: DocumentDetail) => DocumentDetail) {
    const nextDocuments = documents.map((doc) => (doc.id === documentId ? updater(doc) : doc));
    setDocuments(nextDocuments);
    saveDocuments(nextDocuments);
  }

  function updateReviewStatus(documentId: string, status: WorkflowStatus) {
    updateDocument(documentId, (doc) => ({
      ...doc,
      status,
      activity: [
        {
          id: crypto.randomUUID(),
          actorName: "Vishu",
          action: status === "APPROVED" ? "approved" : "rejected",
          target: doc.title,
          createdAt: new Date().toISOString()
        },
        ...doc.activity
      ]
    }));
  }

  function updateSuggestion(documentId: string, suggestionId: string, status: Suggestion["status"]) {
    updateDocument(documentId, (doc) => ({
      ...doc,
      suggestions: doc.suggestions.map((suggestion) => (suggestion.id === suggestionId ? { ...suggestion, status } : suggestion)),
      activity: [
        {
          id: crypto.randomUUID(),
          actorName: "Vishu",
          action: status === "APPROVED" ? "accepted" : "rejected",
          target: "inline suggestion",
          createdAt: new Date().toISOString()
        },
        ...doc.activity
      ]
    }));
  }

  return (
    <section className="page">
      {view === "documents" ? (
        <DocumentsView
          activity={activity}
          comments={comments}
          contributors={contributors}
          documents={filteredDocuments}
          languages={languages}
          languageFilter={languageFilter}
          onLanguageFilter={setLanguageFilter}
          onNewDocument={() => setIsCreating(true)}
          onRoleFilter={setRoleFilter}
          primaryDoc={primaryDoc}
          query={query}
          roleFilter={roleFilter}
          setQuery={setQuery}
          suggestions={suggestions}
          versions={versions}
        />
      ) : null}

      {view === "reviews" ? (
        <ReviewsView activity={activity} items={reviewItems} onStatus={updateReviewStatus} />
      ) : null}

      {view === "suggestions" ? (
        <SuggestionsView items={suggestionItems} onUpdate={updateSuggestion} />
      ) : null}

      {view === "versions" ? (
        <VersionsView diff={diff} items={versionItems} selectedId={selectedVersion?.version.id ?? ""} onSelect={setSelectedVersionId} />
      ) : null}

      {view === "roles" ? <RolesView /> : null}

      {isCreating ? (
        <div className="modal-backdrop" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="new-document-title">
            <div className="modal-header">
              <h2 id="new-document-title">New document</h2>
              <button className="icon-button" type="button" onClick={() => setIsCreating(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <label className="field">
              <span>File name</span>
              <input className="input" value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
            </label>
            <label className="field">
              <span>Language</span>
              <select className="select" value={language} onChange={(event) => setLanguage(event.target.value)}>
                <option value="typescript">TypeScript</option>
                <option value="javascript">JavaScript</option>
                <option value="go">Go</option>
                <option value="java">Java</option>
                <option value="markdown">Markdown</option>
              </select>
            </label>
            <div className="toolbar" style={{ justifyContent: "flex-end" }}>
              <button className="button" type="button" onClick={() => setIsCreating(false)}>
                Cancel
              </button>
              <button className="button primary" type="button" onClick={createDocument}>
                Create
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function DocumentsView(props: {
  activity: Array<ActivityEvent & { file: string }>;
  comments: number;
  contributors: number;
  documents: DocumentDetail[];
  languages: string[];
  languageFilter: string;
  onLanguageFilter: (value: string) => void;
  onNewDocument: () => void;
  onRoleFilter: (value: string) => void;
  primaryDoc?: DocumentDetail;
  query: string;
  roleFilter: string;
  setQuery: (value: string) => void;
  suggestions: number;
  versions: number;
}) {
  return (
    <>
      <div className="hero-editor">
        <div className="hero-copy">
          <div className="workspace-status">
            <span className="live-dot" />
            WebSocket connected · CRDT sync · Version tracking
          </div>
          <h1 className="page-title">Realtime code review, not just a dashboard</h1>
          <div className="tech-badges" aria-label="Architecture">
            <span>WebSocket</span>
            <span>Redis Pub/Sub</span>
            <span>CRDT Sync</span>
            <span>Version Tracking</span>
            <span>Role Based Access</span>
          </div>
          <div className="hero-actions">
            <Link className="button primary" href={`/documents/${props.primaryDoc?.id ?? "doc-auth-review"}`}>
              <Code2 size={18} />
              Open collaborative editor
            </Link>
            <button className="button" type="button" onClick={props.onNewDocument}>
              <FilePlus2 size={18} />
              New document
            </button>
          </div>
        </div>
        <div className="mini-editor">
          <div className="mini-editor-bar">
            <span className="live-dot" /> Vishu editing line 45
            <span>Rahul viewing</span>
            <span>Aman typing</span>
          </div>
          <pre>{`function allowReviewerUsers(role) {
  return role === "owner" || role === "reviewer";
}`}</pre>
          <div className="mini-cursor cursor-a">Rahul</div>
          <div className="mini-cursor cursor-b">Aman</div>
        </div>
      </div>

      <div className="dense-stats">
        <div>
          <MessageSquare size={16} />
          <span>Open Comments</span>
          <strong>{props.comments}</strong>
        </div>
        <div>
          <GitBranch size={16} />
          <span>Suggestions</span>
          <strong>{props.suggestions}</strong>
        </div>
        <div>
          <History size={16} />
          <span>Versions</span>
          <strong>{props.versions}</strong>
        </div>
        <div>
          <UsersRound size={16} />
          <span>Collaborators</span>
          <strong>{props.contributors}</strong>
        </div>
      </div>

      <div className="workspace-grid">
        <main>
          <div className="toolbar filterbar compact-filter">
            <div style={{ position: "relative", flex: "1 1 260px" }}>
              <Search size={18} style={{ position: "absolute", left: 12, top: 11, color: "#94a3b8" }} />
              <input
                className="input"
                value={props.query}
                onChange={(event) => props.setQuery(event.target.value)}
                placeholder="Search files and code"
                style={{ width: "100%", paddingLeft: 38 }}
              />
            </div>
            <label className="select-label">
              <SlidersHorizontal size={16} />
              <select className="select" value={props.roleFilter} onChange={(event) => props.onRoleFilter(event.target.value)}>
                <option value="all">All roles</option>
                <option value="OWNER">Owner</option>
                <option value="REVIEWER">Reviewer</option>
                <option value="VIEWER">Viewer</option>
              </select>
            </label>
            <select className="select" value={props.languageFilter} onChange={(event) => props.onLanguageFilter(event.target.value)}>
              <option value="all">All languages</option>
              {props.languages.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="file-list">
            {props.documents.map((doc) => (
              <Link href={`/documents/${doc.id}`} className="file-row" key={doc.id}>
                <div className="file-main">
                  <strong>{doc.title}</strong>
                  <span>{doc.ownerName} · {doc.role.toLowerCase()} · {statusLabels[doc.status]}</span>
                </div>
                <div className="file-row-meta">
                  <span><strong>v{latestVersion(doc)}</strong> Current</span>
                  <span><strong>{syncLabel(doc)}</strong> Last Sync</span>
                  <span><strong>{doc.activeUsers.length}</strong> Collaborators</span>
                  <span><strong>{openComments(doc)}</strong> Open Comments</span>
                </div>
              </Link>
            ))}
          </div>
        </main>
        <RecentActivity activity={props.activity} />
      </div>
    </>
  );
}

function ReviewsView(props: {
  activity: Array<ActivityEvent & { file: string }>;
  items: Array<{ id: string; doc: DocumentDetail; reviewer: string; pendingComments: number }>;
  onStatus: (documentId: string, status: WorkflowStatus) => void;
}) {
  return (
    <div className="workspace-grid">
      <main>
        <div className="page-header tight-header">
          <div>
            <h1 className="page-title">Review queue</h1>
            <div className="workspace-status">Pending approvals, reviewer ownership, and comment actions.</div>
          </div>
        </div>
        <div className="review-list">
          {props.items.map((item) => (
            <div className="review-row" key={item.id}>
              <div>
                <strong>{item.id}</strong>
                <Link href={`/documents/${item.doc.id}`}>{item.doc.title}</Link>
              </div>
              <div>Reviewer: {item.reviewer}</div>
              <span className={`status-pill status-${item.doc.status.toLowerCase().replace("_", "-")}`}>
                {statusLabels[item.doc.status]}
              </span>
              <div>{item.pendingComments} open comments</div>
              <div className="row-actions">
                <button className="button primary" type="button" onClick={() => props.onStatus(item.doc.id, "APPROVED")}>
                  <Check size={16} /> Approve
                </button>
                <button className="button danger" type="button" onClick={() => props.onStatus(item.doc.id, "REJECTED")}>
                  <X size={16} /> Reject
                </button>
                <Link className="button" href={`/documents/${item.doc.id}`}>
                  <MessageSquare size={16} /> Comment
                </Link>
              </div>
            </div>
          ))}
        </div>
      </main>
      <RecentActivity activity={props.activity} />
    </div>
  );
}

function SuggestionsView(props: {
  items: Array<{ doc: DocumentDetail; suggestion: Suggestion }>;
  onUpdate: (documentId: string, suggestionId: string, status: Suggestion["status"]) => void;
}) {
  return (
    <main>
      <div className="page-header tight-header">
        <div>
          <h1 className="page-title">Inline suggestions</h1>
          <div className="workspace-status">Review proposed code changes before they touch the source document.</div>
        </div>
      </div>
      <div className="suggestion-list">
        {props.items.map(({ doc, suggestion }) => (
          <div className="inline-suggestion" key={suggestion.id}>
            <div className="doc-card-header">
              <div>
                <strong>{doc.title}</strong>
                <div className="muted">
                  Lines {suggestion.startLine}-{suggestion.endLine} · {suggestion.authorName}
                </div>
              </div>
              <span className="badge">{suggestion.status}</span>
            </div>
            <div className="suggestion-meta">
              <span>Reviewer: <strong>{suggestion.reviewerName ?? suggestion.authorName}</strong></span>
              <span>Reason: <strong>{suggestion.reason ?? "Code quality improvement"}</strong></span>
            </div>
            <pre className="inline-diff">{`- allowAllUsers()
+ ${suggestion.replacementText.trim() || "allowReviewerUsers()"}`}</pre>
            <div className="row-actions">
              <button className="button primary" type="button" onClick={() => props.onUpdate(doc.id, suggestion.id, "APPROVED")}>
                Accept
              </button>
              <button className="button danger" type="button" onClick={() => props.onUpdate(doc.id, suggestion.id, "REJECTED")}>
                Reject
              </button>
              <Link className="button" href={`/documents/${doc.id}`}>
                Open file
              </Link>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

function VersionsView(props: {
  diff: { oldLines: string[]; newLines: string[] };
  items: Array<{ doc: DocumentDetail; version: Version }>;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="version-screen">
      <aside className="timeline-panel">
        <h1 className="page-title">Version timeline</h1>
        {props.items.map(({ doc, version }) => (
          <button
            className={`timeline-item ${props.selectedId === version.id ? "active" : ""}`}
            key={version.id}
            type="button"
            onClick={() => props.onSelect(version.id)}
          >
            <strong>{version.label}</strong>
            <span>{relativeTime(version.createdAt)}</span>
            <span>Changed By: {version.authorName ?? "System"}</span>
            <span>Commit Message: {version.commitMessage ?? "Update reviewed changes"}</span>
            <span>{doc.title}</span>
          </button>
        ))}
      </aside>
      <main className="diff-review">
        <div className="version-summary">
          <span>Changed By: <strong>{props.items.find((item) => item.version.id === props.selectedId)?.version.authorName ?? "System"}</strong></span>
          <span>Commit Message: <strong>{props.items.find((item) => item.version.id === props.selectedId)?.version.commitMessage ?? "Update reviewed changes"}</strong></span>
        </div>
        <div className="diff-grid">
          <div>
            <div className="diff-heading">Previous</div>
            <pre className="diff">{props.diff.oldLines.map((line) => `- ${line}`).join("\n")}</pre>
          </div>
          <div>
            <div className="diff-heading">Current</div>
            <pre className="diff">{props.diff.newLines.map((line) => `+ ${line}`).join("\n")}</pre>
          </div>
        </div>
      </main>
    </div>
  );
}

function RolesView() {
  return (
    <main>
      <div className="page-header tight-header">
        <div>
          <h1 className="page-title">Access control</h1>
          <div className="workspace-status">User roles and document permissions.</div>
        </div>
      </div>
      <table className="roles-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Permission</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {roleRows.map((row) => (
            <tr key={row.user}>
              <td>{row.user}</td>
              <td>{row.role}</td>
              <td>{row.permission}</td>
              <td>{row.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

function RecentActivity({ activity }: { activity: Array<ActivityEvent & { file: string }> }) {
  return (
    <aside className="right-rail">
      <h2>Recent Activity</h2>
      {activity.map((event) => (
        <div className="activity-row" key={event.id}>
          <strong>
            {event.actorName} {event.action}
          </strong>
          <span>{event.target}</span>
          <span className="muted">
            {event.file} · {relativeTime(event.createdAt)}
          </span>
        </div>
      ))}
    </aside>
  );
}
