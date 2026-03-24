import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Routes that REQUIRE authentication
 * Everything else is public by default
 */
const isProtectedRoute = createRouteMatcher([
  "/account(.*)",
  "/my-sessions(.*)",
  "/admin(.*)",
  "/sessions/(.*)/join(.*)",
  "/api/sessions/(.*)/join",
  "/api/admin/(.*)",
]);

/**
 * Always-public routes
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
    "/((?!_next|.*\\..*).*)",
    "/api/(.*)",
  ],
};