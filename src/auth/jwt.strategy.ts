import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    // Access tokens have no `purpose`. Reject challenge / OAuth / workspace JWTs
    // so they cannot be used as Bearer sessions (would bypass role checks).
    if (payload?.purpose) {
      const hints: Record<string, string> = {
        login_2fa: 'Complete two-factor verification to continue.',
        workspace_choice: 'Choose Live or Demo workspace to continue.',
        ms_oauth: 'Finish Microsoft sign-in before calling the API.',
      };
      throw new UnauthorizedException(
        hints[String(payload.purpose)] ||
          'This token cannot be used as an API session. Sign in again.',
      );
    }
    if (!payload?.sub || !payload?.email || !payload?.role) {
      throw new UnauthorizedException('Invalid access token.');
    }
    const store = payload.store === 'demo' ? 'demo' : 'live';
    return {
      userId: payload.sub,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      mustChangePassword: Boolean(payload.mustChangePassword),
      mustSetupTotp: Boolean(payload.mustSetupTotp),
      totpEnabled: Boolean(payload.totpEnabled),
      assignedProjects: Array.isArray(payload.assignedProjects)
        ? payload.assignedProjects
        : [],
      isDemo: Boolean(payload.isDemo),
      store,
    };
  }
}
