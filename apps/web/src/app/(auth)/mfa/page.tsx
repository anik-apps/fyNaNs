import { Suspense } from "react";
import { MfaInput } from "@/components/auth/mfa-input";
import { Skeleton } from "@/components/ui/skeleton";

export default function MfaPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <MfaInput />
    </Suspense>
  );
}
