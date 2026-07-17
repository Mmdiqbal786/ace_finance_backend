import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return the API welcome page HTML', () => {
      const html = appController.getHome();
      expect(html).toContain('Aceolution');
      expect(html).toContain('Finance API');
      expect(html).toContain('/auth/login');
      expect(html).toContain('/auth/verify-2fa');
      expect(html).toContain('/expenses/:id/request-changes');
      expect(html).toContain('/fx/convert');
      expect(html).toContain('Auth');
      expect(html).toContain('Expenses');
    });
  });
});
