import { Stack } from "expo-router";

export default function GoalsStack() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Savings Goals" }} />
      <Stack.Screen name="[id]" options={{ title: "Goal" }} />
      <Stack.Screen name="new" options={{ title: "New Goal", presentation: "modal" }} />
    </Stack>
  );
}
