"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const search = useSearchParams();
  const router = useRouter();
  const redirect = search.get("redirect") ?? "/";

  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function googleSignIn() {
    setGoogleLoading(true);
    const supabase = createSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirect)}`;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, queryParams: { hd: "coolset.com" } },
    });
  }

  async function emailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.toLowerCase().endsWith("@coolset.com")) {
      toast.error("Only @coolset.com emails are allowed");
      return;
    }
    setEmailLoading(true);
    const supabase = createSupabaseBrowserClient();
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirect)}`,
          },
        });
        if (error) throw error;
        toast.success("Check your inbox to confirm your email.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(redirect);
        router.refresh();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign-in failed";
      toast.error(msg.includes("auth_domain_violation") ? "Only @coolset.com emails are allowed" : msg);
    } finally {
      setEmailLoading(false);
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>🌿 Office Plant Care</CardTitle>
          <CardDescription>Sign in with your Coolset account.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="google" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="google">Google</TabsTrigger>
              <TabsTrigger value="email">Email</TabsTrigger>
            </TabsList>

            <TabsContent value="google">
              <Button onClick={googleSignIn} disabled={googleLoading} className="w-full">
                {googleLoading ? "Redirecting…" : "Continue with Google"}
              </Button>
            </TabsContent>

            <TabsContent value="email">
              <form onSubmit={emailSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@coolset.com"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={emailLoading}>
                  {emailLoading ? "…" : mode === "signup" ? "Create account" : "Sign in"}
                </Button>
                <button
                  type="button"
                  onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
                  className="text-xs text-muted-foreground underline-offset-2 hover:underline w-full text-center"
                >
                  {mode === "signin" ? "No account? Create one" : "Already have an account? Sign in"}
                </button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </main>
  );
}
