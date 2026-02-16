import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/how-it-works",
  "/sign-in(.*)",
  "/sign-up(.*)",

  // ✅ Stripe must be able to hit this without auth
  "/api/stripe/webhook(.*)",
]);

export default clerkMiddleware((auth, req) => {
  if (!isPublicRoute(req)) auth().protect();
});

export const config = {
  matcher: [
    // Match all routes except static files
    "/((?!_next|.*\\..*).*)",
    // Always run for API routes
    "/api/(.*)",
  ],
};
