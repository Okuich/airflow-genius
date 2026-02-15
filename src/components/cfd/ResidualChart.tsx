import { ResidualData } from "@/domain/cfd/types";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface ResidualChartProps {
  residuals: ResidualData[];
}

const LINES = [
  { key: "continuity", label: "Continuity", color: "hsl(192, 85%, 55%)" },
  { key: "xMomentum", label: "X-Momentum", color: "hsl(160, 70%, 45%)" },
  { key: "yMomentum", label: "Y-Momentum", color: "hsl(38, 92%, 55%)" },
  { key: "zMomentum", label: "Z-Momentum", color: "hsl(0, 72%, 55%)" },
  { key: "kTurbulent", label: "k (Turbulent)", color: "hsl(270, 60%, 60%)" },
  { key: "epsilonOrOmega", label: "ε/ω", color: "hsl(192, 85%, 75%)" },
] as const;

export function ResidualChart({ residuals }: ResidualChartProps) {
  // Sample every Nth point for performance
  const step = Math.max(1, Math.floor(residuals.length / 200));
  const sampled = residuals.filter((_, i) => i % step === 0 || i === residuals.length - 1);

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={sampled} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(220, 18%, 16%)"
            strokeOpacity={0.5}
          />
          <XAxis
            dataKey="iteration"
            tick={{ fontSize: 10, fill: "hsl(215, 12%, 50%)", fontFamily: "JetBrains Mono" }}
            axisLine={{ stroke: "hsl(220, 18%, 18%)" }}
            tickLine={{ stroke: "hsl(220, 18%, 18%)" }}
            label={{ value: "Iteration", position: "insideBottom", offset: -2, fontSize: 10, fill: "hsl(215, 12%, 50%)" }}
          />
          <YAxis
            scale="log"
            domain={["auto", "auto"]}
            tick={{ fontSize: 10, fill: "hsl(215, 12%, 50%)", fontFamily: "JetBrains Mono" }}
            axisLine={{ stroke: "hsl(220, 18%, 18%)" }}
            tickLine={{ stroke: "hsl(220, 18%, 18%)" }}
            tickFormatter={(v: number) => v.toExponential(0)}
            label={{ value: "Residual", angle: -90, position: "insideLeft", offset: 0, fontSize: 10, fill: "hsl(215, 12%, 50%)" }}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(220, 22%, 10%)",
              border: "1px solid hsl(220, 18%, 18%)",
              borderRadius: "6px",
              fontSize: "11px",
              fontFamily: "JetBrains Mono",
            }}
            labelStyle={{ color: "hsl(215, 15%, 85%)" }}
            formatter={(value: number) => value.toExponential(3)}
          />
          <Legend
            wrapperStyle={{ fontSize: "10px", fontFamily: "JetBrains Mono" }}
          />
          {LINES.map((line) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              name={line.label}
              stroke={line.color}
              dot={false}
              strokeWidth={1.5}
              strokeOpacity={0.85}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
