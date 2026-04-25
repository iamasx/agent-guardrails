import { useSiwsAuthStore } from "@/lib/stores/siws-auth";

export function clearSiwsAndRedirectToSignin(redirect: (url: string) => void = (url) => window.location.assign(url)): void {
  if (typeof window === "undefined") return;
  useSiwsAuthStore.getState().clearSignedIn();
  redirect("/signin");
}
