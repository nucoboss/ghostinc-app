"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireAdmin } from "@/lib/admin-auth";
import { SESSION_COOKIE } from "@/lib/csrf";
import { adminUserAction } from "@/lib/admin-users";

function sessionToken() {
  return cookies().then((store) => store.get(SESSION_COOKIE)?.value);
}

export async function toggleUserBlocked(formData: FormData) {
  await requireAdmin("/admin/users");
  const userId = formData.get("userId");
  const blocked = formData.get("blocked");
  if (typeof userId !== "string" || !/^[0-9a-f-]{36}$/.test(userId)) {
    throw new Error("Invalid user ID.");
  }
  const token = await sessionToken();
  if (!token) throw new Error("SESSION_REQUIRED");
  await adminUserAction(blocked === "true" ? "block" : "unblock", userId, token);
  revalidatePath("/admin/users");
}

export async function changeUserRole(formData: FormData) {
  await requireAdmin("/admin/users");
  const userId = formData.get("userId");
  const role = formData.get("role");
  if (typeof userId !== "string" || !/^[0-9a-f-]{36}$/.test(userId)) {
    throw new Error("Invalid user ID.");
  }
  if (role !== "user" && role !== "admin") throw new Error("Invalid role.");
  const token = await sessionToken();
  if (!token) throw new Error("SESSION_REQUIRED");
  await adminUserAction("role", userId, token, role);
  revalidatePath("/admin/users");
}
