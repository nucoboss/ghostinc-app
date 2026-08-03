import type { Metadata } from "next";
import Link from "next/link";
import { PlaygroundForm } from "@/components/playground-form";

export const metadata: Metadata = { title: "API Playground | Ghostinc" };

export default function PlaygroundPage() {
  return (
    <main className="dashboard-content">
      <div className="playground-title">
        <div><span className="section-tag">API Playground</span><h1>Construye una consulta</h1><p>Explora parámetros y respuestas antes de integrar el endpoint.</p></div>
        <div className="playground-actions">
          <Link href="/developers">Ver documentación →</Link>
        </div>
      </div>
      <PlaygroundForm />
    </main>
  );
}
