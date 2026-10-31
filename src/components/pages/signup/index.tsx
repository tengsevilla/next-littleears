import Link from "next/link";
import { Music } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignupForm } from "./SignupForm";

export function SignupPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-[oklch(0.97_0.03_85)] px-4 py-12 dark:bg-background">
      <Link href="/" className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
        <span aria-hidden className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Music className="size-5" />
        </span>
        Little<span className="-ml-2 text-primary">Ears</span>
      </Link>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            <h1 className="text-xl font-bold">You&apos;re invited</h1>
          </CardTitle>
          <CardDescription>
            Choose a password to finish your account, then make songs and approve them before little ears hear them.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SignupForm />
        </CardContent>
      </Card>
    </main>
  );
}
