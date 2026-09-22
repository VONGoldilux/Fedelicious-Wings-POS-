"use client";

import { Text, Spinner } from "@fluentui/react-components";
import type { FluentIcon } from "@fluentui/react-icons";
import { useSharedStyles } from "./styles";

// Shared zero-state / loading-state treatment so "no sales in this window",
// "no staff yet", "no shifts this period" etc. all look like an intentional
// empty state rather than a broken box — matches Analytics' donut/trend
// empty states.
export function EmptyState({ icon: Icon, message }: { icon?: FluentIcon; message: string }) {
  const styles = useSharedStyles();
  return (
    <div className={styles.emptyState}>
      {Icon && <Icon fontSize={28} />}
      <Text>{message}</Text>
    </div>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  const styles = useSharedStyles();
  return (
    <div className={styles.emptyState}>
      <Spinner size="tiny" label={label} labelPosition="after" />
    </div>
  );
}
