import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  // Leave apiVersion unspecified to avoid mismatches
});
