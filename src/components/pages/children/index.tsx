"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChildren } from "@/hooks/api/useChildren";
import type { Child } from "@/lib/api/types";
import { ChildFormDialog } from "./ChildFormDialog";
import { ChildrenList } from "./ChildrenList";
import { DeleteChildDialog } from "./DeleteChildDialog";
import { NamePreviewProvider } from "./NamePreview";

// Client-side by necessity: the bearer token lives in browser memory, so reads (SWR) and
// mutations (apiClient + SWR revalidation) run here rather than in Server Actions.
export function ChildrenPage() {
  const { children, error, isLoading, mutate } = useChildren();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Child | null>(null);
  const [deleting, setDeleting] = useState<Child | null>(null);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(child: Child) {
    setEditing(child);
    setFormOpen(true);
  }

  return (
    <NamePreviewProvider>
      <main className="flex flex-1 flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Children</h1>
            <p className="text-sm text-muted-foreground">Songs can sing their name and fit their age.</p>
          </div>
          <Button onClick={openCreate}>
            <Plus data-icon="inline-start" />
            Add a child
          </Button>
        </header>

        <ChildrenList
          items={children}
          isLoading={isLoading}
          error={error}
          onRetry={() => mutate()}
          onAdd={openCreate}
          onEdit={openEdit}
          onDelete={setDeleting}
        />

        <ChildFormDialog open={formOpen} onOpenChange={setFormOpen} child={editing} onSaved={() => mutate()} />
        <DeleteChildDialog child={deleting} onClose={() => setDeleting(null)} onDeleted={() => mutate()} />
      </main>
    </NamePreviewProvider>
  );
}
