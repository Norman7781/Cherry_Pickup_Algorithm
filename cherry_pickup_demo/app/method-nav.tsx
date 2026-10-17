import Link from "next/link";

export default function MethodNav({ current }: { current: string }) {
  return (
    <nav className="method-nav" aria-label="Algorithm pages">
      {[
        ["/", "DFS + memoization"],
        ["/tabulation", "Bottom-up tabulation"],
        ["/analysis", "Two Method Analysis"],
      ].map(([href, label]) => (
        <Link key={href} href={href} aria-current={current === href ? "page" : undefined}>{label}</Link>
      ))}
    </nav>
  );
}
