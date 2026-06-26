import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';

import {
  AdminChatDao,
  AdminInviteDao,
  UserDao,
  UserRole,
} from '../../common/dao';

type AddAdminChatInput = {
  telegramChatId: string;
  title?: string | null;
  type: string;
};

type AddAdminResult =
  | { status: 'activated'; user: UserDao }
  | { status: 'pending'; username: string };

type RemoveAdminResult =
  | { status: 'removed'; user: UserDao }
  | { status: 'pending_removed'; username: string }
  | { status: 'not_found' };

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(UserDao)
    private readonly usersRepository: Repository<UserDao>,
    @InjectRepository(AdminChatDao)
    private readonly adminChatsRepository: Repository<AdminChatDao>,
    @InjectRepository(AdminInviteDao)
    private readonly adminInvitesRepository: Repository<AdminInviteDao>,
  ) {}

  async addAdmin(actor: UserDao, identifier: string): Promise<AddAdminResult> {
    this.assertSuperAdmin(actor);

    const username = this.normalizeUsername(identifier);

    if (username) {
      const user = await this.findUserByUsername(username);

      if (user) {
        user.role = UserRole.Admin;
        return {
          status: 'activated',
          user: await this.usersRepository.save(user),
        };
      }

      const invite =
        (await this.adminInvitesRepository.findOneBy({ username })) ||
        this.adminInvitesRepository.create({ username });

      invite.isActive = true;
      invite.invitedByUserId = actor.id;
      invite.activatedUserId = null;
      await this.adminInvitesRepository.save(invite);

      return { status: 'pending', username };
    }

    const telegramId = identifier.trim();
    const user =
      (await this.usersRepository.findOneBy({ telegramId })) ||
      this.usersRepository.create({
        telegramId,
        role: UserRole.Admin,
      });

    user.role = UserRole.Admin;

    return { status: 'activated', user: await this.usersRepository.save(user) };
  }

  async removeAdmin(
    actor: UserDao,
    identifier: string,
  ): Promise<RemoveAdminResult> {
    this.assertSuperAdmin(actor);

    const username = this.normalizeUsername(identifier);
    const user = username
      ? await this.findUserByUsername(username)
      : await this.usersRepository.findOneBy({ telegramId: identifier.trim() });

    if (user) {
      user.role = UserRole.User;
      return { status: 'removed', user: await this.usersRepository.save(user) };
    }

    if (username) {
      const invite = await this.adminInvitesRepository.findOneBy({
        username,
        isActive: true,
      });

      if (invite) {
        invite.isActive = false;
        await this.adminInvitesRepository.save(invite);

        return { status: 'pending_removed', username };
      }
    }

    return { status: 'not_found' };
  }

  async listAdmins() {
    return this.usersRepository.find({
      where: [{ role: UserRole.Admin }, { role: UserRole.SuperAdmin }],
      order: { createdAt: 'ASC' },
    });
  }

  async listPendingAdminInvites() {
    return this.adminInvitesRepository.find({
      where: { isActive: true },
      order: { createdAt: 'ASC' },
    });
  }

  async activatePendingAdminInvite(user: UserDao) {
    const username = this.normalizeUsername(user.username || undefined);

    if (!username) {
      return false;
    }

    const invite = await this.adminInvitesRepository.findOneBy({
      username,
      isActive: true,
    });

    if (!invite) {
      return false;
    }

    if (user.role !== UserRole.SuperAdmin) {
      user.role = UserRole.Admin;
      await this.usersRepository.save(user);
    }

    invite.isActive = false;
    invite.activatedUserId = user.id;
    await this.adminInvitesRepository.save(invite);

    return true;
  }

  async addAdminChat(actor: UserDao, input: AddAdminChatInput) {
    this.assertSuperAdmin(actor);

    const chat =
      (await this.adminChatsRepository.findOneBy({
        telegramChatId: input.telegramChatId,
      })) ||
      this.adminChatsRepository.create({
        telegramChatId: input.telegramChatId,
      });

    chat.title = input.title || null;
    chat.type = input.type;
    chat.isActive = true;
    chat.createdByUserId = actor.id;

    return this.adminChatsRepository.save(chat);
  }

  async disableAdminChat(actor: UserDao, telegramChatId: string) {
    this.assertSuperAdmin(actor);

    await this.adminChatsRepository.update(
      { telegramChatId },
      { isActive: false },
    );
  }

  async listActiveAdminChats() {
    return this.adminChatsRepository.find({
      where: { isActive: true },
      order: { createdAt: 'ASC' },
    });
  }

  private assertSuperAdmin(actor: UserDao) {
    if (actor.role !== UserRole.SuperAdmin) {
      throw new ForbiddenException('Only super admins can manage admins');
    }
  }

  private normalizeUsername(identifier?: string | null) {
    const value = identifier?.trim().replace(/^@/, '').toLowerCase();

    if (!value || /^\d+$/.test(value)) {
      return null;
    }

    return value;
  }

  private findUserByUsername(username: string) {
    return this.usersRepository.findOne({
      where: { username: ILike(username) },
    });
  }
}
