import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import { R2StorageService } from './storage.service';

jest.mock('@aws-sdk/client-s3', () => {
  const send = jest.fn();

  return {
    GetObjectCommand: jest.fn((input) => ({ input, type: 'get' })),
    PutObjectCommand: jest.fn((input) => ({ input, type: 'put' })),
    S3Client: jest.fn(() => ({ send })),
    __send: send,
  };
});

describe('R2StorageService', () => {
  const env = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...env,
      R2_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
      R2_ACCESS_KEY_ID: 'access',
      R2_SECRET_ACCESS_KEY: 'secret',
      R2_BUCKET_NAME: 'bucket',
    };
  });

  afterAll(() => {
    process.env = env;
  });

  it('downloads objects from R2 as buffers', async () => {
    const chunks = [Buffer.from('hello'), Buffer.from(' world')];
    const client = {
      send: jest.fn().mockResolvedValueOnce({
        Body: {
          async *[Symbol.asyncIterator]() {
            yield* chunks;
          },
        },
        ContentType: 'image/jpeg',
      }),
    };
    (S3Client as unknown as jest.Mock).mockImplementationOnce(() => client);
    const service = new R2StorageService();

    const result = await service.download('reports/1/photo.jpg');

    expect(GetObjectCommand).toHaveBeenCalledWith({
      Bucket: 'bucket',
      Key: 'reports/1/photo.jpg',
    });
    expect(result.body.equals(Buffer.from('hello world'))).toBe(true);
    expect(result.contentType).toBe('image/jpeg');
  });

  it('uploads with PutObjectCommand', async () => {
    const client = { send: jest.fn().mockResolvedValueOnce({}) };
    (S3Client as unknown as jest.Mock).mockImplementationOnce(() => client);
    const service = new R2StorageService();

    await service.upload({
      key: 'reports/1/photo.jpg',
      body: Buffer.from('content'),
      contentType: 'image/jpeg',
    });

    expect(PutObjectCommand).toHaveBeenCalledWith({
      Bucket: 'bucket',
      Key: 'reports/1/photo.jpg',
      Body: Buffer.from('content'),
      ContentType: 'image/jpeg',
    });
  });
});
