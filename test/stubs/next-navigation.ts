export function redirect(url: string): never {
  throw new Error(`REDIRECT_A_${url}`);
}

export function useRouter() {
  throw new Error("useRouter fuera del contexto de Next");
}
