import { HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';

const mockHealthCheckService = {
  check: jest.fn(),
};

const mockTypeOrmHealthIndicator = {
  pingCheck: jest.fn(),
};

describe('HealthController', () => {
  let healthController: HealthController;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: mockHealthCheckService,
        },
        {
          provide: TypeOrmHealthIndicator,
          useValue: mockTypeOrmHealthIndicator,
        },
      ],
    }).compile();

    healthController = moduleRef.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(healthController).toBeDefined();
  });

  describe('getHealth', () => {
    it('should be defined', () => {
      expect(healthController.getHealth).toBeDefined();
    });

    it('should return an ok status', async () => {
      const result = await healthController.getHealth();
      expect(result).toEqual({ status: 'ok' });
    });
  });

  describe('getPostgresHealth', () => {
    it('should be defined', () => {
      expect(healthController.getPostgresHealth).toBeDefined();
    });

    it('should return the result of check method', async () => {
      mockHealthCheckService.check.mockReturnValueOnce('result');

      const result = await healthController.getPostgresHealth();

      expect(mockHealthCheckService.check).toHaveBeenCalled();
      expect(result).toEqual('result');
    });

    it('should call check method with array of functions with pingCheck', async () => {
      mockTypeOrmHealthIndicator.pingCheck.mockReturnValueOnce('result');

      await healthController.getPostgresHealth();

      const result = mockHealthCheckService.check.mock.calls[0][0][0]();

      expect(mockHealthCheckService.check).toHaveBeenCalledWith([
        expect.any(Function),
      ]);
      expect(result).toEqual('result');
    });
  });
});
