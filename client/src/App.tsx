import { useEffect } from "react";
import { Link, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { CharacterCreatorPage } from "./pages/CharacterCreatorPage";
import { ChroniclePage } from "./pages/ChroniclePage";
import { MemoryCrystalPage } from "./pages/MemoryCrystalPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PlayPage } from "./pages/PlayPage";
import { SettingsPage } from "./pages/SettingsPage";
import { STORAGE_KEY } from "./state/constants";
import { useGameStore } from "./state/store";
import { migrateLegacyStorageKey } from "./state/utils";

export default function App() {
  const initializeSession = useGameStore((state) => state.initializeSession);
  const sessionId = useGameStore((state) => state.sessionId);

  useEffect(() => {
    migrateLegacyStorageKey();
    // Auto-load when a previous session exists in storage. Otherwise leave the
    // user on CharacterCreatorPage to make a choice.
    if (!sessionId && hasStoredSession()) {
      void initializeSession();
    }
  }, [initializeSession, sessionId]);

  return (
    <main className="cultivation-shell px-4 py-6 text-slate-100">
      <div className="relative z-10 mx-auto max-w-7xl">
        <TopNav />
        <Routes>
          <Route path="/" element={<LandingRedirect />} />
          <Route path="/create" element={<CharacterCreatorPage />} />
          <Route element={<Outlet />}>
            <Route path="/play" element={<PlayPage />} />
            <Route path="/play/scene/:sceneId" element={<PlayPage />} />
            <Route path="/memory" element={<MemoryCrystalPage />} />
            <Route path="/chronicle" element={<ChroniclePage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
    </main>
  );
}

function LandingRedirect() {
  const sessionId = useGameStore((state) => state.sessionId);
  if (sessionId || hasStoredSession()) {
    return <Navigate to="/play" replace />;
  }
  return <Navigate to="/create" replace />;
}

function hasStoredSession(): boolean {
  try {
    return Boolean(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return false;
  }
}

function TopNav() {
  const location = useLocation();
  const onPlay = location.pathname === "/" || location.pathname.startsWith("/play");
  const onMemory = location.pathname.startsWith("/memory");
  const onChronicle = location.pathname.startsWith("/chronicle");
  const onSettings = location.pathname.startsWith("/settings");

  return (
    <nav className="mb-4 flex items-center justify-between border-b border-cyan-400/15 pb-3">
      <div>
        <div className="text-[10px] uppercase tracking-[0.4em] text-cyan-300/70">// lower_city</div>
        <h1 className="text-lg font-semibold text-cyan-50 cultivation-glow-text">九龙下城 · 以仙途</h1>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <NavLink to="/play" label="对话" active={onPlay} />
        <NavLink to="/memory" label="记忆水晶" active={onMemory} />
        <NavLink to="/chronicle" label="史册" active={onChronicle} />
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
