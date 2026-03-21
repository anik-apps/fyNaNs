import { Tabs, useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";
import {
  LayoutDashboard,
  Landmark,
  ArrowLeftRight,
  PiggyBank,
  Receipt,
  UserCircle,
} from "lucide-react-native";

function HeaderProfileButton() {
  const router = useRouter();
  return (
    <TouchableOpacity
      onPress={() => router.push("/(tabs)/settings")}
      style={{ marginRight: 12 }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <UserCircle color="#4A90D9" size={26} />
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#4A90D9",
        tabBarInactiveTintColor: "#9CA3AF",
        headerShown: true,
        headerRight: () => <HeaderProfileButton />,
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: "#E5E7EB",
          paddingBottom: 4,
          paddingTop: 4,
          height: 56,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          title: "Accounts",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Landmark color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: "Activity",
          tabBarIcon: ({ color, size }) => (
            <ArrowLeftRight color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="budgets"
        options={{
          title: "Budgets",
          tabBarIcon: ({ color, size }) => (
            <PiggyBank color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="bills"
        options={{
          title: "Bills",
          tabBarIcon: ({ color, size }) => (
            <Receipt color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
          title: "Settings",
        }}
      />
    </Tabs>
  );
}
