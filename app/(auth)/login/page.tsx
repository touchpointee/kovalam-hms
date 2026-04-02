"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
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
  laboratory: "/laboratory/dashboard",
};

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  // Warm up DB connection as soon as login page loads so credentials submit is fast
  useEffect(() => {
    fetch("/api/db-warmup").catch(() => {});
  }, []);

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
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  {...register("password")}
                  className={`pr-11 ${errors.password ? "border-destructive focus-visible:ring-destructive" : ""}`}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-500 hover:text-slate-700"
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-destructive text-sm">{errors.password.message}</p>}
            </div>
            <Button type="submit" className="h-10 w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
