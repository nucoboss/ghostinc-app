import type { Metadata } from "next";
import Link from "next/link";
import { AccountDataScene } from "@/components/account-data-scene";
import { GhostIcon } from "@/components/ghost-icon";
import { SetPasswordForm } from "@/components/set-password-form";

export const metadata: Metadata = {
  title: "Crear contraseña | Ghostinc",
};
export const dynamic = "force-dynamic";

export default function CreatePasswordPage() {
  return (
    <main className="account-page">
      <section className="account-panel">
        <Link className="brand" href="/"><GhostIcon />Ghostinc</Link>
        <div className="account-copy">
          <span className="section-tag">Ghostinc API</span>
          <h1>Define tu contraseña</h1>
          <p>Usa un enlace reciente de uno de los correos que te enviamos para continuar.</p>
        </div>
        <SetPasswordForm />
      </section>
      <aside className="account-aside">
        <AccountDataScene />
      </aside>
    </main>
  );
}
