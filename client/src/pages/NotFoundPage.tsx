import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <section className="cultivation-panel cultivation-corner mx-auto max-w-xl space-y-3 p-6 text-center">
      <h1 className="text-xl font-semibold text-cyan-50 cultivation-glow-text">404 · 此路不通</h1>
      <p className="text-sm text-slate-300">天道镜没有这条记录。</p>
      <Link
        to="/play"
        className="inline-flex rounded-md border border-cyan-300/60 px-4 py-1 text-xs uppercase tracking-[0.3em] text-cyan-100 transition hover:bg-cyan-500/10"
      >
        回到对话
      </Link>
    </section>
  );
}
