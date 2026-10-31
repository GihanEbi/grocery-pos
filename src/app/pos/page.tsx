import type { Metadata } from "next";
import { PosTerminal } from "@/components/pos/pos-terminal";

export const metadata: Metadata = { title: "POS Terminal" };

export default function PosPage() {
  return <PosTerminal />;
}
