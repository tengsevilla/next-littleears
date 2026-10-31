import type { Metadata } from "next";
import { LoginPage } from "@/components/pages/login";

export const metadata: Metadata = { title: "Sign in" };

export default function Page() {
  return <LoginPage />;
}
