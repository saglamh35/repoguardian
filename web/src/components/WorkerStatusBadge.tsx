"use client";

import { useEffect, useState } from "react";

export default function WorkerStatusBadge() {
  const [status, setStatus] = useState<{ ok: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/worker/health")
      .then((res) => res.json())
      .then(setStatus)
      .catch(() => setStatus({ ok: false }));
  }, []);

  if (!status) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        Worker: Unknown
      </span>
    );
  }

  if (status.ok) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        Worker: OK
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
      Worker: Degraded
    </span>
  );
}
