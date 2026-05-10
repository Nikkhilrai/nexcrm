import { client } from "./client";
import { cachedUser, tokens } from "./storage";
import type { LoginResponse, User } from "./types";

export const auth = {
  async login(username: string, password: string): Promise<LoginResponse> {
    const { data } = await client.post<LoginResponse>("/api/auth/login/", {
      username,
      password,
    });
    tokens.set(data.access, data.refresh);
    cachedUser.set(data.user);
    return data;
  },

  async me(): Promise<User> {
    const { data } = await client.get<User>("/api/auth/me/");
    cachedUser.set(data);
    return data;
  },

  /** Local-only logout: clear tokens + cached user. SimpleJWT has no
   *  server-side revoke endpoint in this build, so the access token will
   *  remain valid until its 8-hour expiry — fine for an internal tool. */
  logout(): void {
    tokens.clear();
    cachedUser.clear();
  },
};
