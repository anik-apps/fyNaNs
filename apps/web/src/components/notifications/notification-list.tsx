"use client";

import { useEffect, useState, useCallback } from "react";
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

interface NotificationListProps {
  onUnreadCountChange?: (count: number) => void;
}

export function NotificationList({
  onUnreadCountChange,
}: NotificationListProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchNotifications = useCallback(async (nextCursor?: string) => {
    const params = new URLSearchParams();
    params.set("limit", "20");
    if (nextCursor) params.set("cursor", nextCursor);

    return apiFetch<{
      items: Notification[];
      next_cursor: string | null;
      unread_count: number;
    }>(`/api/notifications?${params.toString()}`);
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchNotifications();
        setNotifications(data.items);
        setCursor(data.next_cursor);
        setHasMore(!!data.next_cursor);
        onUnreadCountChange?.(data.unread_count);
      } catch {
        // handled
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [fetchNotifications, onUnreadCountChange]);

  async function loadMore() {
    if (!cursor) return;
    setIsLoadingMore(true);
    try {
      const data = await fetchNotifications(cursor);
      setNotifications((prev) => [...prev, ...data.items]);
      setCursor(data.next_cursor);
      setHasMore(!!data.next_cursor);
    } catch {
      // handled
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function markAsRead(id: string) {
    try {
      await apiFetch(`/api/notifications/${id}`, { method: "PATCH" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch {
      // handled
    }
  }

  async function markAllAsRead() {
    try {
      await apiFetch("/api/notifications/read-all", { method: "POST" });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      onUnreadCountChange?.(0);
    } catch {
      // handled
    }
  }

  if (isLoading) {
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
      {hasMore && (
        <div className="text-center mt-4">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? "Loading..." : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}
