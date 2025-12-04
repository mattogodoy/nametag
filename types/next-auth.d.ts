import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      surname: string | null;
      nickname: string | null;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    email: string;
    name: string | null;
    surname: string | null;
    nickname: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    surname: string | null;
    nickname: string | null;
  }
}
