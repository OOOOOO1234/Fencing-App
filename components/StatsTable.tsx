import type { ActionStat } from "@/lib/stats";

export function StatsTable({ stats }: { stats: ActionStat[] }) {
  return (
    <div className="card" style={{ overflowX: "auto" }}>
      <table>
        <thead>
          <tr>
            <th>Action</th>
            <th>Attempts</th>
            <th>Successful</th>
            <th>Didn't work</th>
            <th>No touch</th>
            <th>Success</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((row) => (
            <tr key={row.action}>
              <td>{row.action}</td>
              <td className="num">{row.attempts}</td>
              <td className="num good">{row.successful}</td>
              <td className="num bad">{row.failed}</td>
              <td className="num quiet">{row.neither}</td>
              <td className="num">{row.attempts === 0 ? "—" : `${Math.round(row.successRate * 100)}%`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
