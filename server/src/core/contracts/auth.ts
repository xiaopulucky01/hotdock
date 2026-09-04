export interface AuthenticatedUser {
  id: string;
  username: string;
  email?: string;
  tenantId?: string;
  roles: string[];
  permissions: string[];
}

export interface AuthTokenPayload {
  sub: string;
  username: string;
  tenantId?: string;
  roles: string[];
  type: 'access' | 'refresh';
  jti: string;
  iat?: number;
  exp?: number;
}

export interface LoginCredentials {
  username: string;
  password: string;
  tenantId?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}
