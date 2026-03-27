"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { ShieldCheck } from "lucide-react";
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
  { label: "Pharmacist", email: "pharmacy@hms.com", password: "password123" },
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
    <div className="w-full max-w-md">
      <div className="mb-4 rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm text-blue-700 shadow-sm">
        <div className="flex items-center gap-2 text-blue-900">
          <ShieldCheck className="h-4 w-4 text-red-600" />
          <span className="font-medium">Secure clinical access</span>
        </div>
        <p className="mt-1 text-xs">Authorized staff only. All activity is audited.</p>
      </div>

      <Card className="border-blue-100 shadow-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-2">
            <Image
              src="/hospital-logo.png"
              alt={hospitalName}
              width={72}
              height={72}
              className="rounded-full border border-blue-200 object-cover"
            />
          </div>
          <CardTitle className="text-2xl tracking-tight text-blue-900">{hospitalName}</CardTitle>
          <CardDescription className="text-blue-700">Sign in to continue to your dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@hospital.com"
                {...register("email")}
                className={errors.email ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {errors.email && <p className="text-destructive text-sm">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                {...register("password")}
                className={errors.password ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {errors.password && <p className="text-destructive text-sm">{errors.password.message}</p>}
            </div>
            <Button type="submit" className="h-10 w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-center text-xs font-medium text-muted-foreground">Quick test login</p>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
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
    </div>
  );
}
