"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

interface UserDistributionChartProps {
  data: {
    members: number;
    communities: number;
    sponsors: number;
    venues: number;
  };
}

const COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b"];

export function UserDistributionChart({ data }: UserDistributionChartProps) {
  const chartData = [
    { name: "Members", value: data.members },
    { name: "Communities", value: data.communities },
    { name: "Sponsors", value: data.sponsors },
    { name: "Venues", value: data.venues },
  ].filter((item) => item.value > 0);

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={80}
          paddingAngle={5}
          dataKey="value"
          label={({ name, percent }) =>
            `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
          }
          labelLine={false}
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
          }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
