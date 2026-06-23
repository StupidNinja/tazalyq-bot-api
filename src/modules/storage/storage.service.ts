import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';

import { getStorageConfig } from '../../config/storage.config';

type UploadInput = {
  key: string;
  body: Buffer;
  contentType?: string;
};

@Injectable()
export class R2StorageService {
  private readonly config = getStorageConfig();
  private client: S3Client | null = null;

  async upload(input: UploadInput) {
    if (
      !this.config.endpoint ||
      !this.config.accessKeyId ||
      !this.config.secretAccessKey ||
      !this.config.bucketName
    ) {
      throw new Error('R2 storage is not configured');
    }

    await this.getClient().send(
      new PutObjectCommand({
        Bucket: this.config.bucketName,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType || 'application/octet-stream',
      }),
    );

    return {
      bucket: this.config.bucketName,
      key: input.key,
      url: this.config.publicBaseUrl
        ? `${this.config.publicBaseUrl.replace(/\/$/, '')}/${input.key}`
        : null,
    };
  }

  private getClient() {
    if (!this.client) {
      this.client = new S3Client({
        region: 'auto',
        endpoint: this.config.endpoint,
        credentials: {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
        },
      });
    }

    return this.client;
  }
}
