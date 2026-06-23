import { AppShell } from "@/components/app-shell";
import { DocumentsDashboard } from "@/components/documents-dashboard";
import { demoDocuments } from "@/lib/demo-data";

type View = "documents" | "reviews" | "suggestions" | "versions" | "roles";

function getView(value?: string): View {
  if (value === "reviews" || value === "suggestions" || value === "versions" || value === "roles") return value;
  return "documents";
}

export default function Home({ searchParams }: { searchParams?: { q?: string; view?: string } }) {
  const query = searchParams?.q ?? "";

  return (
    <AppShell>
      <DocumentsDashboard initialDocuments={demoDocuments} initialQuery={query} view={getView(searchParams?.view)} />
    </AppShell>
  );
}
