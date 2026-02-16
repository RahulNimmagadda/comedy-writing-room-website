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

export default clerkMiddleware((auth, req) => {
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
