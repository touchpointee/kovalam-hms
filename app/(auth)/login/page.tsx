"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type FormData = z.infer<typeof schema>;

const hospitalName = process.env.NEXT_PUBLIC_HOSPITAL_NAME ?? "Hospital";

const roleDashboard: Record<string, string> = {
  admin: "/admin/dashboard",
  doctor: "/doctor/dashboard",
  pharmacy: "/pharmacy/dashboard",
  frontdesk: "/frontdesk/dashboard",
};

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  // Warm up DB connection as soon as login page loads so credentials submit is fast
  useEffect(() => {
    fetch("/api/db-warmup").catch(() => {});
  }, []);

  const testCredentials = [
    { label: "Admin", email: "admin@hms.com", password: "password123" },
    { label: "Doctor", email: "doctor@hms.com", password: "password123" },
    { label: "Front Desk", email: "frontdesk@hms.com", password: "password123" },
  ] as const;

  function fillAndSubmit(email: string, password: string) {
    setValue("email", email);
    setValue("password", password);
    setLoading(true);
    signIn("credentials", { email, password, redirect: false })
      .then((res) => {
        if (res?.error) {
          toast.error(res.error ?? "Invalid credentials");
          setLoading(false);
          return;
        }
        return fetch("/api/auth/session").then((r) => r.json());
      })
      .then((session) => {
        if (!session?.user?.role) return;
        const path = roleDashboard[session.user.role];
        toast.success("Logged in successfully");
        router.push(path);
        router.refresh();
      })
      .catch((err) => {
        setLoading(false);
        const msg = err?.message || (typeof err === "string" ? err : "");
        if (msg.includes("fetch") || msg.includes("Failed to fetch") || msg.includes("Connection")) {
          toast.error("Server unreachable. Is the dev server running? Try: npm run dev");
        } else {
          toast.error(msg || "Something went wrong");
        }
      })
      .finally(() => setLoading(false));
  }

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });
      if (res?.error) {
        toast.error(res.error ?? "Invalid credentials");
        return;
      }
      const sessionRes = await fetch("/api/auth/session");
      const session = await sessionRes.json();
      const role = session?.user?.role;
      const path = role ? roleDashboard[role] : "/login";
      toast.success("Logged in successfully");
      router.push(path);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("fetch") || msg.includes("Failed to fetch") || msg.includes("Connection")) {
        toast.error("Server unreachable. Is the dev server running? Try: npm run dev");
      } else {
        toast.error(msg || "Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">{hospitalName}</CardTitle>
        <CardDescription>Sign in to continue</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              {...register("email")}
              className={errors.email ? "border-destructive" : ""}
            />
            {errors.email && (
              <p className="text-destructive text-sm">{errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              {...register("password")}
              className={errors.password ? "border-destructive" : ""}
            />
            {errors.password && (
              <p className="text-destructive text-sm">{errors.password.message}</p>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
          <div className="space-y-2 pt-2">
            <p className="text-muted-foreground text-center text-xs">Quick test login</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {testCredentials.map(({ label, email, password }) => (
                <Button
                  key={email}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  onClick={() => fillAndSubmit(email, password)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
