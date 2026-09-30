import type { Metadata } from "next";
import TabulationLab from "./tabulation-lab";

export const metadata: Metadata = {
  title: "Bottom-up Table | Algorithm Lab",
  description:
    "Watch the Cherry Pickup DP table fill layer by layer, and predict each value.",
};

export default function TabulationPage() {
  return <TabulationLab />;
}
