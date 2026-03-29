import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { dbConnect } from "./mongoose";
import User from "@/models/User";
import { log } from "@/lib/logger";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email.toLowerCase();
        try {
          await dbConnect();
        } catch (err) {
          console.error("Auth DB connect failed:", err);
          await log.error({
            category: "auth",
            message: "Login failed: database unavailable",
            route: "nextauth.credentials.authorize",
            userEmail: email,
            meta: err instanceof Error ? { error: err.message } : { error: String(err) },
          });
          throw new Error("Database connection failed. Check MongoDB Atlas and network.");
        }
        const user = await User.findOne({ email }).lean() as { _id: unknown; name: string; email: string; password: string; role: string } | null;
        if (!user) {
          await log.warn({
            category: "auth",
            message: "Login failed: user not found",
            route: "nextauth.credentials.authorize",
            userEmail: email,
          });
          return null;
        }
        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) {
          await log.warn({
            category: "auth",
            message: "Login failed: invalid password",
            route: "nextauth.credentials.authorize",
            userId: String(user._id),
            userEmail: user.email,
            userRole: user.role,
          });
          return null;
        }
        await log.info({
          category: "auth",
          message: "Login success",
          route: "nextauth.credentials.authorize",
          userId: String(user._id),
          userEmail: user.email,
          userRole: user.role,
        });
        return {
          id: String(user._id),
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session && session.user && token) {
        session.user = {
          ...session.user,
          id: token.id as string,
          role: token.role as string,
        } as any;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
};
