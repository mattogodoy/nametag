import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      surname: string | null;
      nickname: string | null;
      photo: string | null;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    email: string;
    name: string | null;
    surname: string | null;
    nickname: string | null;
    photo: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    surname: string | null;
    nickname: string | null;
    photo: string | null;
    jti?: string; // JWT ID for token blacklist tracking
    authTime?: number; // Sign-in time in seconds, stable across JWT re-encoding
  }
}
