import { ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';

import {
  AdminChatDao,
  AdminInviteDao,
  UserDao,
  UserRole,
} from '../../common/dao';
import { AdminService } from './admin.service';

const createRepositoryMock = () => ({
  create: jest.fn((value) => value),
  find: jest.fn(),
  findOne: jest.fn(),
  findOneBy: jest.fn(),
  save: jest.fn((value) => Promise.resolve(value)),
  update: jest.fn(),
});

describe('AdminService', () => {
  const createService = () => {
    const usersRepository = createRepositoryMock();
    const adminChatsRepository = createRepositoryMock();
    const adminInvitesRepository = createRepositoryMock();
    const service = new AdminService(
      usersRepository as unknown as Repository<UserDao>,
      adminChatsRepository as unknown as Repository<AdminChatDao>,
      adminInvitesRepository as unknown as Repository<AdminInviteDao>,
    );

    return {
      service,
      usersRepository,
      adminChatsRepository,
      adminInvitesRepository,
    };
  };

  it('promotes users to admin when requested by a super admin', async () => {
    const { service, usersRepository } = createService();
    usersRepository.findOneBy.mockResolvedValueOnce(null);

    await service.addAdmin(
      { id: 'super-id', role: UserRole.SuperAdmin } as UserDao,
      '123456',
    );

    expect(usersRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        telegramId: '123456',
        role: UserRole.Admin,
      }),
    );
  });

  it('promotes existing users by username', async () => {
    const { service, usersRepository } = createService();
    const existingUser = {
      id: 'user-id',
      username: 'target_user',
      role: UserRole.User,
    } as UserDao;
    usersRepository.findOne.mockResolvedValueOnce(existingUser);

    const result = await service.addAdmin(
      { id: 'super-id', role: UserRole.SuperAdmin } as UserDao,
      '@target_user',
    );

    expect(result.status).toBe('activated');
    expect(usersRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user-id',
        role: UserRole.Admin,
      }),
    );
  });

  it('creates a pending invite when username has not opened the bot yet', async () => {
    const { service, usersRepository, adminInvitesRepository } =
      createService();
    usersRepository.findOne.mockResolvedValueOnce(null);
    adminInvitesRepository.findOneBy.mockResolvedValueOnce(null);

    const result = await service.addAdmin(
      { id: 'super-id', role: UserRole.SuperAdmin } as UserDao,
      '@new_admin',
    );

    expect(result.status).toBe('pending');
    expect(adminInvitesRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'new_admin',
        isActive: true,
        invitedByUserId: 'super-id',
      }),
    );
  });

  it('activates a pending username invite when the user opens the bot', async () => {
    const { service, usersRepository, adminInvitesRepository } =
      createService();
    const invite = {
      id: 'invite-id',
      username: 'new_admin',
      isActive: true,
    } as AdminInviteDao;
    const user = {
      id: 'user-id',
      username: 'New_Admin',
      role: UserRole.User,
    } as UserDao;
    adminInvitesRepository.findOneBy.mockResolvedValueOnce(invite);

    const result = await service.activatePendingAdminInvite(user);

    expect(result).toBe(true);
    expect(usersRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user-id',
        role: UserRole.Admin,
      }),
    );
    expect(adminInvitesRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'invite-id',
        isActive: false,
        activatedUserId: 'user-id',
      }),
    );
  });

  it('removes pending invites by username', async () => {
    const { service, usersRepository, adminInvitesRepository } =
      createService();
    usersRepository.findOne.mockResolvedValueOnce(null);
    adminInvitesRepository.findOneBy.mockResolvedValueOnce({
      id: 'invite-id',
      username: 'new_admin',
      isActive: true,
    });

    const result = await service.removeAdmin(
      { id: 'super-id', role: UserRole.SuperAdmin } as UserDao,
      '@new_admin',
    );

    expect(result).toEqual({
      status: 'pending_removed',
      username: 'new_admin',
    });
    expect(adminInvitesRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'invite-id',
        isActive: false,
      }),
    );
  });

  it('blocks non-super-admins from changing roles', async () => {
    const { service } = createService();

    await expect(
      service.addAdmin(
        { id: 'admin-id', role: UserRole.Admin } as UserDao,
        '123',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('blocks non-super-admins from registering admin chats', async () => {
    const { service } = createService();

    await expect(
      service.addAdminChat(
        { id: 'admin-id', role: UserRole.Admin } as UserDao,
        {
          telegramChatId: '-100123',
          title: 'Ops',
          type: 'supergroup',
        },
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('registers the current chat as an active admin chat', async () => {
    const { service, adminChatsRepository } = createService();
    adminChatsRepository.findOneBy.mockResolvedValueOnce(null);

    await service.addAdminChat(
      { id: 'super-id', role: UserRole.SuperAdmin } as UserDao,
      {
        telegramChatId: '-100123',
        title: 'Ops',
        type: 'supergroup',
      },
    );

    expect(adminChatsRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        telegramChatId: '-100123',
        title: 'Ops',
        type: 'supergroup',
        isActive: true,
        createdByUserId: 'super-id',
      }),
    );
  });

  it('lists only active admin chats', async () => {
    const { service, adminChatsRepository } = createService();
    adminChatsRepository.find.mockResolvedValueOnce([]);

    await service.listActiveAdminChats();

    expect(adminChatsRepository.find).toHaveBeenCalledWith({
      where: { isActive: true },
      order: { createdAt: 'ASC' },
    });
  });
});
