import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      // Özel repo erişimi için "repo" şart
      authorization: { params: { scope: "read:user user:email repo" } },
    }),
  ],
  callbacks: {
    async jwt({ token, account, user }) {
      if (account?.access_token) (token as any).accessToken = account.access_token;
      if (user?.id) (token as any).uid = user.id; // DB user id
      return token;
    },
    async session({ session, token, user }) {
      (session as any).accessToken = (token as any).accessToken ?? null;
      if (!session.user) (session as any).user = {};
      (session.user as any).id = user?.id ?? (token as any).uid ?? null;
      return session;
    },
  },
});
