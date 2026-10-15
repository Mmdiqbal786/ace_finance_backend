import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: getConnectionToken(),
          useValue: { readyState: 1 },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return the API welcome page HTML', () => {
      const html = appController.getHome();
      expect(html).toContain('Aceolution');
      expect(html).toContain('Finance API');
      expect(html).toContain('/Ace_logo_small.png');
      expect(html).toContain('rel="icon"');
      expect(html).toContain('/auth/login');
      expect(html).toContain('/expenses');
      expect(html).toContain('/fx/convert');
      expect(html).toContain('Swagger UI');
      expect(html).toContain('OpenAPI');
    });
  });
});
