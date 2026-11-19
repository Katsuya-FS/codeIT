import 'reflect-metadata';
import 'dotenv/config';
import * as argon2 from 'argon2';
import { isEmail } from 'class-validator';
import { randomUUID } from 'node:crypto';
import dataSource from './data-source';
import { Role } from './identity/entities/role.entity';
import { UserAccount } from './identity/entities/user-account.entity';

async function bootstrapAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const displayName = process.env.ADMIN_DISPLAY_NAME?.trim();
  if (!email || !isEmail(email) || !password || !displayName || displayName.length < 2 || displayName.length > 80 || password.length < 16) {
    throw new Error('Set ADMIN_EMAIL, ADMIN_DISPLAY_NAME, and a one-time ADMIN_PASSWORD of at least 16 characters in the deployment environment.');
  }
  await dataSource.initialize();
  try {
    await dataSource.transaction(async (manager) => {
      const role = await manager.getRepository(Role).findOne({ where: { name: 'Administrator' }, lock: { mode: 'pessimistic_write' } });
      if (!role) throw new Error('Administrator role seed is missing. Run the database migrations.');
      const repo = manager.getRepository(UserAccount);
      const existingAdmin = await repo.countBy({ roleName: role.name });
      if (existingAdmin) throw new Error('An Administrator already exists. Bootstrap can only run once.');
      await repo.save({
        id: randomUUID(), email, displayName, roleName: role.name, status: 'active',
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      });
    });
    process.stdout.write('Initial Administrator created. Remove ADMIN_PASSWORD from the environment now.\n');
  } finally {
    await dataSource.destroy();
  }
}

bootstrapAdmin().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Administrator bootstrap failed.'}\n`);
  process.exitCode = 1;
});
