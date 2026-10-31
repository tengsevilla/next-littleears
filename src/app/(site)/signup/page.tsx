import type { Metadata } from "next";
import { SignupPage } from "@/components/pages/signup";

// no-referrer: the invite token is in this page's URL until the client strips it.
export const metadata: Metadata = { title: "Join LittleEars", referrer: "no-referrer" };

export default function Page() {
  return <SignupPage />;
}
