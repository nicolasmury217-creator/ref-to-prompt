interface ErrorBannerProps {
  error: string;
  reasons: string[] | null;
}

export function ErrorBanner({ error, reasons }: ErrorBannerProps) {
  return (
    <div className="rounded border border-red-800 bg-red-950 p-4 text-sm">
      <p className="text-red-300">{error}</p>
      {reasons && (
        <ul className="mt-2 list-disc list-inside text-red-400">
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
