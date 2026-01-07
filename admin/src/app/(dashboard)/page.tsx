"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Users,
  CalendarDays,
  TrendingUp,
  FileText,
  MessageSquare,
  Heart,
} from "lucide-react";
import {
  getOverviewStats,
  getUserAnalytics,
  getEventAnalytics,
  getEngagementAnalytics,
  type OverviewStats,
  type UserAnalytics,
  type EventAnalytics,
  type EngagementAnalytics,
} from "@/lib/api";
import {
  UserGrowthChart,
  UserDistributionChart,
  EngagementChart,
} from "@/components/analytics";

export default function DashboardPage() {
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [userAnalytics, setUserAnalytics] = useState<UserAnalytics | null>(
    null
  );
  const [eventAnalytics, setEventAnalytics] = useState<EventAnalytics | null>(
    null
  );
  const [engagementAnalytics, setEngagementAnalytics] =
    useState<EngagementAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const [overviewData, userData, eventData, engagementData] =
          await Promise.all([
            getOverviewStats(),
            getUserAnalytics("30d"),
            getEventAnalytics("30d"),
            getEngagementAnalytics("30d"),
          ]);

        setOverview(overviewData);
        setUserAnalytics(userData);
        setEventAnalytics(eventData);
        setEngagementAnalytics(engagementData);
      } catch (err) {
        console.error("Failed to fetch analytics:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load analytics"
        );
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const stats = [
    {
      title: "Total Users",
      value: overview?.totalUsers ?? "—",
      description: `${overview?.totalMembers ?? 0} members, ${
        overview?.totalCommunities ?? 0
      } communities`,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-100 dark:bg-blue-900/30",
    },
    {
      title: "Total Events",
      value: overview?.totalEvents ?? "—",
      description: `${eventAnalytics?.byStatus.upcoming ?? 0} upcoming`,
      icon: CalendarDays,
      color: "text-purple-600",
      bgColor: "bg-purple-100 dark:bg-purple-900/30",
    },
    {
      title: "Total Posts",
      value: overview?.totalPosts ?? "—",
      description: `${engagementAnalytics?.posts.thisWeek ?? 0} this week`,
      icon: FileText,
      color: "text-green-600",
      bgColor: "bg-green-100 dark:bg-green-900/30",
    },
    {
      title: "Engagement",
      value: engagementAnalytics
        ? `${
            engagementAnalytics.comments.total + engagementAnalytics.likes.total
          }`
        : "—",
      description: `${engagementAnalytics?.comments.total ?? 0} comments, ${
        engagementAnalytics?.likes.total ?? 0
      } likes`,
      icon: TrendingUp,
      color: "text-amber-600",
      bgColor: "bg-amber-100 dark:bg-amber-900/30",
    },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                <div className="h-8 w-8 bg-muted animate-pulse rounded-lg" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-20 bg-muted animate-pulse rounded mb-2" />
                <div className="h-3 w-32 bg-muted animate-pulse rounded" />
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
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here&apos;s what&apos;s happening with SnooSpace.
          </p>
        </div>
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">Error loading analytics: {error}</p>
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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here&apos;s what&apos;s happening with SnooSpace.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`rounded-lg p-2 ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {typeof stat.value === "number"
                  ? stat.value.toLocaleString()
                  : stat.value}
              </div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* User Growth Chart */}
        <Card>
          <CardHeader>
            <CardTitle>User Growth</CardTitle>
            <CardDescription>New signups over the last 30 days</CardDescription>
          </CardHeader>
          <CardContent>
            {userAnalytics && <UserGrowthChart data={userAnalytics.growth} />}
          </CardContent>
        </Card>

        {/* User Distribution Chart */}
        <Card>
          <CardHeader>
            <CardTitle>User Distribution</CardTitle>
            <CardDescription>Breakdown by user type</CardDescription>
          </CardHeader>
          <CardContent>
            {userAnalytics && (
              <UserDistributionChart data={userAnalytics.byType} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Engagement Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Engagement Trends</CardTitle>
          <CardDescription>
            Posts, comments, and likes over the last 30 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          {engagementAnalytics && (
            <EngagementChart data={engagementAnalytics.trend} />
          )}
        </CardContent>
      </Card>

      {/* Recent Activity & Events */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Signups */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Signups</CardTitle>
            <CardDescription>Latest users to join</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {userAnalytics?.recentSignups.slice(0, 5).map((user) => (
                <div
                  key={`${user.type}-${user.id}`}
                  className="flex items-center gap-4"
                >
                  <div
                    className={`h-2 w-2 rounded-full ${
                      user.type === "member" ? "bg-blue-500" : "bg-purple-500"
                    }`}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {user.type} •{" "}
                      {new Date(user.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
              {(!userAnalytics?.recentSignups ||
                userAnalytics.recentSignups.length === 0) && (
                <p className="text-sm text-muted-foreground">
                  No recent signups
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Events */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Events</CardTitle>
            <CardDescription>Latest events created</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {eventAnalytics?.recentEvents.slice(0, 5).map((event) => (
                <div key={event.id} className="flex items-center gap-4">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{event.title}</p>
                    <p className="text-xs text-muted-foreground">
                      by {event.community_name} • {event.attendee_count}{" "}
                      attendees
                    </p>
                  </div>
                </div>
              ))}
              {(!eventAnalytics?.recentEvents ||
                eventAnalytics.recentEvents.length === 0) && (
                <p className="text-sm text-muted-foreground">
                  No recent events
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
