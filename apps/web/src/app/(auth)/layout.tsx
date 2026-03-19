import { AuthProvider } from "@/providers/auth-provider";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold">
              fy<span className="text-muted-foreground">NaN</span>s
            </h1>
            <p className="text-muted-foreground mt-1">
              Your finances, beyond the numbers
            </p>
          </div>
          {children}
        </div>
      </div>
    </AuthProvider>
  );
}
