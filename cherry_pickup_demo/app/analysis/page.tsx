import type { Metadata } from "next";
import MethodComparison from "../method-comparison";
import MethodNav from "../method-nav";

export const metadata: Metadata = {
  title: "Two Method Analysis | Algorithm Lab",
  description: "Compare Cherry Pickup DFS with memoization and bottom-up tabulation, including complexity and recorded benchmarks.",
};

export default function AnalysisPage() {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">↘</span><span>algorithm lab</span></div>
      </header>
      <MethodNav current="/analysis" />
      <section className="intro">
        <div>
          <p className="eyebrow">Problem 741 · method comparison</p>
          <h1>Two Method <em>Analysis.</em></h1>
          <p className="lede">Compare how DFS with memoization and bottom-up tabulation solve Cherry Pickup, and review the submission report’s results.</p>
        </div>
      </section>
      <MethodComparison />
      <footer className="footer"><span>cherry pickup / method analysis</span></footer>
    </main>
  );
}
