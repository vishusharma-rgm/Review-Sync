"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { diffLines } from "diff";
import { io, type Socket } from "socket.io-client";
import * as Y from "yjs";
import {
  Activity,
  Check,
  CircleDot,
  GitPullRequestArrow,
  History,
  MessageSquarePlus,
  Save,
  Search,
  UserRound,
  UsersRound,
  X
} from "lucide-react";
import type {
  ActivityEvent,
  DocumentDetail,
  PresenceUser,
  ReviewComment,
  Suggestion,
  Version,
  WorkflowStatus
} from "@/lib/types";
import { canEdit, canReview } from "@/lib/permissions";
import { countSearchMatches, replaceLineRange } from "@/lib/suggestions";
import { localDocumentsKey, mergeDocumentDefaults } from "@/lib/local-documents";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

const colors = ["#14b8a6", "#60a5fa", "#f59e0b", "#a78bfa", "#fb7185"];

type Props = {
  initialDocument: DocumentDetail;
};

const statusLabels: Record<WorkflowStatus, string> = {
  OPEN: "Open",
  IN_REVIEW: "In Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  MERGED: "Merged"
};

function loadStoredDocument(initialDocument: DocumentDetail) {
  if (typeof window === "undefined") return initialDocument;
  const stored = window.localStorage.getItem(localDocumentsKey);
  if (!stored) return initialDocument;

  try {
    const documents = JSON.parse(stored) as DocumentDetail[];
    const storedDocument = documents.find((doc) => doc.id === initialDocument.id);
    if (!storedDocument) return initialDocument;

    const activeUsers = new Map<string, PresenceUser>();
    initialDocument.activeUsers.forEach((user) => activeUsers.set(user.id, user));
    storedDocument.activeUsers?.forEach((user) => activeUsers.set(user.id, user));

    const mergedDocument = mergeDocumentDefaults(initialDocument, storedDocument);

    return {
      ...mergedDocument,
      activeUsers: Array.from(activeUsers.values()),
      activity: mergedDocument.activity?.length ? mergedDocument.activity : initialDocument.activity,
      versions: mergedDocument.versions?.length ? mergedDocument.versions : initialDocument.versions
    };
  } catch {
    return initialDocument;
  }
}

function relativeTime(iso: string) {
  const delta = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(1, Math.round(delta / 60_000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return "Yesterday";
}

function splitDiff(oldContent: string, newContent: string) {
  const oldRows: Array<{ value: string; kind: "removed" | "normal" }> = [];
  const newRows: Array<{ value: string; kind: "added" | "normal" }> = [];

  diffLines(oldContent, newContent).forEach((part) => {
    const rows = part.value.split("\n");
    if (rows[rows.length - 1] === "") rows.pop();

    rows.forEach((row) => {
      if (part.removed) oldRows.push({ value: row, kind: "removed" });
      else if (part.added) newRows.push({ value: row, kind: "added" });
      else {
        oldRows.push({ value: row, kind: "normal" });
        newRows.push({ value: row, kind: "normal" });
      }
    });
  });

  return { oldRows, newRows };
}

export function EditorWorkspace({ initialDocument }: Props) {
  const [documentData] = useState<DocumentDetail>(() => loadStoredDocument(initialDocument));
  const [content, setContent] = useState(documentData.content);
  const [comments, setComments] = useState<ReviewComment[]>(documentData.comments);
  const [suggestions, setSuggestions] = useState<Suggestion[]>(documentData.suggestions);
  const [versions, setVersions] = useState<Version[]>(documentData.versions);
  const [activity, setActivity] = useState<ActivityEvent[]>(documentData.activity);
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus>(documentData.status);
  const [line, setLine] = useState(1);
  const [column, setColumn] = useState(1);
  const [commentBody, setCommentBody] = useState("");
  const [replacementText, setReplacementText] = useState("");
  const [search, setSearch] = useState("");
  const [syncStatus, setSyncStatus] = useState("Connecting");
  const [autosaveStatus, setAutosaveStatus] = useState("Saved");
  const [presence, setPresence] = useState<PresenceUser[]>(documentData.activeUsers);
  const [selectedVersionId, setSelectedVersionId] = useState(documentData.versions[0]?.id ?? "");
  const socketRef = useRef<Socket | null>(null);
  const ydocRef = useRef<Y.Doc | null>(null);
  const autosaveRef = useRef<number | null>(null);
  const applyingRemoteRef = useRef(false);
  const role = documentData.role;
  const editable = canEdit(role);
  const reviewable = canReview(role);
  const activeUsers = useMemo(() => {
    const merged = new Map<string, PresenceUser>();
    documentData.activeUsers.forEach((user) => merged.set(user.id, user));
    presence.forEach((user) => merged.set(user.id, user));
    return Array.from(merged.values());
  }, [documentData.activeUsers, presence]);
  const remoteUsers = activeUsers.filter((user) => user.id !== "user-current");

  useEffect(() => {
    const stored = window.localStorage.getItem(localDocumentsKey);
    let currentDocuments: DocumentDetail[] = [];

    try {
      currentDocuments = stored ? (JSON.parse(stored) as DocumentDetail[]) : [];
    } catch {
      currentDocuments = [];
    }
    const nextDocument: DocumentDetail = {
      ...documentData,
      content,
      comments,
      suggestions,
      versions,
      activity,
      status: workflowStatus,
      activeUsers,
      lastEditedLabel: autosaveStatus === "Saved" ? "just now" : documentData.lastEditedLabel
    };
    const exists = currentDocuments.some((doc) => doc.id === documentData.id);
    const nextDocuments = exists
      ? currentDocuments.map((doc) => (doc.id === documentData.id ? nextDocument : doc))
      : [nextDocument, ...currentDocuments];

    window.localStorage.setItem(localDocumentsKey, JSON.stringify(nextDocuments));
  }, [activeUsers, activity, autosaveStatus, comments, content, documentData, suggestions, versions, workflowStatus]);

  useEffect(() => {
    const ydoc = new Y.Doc();
    const ytext = ydoc.getText("content");
    ydocRef.current = ydoc;

    const realtimeUrl = process.env.NEXT_PUBLIC_REALTIME_URL || "http://localhost:4000";
    const socket = io(realtimeUrl, {
      transports: ["websocket"],
      query: {
        documentId: documentData.id,
        userId: "user-current",
        name: "Vishu"
      }
    });
    socketRef.current = socket;

    socket.on("connect", () => setSyncStatus("Live"));
    socket.on("disconnect", () => setSyncStatus("Reconnecting"));
    socket.on("presence", (users: PresenceUser[]) => setPresence(users));
    socket.on("activity:new", (event: ActivityEvent) => setActivity((current) => [event, ...current].slice(0, 12)));
    socket.on("sync:init", (payload: { update: ArrayBuffer }) => {
      applyingRemoteRef.current = true;
      Y.applyUpdate(ydoc, new Uint8Array(payload.update));
      applyingRemoteRef.current = false;
      if (ytext.length === 0 && documentData.content.length > 0) {
        ytext.insert(0, documentData.content);
      }
      setContent(ytext.toString());
    });
    socket.on("sync:update", (payload: { update: ArrayBuffer }) => {
      applyingRemoteRef.current = true;
      Y.applyUpdate(ydoc, new Uint8Array(payload.update));
      setContent(ytext.toString());
      applyingRemoteRef.current = false;
    });

    const observer = (update: Uint8Array) => {
      if (!applyingRemoteRef.current) {
        socket.emit("sync:update", { documentId: documentData.id, update });
      }
    };

    ydoc.on("update", observer);

    return () => {
      ydoc.off("update", observer);
      socket.disconnect();
      ydoc.destroy();
    };
  }, [documentData.activeUsers, documentData.content, documentData.id]);

  const selectedVersion = versions.find((version) => version.id === selectedVersionId) ?? versions[0];
  const diff = useMemo(() => splitDiff(selectedVersion?.content ?? "", content), [content, selectedVersion?.content]);
  const searchMatches = useMemo(() => countSearchMatches(content, search), [content, search]);

  function addActivity(action: string, target: string) {
    const event: ActivityEvent = {
      id: crypto.randomUUID(),
      actorName: "Vishu",
      action,
      target,
      createdAt: new Date().toISOString()
    };
    setActivity((current) => [event, ...current].slice(0, 12));
    socketRef.current?.emit("activity:new", { documentId: documentData.id, ...event });
  }

  function syncLocalChange(nextContent: string) {
    setContent(nextContent);
    setAutosaveStatus("Editing");
    if (autosaveRef.current) window.clearTimeout(autosaveRef.current);
    autosaveRef.current = window.setTimeout(() => {
      setAutosaveStatus("Autosaved");
      window.setTimeout(() => setAutosaveStatus("Saved"), 900);
    }, 5000);

    const ydoc = ydocRef.current;
    if (!ydoc) return;
    const ytext = ydoc.getText("content");
    ydoc.transact(() => {
      ytext.delete(0, ytext.length);
      ytext.insert(0, nextContent);
    });
  }

  function emitCursor(nextLine: number, nextColumn: number, mode: "editing" | "viewing") {
    socketRef.current?.emit("cursor:update", {
      documentId: documentData.id,
      line: nextLine,
      column: nextColumn,
      mode
    });
  }

  function addComment() {
    if (!commentBody.trim() || !reviewable) return;
    setComments((current) => [
      {
        id: crypto.randomUUID(),
        authorName: "Vishu",
        line,
        body: commentBody.trim(),
        resolved: false,
        createdAt: new Date().toISOString()
      },
      ...current
    ]);
    addActivity("commented on", `line ${line}`);
    setCommentBody("");
  }

  function addSuggestion() {
    if (!replacementText.trim() || !reviewable) return;
    setSuggestions((current) => [
      {
        id: crypto.randomUUID(),
        authorName: "Vishu",
        startLine: line,
        endLine: line,
        replacementText,
        status: "OPEN",
        createdAt: new Date().toISOString()
      },
      ...current
    ]);
    addActivity("suggested change on", `line ${line}`);
    setReplacementText("");
  }

  function resolveSuggestion(suggestion: Suggestion, status: "APPROVED" | "REJECTED") {
    if (status === "APPROVED") {
      syncLocalChange(replaceLineRange(content, suggestion.startLine, suggestion.endLine, suggestion.replacementText));
    }
    setSuggestions((current) => current.map((item) => (item.id === suggestion.id ? { ...item, status } : item)));
    addActivity(status === "APPROVED" ? "approved" : "rejected", `suggestion on line ${suggestion.startLine}`);
  }

  function saveVersion() {
    const nextVersion = {
      id: crypto.randomUUID(),
      label: `Version ${versions.length + 13}`,
      content,
      authorName: "Vishu",
      commitMessage: "Restrict reviewer access",
      createdAt: new Date().toISOString()
    };
    setVersions((current) => [nextVersion, ...current]);
    setSelectedVersionId(nextVersion.id);
    addActivity("created", nextVersion.label);
    setSyncStatus("Saved");
    window.setTimeout(() => setSyncStatus(socketRef.current?.connected ? "Live" : "Reconnecting"), 900);
  }

  return (
    <div className="editor-layout">
      <section className="editor-pane">
        <div className="editor-header">
          <div>
            <div className="editor-title">{documentData.title}</div>
            <div className="badge-row" style={{ marginTop: 8 }}>
              <span className={`badge ${role.toLowerCase()}`}>{role}</span>
              <span className={`status-pill status-${workflowStatus.toLowerCase().replace("_", "-")}`}>
                {statusLabels[workflowStatus]}
              </span>
              <span className="badge">{documentData.language}</span>
              <span className="badge">
                <CircleDot size={12} /> {syncStatus}
              </span>
              <span className="badge">
                <Save size={12} /> {autosaveStatus}
              </span>
            </div>
          </div>
          <div className="toolbar">
            <div className="presence">
              {activeUsers.map((user, index) => (
                <span className="avatar" key={user.id} style={{ background: user.color || colors[index % colors.length] }}>
                  {user.name.slice(0, 1)}
                </span>
              ))}
            </div>
            <select className="select" value={workflowStatus} onChange={(event) => setWorkflowStatus(event.target.value as WorkflowStatus)}>
              <option value="OPEN">Open</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="MERGED">Merged</option>
            </select>
            <button className="button" type="button" onClick={saveVersion}>
              <Save size={18} />
              Version
            </button>
          </div>
        </div>
        <div className="editor-canvas">
          <div className="cursor-layer" aria-hidden="true">
            {remoteUsers.map((user, index) => (
              <div
                className="remote-cursor"
                key={user.id}
                style={{
                  left: `${72 + (user.column ?? index + 1) * 8}px`,
                  top: `${24 + (user.line ?? index + 1) * 20}px`,
                  background: user.color
                }}
              >
                <span className="cursor-label" style={{ background: user.color }}>
                  {user.name}
                </span>
              </div>
            ))}
          </div>
          <MonacoEditor
            height="100%"
            language={documentData.language}
            theme="vs-dark"
            value={content}
            options={{
              readOnly: !editable,
              minimap: { enabled: false },
              fontSize: 14,
              wordWrap: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true
            }}
            onChange={(value) => {
              if (typeof value === "string" && editable) {
                emitCursor(line, column, "editing");
                syncLocalChange(value);
              }
            }}
            onMount={(editor) => {
              editor.onDidChangeCursorPosition((event) => {
                setLine(event.position.lineNumber);
                setColumn(event.position.column);
                emitCursor(event.position.lineNumber, event.position.column, editable ? "editing" : "viewing");
              });
            }}
          />
        </div>
      </section>

      <aside className="side-panel">
        <section className="panel-section">
          <h2 className="panel-title">Realtime Presence</h2>
          <div className="presence-list">
            {activeUsers.map((user) => (
              <div className="presence-row" key={user.id}>
                <span className="collaborator" style={{ borderColor: user.color }}>
                  <span className="live-dot" style={{ background: user.color }} />
                  {user.name}
                </span>
                <span>
                  {user.mode === "editing" ? "editing" : "viewing"} line {user.line ?? 1}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="panel-section">
          <h2 className="panel-title">Review Tools</h2>
          <div className="toolbar">
            <span className="badge">
              <UserRound size={12} /> Line {line}
            </span>
            <span className="badge">{editable ? "Editable" : "Read-only"}</span>
            <span className="badge">
              <UsersRound size={12} /> {activeUsers.length} active
            </span>
          </div>
        </section>

        <section className="panel-section">
          <h2 className="panel-title">Search</h2>
          <div style={{ position: "relative" }}>
            <Search size={16} style={{ position: "absolute", top: 11, left: 10, color: "#94a3b8" }} />
            <input
              className="input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Find in file"
              style={{ width: "100%", paddingLeft: 34 }}
            />
          </div>
          <p className="muted">{search ? `${searchMatches} matches` : "Search current document content."}</p>
        </section>

        <section className="panel-section">
          <h2 className="panel-title">Activity Feed</h2>
          {activity.map((event) => (
            <div className="activity-row" key={event.id}>
              <strong>
                <Activity size={14} /> {event.actorName} {event.action}
              </strong>
              <span>{event.target}</span>
              <span className="muted">{relativeTime(event.createdAt)}</span>
            </div>
          ))}
        </section>

        <section className="panel-section">
          <h2 className="panel-title">Inline Comments</h2>
          <textarea
            className="textarea"
            value={commentBody}
            onChange={(event) => setCommentBody(event.target.value)}
            placeholder="Add a review comment"
            disabled={!reviewable}
          />
          <div style={{ height: 8 }} />
          <button className="button primary" type="button" onClick={addComment} disabled={!reviewable}>
            <MessageSquarePlus size={18} />
            Comment
          </button>
          <div style={{ height: 12 }} />
          {comments.map((comment) => (
            <div className="thread" key={comment.id}>
              <strong>Line {comment.line}</strong>
              <div>{comment.body}</div>
              <div className="muted">
                {comment.authorName} · {relativeTime(comment.createdAt)}
              </div>
            </div>
          ))}
        </section>

        <section className="panel-section">
          <h2 className="panel-title">Suggestions</h2>
          <textarea
            className="textarea"
            value={replacementText}
            onChange={(event) => setReplacementText(event.target.value)}
            placeholder="Replacement text for selected line"
            disabled={!reviewable}
          />
          <div style={{ height: 8 }} />
          <button className="button" type="button" onClick={addSuggestion} disabled={!reviewable}>
            <GitPullRequestArrow size={18} />
            Suggest
          </button>
          <div style={{ height: 12 }} />
          {suggestions.map((suggestion) => (
            <div className="suggestion" key={suggestion.id}>
              <strong>
                Lines {suggestion.startLine}-{suggestion.endLine}
              </strong>
              <code>{suggestion.replacementText}</code>
              <span className="badge">{suggestion.status}</span>
              {suggestion.status === "OPEN" ? (
                <div className="toolbar">
                  <button className="button primary" type="button" onClick={() => resolveSuggestion(suggestion, "APPROVED")}>
                    <Check size={16} />
                    Approve
                  </button>
                  <button className="button danger" type="button" onClick={() => resolveSuggestion(suggestion, "REJECTED")}>
                    <X size={16} />
                    Reject
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </section>

        <section className="panel-section">
          <h2 className="panel-title">Version Timeline</h2>
          {versions.map((version) => (
            <button
              className={`version-row ${selectedVersion?.id === version.id ? "active" : ""}`}
              key={version.id}
              type="button"
              onClick={() => setSelectedVersionId(version.id)}
            >
              <strong>
                <span className="timeline-dot" /> {version.label}
              </strong>
              <span>{relativeTime(version.createdAt)}</span>
              <span className="muted">Changed By: {version.authorName ?? "System"}</span>
              <span className="muted">Commit Message: {version.commitMessage ?? "Update reviewed changes"}</span>
            </button>
          ))}
          <div className="diff-grid" aria-label="Side by side diff">
            <div className="diff-pane">
              <div className="diff-heading">{selectedVersion?.label ?? "Previous"}</div>
              <div className="diff">
                {diff.oldRows.map((row, index) => (
                  <div className={`diff-line ${row.kind}`} key={`${row.value}-${index}`}>
                    {row.kind === "removed" ? "- " : "  "}
                    {row.value || " "}
                  </div>
                ))}
              </div>
            </div>
            <div className="diff-pane">
              <div className="diff-heading">Current</div>
              <div className="diff">
                {diff.newRows.map((row, index) => (
                  <div className={`diff-line ${row.kind}`} key={`${row.value}-${index}`}>
                    {row.kind === "added" ? "+ " : "  "}
                    {row.value || " "}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </aside>
    </div>
  );
}
