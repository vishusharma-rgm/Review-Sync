import { AppShell } from "@/components/app-shell";
import { EditorWorkspace } from "@/components/editor-workspace";
import { getDocument } from "@/lib/demo-data";
import type { DocumentDetail } from "@/lib/types";

export default function DocumentPage({ params }: { params: { id: string } }) {
  const document =
    getDocument(params.id) ??
    ({
      id: params.id,
      title: "untitled.ts",
      language: "typescript",
      content: "",
      role: "OWNER",
      status: "OPEN",
      ownerName: "Platform Team",
      contributors: 1,
      activeUsers: [
        {
          id: "user-current",
          name: "Vishu",
          color: "#14b8a6",
          mode: "editing",
          line: 1,
          column: 1
        }
      ],
      lastEditedLabel: "just now",
      approvalRate: 0,
      avgResolutionTime: "n/a",
      comments: [],
      suggestions: [],
      versions: [],
      activity: []
    } satisfies DocumentDetail);

  return (
    <AppShell>
      <EditorWorkspace initialDocument={document} />
    </AppShell>
  );
}
