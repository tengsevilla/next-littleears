import { StudioShell } from "@/components/layout/StudioShell";

// Route protection lives here, at the studio layout. The access token is memory-only and
// the refresh cookie is scoped to the API origin (path=/api/auth), so the Next server cannot
// see a session: the client shell restores it via refreshToken() and redirects to /login on failure.
// Pages under it are withheld until that check settles, so each studio page sets `instant = false`.
export default function StudioLayout({ children }: LayoutProps<"/studio">) {
  return <StudioShell>{children}</StudioShell>;
}
