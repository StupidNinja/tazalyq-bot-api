import { InputFile } from 'grammy';

import { ReportPhotoDao } from '../../common/dao';
import { R2StorageService } from '../storage/storage.service';

type TelegramPhotoApi = {
  sendPhoto: (
    chatId: number | string,
    photo: string | InputFile,
  ) => Promise<unknown>;
};

export const sendReportPhotoWithFallback = async (
  api: TelegramPhotoApi,
  chatId: number | string,
  photo: ReportPhotoDao,
  storage: R2StorageService,
) => {
  try {
    await api.sendPhoto(chatId, photo.telegramFileId);
    return;
  } catch {
    const downloaded = await storage.download(photo.r2Key);

    await api.sendPhoto(
      chatId,
      new InputFile(downloaded.body, `photo-${photo.id}.jpg`),
    );
  }
};
