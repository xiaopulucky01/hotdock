import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
  OnModuleInit,
} from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { PersistenceService } from '../persistence/persistence.service';
import { UserService } from '../user/user.service';
import { IdentityService } from './identity.service';
import { PlatformConfigService } from '../config/config.service';
import { SecretsService } from '../secrets/secrets.service';

export interface OAuthProviderConfig {
  id: string;
  displayName: string;
  clientId: string;
  /** stored encrypted */
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes?: string[];
  /** JSON path-ish: default sub/email/name mapping */
  enabled: boolean;
}

interface OAuthState {
  provider: string;
  tenantId?: string;
  redirectUri: string;
  createdAt: string;
  nonce: string;
}

/**
 * Generic OAuth2/OIDC authorization-code helper.
 * Configure providers via platform config / API; maps external identity to local user.
 */
@Injectable()
export class OAuthService implements OnModuleInit {
  private providers = new Map<string, OAuthProviderConfig>();
  private states = new Map<string, OAuthState>();
  private loaded = false;

  constructor(
    private readonly persistence: PersistenceService,
    private readonly users: UserService,
    private readonly identity: IdentityService,
    private readonly config: PlatformConfigService,
    private readonly secrets: SecretsService,
  ) {}

  async onModuleInit() {
    await this.ensureLoaded();
    this.config.registerSchema([
      {
        key: 'platform.oauth.enabled',
        type: 'boolean',
        default: false,
        description: 'Enable OAuth/OIDC login',
      },
    ]);
  }

  private async ensureLoaded() {
    if (this.loaded) return;
    this.loaded = true;
    const data = await this.persistence.load<OAuthProviderConfig[]>(
      'oauth-providers',
    );
    for (const p of data ?? []) this.providers.set(p.id, p);
  }

  private async persist() {
    await this.persistence.save('oauth-providers', [...this.providers.values()]);
  }

  listProviders() {
    return [...this.providers.values()].map((p) => ({
      id: p.id,
      displayName: p.displayName,
      enabled: p.enabled,
      authorizeUrl: p.authorizeUrl,
      scopes: p.scopes,
    }));
  }

  async upsertProvider(
    input: Omit<OAuthProviderConfig, 'clientSecret'> & {
      clientSecret: string;
    },
  ) {
    await this.ensureLoaded();
    const sealed: OAuthProviderConfig = {
      ...input,
      clientSecret: this.secrets.seal(input.clientSecret) as string,
    };
    this.providers.set(sealed.id, sealed);
    await this.persist();
    return this.listProviders().find((p) => p.id === sealed.id);
  }

  start(providerId: string, redirectUri: string, tenantId?: string) {
    const provider = this.providers.get(providerId);
    if (!provider?.enabled) {
      throw new BadRequestException(`OAuth provider ${providerId} not enabled`);
    }
    const state = randomBytes(16).toString('hex');
    this.states.set(state, {
      provider: providerId,
      tenantId,
      redirectUri,
      createdAt: new Date().toISOString(),
      nonce: randomBytes(8).toString('hex'),
    });
    const scopes = (provider.scopes ?? ['openid', 'profile', 'email']).join(' ');
    const url = new URL(provider.authorizeUrl);
    url.searchParams.set('client_id', provider.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', scopes);
    url.searchParams.set('state', state);
    return { url: url.toString(), state };
  }

  async callback(input: { code: string; state: string }) {
    const st = this.states.get(input.state);
    if (!st) throw new UnauthorizedException('Invalid OAuth state');
    this.states.delete(input.state);
    const provider = this.providers.get(st.provider);
    if (!provider) throw new BadRequestException('Unknown provider');

    const clientSecret = String(this.secrets.reveal(provider.clientSecret));
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: input.code,
      redirect_uri: st.redirectUri,
      client_id: provider.clientId,
      client_secret: clientSecret,
    });
    const tokenRes = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!tokenRes.ok) {
      throw new UnauthorizedException('OAuth token exchange failed');
    }
    const tokenJson = (await tokenRes.json()) as {
      access_token: string;
      id_token?: string;
    };
    const infoRes = await fetch(provider.userInfoUrl, {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    if (!infoRes.ok) {
      throw new UnauthorizedException('OAuth userinfo failed');
    }
    const info = (await infoRes.json()) as {
      sub?: string;
      email?: string;
      preferred_username?: string;
      name?: string;
    };
    const externalId = info.sub ?? info.email;
    if (!externalId) {
      throw new UnauthorizedException('OAuth profile missing sub/email');
    }
    const username =
      info.preferred_username ??
      info.email ??
      `${provider.id}_${createHash('sha1').update(externalId).digest('hex').slice(0, 8)}`;

    let user = this.users.findByUsername(username);
    if (!user) {
      const created = await this.identity.register({
        username,
        password: randomBytes(24).toString('base64url'),
        email: info.email,
        tenantId: st.tenantId,
      });
      return this.identity.issueTokensForUser(created.id);
    }
    return this.identity.issueTokensForUser(user.id);
  }
}
