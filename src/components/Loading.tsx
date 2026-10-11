export function Loading({ label }: { label: string }) {
  return (
    <p className="loading" role="status">
      {label}
    </p>
  );
}
