import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { stripe } from "@/lib/stripe";

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ cs_id?: string; session_id?: string }>;
}) {
  const { userId } = auth();
  if (!userId) redirect("/sign-in");

  const { cs_id, session_id } = await searchParams;

  if (!cs_id || !session_id) {
    return (
      <main className="min-h-screen max-w-2xl mx-auto p-8">
        <h1 className="text-2xl font-bold">Missing payment info</h1>
        <p className="opacity-70 mt-2">Could not confirm your payment.</p>
      </main>
    );
  }

  // Optional: verify Stripe says it's paid (nice UX)
  const checkout = await stripe.checkout.sessions.retrieve(cs_id);

  if (checkout.payment_status !== "paid") {
    return (
      <main className="min-h-screen max-w-2xl mx-auto p-8">
        <h1 className="text-2xl font-bold">Payment not confirmed</h1>
        <p className="opacity-70 mt-2">
          If you were charged, your payment may still be processing. Check back in a moment.
        </p>
        <a className="underline" href="/">Back to sessions</a>
      </main>
    );
  }

  // ✅ Do NOT insert booking here.
  // Webhook is the source of truth and will book + auto-refund if needed.
  redirect("/");
}
