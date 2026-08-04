import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", async (importOriginal) => {
  const original = await importOriginal<typeof import("next/navigation")>();
  return {
    ...original,
    useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  };
});

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

const { default: Home } = await import("@/app/page");
const { default: SearchPage } = await import("@/app/buscar/page");
const { default: AccountPage } = await import("@/app/cuenta/page");
const { default: LoginPage } = await import("@/app/auth/login/page");
const { default: LoginErrorPage } = await import("@/app/error-de-acceso/page");
const { default: AdminLayout } = await import("@/app/admin/layout");
const { default: PlaygroundPage } = await import("@/app/playground/page");
const { default: PortalDemoLayout } = await import("@/app/portal-demo/layout");
const { default: PortalDemoPage } = await import("@/app/portal-demo/page");
const { default: PortalDemoProfilePage } = await import("@/app/portal-demo/profile/page");
const { default: PortalDemoKeysPage } = await import("@/app/portal-demo/keys/page");
const { default: PortalDemoUsagePage } = await import("@/app/portal-demo/usage/page");
const { default: PortalDemoBillingPage } = await import("@/app/portal-demo/billing/page");
const { default: PortalDemoPlaygroundPage } = await import("@/app/portal-demo/playground/page");

describe("smoke de render", () => {
  it("la portada enlaza a la búsqueda canónica", () => {
    const html = renderToStaticMarkup(<Home />);
    expect(html).toContain("Consulta antecedentes judiciales de empresas chilenas");
    expect(html).toContain('href="/buscar"');
    expect(html).toContain("Riesgo de arrendatarios");
    expect(html).toContain("Cobertura disponible");
    expect(html).toContain("+1,3 M");
    expect(html).toContain("+42 mil");
  });

  it("/buscar renderiza ambos modos de consulta", () => {
    const html = renderToStaticMarkup(<SearchPage />);
    expect(html).toContain("Busca causas por empresa o RUT");
    expect(html).toContain("Empresa por nombre");
    expect(html).toContain("Por RUT");
  });

  it("/cuenta enlaza al login nativo y al registro por correo", () => {
    const html = renderToStaticMarkup(<AccountPage />);
    expect(html).toContain("Accede a tu portal");
    expect(html).toContain('href="/auth/login?returnTo=/dashboard"');
    expect(html).toContain("Ingresar a mi cuenta");
    expect(html).toContain('href="/registrarme"');
    expect(html).toContain('href="/recuperar"');
    expect(html).not.toContain("Continuar con Google");
  });

  it("/auth/login ofrece el formulario de correo y contraseña sin mención a Auth0", () => {
    const element = LoginPage({ searchParams: Promise.resolve({ returnTo: "/dashboard" }) });
    return element.then((page) => {
      const html = renderToStaticMarkup(page);
      expect(html).toContain("Ingresa a tu portal");
      expect(html).toContain('type="email"');
      expect(html).toContain('type="password"');
      expect(html).toContain('autoComplete="current-password"');
      expect(html).not.toContain("Auth0");
      expect(html).not.toContain("Google");
    });
  });

  it("/admin redirige al login sin sesión", async () => {
    await expect(AdminLayout({ children: null })).rejects.toThrow(/REDIRECT/);
  });

  it("/error-de-acceso explica un rechazo sin exponer detalles internos", () => {
    const html = renderToStaticMarkup(<LoginErrorPage />);
    expect(html).toContain("No fue posible autorizar esta cuenta");
    expect(html).toContain("Intentar ingresar nuevamente");
    expect(html).toContain('href="/auth/login?returnTo=/dashboard"');
    expect(html).not.toContain("authorization flow");
  });

  it("/playground ofrece una demo pública sin autenticación", () => {
    const html = renderToStaticMarkup(<PlaygroundPage />);
    expect(html).toContain("API playground · demostración");
    expect(html).toContain("Entorno demo");
    expect(html).toContain("X-API-Key");
  });

  it("/portal-demo ofrece todas las secciones estáticas sin autenticación", () => {
    const html = renderToStaticMarkup(<PortalDemoLayout><PortalDemoPage /></PortalDemoLayout>);
    expect(html).toContain("Portal de usuario");
    expect(html).toContain("Empresa Demo SpA");
    expect(html).toContain('href="/portal-demo/profile"');
    expect(html).toContain('href="/portal-demo/keys"');
    expect(html).toContain('href="/portal-demo/usage"');
    expect(html).toContain('href="/portal-demo/billing"');
    expect(html).toContain('href="/portal-demo/playground"');
    expect(html).not.toContain("/auth/login");

    const sections = [
      renderToStaticMarkup(<PortalDemoProfilePage />),
      renderToStaticMarkup(<PortalDemoKeysPage />),
      renderToStaticMarkup(<PortalDemoUsagePage />),
      renderToStaticMarkup(<PortalDemoBillingPage />),
      renderToStaticMarkup(<PortalDemoPlaygroundPage />),
    ].join("\n");
    expect(sections).toContain("Mi cuenta");
    expect(sections).toContain("API keys");
    expect(sections).toContain("Consumo y actividad");
    expect(sections).toContain("Saldo e historial");
    expect(sections).toContain("Construye una consulta");
  });
});
