import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/user.schema';
import { withDemoScope } from '../common/store/demo-scope';

const GRAPH = 'https://graph.microsoft.com/v1.0';
const SCOPES = ['openid', 'profile', 'offline_access', 'User.Read'].join(' ');
const OAUTH_PURPOSE = 'ms_oauth';

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  error?: string;
  error_description?: string;
};

/**
 * Microsoft Entra ID (Azure AD) OAuth for Aceolution Finance.
 * Pattern mirrors ACE Outsource: authorize → callback → find/create app user.
 * Azure AD group → role sync is intentionally not implemented yet.
 */
@Injectable()
export class MicrosoftAuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  private tenant(): string {
    return (this.config.get<string>('AZURE_TENANT_ID') || '').trim();
  }

  private clientId(): string {
    return (this.config.get<string>('AZURE_CLIENT_ID') || '').trim();
  }

  private clientSecret(): string {
    return (this.config.get<string>('AZURE_CLIENT_SECRET') || '').trim();
  }

  /**
   * Aceolution company emails for new Microsoft users.
   * Default: any `@aceolution.*` domain (.com, .tw, and any other Aceolution TLD).
   * Optional override: comma-separated exact domains in ALLOWED_EMAIL_DOMAIN(S).
   * Set ALLOWED_EMAIL_DOMAIN=*aceolution* (or leave empty / omit) for all Aceolution domains.
   */
  private allowedEmailDomains(): string[] {
    const raw = (
      this.config.get<string>('ALLOWED_EMAIL_DOMAINS') ||
      this.config.get<string>('ALLOWED_EMAIL_DOMAIN') ||
      '*aceolution*'
    )
      .trim()
      .toLowerCase();
    if (!raw || raw === '*' || raw === '*aceolution*' || raw === 'aceolution.*') {
      return ['*aceolution*'];
    }
    return [
      ...new Set(
        raw
          .split(/[,;\s]+/)
          .map((part) => part.replace(/^@/, '').trim())
          .filter(Boolean),
      ),
    ];
  }

  isConfigured(): boolean {
    return Boolean(this.tenant() && this.clientId() && this.clientSecret());
  }

  status() {
    const configured = this.isConfigured();
    const domains = this.allowedEmailDomains();
    const allAceolution = domains.includes('*aceolution*');
    return {
      configured,
      // Backend is ready; frontend may still hide the button via NEXT_PUBLIC_LOGIN.
      enabled: configured,
      allowedEmailDomain: allAceolution ? 'aceolution.*' : domains[0] || null,
      allowedEmailDomains: allAceolution ? ['aceolution.*'] : domains,
      // Group-based roles: hold — ask before building.
      azureAdGroupRoles: false,
    };
  }

  redirectUri(): string {
    const explicit = (this.config.get<string>('AZURE_REDIRECT_URI') || '').trim();
    if (explicit) return explicit;
    const apiPublic =
      (this.config.get<string>('API_PUBLIC_URL') || '').trim().replace(/\/$/, '') ||
      `http://localhost:${this.config.get<string>('PORT') || '3001'}`;
    return `${apiPublic}/auth/microsoft/callback`;
  }

  frontendUrl(): string {
    return (
      (this.config.get<string>('FRONTEND_URL') || '').trim().replace(/\/$/, '') ||
      'http://localhost:3000'
    );
  }

  private assertConfigured() {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        'Microsoft login is not configured. Set AZURE_TENANT_ID, AZURE_CLIENT_ID, and AZURE_CLIENT_SECRET.',
      );
    }
  }

  buildAuthorizeUrl(): { url: string } {
    this.assertConfigured();
    const state = this.jwtService.sign(
      {
        purpose: OAUTH_PURPOSE,
        nonce: crypto.randomUUID(),
      },
      { expiresIn: '10m' },
    );
    const params = new URLSearchParams({
      client_id: this.clientId(),
      response_type: 'code',
      redirect_uri: this.redirectUri(),
      response_mode: 'query',
      scope: SCOPES,
      state,
      prompt: 'select_account',
    });
    return {
      url: `https://login.microsoftonline.com/${this.tenant()}/oauth2/v2.0/authorize?${params}`,
    };
  }

  private verifyState(state: string) {
    try {
      const payload = this.jwtService.verify<{ purpose?: string }>(state);
      if (payload.purpose !== OAUTH_PURPOSE) {
        throw new Error('bad purpose');
      }
    } catch {
      throw new BadRequestException(
        'Login expired. Try Sign in with Microsoft again.',
      );
    }
  }

  async handleCallback(code: string, state: string): Promise<UserDocument> {
    this.assertConfigured();
    this.verifyState(state);
    const tokens = await this.exchangeToken({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri(),
    });
    const profile = await this.graphMe(tokens.access_token);
    // Microsoft always uses the live database (never demo).
    return withDemoScope(false, () =>
      this.usersService.findOrCreateFromMicrosoft(profile, {
        allowedEmailDomains: this.allowedEmailDomains(),
      }),
    );
  }

  private async exchangeToken(body: Record<string, string>) {
    const params = new URLSearchParams({
      client_id: this.clientId(),
      client_secret: this.clientSecret(),
      scope: SCOPES,
      ...body,
    });
    const response = await fetch(
      `https://login.microsoftonline.com/${this.tenant()}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      },
    );
    const data = (await response.json()) as TokenResponse;
    if (!response.ok || !data.access_token) {
      throw new BadRequestException(
        data.error_description || data.error || 'Microsoft token request failed',
      );
    }
    return data;
  }

  private async graphMe(accessToken: string) {
    const response = await fetch(
      `${GRAPH}/me?$select=id,displayName,mail,userPrincipalName`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!response.ok) {
      throw new BadRequestException('Could not read Microsoft profile');
    }
    const data = (await response.json()) as {
      id: string;
      displayName?: string;
      mail?: string;
      userPrincipalName?: string;
    };
    const email = (data.mail || data.userPrincipalName || '').toLowerCase();
    if (!data.id || !email) {
      throw new BadRequestException(
        'Microsoft did not return an email for this account',
      );
    }
    return {
      microsoftId: data.id,
      email,
      name: data.displayName || email,
    };
  }
}
