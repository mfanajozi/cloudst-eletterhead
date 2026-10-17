import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-charcoal-900 text-white p-6">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gold-400">404</h1>
        <p className="mt-2 text-charcoal-400">Page not found</p>
        <Link
          href="/dashboard"
          className="mt-4 inline-flex items-center gap-2 text-sm text-gold-400 hover:underline"
        >
          <span>Return to dashboard</span>
        </Link>
      </div>
    </div>
  );
}
