// prisma/seed.ts
import { PrismaClient, RoleName, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log(' Iniciando seed...');

  // ========== 1. CREAR ROLES ==========
  console.log(' Creando roles...');

  const adminRole = await prisma.role.upsert({
    where: { name: RoleName.ADMIN },
    update: {},
    create: {
      name: RoleName.ADMIN,
    },
  });

  const studentRole = await prisma.role.upsert({
    where: { name: RoleName.STUDENT },
    update: {},
    create: {
      name: RoleName.STUDENT,
    },
  });

  console.log(' Roles creados:', {
    admin: adminRole.id,
    student: studentRole.id,
  });

  // ========== 2. CREAR USUARIO ADMINISTRADOR ==========
  console.log('👤 Creando usuario administrador...');

  const adminPasswordHash = await bcrypt.hash('Admin123456', 12);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@aulavirtual.com' },
    update: {},
    create: {
      email: 'admin@aulavirtual.com',
      passwordHash: adminPasswordHash,
      firstName: 'Admin',
      lastName: 'Principal',
      phone: '+51987654321',
      status: UserStatus.ACTIVE,
    },
  });

  console.log(' Usuario administrador creado:', {
    id: adminUser.id,
    email: adminUser.email,
    name: `${adminUser.firstName} ${adminUser.lastName}`,
  });

  // ========== 3. ASIGNAR ROL ADMIN AL USUARIO ADMINISTRADOR ==========
  console.log(' Asignando rol ADMIN al usuario administrador...');

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: adminRole.id,
    },
  });

  console.log(' Rol ADMIN asignado al administrador');

  // ========== 4. CREAR USUARIO ESTUDIANTE ==========
  console.log(' Creando usuario estudiante...');

  const studentPasswordHash = await bcrypt.hash('Student123456', 12);

  const studentUser = await prisma.user.upsert({
    where: { email: 'estudiante@aulavirtual.com' },
    update: {},
    create: {
      email: 'estudiante@aulavirtual.com',
      passwordHash: studentPasswordHash,
      firstName: 'Juan',
      lastName: 'Pérez',
      phone: '+51987654322',
      status: UserStatus.ACTIVE,
    },
  });

  console.log(' Usuario estudiante creado:', {
    id: studentUser.id,
    email: studentUser.email,
    name: `${studentUser.firstName} ${studentUser.lastName}`,
  });

  // ========== 5. ASIGNAR ROL STUDENT AL USUARIO ESTUDIANTE ==========
  console.log('🔗 Asignando rol STUDENT al usuario estudiante...');

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: studentUser.id,
        roleId: studentRole.id,
      },
    },
    update: {},
    create: {
      userId: studentUser.id,
      roleId: studentRole.id,
    },
  });

  console.log(' Rol STUDENT asignado al estudiante');

  // ========== 6. RESUMEN FINAL ==========
  console.log('\n Seed completado exitosamente!\n');
  console.log('═══════════════════════════════════════════════════');
  console.log(' CREDENCIALES DE ACCESO');
  console.log('═══════════════════════════════════════════════════\n');

  console.log(' ADMINISTRADOR:');
  console.log('   Email:    admin@aulavirtual.com');
  console.log('   Password: Admin123456');
  console.log('   Rol:      ADMIN');
  console.log('   ID:       ' + adminUser.id + '\n');

  console.log(' ESTUDIANTE:');
  console.log('   Email:    estudiante@aulavirtual.com');
  console.log('   Password: Student123456');
  console.log('   Rol:      STUDENT');
  console.log('   ID:       ' + studentUser.id + '\n');

  console.log('═══════════════════════════════════════════════════');
}

main()
  .catch((e) => {
    console.error('Error durante el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });