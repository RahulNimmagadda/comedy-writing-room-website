import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Routes that REQUIRE authentication
 * Everything else is public by default
 */
const isProtectedRoute = createRouteMatcher([
  // User account pages
  "/account(.*)",
  "/my-sessions(.*)",

  // Admin area
  "/admin(.*)",

  // Session join actions (page-based joins if any)
  "/join(.*)",

  // Protected API routes
  "/api/sessions/(.*)/join",
  "/api/admin/(.*)",
]);

/**
 * Always-public routes (never block)
 * Keeps cron/webhooks clean and avoids Clerk token parsing weirdness.
 */
const isAlwaysPublicRoute = createRouteMatcher([
  "/api/cron(.*)",
  "/api/stripe/webhook(.*)",
]);

export default clerkMiddleware((auth, req) => {
  if (isAlwaysPublicRoute(req)) return;

  if (isProtectedRoute(req)) {
    auth().protect();
  }
});

export const config = {
  matcher: [
    // Match all routes except static files
    "/((?!_next|.*\\..*).*)",
    // Always run for API routes
    "/api/(.*)",
  ],
};