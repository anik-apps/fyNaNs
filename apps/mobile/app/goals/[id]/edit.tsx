import React, { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { ActivityIndicator } from "react-native";
import { apiFetch } from "@/src/lib/api-client";
import { GoalForm } from "@/src/components/goals/GoalForm";

export default function EditGoalScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [goal, setGoal] = useState<any | null>(null);

  useEffect(() => {
    apiFetch(`/api/goals/${id}`).then(setGoal).catch(() => {});
  }, [id]);

  if (!goal) return <ActivityIndicator style={{ marginTop: 40 }} />;
  return (
    <>
      <Stack.Screen options={{ title: "Edit Goal" }} />
      <GoalForm editing={goal} onSaved={() => router.back()} onCancel={() => router.back()} />
    </>
  );
}
