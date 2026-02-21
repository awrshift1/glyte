"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-[#0f1729] flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-bold text-white mb-2">
            Something went wrong
          </h2>
          <p className="text-gray-400 text-sm mb-4">{error.message}</p>
          <button
            onClick={reset}
            className="px-4 py-2 bg-[#2563eb] text-white rounded-lg text-sm hover:bg-[#1d4ed8]"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
