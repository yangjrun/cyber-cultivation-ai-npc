import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from "recharts";
import type { ElementRoots, RootElement } from "../api/sessionApi";

const labels: Record<RootElement, string> = {
  metal: "金",
  wood: "木",
  water: "水",
  fire: "火",
  earth: "土"
};

type RootsRadarChartProps = {
  roots: ElementRoots;
};

export function RootsRadarChart({ roots }: RootsRadarChartProps) {
  const data = (Object.entries(roots) as Array<[RootElement, number]>).map(([element, value]) => ({
    element: labels[element],
    value
  }));

  if (navigator.userAgent.includes("jsdom")) {
    return (
      <div aria-label="五行灵根雷达图" className="grid grid-cols-5 gap-1 text-center text-[11px] text-violet-100">
        {data.map((item) => <span key={item.element}>{item.element}{item.value}</span>)}
      </div>
    );
  }

  return (
    <div className="h-40 w-full" aria-label="五行灵根雷达图">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="rgba(148,163,184,0.25)" />
          <PolarAngleAxis dataKey="element" tick={{ fill: "#c4b5fd", fontSize: 11 }} />
          <Radar dataKey="value" stroke="#a78bfa" fill="#8b5cf6" fillOpacity={0.35} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
