import { Stack } from "expo-router";

export default function AccountsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: true, title: "Accounts" }} />
      <Stack.Screen name="add" options={{ headerShown: true, title: "Add Account" }} />
      <Stack.Screen name="[id]" options={{ headerShown: true, title: "Account" }} />
    </Stack>
  );
}
