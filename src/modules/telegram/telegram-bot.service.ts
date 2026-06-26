import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { Bot, GrammyError } from 'grammy';

import { getBotConfig } from '../../config/bot.config';
import { userBotCommands } from './domain/telegram-commands';
import { TelegramUpdateService } from './telegram-update.service';

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name);
  private readonly config = getBotConfig();
  private bot: Bot | null = null;

  constructor(private readonly updates: TelegramUpdateService) {}

  async onModuleInit() {
    if (!this.config.token) {
      this.logger.warn(
        'BOT_TOKEN is not set. Telegram bot polling is disabled.',
      );
      return;
    }

    if (this.config.mode !== 'polling') {
      this.logger.warn(`BOT_MODE=${this.config.mode} is not implemented yet.`);
      return;
    }

    this.bot = new Bot(this.config.token);
    this.updates.register(this.bot);

    try {
      await this.bot.api.setMyCommands(userBotCommands);
      await this.bot.start({
        onStart: ({ username }) =>
          this.logger.log(`Telegram bot @${username} started in polling mode`),
      });
    } catch (error) {
      if (error instanceof GrammyError && error.error_code === 409) {
        this.logger.error(
          'Telegram polling conflict: another getUpdates consumer is already running for this BOT_TOKEN. Stop the other app instance or close manual getUpdates requests, then restart this service.',
        );
        return;
      }

      throw error;
    }
  }

  async onModuleDestroy() {
    await this.bot?.stop();
  }
}
