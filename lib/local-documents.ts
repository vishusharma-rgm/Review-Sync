import type { DocumentDetail, DocumentSummary } from "@/lib/types";

export const localDocumentsKey = "reviewsync.documents.v5";

export function mergeDocumentDefaults(base: DocumentDetail, stored?: DocumentDetail): DocumentDetail {
  if (!stored) return base;

  return {
    ...base,
    ...stored,
    suggestions: stored.suggestions.map((suggestion) => {
      const defaultSuggestion = base.suggestions.find((item) => item.id === suggestion.id);
      return defaultSuggestion ? { ...defaultSuggestion, ...suggestion } : suggestion;
    }),
    versions: stored.versions.map((version) => {
      const defaultVersion = base.versions.find((item) => item.id === version.id);
      return defaultVersion ? { ...defaultVersion, ...version } : version;
    })
  };
}

export function summarizeDocument(doc: DocumentDetail): DocumentSummary {
  return {
    id: doc.id,
    title: doc.title,
    language: doc.language,
    updatedAt: new Date().toISOString(),
    role: doc.role,
    status: doc.status,
    ownerName: doc.ownerName,
    contributors: doc.contributors,
    activeUsers: doc.activeUsers,
    lastEditedLabel: doc.lastEditedLabel,
    comments: doc.comments.length,
    suggestions: doc.suggestions.filter((suggestion) => suggestion.status === "OPEN").length,
    approvalRate: doc.approvalRate,
    avgResolutionTime: doc.avgResolutionTime
  };
}

export function makeBlankDocument(title: string, language: string): DocumentDetail {
  return {
    id: `doc-${crypto.randomUUID()}`,
    title,
    language,
    ownerName: "Platform Team",
    role: "OWNER",
    status: "OPEN",
    contributors: 1,
    activeUsers: [
      {
        id: "user-current",
        name: "Project Lead",
        color: "#14b8a6",
        mode: "editing",
        line: 1,
        column: 1
      }
    ],
    lastEditedLabel: "just now",
    approvalRate: 0,
    avgResolutionTime: "n/a",
    content: "",
    comments: [],
    suggestions: [],
    versions: [],
    activity: [
      {
        id: crypto.randomUUID(),
        actorName: "Project Lead",
        action: "created",
        target: title,
        createdAt: new Date().toISOString()
      }
    ]
  };
}
