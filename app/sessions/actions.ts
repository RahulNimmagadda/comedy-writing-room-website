"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function joinSession(formData: FormData) {
  const { userId } = auth();
  if (!userId) throw new Error("Not signed in");

  const sessionId = String(formData.get("sessionId") || "");
  if (!sessionId) throw new Error("Missing sessionId");

  // Delegate all capacity + late-join rules to the DB (atomic + race-safe)
  const { error } = await supabaseAdmin.rpc("join_session", {
    p_session_id: sessionId,
    p_user_id: userId,
  });

  if (error) {
    // Supabase SQL exceptions show up here; make them readable
    throw new Error(error.message);
  }

  // Your homepage is "/"; revalidate that
  revalidatePath("/");
}
