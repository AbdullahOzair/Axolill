"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

/**
 * The page shell every admin screen renders through — capped at 1200px, with
 * the standard eyebrow / title / description header and a right-aligned
 * primary action. See CLAUDE.md → Admin Design System.
 */
export function AdminPage({
  eyebrow,
  title,
  description,
  action,
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      className={cn("admin-page", className)}
    >
      <header className="admin-header">
        <div className="min-w-0">
          {eyebrow && <p className="admin-eyebrow">{eyebrow}</p>}
          <h1 className="admin-title mt-1.5">{title}</h1>
          {description && (
            <p className="admin-description mt-1.5">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </header>

      {children}
    </motion.div>
  );
}
