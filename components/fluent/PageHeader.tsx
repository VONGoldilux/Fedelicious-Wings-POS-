"use client";

import type { ReactNode } from "react";
import { Title2, Text, tokens } from "@fluentui/react-components";
import { useSharedStyles } from "./styles";

// The "<h1> + subtitle + optional right-aligned control" block every admin
// page repeats — factored out so title/subtitle typography can't drift
// between pages the way it had (some used font-display text-2xl, some
// text-xl, etc.).
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  const styles = useSharedStyles();
  return (
    <div className={styles.pageHeaderRow}>
      <div>
        <Title2 as="h1">{title}</Title2>
        {subtitle && (
          <Text style={{ color: tokens.colorNeutralForeground3 }} block>
            {subtitle}
          </Text>
        )}
      </div>
      {action}
    </div>
  );
}
