import { useEffect } from "react";
import { Link, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PlayPage } from "./pages/PlayPage";
import { SettingsPage } from "./pages/SettingsPage";
import { useGameStore } from "./state/store";

export default function App() {
  const initializeSession = useGameStore((state) => state.initializeSession);

  useEffect(() => {
    void initializeSession();
  }, [initializeSession]);

  return (
    <main className="cyber-shell px-4 py-6 text-slate-100">
      <div className="relative z-10 mx-auto max-w-7xl">
        <TopNav />
        <Routes>
          <Route path="/" element={<Navigate to="/play" replace />} />
          <Route element={<Outlet />}>
            <Route path="/play" element={<PlayPage />} />
            <Route path="/play/scene/:sceneId" element={<PlayPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
    </main>
  );
}

function TopNav() {
  const location = useLocation();
  const onPlay = location.pathname === "/" || location.pathname.startsWith("/play");
  const onSettings = location.pathname.startsWith("/settings");

  return (
    <nav className="mb-4 flex items-center justify-between border-b border-cyan-400/15 pb-3">
      <div>
        <div className="text-[10px] uppercase tracking-[0.4em] text-cyan-300/70">// cyber_cultivation</div>
        <h1 className="text-lg font-semibold text-cyan-50 cyber-glow-text">赛博修仙 · 对话演示</h1>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <NavLink to="/play" label="对话" active={onPlay} />
        <NavLink to="/settings" label="设置" active={onSettings} />
      </div>
    </nav>
  );
}

function NavLink({ to, label, active }: { to: string; label: string; active: boolean }) {
  return (
    <Link
      to={to}
      className={
        active
          ? "rounded-md border border-cyan-300/70 bg-cyan-500/10 px-3 py-1 uppercase tracking-[0.3em] text-cyan-100"
          : "rounded-md border border-slate-600/50 px-3 py-1 uppercase tracking-[0.3em] text-slate-300 transition hover:border-cyan-300/60 hover:text-cyan-100"
      }
    >
      {label}
    </Link>
  );
}
