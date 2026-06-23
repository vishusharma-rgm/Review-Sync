import jwt from "jsonwebtoken";
import type { User } from "@/lib/types";

const fallbackSecret = "reviewsync-development-secret";

export type AuthTokenPayload = {
  userId: string;
  email: string;
  name: string;
};

export function signAuthToken(user: User) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      name: user.name
    },
    process.env.JWT_SECRET || fallbackSecret,
    { expiresIn: "7d" }
  );
}

export function verifyAuthToken(token: string) {
  return jwt.verify(token, process.env.JWT_SECRET || fallbackSecret) as AuthTokenPayload;
}

export function publicUser(user: { id: string; email: string; name: string }) {
  return {
    id: user.id,
    email: user.email,
    name: user.name
  };
}
