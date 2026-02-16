"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function isAdminUser(userId: string | null) {
  if (!userId) return false;
  const adminIds =
    process.env.ADMIN_USER_IDS?.split(",").map((s) => s.trim()) ?? [];
  return adminIds.includes(userId);
}

export async function joinSession(formData: FormData) {
  const { userId } = auth();
  if (!userId) throw new Error("Not signed in");

  // This action is intended to be "Admin: Sign Up Free"
  // Prevent non-admins from calling it directly.
  if (!isAdminUser(userId)) {
    throw new Error("Not authorized");
  }

  const sessionId = String(formData.get("sessionId") || "");
  if (!sessionId) throw new Error("Missing sessionId");

  // Delegate all capacity + rules to the DB (atomic + race-safe)
  const { error } = await supabaseAdmin.rpc("join_session", {
    p_session_id: sessionId,
    p_user_id: userId,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
}
