import React from "react";
import { useRouter, Stack } from "expo-router";
import { GoalForm } from "@/src/components/goals/GoalForm";

export default function NewGoalScreen() {
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ title: "New Goal" }} />
      <GoalForm onSaved={() => router.back()} onCancel={() => router.back()} />
    </>
  );
}
