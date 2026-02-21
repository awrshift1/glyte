export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen font-[var(--font-space-grotesk)]">
      {children}
    </div>
  );
}
