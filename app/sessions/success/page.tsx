import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

  const checkout = await stripe.checkout.sessions.retrieve(cs_id);

  // Only book if Stripe says it was paid
  if (checkout.payment_status !== "paid") {
    return (
      <main className="min-h-screen max-w-2xl mx-auto p-8">
        <h1 className="text-2xl font-bold">Payment not confirmed</h1>
        <p className="opacity-70 mt-2">If you were charged, contact support.</p>
      </main>
    );
  }

  // Insert booking (idempotent: if already exists, ignore)
  const { error } = await supabaseAdmin.from("bookings").insert({
    session_id,
    user_id: userId,
  });

  // If duplicate key, ignore; otherwise show error
  if (error && !String(error.message).toLowerCase().includes("duplicate")) {
    return (
      <main className="min-h-screen max-w-2xl mx-auto p-8">
        <h1 className="text-2xl font-bold">Booked, but…</h1>
        <pre className="mt-4 p-4 border rounded bg-white overflow-auto">
          {JSON.stringify(error, null, 2)}
        </pre>
      </main>
    );
  }

  // Back to homepage, now they’ll appear as Signed Up ✅
  redirect("/");
}
