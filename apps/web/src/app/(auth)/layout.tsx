import { AuthProvider } from "@/providers/auth-provider";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
        {/* Watermark logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-watermark.png"
          alt=""
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] opacity-[0.25] pointer-events-none select-none dark:opacity-[0.30]"
        />
        <div className="w-full max-w-md relative z-10">
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
