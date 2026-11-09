"use client";
import { ErrorNotice } from "../src/components/ui";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="page-container">
      <ErrorNotice
        message="This page couldn't be loaded. Please try again."
        onRetry={reset}
      />
    </div>
  );
}
