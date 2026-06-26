import { ReportPhotoDao } from '../../common/dao';
import { R2StorageService } from '../storage/storage.service';
import { sendReportPhotoWithFallback } from './telegram-photo-sender';

describe('sendReportPhotoWithFallback', () => {
  it('uses telegram file_id first', async () => {
    const api = {
      sendPhoto: jest.fn().mockResolvedValueOnce(undefined),
    };
    const storage = { download: jest.fn() } as unknown as R2StorageService;

    await sendReportPhotoWithFallback(
      api as never,
      123,
      { telegramFileId: 'file-id', r2Key: 'key' } as ReportPhotoDao,
      storage,
    );

    expect(api.sendPhoto).toHaveBeenCalledWith(123, 'file-id');
    expect(storage.download).not.toHaveBeenCalled();
  });

  it('downloads from R2 when telegram file_id fails', async () => {
    const api = {
      sendPhoto: jest
        .fn()
        .mockRejectedValueOnce(new Error('wrong file id'))
        .mockResolvedValueOnce(undefined),
    };
    const storage = {
      download: jest.fn().mockResolvedValueOnce({
        body: Buffer.from('image'),
        contentType: 'image/jpeg',
      }),
    } as unknown as R2StorageService;

    await sendReportPhotoWithFallback(
      api as never,
      123,
      {
        telegramFileId: 'file-id',
        r2Key: 'reports/1/photo.jpg',
        mimeType: 'image/jpeg',
      } as ReportPhotoDao,
      storage,
    );

    expect(storage.download).toHaveBeenCalledWith('reports/1/photo.jpg');
    expect(api.sendPhoto).toHaveBeenLastCalledWith(123, expect.any(Object));
  });
});
