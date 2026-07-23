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
    if (payload?.purpose === 'login_2fa') {
      throw new UnauthorizedException('Complete two-factor verification to continue.');
    }
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
    };
  }
}
