"use client";

import { useEffect } from "react";
import {
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { NotificationItem } from "./notification-item";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";

interface Notification {
  id: string;
  type: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

interface NotificationPage {
  items: Notification[];
  next_cursor: string | null;
  unread_count: number;
}

type NotificationCache = InfiniteData<NotificationPage, string | null>;

interface NotificationListProps {
  onUnreadCountChange?: (count: number) => void;
}

function fetchNotifications(cursor: string | null): Promise<NotificationPage> {
  const params = new URLSearchParams();
  params.set("limit", "20");
  if (cursor) params.set("cursor", cursor);
  return apiFetch<NotificationPage>(`/api/notifications?${params.toString()}`);
}

function markPagesRead(
  cache: NotificationCache | undefined,
  ids: "all" | string
): NotificationCache | undefined {
  if (!cache) return cache;
  return {
    ...cache,
    pages: cache.pages.map((page) => ({
      ...page,
      unread_count: ids === "all" ? 0 : page.unread_count,
      items: page.items.map((n) =>
        ids === "all" || n.id === ids ? { ...n, is_read: true } : n
      ),
    })),
  };
}

export function NotificationList({
  onUnreadCountChange,
}: NotificationListProps) {
  const queryClient = useQueryClient();
  const {
    data,
    isPending,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ["notifications"],
    queryFn: ({ pageParam }) => fetchNotifications(pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.next_cursor,
  });

  const unreadCount = data?.pages[0]?.unread_count;

  useEffect(() => {
    if (unreadCount !== undefined) {
      onUnreadCountChange?.(unreadCount);
    }
  }, [unreadCount, onUnreadCountChange]);

  const notifications = data?.pages.flatMap((page) => page.items) ?? [];

  async function markAsRead(id: string) {
    try {
      await apiFetch(`/api/notifications/${id}`, { method: "PATCH" });
      queryClient.setQueryData<NotificationCache>(["notifications"], (prev) =>
        markPagesRead(prev, id)
      );
    } catch {
      // handled
    }
  }

  async function markAllAsRead() {
    try {
      await apiFetch("/api/notifications/read-all", { method: "POST" });
      queryClient.setQueryData<NotificationCache>(["notifications"], (prev) =>
        markPagesRead(prev, "all")
      );
      onUnreadCountChange?.(0);
    } catch {
      // handled
    }
  }

  if (isPending) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">No notifications</p>
        <p className="text-sm mt-1">You are all caught up!</p>
      </div>
    );
  }

  const hasUnread = notifications.some((n) => !n.is_read);

  return (
    <div className="space-y-2">
      {hasUnread && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={markAllAsRead}>
            Mark all as read
          </Button>
        </div>
      )}
      <div className="space-y-1">
        {notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            {...notification}
            onMarkRead={markAsRead}
          />
        ))}
      </div>
      {hasNextPage && (
        <div className="text-center mt-4">
          <Button
            variant="outline"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
