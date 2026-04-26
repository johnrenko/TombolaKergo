"use client";

import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../../convex/_generated/api";
import { getAdminSessionToken } from "../../components/adminSession";
import { formatDate } from "../../components/format";

export default function AuditPage() {
  const [sessionToken, setSessionToken] = useState("");
  const logs = useQuery(api.auth.listAuditLogs, sessionToken ? { sessionToken, limit: 100 } : "skip") as any[] | undefined;

  useEffect(() => {
    setSessionToken(getAdminSessionToken());
  }, []);

  return (
    <main className="content stack">
      <div>
        <h1 className="page-title">Historique</h1>
        <p className="muted">Journal des actions réalisées par les administrateurs.</p>
      </div>
      <section className="card">
        {!logs ? (
          <p className="muted">Chargement…</p>
        ) : logs.length === 0 ? (
          <p className="muted">Aucune action enregistrée.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Détail</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log._id}>
                    <td>{formatDate(log.createdAt)}</td>
                    <td>{log.actorEmail ?? "Système"}</td>
                    <td>{log.action}</td>
                    <td>{log.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
