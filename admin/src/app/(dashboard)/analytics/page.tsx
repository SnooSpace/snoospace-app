"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users, Globe, Smartphone, TrendingUp, ArrowRight } from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { getAdvancedAnalytics, type AdvancedAnalytics } from "@/lib/api";

const COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#6366f1",
];

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AdvancedAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const data = await getAdvancedAnalytics();
        setAnalytics(data);
      } catch (err) {
        console.error("Failed to fetch advanced analytics:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load analytics"
        );
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">Loading advanced metrics...</p>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-16 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">Advanced metrics and insights</p>
        </div>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">Error: {error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">
          DAU/WAU/MAU, retention rates, geographic distribution & device metrics
        </p>
      </div>

      {/* Active Users Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Daily Active Users
            </CardTitle>
            <div className="rounded-lg p-2 bg-blue-100 dark:bg-blue-900/30">
              <Users className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics?.activeUsers.dau ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">Active today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Weekly Active Users
            </CardTitle>
            <div className="rounded-lg p-2 bg-purple-100 dark:bg-purple-900/30">
              <Users className="h-4 w-4 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics?.activeUsers.wau ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">Last 7 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Monthly Active Users
            </CardTitle>
            <div className="rounded-lg p-2 bg-green-100 dark:bg-green-900/30">
              <Users className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics?.activeUsers.mau ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Stickiness Ratio
            </CardTitle>
            <div className="rounded-lg p-2 bg-amber-100 dark:bg-amber-900/30">
              <TrendingUp className="h-4 w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analytics?.activeUsers.mau
                ? Math.round(
                    (analytics.activeUsers.dau / analytics.activeUsers.mau) *
                      100
                  )
                : 0}
              %
            </div>
            <p className="text-xs text-muted-foreground">DAU/MAU ratio</p>
          </CardContent>
        </Card>
      </div>

      {/* Active Users Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Active Users Trend</CardTitle>
          <CardDescription>
            Users active per day over the last 30 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={analytics?.activeUsers.trend || []}>
              <defs>
                <linearGradient id="dauGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 12 }}
              />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip labelFormatter={formatDate} />
              <Area
                type="monotone"
                dataKey="activeUsers"
                name="Active Users"
                stroke="#3b82f6"
                fill="url(#dauGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Retention & Device Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Retention Rates */}
        <Card>
          <CardHeader>
            <CardTitle>Retention Rates</CardTitle>
            <CardDescription>Users returning after signup</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                {
                  label: "D1 Retention",
                  data: analytics?.retention.d1,
                  color: "bg-blue-500",
                },
                {
                  label: "D7 Retention",
                  data: analytics?.retention.d7,
                  color: "bg-purple-500",
                },
                {
                  label: "D30 Retention",
                  data: analytics?.retention.d30,
                  color: "bg-green-500",
                },
              ].map((item) => (
                <div key={item.label} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{item.label}</span>
                    <span className="font-medium">{item.data?.rate ?? 0}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color} transition-all`}
                      style={{ width: `${item.data?.rate ?? 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {item.data?.retainedCount ?? 0} of{" "}
                    {item.data?.cohortSize ?? 0} users retained
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Device Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Device Distribution</CardTitle>
            <CardDescription>
              Platform breakdown of active users
            </CardDescription>
          </CardHeader>
          <CardContent>
            {analytics?.devices.byPlatform &&
            analytics.devices.byPlatform.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={analytics.devices.byPlatform}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="userCount"
                    nameKey="platform"
                    label={({ name, percent }) =>
                      `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                    labelLine={false}
                  >
                    {analytics.devices.byPlatform.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[280px] text-muted-foreground">
                <div className="text-center">
                  <Smartphone className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No device data yet</p>
                  <p className="text-xs">
                    Device info will appear as users log in
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Geographic Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Geographic Distribution</CardTitle>
          <CardDescription>Where your users are located</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {/* By Country */}
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Globe className="h-4 w-4" /> Top Countries
              </h4>
              {analytics?.geographic.byCountry &&
              analytics.geographic.byCountry.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={analytics.geographic.byCountry}
                    layout="vertical"
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-muted"
                    />
                    <XAxis type="number" tick={{ fontSize: 12 }} />
                    <YAxis
                      dataKey="country"
                      type="category"
                      width={80}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[200px] text-muted-foreground">
                  No location data available
                </div>
              )}
            </div>

            {/* Top Cities */}
            <div>
              <h4 className="text-sm font-medium mb-3">Top Cities</h4>
              <div className="space-y-2">
                {analytics?.geographic.byLocation &&
                analytics.geographic.byLocation.length > 0 ? (
                  analytics.geographic.byLocation.slice(0, 8).map((loc, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-muted-foreground">{i + 1}.</span>
                        {loc.city}, {loc.country}
                      </span>
                      <span className="font-medium">{loc.count}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No city data available
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* OS Version Distribution */}
      {analytics?.devices.byOS && analytics.devices.byOS.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>OS Version Distribution</CardTitle>
            <CardDescription>
              Active users by platform and OS version
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.devices.byOS.map((os, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        os.platform?.toLowerCase() === "ios"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                          : os.platform?.toLowerCase() === "android"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                      }`}
                    >
                      {os.platform || "Unknown"}
                    </span>
                    {os.osVersion || "Unknown version"}
                  </span>
                  <span className="font-medium">{os.count} users</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
