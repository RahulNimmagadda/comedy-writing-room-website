export default function ContactPage() {
  return (
    <main className="min-h-screen max-w-2xl mx-auto px-4 py-12">
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Contact</h1>

        <p className="text-base opacity-80">
          Questions, feedback, or interested in hosting a writing room?
          <br />
          Reach out anytime.
        </p>

        <div className="bg-gray-50 border rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Email</p>

          <a
            href="mailto:hello@comedywritingroom.com"
            className="text-lg font-medium text-blue-600 hover:underline"
          >
            hello@comedywritingroom.com
          </a>
        </div>
      </div>
    </main>
  );
}