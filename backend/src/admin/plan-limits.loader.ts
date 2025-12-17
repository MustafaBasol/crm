import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PlanLimitsService } from './plan-limits.service';

@Injectable()
export class PlanLimitsLoader implements OnModuleInit {
  private readonly logger = new Logger(PlanLimitsLoader.name);

  constructor(private readonly planLimitsService: PlanLimitsService) {}

  onModuleInit() {
    // Uygulama başlatılırken override'ları uygula
    try {
      this.planLimitsService.applyOverridesOnBootstrap();

      // Avoid noisy console output in e2e runs.
      if (process.env.NODE_ENV !== 'test') {
        this.logger.log(
          'Plan limit overrides applied from config/plan-limits.json',
        );
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to apply plan limit overrides: ${reason}`);
    }
  }
}
