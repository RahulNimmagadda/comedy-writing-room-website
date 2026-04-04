import { SignOutButton, UserProfile } from "@clerk/nextjs";

export default function AccountPage() {
  return (
    <section className="space-y-6">
      <div className="flex justify-end">
        <SignOutButton>
          <button className="inline-flex items-center justify-center rounded-full bg-[#1f1510] px-5 py-2.5 text-sm font-semibold text-[#fff6ea] transition hover:bg-[#31231b]">
            Sign out
          </button>
        </SignOutButton>
      </div>

      <div className="overflow-hidden rounded-[2rem] border border-[#d8c3ad] bg-[#fbf5eb]/88 p-2 shadow-[0_24px_60px_rgba(58,36,23,0.08)]">
        <UserProfile path="/account" routing="path" />
      </div>
    </section>
  );
}
