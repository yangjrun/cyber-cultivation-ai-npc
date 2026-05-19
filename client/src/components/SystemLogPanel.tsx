export type SystemLog = {
  id: string;
  time: string;
  text: string;
};

type SystemLogPanelProps = {
  logs: SystemLog[];
};

export function SystemLogPanel({ logs }: SystemLogPanelProps) {
  return (
    <section className="cyber-panel cyber-panel--amber cyber-corner relative overflow-hidden p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-200">
          系统日志
        </h2>
        <span className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
          last 5
        </span>
      </header>

      {logs.length === 0 ? (
        <p className="text-sm text-slate-500">暂无日志。</p>
      ) : (
        <ul className="space-y-1.5 font-mono text-[12px] leading-5 text-amber-100/90">
          {logs.map((log) => (
            <li key={log.id} className="flex gap-2">
              <span className="text-amber-300/70">[{log.time}]</span>
              <span className="flex-1 text-slate-100">{log.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
