# 📚 Documentación de APIs - Aula Virtual

> **Versión**: 1.0
> **Base URL**: `http://localhost:3000`
> **Última actualización**: 2025-11-22

## 📋 Tabla de Contenidos

- [Información General](#información-general)
- [Autenticación](#autenticación)
- [Módulos de la API](#módulos-de-la-api)
  - [Auth](#1-auth)
  - [Users](#2-users)
  - [Roles](#3-roles)
  - [Course Categories](#4-course-categories)
  - [Instructors](#5-instructors)
  - [Courses](#6-courses)
  - [Modules](#7-modules)
  - [Lessons](#8-lessons)
  - [Resources](#9-resources)
  - [Quizzes](#10-quizzes)
  - [Questions](#11-questions)
  - [Enrollments](#12-enrollments)
  - [Progress](#13-progress)
  - [Live Sessions](#14-live-sessions)
  - [Notifications](#15-notifications)
  - [Payment Receipts](#16-payment-receipts)

---

## 🔐 Información General

### Autenticación

La API utiliza JWT (JSON Web Tokens) para autenticación. Después de hacer login, debes incluir el token en el header de tus peticiones:

```
Authorization: Bearer {tu_token_aqui}
```

### Roles de Usuario

- **ADMIN**: Acceso completo al sistema, puede crear y gestionar contenido
- **STUDENT**: Acceso limitado solo a cursos en los que está enrollado

### Códigos de Estado HTTP

- `200 OK`: Petición exitosa
- `201 Created`: Recurso creado exitosamente
- `400 Bad Request`: Error en los datos enviados
- `401 Unauthorized`: No autenticado
- `403 Forbidden`: No tiene permisos
- `404 Not Found`: Recurso no encontrado
- `500 Internal Server Error`: Error del servidor

---

## 1. 🔑 Auth

### POST `/auth/login`
Iniciar sesión en el sistema.

**Permisos**: Público

**Body**:
```json
{
  "email": "admin@ejemplo.com",
  "password": "password123"
}
```

**Respuesta**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "cuid123",
    "email": "admin@ejemplo.com",
    "firstName": "Juan",
    "lastName": "Pérez",
    "roles": ["ADMIN"]
  }
}
```

---

### GET `/auth/profile`
Obtener información del usuario autenticado.

**Permisos**: Autenticado (ADMIN, STUDENT)

**Headers**: `Authorization: Bearer {token}`

**Respuesta**:
```json
{
  "id": "cuid123",
  "email": "admin@ejemplo.com",
  "firstName": "Juan",
  "lastName": "Pérez",
  "phone": "+1234567890",
  "status": "ACTIVE",
  "roles": ["ADMIN"],
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

---

### POST `/auth/dev/create-admin`
Crear admin para desarrollo (solo en modo desarrollo).

**Permisos**: Solo disponible en NODE_ENV=development

**Respuesta**:
```json
{
  "message": "Dev admin created",
  "credentials": {
    "email": "admin@dev.com",
    "password": "dev123456"
  }
}
```

---

## 2. 👥 Users

### POST `/users`
Crear nuevo usuario (estudiante o admin).

**Permisos**: ADMIN

**Body**:
```json
{
  "email": "estudiante@ejemplo.com",
  "password": "password123",
  "firstName": "María",
  "lastName": "González",
  "phone": "+1234567890",
  "roles": ["STUDENT"]
}
```

**Respuesta**:
```json
{
  "id": "cuid456",
  "email": "estudiante@ejemplo.com",
  "firstName": "María",
  "lastName": "González",
  "phone": "+1234567890",
  "status": "ACTIVE",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

---

### GET `/users`
Listar todos los usuarios.

**Permisos**: ADMIN

**Respuesta**:
```json
[
  {
    "id": "cuid123",
    "email": "admin@ejemplo.com",
    "firstName": "Juan",
    "lastName": "Pérez",
    "status": "ACTIVE",
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  ...
]
```

---

### GET `/users/stats`
Obtener estadísticas de usuarios.

**Permisos**: ADMIN

**Respuesta**:
```json
{
  "totalUsers": 150,
  "activeUsers": 145,
  "suspendedUsers": 5,
  "students": 140,
  "admins": 10
}
```

---

### GET `/users/:id`
Obtener usuario por ID.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Respuesta**:
```json
{
  "id": "cuid123",
  "email": "estudiante@ejemplo.com",
  "firstName": "María",
  "lastName": "González",
  "phone": "+1234567890",
  "status": "ACTIVE",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

---

### PATCH `/users/:id`
Actualizar usuario.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Body** (todos los campos opcionales):
```json
{
  "firstName": "María",
  "lastName": "González",
  "phone": "+0987654321",
  "email": "nuevo@email.com"
}
```

**Respuesta**: Usuario actualizado

---

### PATCH `/users/:id/suspend`
Suspender usuario.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Respuesta**: Usuario con status "SUSPENDED"

---

### PATCH `/users/:id/activate`
Activar usuario.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Respuesta**: Usuario con status "ACTIVE"

---

### DELETE `/users/:id`
Eliminar usuario.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Respuesta**: Usuario eliminado

---

## 3. 🎭 Roles

### POST `/roles`
Crear nuevo rol.

**Permisos**: ADMIN

**Body**:
```json
{
  "name": "ADMIN"
}
```

**Respuesta**:
```json
{
  "id": "cuid789",
  "name": "ADMIN"
}
```

---

### GET `/roles`
Obtener todos los roles.

**Permisos**: ADMIN

**Respuesta**:
```json
[
  {
    "id": "cuid789",
    "name": "ADMIN"
  },
  {
    "id": "cuid790",
    "name": "STUDENT"
  }
]
```

---

### GET `/roles/stats`
Estadísticas de roles.

**Permisos**: ADMIN

**Respuesta**:
```json
{
  "totalRoles": 2,
  "rolesBreakdown": {
    "ADMIN": 10,
    "STUDENT": 140
  }
}
```

---

### POST `/roles/initialize`
Inicializar roles por defecto (ADMIN, STUDENT).

**Permisos**: ADMIN

**Respuesta**:
```json
{
  "message": "Default roles initialized successfully"
}
```

---

### POST `/roles/assign`
Asignar rol a usuario.

**Permisos**: ADMIN

**Body**:
```json
{
  "userId": "cuid123",
  "roleName": "ADMIN"
}
```

**Respuesta**:
```json
{
  "userId": "cuid123",
  "roleId": "cuid789",
  "roleName": "ADMIN",
  "assignedAt": "2024-01-01T00:00:00.000Z"
}
```

---

### GET `/roles/user/:userId`
Obtener roles de un usuario.

**Permisos**: ADMIN

**Parámetros URL**: `userId` (string)

**Respuesta**:
```json
[
  {
    "id": "cuid789",
    "name": "ADMIN"
  }
]
```

---

### DELETE `/roles/user/:userId/role/:roleId`
Remover rol de usuario.

**Permisos**: ADMIN

**Parámetros URL**: `userId` (string), `roleId` (string)

**Respuesta**: 204 No Content

---

### GET `/roles/type/admins`
Obtener todos los administradores.

**Permisos**: ADMIN

**Respuesta**: Lista de usuarios con rol ADMIN

---

### GET `/roles/type/students`
Obtener todos los estudiantes.

**Permisos**: ADMIN

**Respuesta**: Lista de usuarios con rol STUDENT

---

## 4. 📂 Course Categories

### POST `/course-categories`
Crear nueva categoría de curso.

**Permisos**: ADMIN

**Body**:
```json
{
  "name": "Programación",
  "slug": "programacion",
  "description": "Cursos de programación y desarrollo de software",
  "isActive": true
}
```

**Respuesta**:
```json
{
  "id": "cuid001",
  "name": "Programación",
  "slug": "programacion",
  "description": "Cursos de programación y desarrollo de software",
  "isActive": true
}
```

---

### GET `/course-categories`
Listar categorías.

**Permisos**: Público (usuarios ven solo activas, ADMIN ve todas)

**Query Params** (opcionales):
- `isActive`: boolean

**Respuesta**:
```json
{
  "data": [
    {
      "id": "cuid001",
      "name": "Programación",
      "slug": "programacion",
      "description": "Cursos de programación",
      "isActive": true,
      "_count": {
        "courses": 12
      }
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 10
  }
}
```

---

### GET `/course-categories/active`
Categorías activas.

**Permisos**: Público

**Respuesta**: Lista de categorías activas

---

### GET `/course-categories/popular`
Categorías más populares (por número de cursos).

**Permisos**: Público

**Query Params** (opcionales):
- `limit`: number (default: 5)

**Respuesta**: Lista de categorías ordenadas por popularidad

---

### GET `/course-categories/stats`
Estadísticas de categorías.

**Permisos**: ADMIN

**Respuesta**:
```json
{
  "totalCategories": 10,
  "activeCategories": 8,
  "inactiveCategories": 2,
  "categoriesWithCourses": 7
}
```

---

### GET `/course-categories/slug/:slug`
Obtener categoría por slug.

**Permisos**: Público

**Parámetros URL**: `slug` (string)

**Respuesta**: Categoría con sus cursos

---

### GET `/course-categories/:id`
Obtener categoría por ID.

**Permisos**: Público

**Parámetros URL**: `id` (string)

**Respuesta**: Categoría completa

---

### PATCH `/course-categories/:id`
Actualizar categoría.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Body** (campos opcionales):
```json
{
  "name": "Programación Web",
  "description": "Nueva descripción",
  "isActive": false
}
```

**Respuesta**: Categoría actualizada

---

### PATCH `/course-categories/:id/toggle-status`
Activar/Desactivar categoría.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Respuesta**: Categoría con status cambiado

---

### DELETE `/course-categories/:id`
Eliminar categoría.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Respuesta**: Categoría eliminada

---

## 5. 👨‍🏫 Instructors

### POST `/instructors`
Crear nuevo instructor.

**Permisos**: ADMIN

**Body**:
```json
{
  "firstName": "Carlos",
  "lastName": "Martínez",
  "email": "carlos@ejemplo.com",
  "phone": "+1234567890",
  "bio": "Experto en desarrollo web con 10 años de experiencia",
  "specialization": "Desarrollo Web",
  "experience": "10 años",
  "linkedinUrl": "https://linkedin.com/in/carlos"
}
```

**Respuesta**:
```json
{
  "id": "cuid002",
  "firstName": "Carlos",
  "lastName": "Martínez",
  "email": "carlos@ejemplo.com",
  "phone": "+1234567890",
  "bio": "Experto en desarrollo web",
  "specialization": "Desarrollo Web",
  "experience": "10 años",
  "linkedinUrl": "https://linkedin.com/in/carlos",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

---

### GET `/instructors`
Listar instructores.

**Permisos**: ADMIN

**Query Params** (opcionales):
- `page`: number
- `limit`: number

**Respuesta**:
```json
{
  "data": [
    {
      "id": "cuid002",
      "firstName": "Carlos",
      "lastName": "Martínez",
      "specialization": "Desarrollo Web",
      "_count": {
        "courses": 5
      }
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 10
  }
}
```

---

### GET `/instructors/public`
Lista pública de instructores (sin datos sensibles).

**Permisos**: Público

**Respuesta**: Lista de instructores sin email/phone

---

### GET `/instructors/stats`
Estadísticas de instructores.

**Permisos**: ADMIN

**Respuesta**:
```json
{
  "totalInstructors": 20,
  "instructorsWithCourses": 15,
  "instructorsWithoutCourses": 5
}
```

---

### GET `/instructors/:id`
Obtener instructor por ID.

**Permisos**: Autenticado (ADMIN ve todo, STUDENT ve solo info pública)

**Parámetros URL**: `id` (string)

**Respuesta**: Instructor completo (o limitado según rol)

---

### GET `/instructors/:id/courses`
Cursos de un instructor.

**Permisos**: Autenticado

**Parámetros URL**: `id` (string)

**Respuesta**: Lista de cursos del instructor

---

### PATCH `/instructors/:id`
Actualizar instructor.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Body** (campos opcionales): Similar al POST

**Respuesta**: Instructor actualizado

---

### DELETE `/instructors/:id`
Eliminar instructor.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Respuesta**: Instructor eliminado

---

## 6. 📚 Courses

### POST `/courses`
Crear nuevo curso.

**Permisos**: ADMIN

**Body**:
```json
{
  "title": "Desarrollo Web Full Stack",
  "slug": "desarrollo-web-full-stack",
  "summary": "Aprende desarrollo web desde cero",
  "description": "Curso completo de desarrollo web...",
  "level": "BEGINNER",
  "thumbnailUrl": "https://bunny.net/thumbnail.jpg",
  "estimatedHours": 40,
  "price": 99.99,
  "status": "DRAFT",
  "visibility": "PRIVATE",
  "categoryId": "cuid001",
  "instructorId": "cuid002"
}
```

**Nota sobre `level`**: Valores permitidos: `BEGINNER`, `INTERMEDIATE`, `ADVANCED`
**Nota sobre `status`**: Valores permitidos: `DRAFT`, `PUBLISHED`, `ARCHIVED`
**Nota sobre `visibility`**: Valores permitidos: `PUBLIC`, `PRIVATE`

**Respuesta**:
```json
{
  "id": "cuid003",
  "title": "Desarrollo Web Full Stack",
  "slug": "desarrollo-web-full-stack",
  "summary": "Aprende desarrollo web desde cero",
  "description": "Curso completo de desarrollo web...",
  "level": "BEGINNER",
  "thumbnailUrl": "https://bunny.net/thumbnail.jpg",
  "estimatedHours": 40,
  "price": "99.99",
  "status": "DRAFT",
  "visibility": "PRIVATE",
  "categoryId": "cuid001",
  "instructorId": "cuid002",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "publishedAt": null
}
```

---

### GET `/courses`
Listar cursos con filtros.

**Permisos**: Autenticado (ADMIN ve todos, STUDENT solo públicos)

**Query Params** (opcionales):
- `categoryId`: string
- `instructorId`: string
- `level`: BEGINNER | INTERMEDIATE | ADVANCED
- `status`: DRAFT | PUBLISHED | ARCHIVED
- `search`: string

**Respuesta**:
```json
{
  "data": [
    {
      "id": "cuid003",
      "title": "Desarrollo Web Full Stack",
      "slug": "desarrollo-web-full-stack",
      "level": "BEGINNER",
      "price": "99.99",
      "status": "PUBLISHED",
      "category": {
        "name": "Programación"
      },
      "instructor": {
        "firstName": "Carlos",
        "lastName": "Martínez"
      },
      "_count": {
        "modules": 10,
        "enrollments": 50
      }
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 10
  }
}
```

---

### GET `/courses/public`
Cursos públicos (sin autenticación).

**Permisos**: Público

**Respuesta**: Lista de cursos públicos y publicados

---

### GET `/courses/stats`
Estadísticas de cursos.

**Permisos**: ADMIN

**Respuesta**:
```json
{
  "totalCourses": 50,
  "publishedCourses": 40,
  "draftCourses": 8,
  "archivedCourses": 2,
  "totalEnrollments": 500
}
```

---

### GET `/courses/instructor/:instructorId`
Cursos de un instructor.

**Permisos**: ADMIN

**Parámetros URL**: `instructorId` (string)

**Respuesta**: Lista de cursos del instructor

---

### GET `/courses/category/:categoryId`
Cursos de una categoría.

**Permisos**: Público

**Parámetros URL**: `categoryId` (string)

**Respuesta**: Lista de cursos de la categoría

---

### GET `/courses/slug/:slug`
Obtener curso por slug.

**Permisos**: Público

**Parámetros URL**: `slug` (string)

**Respuesta**: Curso completo

---

### GET `/courses/:id`
Obtener curso por ID.

**Permisos**: Autenticado

**Parámetros URL**: `id` (string)

**Respuesta**: Curso completo con módulos y lecciones

---

### PATCH `/courses/:id`
Actualizar curso.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Body** (campos opcionales): Similar al POST

**Respuesta**: Curso actualizado

---

### PATCH `/courses/:id/publish`
Publicar curso.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Respuesta**: Curso con status "PUBLISHED"

---

### PATCH `/courses/:id/archive`
Archivar curso.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Respuesta**: Curso con status "ARCHIVED"

---

### DELETE `/courses/:id`
Eliminar curso.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Respuesta**: Curso eliminado

---

## 7. 📦 Modules

### POST `/modules`
Crear nuevo módulo en un curso.

**Permisos**: ADMIN

**Body**:
```json
{
  "title": "Introducción a JavaScript",
  "description": "Fundamentos de JavaScript",
  "order": 1,
  "isRequired": true,
  "courseId": "cuid003"
}
```

**Respuesta**:
```json
{
  "id": "cuid004",
  "title": "Introducción a JavaScript",
  "description": "Fundamentos de JavaScript",
  "order": 1,
  "isRequired": true,
  "courseId": "cuid003"
}
```

---

### GET `/modules`
Listar módulos con filtros.

**Permisos**: ADMIN

**Query Params** (opcionales):
- `courseId`: string

**Respuesta**: Lista de módulos

---

### GET `/modules/stats`
Estadísticas de módulos.

**Permisos**: ADMIN

**Respuesta**:
```json
{
  "totalModules": 100,
  "modulesWithContent": 95,
  "modulesWithoutContent": 5
}
```

---

### GET `/modules/course/:courseId`
Módulos de un curso específico.

**Permisos**: Autenticado

**Parámetros URL**: `courseId` (string)

**Respuesta**:
```json
[
  {
    "id": "cuid004",
    "title": "Introducción a JavaScript",
    "description": "Fundamentos de JavaScript",
    "order": 1,
    "isRequired": true,
    "_count": {
      "lessons": 5,
      "quizzes": 1
    }
  }
]
```

---

### GET `/modules/course/:courseId/next-order`
Obtener siguiente orden disponible para nuevo módulo.

**Permisos**: ADMIN

**Parámetros URL**: `courseId` (string)

**Respuesta**:
```json
{
  "nextOrder": 6
}
```

---

### GET `/modules/:id`
Obtener módulo por ID.

**Permisos**: Autenticado

**Parámetros URL**: `id` (string)

**Respuesta**: Módulo completo con lecciones y quizzes

---

### PATCH `/modules/:id`
Actualizar módulo.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Body** (campos opcionales):
```json
{
  "title": "Nuevo título",
  "description": "Nueva descripción",
  "order": 2,
  "isRequired": false
}
```

**Respuesta**: Módulo actualizado

---

### POST `/modules/:id/duplicate`
Duplicar módulo.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Respuesta**: Módulo duplicado

---

### PATCH `/modules/course/:courseId/reorder`
Reordenar módulos de un curso.

**Permisos**: ADMIN

**Parámetros URL**: `courseId` (string)

**Body**:
```json
{
  "moduleOrders": [
    { "moduleId": "cuid004", "order": 1 },
    { "moduleId": "cuid005", "order": 2 }
  ]
}
```

**Respuesta**: Módulos reordenados

---

### DELETE `/modules/:id`
Eliminar módulo.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Respuesta**: Módulo eliminado

---

## 8. 📖 Lessons

### POST `/lessons`
Crear lección manual.

**Permisos**: ADMIN

**Body**:
```json
{
  "title": "Variables en JavaScript",
  "type": "VIDEO",
  "order": 1,
  "durationSec": 600,
  "videoUrl": "https://bunny.net/video.mp4",
  "moduleId": "cuid004"
}
```

**Nota sobre `type`**: Valores permitidos: `VIDEO`, `TEXT`, `SCORM`

**Respuesta**:
```json
{
  "id": "cuid005",
  "title": "Variables en JavaScript",
  "type": "VIDEO",
  "order": 1,
  "durationSec": 600,
  "videoUrl": "https://bunny.net/video.mp4",
  "markdownContent": null,
  "moduleId": "cuid004"
}
```

---

### POST `/lessons/upload-video`
Crear lección con video (sube a Bunny.net).

**Permisos**: ADMIN

**Content-Type**: `multipart/form-data`

**Body (form-data)**:
- `video`: File (max 500MB, solo videos)
- `title`: string
- `moduleId`: string
- `order`: number
- `durationSec`: number (opcional)

**Respuesta**: Lección creada con videoUrl de Bunny.net

---

### POST `/lessons/upload-text`
Crear lección de texto/PDF.

**Permisos**: ADMIN

**Content-Type**: `multipart/form-data`

**Body (form-data)**:
- `pdf`: File (opcional, max 50MB, solo PDF)
- `title`: string
- `moduleId`: string
- `order`: number
- `markdownContent`: string (opcional, requerido si no hay PDF)

**Respuesta**: Lección creada

---

### GET `/lessons`
Listar lecciones.

**Permisos**: ADMIN

**Query Params** (opcionales):
- `moduleId`: string
- `type`: VIDEO | TEXT | SCORM

**Respuesta**: Lista de lecciones

---

### GET `/lessons/stats`
Estadísticas de lecciones.

**Permisos**: ADMIN

**Respuesta**:
```json
{
  "totalLessons": 200,
  "videoLessons": 150,
  "textLessons": 45,
  "scormLessons": 5
}
```

---

### GET `/lessons/module/:moduleId`
Lecciones de un módulo.

**Permisos**: Autenticado

**Parámetros URL**: `moduleId` (string)

**Respuesta**: Lista de lecciones del módulo ordenadas

---

### GET `/lessons/module/:moduleId/next-order`
Siguiente orden disponible para nueva lección.

**Permisos**: ADMIN

**Parámetros URL**: `moduleId` (string)

**Respuesta**:
```json
{
  "nextOrder": 6
}
```

---

### GET `/lessons/:id`
Obtener lección por ID.

**Permisos**: Autenticado

**Parámetros URL**: `id` (string)

**Respuesta**: Lección completa

---

### GET `/lessons/:id/with-resources`
Obtener lección con sus recursos.

**Permisos**: Autenticado

**Parámetros URL**: `id` (string)

**Respuesta**: Lección con array de resources

---

### PATCH `/lessons/:id`
Actualizar lección.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Body** (campos opcionales): Similar al POST

**Respuesta**: Lección actualizada

---

### POST `/lessons/:id/duplicate`
Duplicar lección.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Respuesta**: Lección duplicada

---

### PATCH `/lessons/module/:moduleId/reorder`
Reordenar lecciones de un módulo.

**Permisos**: ADMIN

**Parámetros URL**: `moduleId` (string)

**Body**:
```json
{
  "lessonOrders": [
    { "lessonId": "cuid005", "order": 1 },
    { "lessonId": "cuid006", "order": 2 }
  ]
}
```

**Respuesta**: Lecciones reordenadas

---

### DELETE `/lessons/:id`
Eliminar lección.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Respuesta**: Lección eliminada

---

## 9. 📎 Resources

### POST `/resources`
Crear resource manual (con URL existente).

**Permisos**: ADMIN

**Body**:
```json
{
  "fileName": "documento.pdf",
  "fileType": "application/pdf",
  "fileUrl": "https://bunny.net/doc.pdf",
  "sizeKb": 1024,
  "lessonId": "cuid005"
}
```

**Respuesta**:
```json
{
  "id": "cuid006",
  "fileName": "documento.pdf",
  "fileType": "application/pdf",
  "fileUrl": "https://bunny.net/doc.pdf",
  "sizeKb": 1024,
  "lessonId": "cuid005"
}
```

---

### POST `/resources/upload`
Subir archivo como resource (sube a Bunny.net).

**Permisos**: ADMIN

**Content-Type**: `multipart/form-data`

**Body (form-data)**:
- `file`: File (max 100MB)
- `lessonId`: string

**Tipos permitidos**: PDF, ZIP, Office docs, Imágenes, TXT

**Respuesta**: Resource creado con URL de Bunny.net

---

### GET `/resources`
Listar resources.

**Permisos**: ADMIN

**Query Params** (opcionales):
- `lessonId`: string
- `fileType`: string

**Respuesta**: Lista de resources

---

### GET `/resources/stats`
Estadísticas de resources.

**Permisos**: ADMIN

**Respuesta**:
```json
{
  "totalResources": 300,
  "totalSizeKb": 1048576,
  "resourcesByType": {
    "application/pdf": 200,
    "image/jpeg": 50
  }
}
```

---

### GET `/resources/lesson/:lessonId`
Resources de una lección.

**Permisos**: Autenticado (verifica acceso a la lección)

**Parámetros URL**: `lessonId` (string)

**Respuesta**: Lista de resources de la lección

---

### GET `/resources/module/:moduleId`
Resources de un módulo.

**Permisos**: Autenticado (verifica acceso)

**Parámetros URL**: `moduleId` (string)

**Respuesta**: Lista de resources del módulo

---

### GET `/resources/course/:courseId`
Resources de un curso.

**Permisos**: Autenticado (verifica acceso)

**Parámetros URL**: `courseId` (string)

**Respuesta**: Lista de resources del curso

---

### GET `/resources/:id`
Obtener resource por ID.

**Permisos**: Autenticado (verifica acceso)

**Parámetros URL**: `id` (string)

**Respuesta**: Resource completo

---

### GET `/resources/:id/download`
Descargar resource.

**Permisos**: Autenticado (verifica acceso)

**Parámetros URL**: `id` (string)

**Respuesta**:
```json
{
  "downloadUrl": "https://bunny.net/direct-download-url"
}
```

---

### PATCH `/resources/:id`
Actualizar resource.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Body** (campos opcionales):
```json
{
  "fileName": "nuevo-nombre.pdf",
  "fileType": "application/pdf"
}
```

**Respuesta**: Resource actualizado

---

### POST `/resources/:id/duplicate`
Duplicar resource a otra lección.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Body**:
```json
{
  "targetLessonId": "cuid007"
}
```

**Respuesta**: Resource duplicado

---

### POST `/resources/bulk-upload`
Subida masiva desde ZIP.

**Permisos**: ADMIN

**Content-Type**: `multipart/form-data`

**Body (form-data)**:
- `zipFile`: File (ZIP)
- `lessonId`: string

**Respuesta**: Array de resources creados

---

### DELETE `/resources/:id`
Eliminar resource.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Respuesta**: Resource eliminado

---

### DELETE `/resources/lesson/:lessonId/clear`
Eliminar todos los resources de una lección.

**Permisos**: ADMIN

**Parámetros URL**: `lessonId` (string)

**Respuesta**: Mensaje de confirmación

---

## 10. 📝 Quizzes

### POST `/quizzes`
Crear quiz en un módulo.

**Permisos**: ADMIN

**Body**:
```json
{
  "title": "Examen Final de JavaScript",
  "passingScore": 70,
  "attemptsAllowed": 3,
  "moduleId": "cuid004"
}
```

**Respuesta**:
```json
{
  "id": "cuid007",
  "title": "Examen Final de JavaScript",
  "passingScore": 70,
  "attemptsAllowed": 3,
  "moduleId": "cuid004"
}
```

---

### GET `/quizzes`
Listar quizzes.

**Permisos**: ADMIN

**Query Params** (opcionales):
- `moduleId`: string

**Respuesta**: Lista de quizzes

---

### GET `/quizzes/stats`
Estadísticas de quizzes.

**Permisos**: ADMIN

**Respuesta**:
```json
{
  "totalQuizzes": 50,
  "totalQuestions": 500,
  "averagePassingScore": 72
}
```

---

### GET `/quizzes/module/:moduleId`
Quizzes de un módulo.

**Permisos**: Autenticado (verifica acceso)

**Parámetros URL**: `moduleId` (string)

**Respuesta**: Lista de quizzes del módulo

---

### GET `/quizzes/:id`
Obtener quiz por ID.

**Permisos**: Autenticado

**Parámetros URL**: `id` (string)

**Respuesta**:
- ADMIN: Quiz completo con respuestas correctas
- STUDENT: Quiz sin respuestas correctas (usa `/preview`)

---

### GET `/quizzes/:id/preview`
Vista previa para estudiantes (preguntas sin respuestas).

**Permisos**: Autenticado (verifica acceso)

**Parámetros URL**: `id` (string)

**Respuesta**: Quiz con preguntas pero sin indicar respuestas correctas

---

### POST `/quizzes/:id/submit`
Enviar respuestas de quiz.

**Permisos**: Autenticado (verifica acceso)

**Parámetros URL**: `id` (string)

**Body**:
```json
{
  "quizId": "cuid007",
  "enrollmentId": "cuid020",
  "answers": [
    {
      "questionId": "cuid008",
      "selectedAnswerIds": ["cuid009"]
    },
    {
      "questionId": "cuid010",
      "selectedAnswerIds": ["cuid011", "cuid012"]
    }
  ]
}
```

**Respuesta**:
```json
{
  "score": 85,
  "passed": true,
  "passingScore": 70,
  "totalQuestions": 10,
  "correctAnswers": 8,
  "incorrectAnswers": 2,
  "details": [
    {
      "questionId": "cuid008",
      "correct": true,
      "points": 10
    }
  ]
}
```

---

### GET `/quizzes/:id/results/:userId`
Ver resultados de quiz de un usuario.

**Permisos**: ADMIN o el propio usuario

**Parámetros URL**: `id` (string), `userId` (string)

**Respuesta**: Historial de intentos y resultados

---

### PATCH `/quizzes/:id`
Actualizar quiz.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Body** (campos opcionales):
```json
{
  "title": "Nuevo título",
  "passingScore": 75,
  "attemptsAllowed": 5
}
```

**Respuesta**: Quiz actualizado

---

### POST `/quizzes/:id/duplicate`
Duplicar quiz a otro módulo.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Body**:
```json
{
  "targetModuleId": "cuid015"
}
```

**Respuesta**: Quiz duplicado

---

### DELETE `/quizzes/:id`
Eliminar quiz.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Respuesta**: Quiz eliminado

---

## 11. ❓ Questions

### POST `/questions`
Crear pregunta completa con opciones.

**Permisos**: ADMIN

**Body**:
```json
{
  "text": "¿Qué es una variable?",
  "type": "SINGLE",
  "order": 1,
  "weight": 1,
  "imageUrl": null,
  "quizId": "cuid007",
  "answerOptions": [
    {
      "text": "Un contenedor de datos",
      "isCorrect": true
    },
    {
      "text": "Una función",
      "isCorrect": false
    }
  ]
}
```

**Nota sobre `type`**: Valores permitidos: `SINGLE`, `MULTIPLE`, `TRUEFALSE`

**Respuesta**:
```json
{
  "id": "cuid008",
  "text": "¿Qué es una variable?",
  "type": "SINGLE",
  "order": 1,
  "weight": 1,
  "imageUrl": null,
  "quizId": "cuid007",
  "answerOptions": [
    {
      "id": "cuid009",
      "text": "Un contenedor de datos",
      "isCorrect": true
    },
    {
      "id": "cuid010",
      "text": "Una función",
      "isCorrect": false
    }
  ]
}
```

---

### POST `/questions/simple`
Crear pregunta sin opciones (añadir opciones después).

**Permisos**: ADMIN

**Body**:
```json
{
  "text": "¿Qué es JavaScript?",
  "type": "MULTIPLE",
  "order": 2,
  "weight": 2,
  "quizId": "cuid007"
}
```

**Respuesta**: Pregunta sin opciones

---

### POST `/questions/upload-with-image`
Crear pregunta con imagen.

**Permisos**: ADMIN

**Content-Type**: `multipart/form-data`

**Body (form-data)**:
- `image`: File (max 10MB, JPEG/PNG/GIF/WebP)
- `text`: string
- `type`: SINGLE | MULTIPLE | TRUEFALSE
- `order`: number
- `weight`: number
- `quizId`: string
- `answerOptions`: JSON string (array de opciones)

**Respuesta**: Pregunta con imageUrl de Bunny.net

---

### PATCH `/questions/:id/upload-image`
Agregar/actualizar imagen a pregunta existente.

**Permisos**: ADMIN

**Content-Type**: `multipart/form-data`

**Parámetros URL**: `id` (string)

**Body (form-data)**:
- `image`: File (max 10MB, JPEG/PNG/GIF/WebP)

**Respuesta**: Pregunta con nueva imageUrl

---

### DELETE `/questions/:id/remove-image`
Eliminar imagen de pregunta.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Respuesta**: Pregunta sin imageUrl

---

### GET `/questions`
Listar preguntas.

**Permisos**: ADMIN

**Query Params** (opcionales):
- `quizId`: string
- `type`: SINGLE | MULTIPLE | TRUEFALSE

**Respuesta**: Lista de preguntas

---

### GET `/questions/stats`
Estadísticas de preguntas.

**Permisos**: ADMIN

**Respuesta**:
```json
{
  "totalQuestions": 500,
  "singleChoice": 300,
  "multipleChoice": 150,
  "trueFalse": 50,
  "questionsWithImages": 100
}
```

---

### GET `/questions/quiz/:quizId`
Preguntas de un quiz.

**Permisos**: Autenticado (verifica acceso)

**Parámetros URL**: `quizId` (string)

**Respuesta**: Lista de preguntas del quiz

---

### GET `/questions/quiz/:quizId/next-order`
Siguiente orden disponible.

**Permisos**: ADMIN

**Parámetros URL**: `quizId` (string)

**Respuesta**:
```json
{
  "nextOrder": 11
}
```

---

### GET `/questions/:id`
Obtener pregunta por ID.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Respuesta**: Pregunta completa con opciones

---

### PATCH `/questions/:id`
Actualizar pregunta.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Body** (campos opcionales):
```json
{
  "text": "Nuevo texto de pregunta",
  "type": "MULTIPLE",
  "weight": 2
}
```

**Respuesta**: Pregunta actualizada

---

### POST `/questions/:id/duplicate`
Duplicar pregunta a otro quiz.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Body**:
```json
{
  "targetQuizId": "cuid020"
}
```

**Respuesta**: Pregunta duplicada

---

### PATCH `/questions/quiz/:quizId/reorder`
Reordenar preguntas.

**Permisos**: ADMIN

**Parámetros URL**: `quizId` (string)

**Body**:
```json
{
  "questionOrders": [
    { "questionId": "cuid008", "order": 1 },
    { "questionId": "cuid010", "order": 2 }
  ]
}
```

**Respuesta**: Preguntas reordenadas

---

### DELETE `/questions/:id`
Eliminar pregunta.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Respuesta**: Pregunta eliminada

---

### POST `/questions/:questionId/answer-options`
Agregar opción de respuesta a pregunta.

**Permisos**: ADMIN

**Parámetros URL**: `questionId` (string)

**Body**:
```json
{
  "text": "Nueva opción",
  "isCorrect": false
}
```

**Respuesta**: Opción creada

---

### GET `/questions/:questionId/answer-options`
Obtener opciones de una pregunta.

**Permisos**: ADMIN

**Parámetros URL**: `questionId` (string)

**Respuesta**: Lista de opciones

---

### PATCH `/questions/answer-options/:id`
Actualizar opción de respuesta.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Body**:
```json
{
  "text": "Opción actualizada",
  "isCorrect": true
}
```

**Respuesta**: Opción actualizada

---

### DELETE `/questions/answer-options/:id`
Eliminar opción de respuesta.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Respuesta**: Opción eliminada

---

## 12. 🎓 Enrollments

### POST `/enrollments`
Crear enrollment directo (por IDs).

**Permisos**: ADMIN

**Body**:
```json
{
  "userId": "cuid123",
  "courseId": "cuid003",
  "enrolledById": "cuid789",
  "status": "ACTIVE",
  "paymentConfirmed": false,
  "expiresAt": "2025-12-31T23:59:59.000Z"
}
```

**Nota sobre `status`**: Valores permitidos: `ACTIVE`, `EXPIRED`, `SUSPENDED`, `COMPLETED`

**Respuesta**:
```json
{
  "id": "cuid020",
  "userId": "cuid123",
  "courseId": "cuid003",
  "enrolledById": "cuid789",
  "status": "ACTIVE",
  "paymentConfirmed": false,
  "enrolledAt": "2024-01-01T00:00:00.000Z",
  "expiresAt": "2025-12-31T23:59:59.000Z"
}
```

---

### POST `/enrollments/manual`
Enrollar usuario por email (crea usuario si no existe).

**Permisos**: ADMIN

**Body**:
```json
{
  "userEmail": "estudiante@ejemplo.com",
  "courseIds": ["cuid003", "cuid004"],
  "expiresInMonths": 12,
  "paymentConfirmed": true
}
```

**Respuesta**:
```json
{
  "user": {
    "id": "cuid123",
    "email": "estudiante@ejemplo.com"
  },
  "enrollments": [
    {
      "id": "cuid020",
      "courseId": "cuid003",
      "status": "ACTIVE"
    },
    {
      "id": "cuid021",
      "courseId": "cuid004",
      "status": "ACTIVE"
    }
  ]
}
```

---

### POST `/enrollments/bulk`
Enrollment masivo de múltiples usuarios a múltiples cursos.

**Permisos**: ADMIN

**Body**:
```json
{
  "userIds": ["cuid123", "cuid456"],
  "courseIds": ["cuid003", "cuid004"],
  "expiresInMonths": 6,
  "paymentConfirmed": false
}
```

**Respuesta**:
```json
{
  "created": 4,
  "enrollments": [...]
}
```

---

### GET `/enrollments`
Listar enrollments con filtros.

**Permisos**: ADMIN

**Query Params** (opcionales):
- `userId`: string
- `courseId`: string
- `status`: ACTIVE | EXPIRED | SUSPENDED | COMPLETED
- `paymentConfirmed`: boolean

**Respuesta**:
```json
{
  "data": [
    {
      "id": "cuid020",
      "status": "ACTIVE",
      "paymentConfirmed": true,
      "enrolledAt": "2024-01-01T00:00:00.000Z",
      "expiresAt": "2025-12-31T23:59:59.000Z",
      "user": {
        "email": "estudiante@ejemplo.com",
        "firstName": "María"
      },
      "course": {
        "title": "Desarrollo Web Full Stack"
      }
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 10
  }
}
```

---

### GET `/enrollments/stats`
Estadísticas de enrollments.

**Permisos**: ADMIN

**Respuesta**:
```json
{
  "totalEnrollments": 500,
  "activeEnrollments": 450,
  "expiredEnrollments": 30,
  "suspendedEnrollments": 10,
  "completedEnrollments": 10,
  "paymentConfirmed": 480,
  "paymentPending": 20
}
```

---

### GET `/enrollments/pending-payment`
Enrollments pendientes de pago.

**Permisos**: ADMIN

**Respuesta**: Lista de enrollments con `paymentConfirmed: false`

---

### GET `/enrollments/expired`
Enrollments expirados.

**Permisos**: ADMIN

**Respuesta**: Lista de enrollments expirados

---

### GET `/enrollments/expiring-soon`
Enrollments que expiran pronto.

**Permisos**: ADMIN

**Query Params** (opcionales):
- `days`: number (default: 7)

**Respuesta**: Enrollments que expiran en los próximos X días

---

### GET `/enrollments/my-courses`
Cursos del usuario actual.

**Permisos**: Autenticado

**Respuesta**: Lista de enrollments del usuario autenticado

---

### GET `/enrollments/user/:userId`
Enrollments de un usuario específico.

**Permisos**: ADMIN

**Parámetros URL**: `userId` (string)

**Respuesta**: Lista de enrollments del usuario

---

### GET `/enrollments/course/:courseId`
Enrollments de un curso específico.

**Permisos**: ADMIN

**Parámetros URL**: `courseId` (string)

**Respuesta**: Lista de enrollments del curso

---

### GET `/enrollments/course/:courseId/stats`
Estadísticas de enrollments de un curso.

**Permisos**: ADMIN

**Parámetros URL**: `courseId` (string)

**Respuesta**:
```json
{
  "totalEnrollments": 50,
  "activeEnrollments": 45,
  "completedEnrollments": 3,
  "averageProgress": 65
}
```

---

### GET `/enrollments/:id`
Obtener enrollment por ID.

**Permisos**: ADMIN o el propio usuario enrollado

**Parámetros URL**: `id` (string)

**Respuesta**: Enrollment completo

---

### PATCH `/enrollments/:id`
Actualizar enrollment.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Body** (campos opcionales):
```json
{
  "status": "ACTIVE",
  "paymentConfirmed": true,
  "expiresAt": "2026-12-31T23:59:59.000Z"
}
```

**Respuesta**: Enrollment actualizado

---

### PATCH `/enrollments/:id/confirm-payment`
Confirmar pago de enrollment.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Respuesta**: Enrollment con `paymentConfirmed: true`

---

### PATCH `/enrollments/:id/activate`
Activar enrollment.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Respuesta**: Enrollment con `status: "ACTIVE"`

---

### PATCH `/enrollments/:id/suspend`
Suspender enrollment.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Respuesta**: Enrollment con `status: "SUSPENDED"`

---

### PATCH `/enrollments/:id/complete`
Marcar enrollment como completado.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Respuesta**: Enrollment con `status: "COMPLETED"`

---

### PATCH `/enrollments/:id/extend`
Extender fecha de expiración.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Body**:
```json
{
  "months": 6
}
```

**Nota**: `months` debe estar entre 1 y 12

**Respuesta**: Enrollment con nueva fecha de expiración

---

### GET `/enrollments/check-access/:courseId`
Verificar acceso de usuario a curso.

**Permisos**: Autenticado

**Parámetros URL**: `courseId` (string)

**Respuesta**:
```json
{
  "hasAccess": true,
  "enrollment": {
    "id": "cuid020",
    "status": "ACTIVE",
    "expiresAt": "2025-12-31T23:59:59.000Z"
  }
}
```

---

### GET `/enrollments/check-access/:courseId/lesson/:lessonId`
Verificar acceso a lección específica.

**Permisos**: Autenticado

**Parámetros URL**: `courseId` (string), `lessonId` (string)

**Respuesta**: Similar al anterior

---

### DELETE `/enrollments/:id`
Eliminar enrollment.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Respuesta**: Enrollment eliminado

---

### POST `/enrollments/cleanup-expired`
Limpiar enrollments expirados.

**Permisos**: ADMIN

**Respuesta**:
```json
{
  "deletedCount": 15
}
```

---

## 13. 📊 Progress

### POST `/progress`
Crear progress directo.

**Permisos**: ADMIN

**Body**:
```json
{
  "enrollmentId": "cuid020",
  "lessonId": "cuid005",
  "completedAt": "2024-01-01T12:00:00.000Z",
  "score": 95
}
```

**Respuesta**:
```json
{
  "id": "cuid030",
  "enrollmentId": "cuid020",
  "lessonId": "cuid005",
  "completedAt": "2024-01-01T12:00:00.000Z",
  "score": 95
}
```

---

### POST `/progress/mark-complete`
Marcar lección como completada (para estudiantes).

**Permisos**: Autenticado

**Body**:
```json
{
  "courseId": "cuid003",
  "lessonId": "cuid005",
  "score": null
}
```

**Respuesta**: Progress creado

---

### POST `/progress/bulk`
Marcar múltiples lecciones como completadas.

**Permisos**: ADMIN

**Body**:
```json
{
  "enrollmentId": "cuid020",
  "lessonIds": ["cuid005", "cuid006", "cuid007"]
}
```

**Respuesta**:
```json
{
  "created": 3,
  "progress": [...]
}
```

---

### GET `/progress`
Listar progress con filtros.

**Permisos**: ADMIN

**Query Params** (opcionales):
- `enrollmentId`: string
- `lessonId`: string
- `completed`: boolean

**Respuesta**: Lista de progress

---

### GET `/progress/my-progress`
Progreso del usuario actual.

**Permisos**: Autenticado

**Respuesta**: Progress del usuario autenticado

---

### GET `/progress/stats`
Estadísticas generales de progress.

**Permisos**: ADMIN

**Respuesta**:
```json
{
  "totalProgress": 5000,
  "completedLessons": 4500,
  "averageScore": 87
}
```

---

### GET `/progress/user/:userId`
Progress de un usuario específico.

**Permisos**: ADMIN

**Parámetros URL**: `userId` (string)

**Respuesta**: Lista de progress del usuario

---

### GET `/progress/user/:userId/summary`
Resumen completo del progreso del usuario.

**Permisos**: ADMIN o el propio usuario

**Parámetros URL**: `userId` (string)

**Respuesta**:
```json
{
  "totalCourses": 5,
  "completedCourses": 2,
  "inProgressCourses": 3,
  "totalLessons": 100,
  "completedLessons": 65,
  "overallProgress": 65
}
```

---

### GET `/progress/course/:courseId`
Progress de un curso específico.

**Permisos**: ADMIN

**Parámetros URL**: `courseId` (string)

**Respuesta**: Progress de todos los estudiantes en el curso

---

### GET `/progress/course/:courseId/summary`
Resumen del progreso del curso.

**Permisos**: ADMIN

**Parámetros URL**: `courseId` (string)

**Respuesta**: Estadísticas agregadas del curso

---

### GET `/progress/my-course/:courseId`
Mi progreso en un curso específico.

**Permisos**: Autenticado

**Parámetros URL**: `courseId` (string)

**Respuesta**:
```json
{
  "courseId": "cuid003",
  "totalLessons": 20,
  "completedLessons": 15,
  "progress": 75,
  "lessons": [
    {
      "lessonId": "cuid005",
      "completed": true,
      "completedAt": "2024-01-01T12:00:00.000Z"
    }
  ]
}
```

---

### GET `/progress/lesson/:lessonId`
Progress de una lección específica (todos los estudiantes).

**Permisos**: ADMIN

**Parámetros URL**: `lessonId` (string)

**Respuesta**: Estadísticas de progreso de la lección

---

### GET `/progress/enrollment/:enrollmentId`
Progress de un enrollment específico.

**Permisos**: ADMIN o el propio usuario

**Parámetros URL**: `enrollmentId` (string)

**Respuesta**: Progress del enrollment

---

### GET `/progress/check/:lessonId`
Verificar si lección está completada.

**Permisos**: Autenticado

**Parámetros URL**: `lessonId` (string)

**Respuesta**:
```json
{
  "completed": true,
  "completedAt": "2024-01-01T12:00:00.000Z",
  "score": 95
}
```

---

### GET `/progress/next-lesson/:courseId`
Obtener siguiente lección por completar.

**Permisos**: Autenticado

**Parámetros URL**: `courseId` (string)

**Respuesta**:
```json
{
  "nextLesson": {
    "id": "cuid006",
    "title": "Funciones en JavaScript",
    "moduleId": "cuid004"
  }
}
```

---

### GET `/progress/:id`
Obtener progress por ID.

**Permisos**: ADMIN o el propio usuario

**Parámetros URL**: `id` (string)

**Respuesta**: Progress completo

---

### PATCH `/progress/:id`
Actualizar progress.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Body** (campos opcionales):
```json
{
  "score": 98,
  "completedAt": "2024-01-02T10:00:00.000Z"
}
```

**Respuesta**: Progress actualizado

---

### PATCH `/progress/:id/mark-incomplete`
Marcar lección como no completada.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Respuesta**: Progress con `completedAt: null`

---

### GET `/progress/analytics/completion-rates`
Tasas de finalización por curso.

**Permisos**: ADMIN

**Respuesta**:
```json
[
  {
    "courseId": "cuid003",
    "courseTitle": "Desarrollo Web Full Stack",
    "completionRate": 68.5,
    "totalStudents": 50,
    "completedStudents": 34
  }
]
```

---

### GET `/progress/analytics/student-performance`
Rendimiento de estudiantes.

**Permisos**: ADMIN

**Query Params** (opcionales):
- `courseId`: string

**Respuesta**: Análisis de rendimiento de estudiantes

---

### GET `/progress/analytics/lesson-difficulty`
Análisis de dificultad por lección.

**Permisos**: ADMIN

**Query Params** (opcionales):
- `courseId`: string

**Respuesta**: Lecciones ordenadas por dificultad

---

### POST `/progress/reset-course/:courseId/:userId`
Resetear progreso de curso.

**Permisos**: ADMIN

**Parámetros URL**: `courseId` (string), `userId` (string)

**Respuesta**: Mensaje de confirmación

---

### POST `/progress/reset-lesson/:lessonId/:userId`
Resetear progreso de lección.

**Permisos**: ADMIN

**Parámetros URL**: `lessonId` (string), `userId` (string)

**Respuesta**: Mensaje de confirmación

---

### DELETE `/progress/:id`
Eliminar progress.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Respuesta**: Progress eliminado

---

## 14. 📹 Live Sessions

### POST `/live-sessions`
Crear sesión en vivo.

**Permisos**: ADMIN

**Body**:
```json
{
  "topic": "Introducción a React",
  "startsAt": "2024-02-01T18:00:00.000Z",
  "endsAt": "2024-02-01T20:00:00.000Z",
  "meetingUrl": "https://zoom.us/j/123456789",
  "courseId": "cuid003"
}
```

**Respuesta**:
```json
{
  "id": "cuid040",
  "topic": "Introducción a React",
  "startsAt": "2024-02-01T18:00:00.000Z",
  "endsAt": "2024-02-01T20:00:00.000Z",
  "meetingUrl": "https://zoom.us/j/123456789",
  "courseId": "cuid003"
}
```

---

### POST `/live-sessions/bulk`
Crear múltiples sesiones.

**Permisos**: ADMIN

**Body**:
```json
{
  "sessions": [
    {
      "topic": "Sesión 1",
      "startsAt": "2024-02-01T18:00:00.000Z",
      "endsAt": "2024-02-01T20:00:00.000Z",
      "courseId": "cuid003"
    },
    {
      "topic": "Sesión 2",
      "startsAt": "2024-02-08T18:00:00.000Z",
      "endsAt": "2024-02-08T20:00:00.000Z",
      "courseId": "cuid003"
    }
  ]
}
```

**Respuesta**:
```json
{
  "created": 2,
  "sessions": [...]
}
```

---

### GET `/live-sessions`
Listar sesiones.

**Permisos**: ADMIN

**Query Params** (opcionales):
- `courseId`: string
- `status`: UPCOMING | LIVE | PAST

**Respuesta**: Lista de sesiones

---

### GET `/live-sessions/my-sessions`
Sesiones del usuario actual.

**Permisos**: Autenticado

**Respuesta**: Sesiones de los cursos enrollados

---

### GET `/live-sessions/upcoming`
Próximas sesiones.

**Permisos**: Autenticado

**Respuesta**: Sesiones que aún no han comenzado

---

### GET `/live-sessions/live-now`
Sesiones en vivo actualmente.

**Permisos**: Autenticado

**Respuesta**: Sesiones que están ocurriendo ahora

---

### GET `/live-sessions/stats`
Estadísticas de sesiones.

**Permisos**: ADMIN

**Respuesta**:
```json
{
  "totalSessions": 100,
  "upcomingSessions": 20,
  "pastSessions": 75,
  "liveSessions": 5
}
```

---

### GET `/live-sessions/course/:courseId`
Sesiones de un curso.

**Permisos**: Autenticado (verifica acceso)

**Parámetros URL**: `courseId` (string)

**Respuesta**: Lista de sesiones del curso

---

### GET `/live-sessions/next/:courseId`
Próxima sesión de un curso.

**Permisos**: Autenticado (verifica acceso)

**Parámetros URL**: `courseId` (string)

**Respuesta**: Próxima sesión o null

---

### GET `/live-sessions/calendar`
Vista calendario.

**Permisos**: Autenticado

**Query Params** (opcionales):
- `days`: number (default: 30)

**Respuesta**: Sesiones de los próximos X días

---

### GET `/live-sessions/:id`
Obtener sesión por ID.

**Permisos**: Autenticado (verifica acceso)

**Parámetros URL**: `id` (string)

**Respuesta**: Sesión completa

---

### PATCH `/live-sessions/:id`
Actualizar sesión.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Body** (campos opcionales):
```json
{
  "topic": "Nuevo tema",
  "startsAt": "2024-02-02T18:00:00.000Z",
  "meetingUrl": "https://meet.google.com/xyz"
}
```

**Respuesta**: Sesión actualizada

---

### PATCH `/live-sessions/:id/start`
Marcar sesión como iniciada.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Respuesta**: Sesión marcada como en vivo

---

### PATCH `/live-sessions/:id/end`
Marcar sesión como finalizada.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Respuesta**: Sesión marcada como terminada

---

### POST `/live-sessions/:id/join`
Unirse a sesión.

**Permisos**: Autenticado (verifica acceso)

**Parámetros URL**: `id` (string)

**Respuesta**:
```json
{
  "sessionId": "cuid040",
  "meetingUrl": "https://zoom.us/j/123456789",
  "topic": "Introducción a React",
  "startsAt": "2024-02-01T18:00:00.000Z"
}
```

---

### DELETE `/live-sessions/:id`
Eliminar sesión.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Respuesta**: Sesión eliminada

---

### DELETE `/live-sessions/course/:courseId/cleanup`
Limpiar sesiones pasadas de un curso.

**Permisos**: ADMIN

**Parámetros URL**: `courseId` (string)

**Query Params** (opcionales):
- `days`: number (default: 30) - Elimina sesiones más antiguas que X días

**Respuesta**:
```json
{
  "deletedCount": 15
}
```

---

## 15. 🔔 Notifications

### POST `/notifications`
Crear notificación.

**Permisos**: ADMIN

**Body**:
```json
{
  "type": "NEW_CONTENT",
  "userId": "cuid123",
  "payload": {
    "title": "Nuevo curso disponible",
    "message": "Se ha agregado un nuevo curso de React"
  }
}
```

**Nota sobre `type`**: Valores permitidos:
- `MODULE_COMPLETED`
- `QUIZ_PASSED`
- `QUIZ_FAILED`
- `COURSE_COMPLETED`
- `LIVE_SESSION_REMINDER`
- `ENROLLMENT_CREATED`
- `NEW_CONTENT`

**Respuesta**:
```json
{
  "id": "cuid050",
  "type": "NEW_CONTENT",
  "userId": "cuid123",
  "payload": {...},
  "readAt": null,
  "sentAt": "2024-01-01T12:00:00.000Z"
}
```

---

### GET `/notifications/all`
Todas las notificaciones (filtradas).

**Permisos**: ADMIN

**Query Params** (opcionales):
- `userId`: string
- `type`: NotificationType
- `unreadOnly`: boolean

**Respuesta**: Lista de notificaciones

---

### GET `/notifications`
Mis notificaciones.

**Permisos**: Autenticado

**Query Params** (opcionales):
- `unreadOnly`: boolean (default: false)

**Respuesta**:
```json
[
  {
    "id": "cuid050",
    "type": "NEW_CONTENT",
    "payload": {
      "title": "Nuevo curso disponible",
      "message": "Se ha agregado un nuevo curso de React"
    },
    "readAt": null,
    "sentAt": "2024-01-01T12:00:00.000Z"
  }
]
```

---

### GET `/notifications/unread-count`
Contador de notificaciones no leídas.

**Permisos**: Autenticado

**Respuesta**:
```json
{
  "unreadCount": 5
}
```

---

### PATCH `/notifications/mark-as-read`
Marcar notificaciones como leídas.

**Permisos**: Autenticado

**Body**:
```json
{
  "notificationIds": ["cuid050", "cuid051", "cuid052"]
}
```

**Respuesta**: Notificaciones marcadas como leídas

---

### PATCH `/notifications/mark-all-read`
Marcar todas como leídas.

**Permisos**: Autenticado

**Respuesta**: Todas las notificaciones del usuario marcadas como leídas

---

### DELETE `/notifications/:id`
Eliminar mi notificación.

**Permisos**: Autenticado (solo sus propias notificaciones)

**Parámetros URL**: `id` (string)

**Respuesta**: Notificación eliminada

---

### DELETE `/notifications/cleanup/:days`
Limpiar notificaciones antiguas.

**Permisos**: ADMIN

**Parámetros URL**: `days` (number)

**Respuesta**:
```json
{
  "deletedCount": 150
}
```

---

### POST `/notifications/module-completed`
Notificar módulo completado (uso interno).

**Permisos**: ADMIN

**Body**:
```json
{
  "userId": "cuid123",
  "moduleData": {
    "moduleId": "cuid004",
    "moduleTitle": "JavaScript Básico"
  }
}
```

**Respuesta**: Notificación creada

---

### POST `/notifications/quiz-result`
Notificar resultado de quiz (uso interno).

**Permisos**: ADMIN

**Body**:
```json
{
  "userId": "cuid123",
  "quizData": {
    "quizId": "cuid007",
    "quizTitle": "Examen Final",
    "score": 85
  },
  "passed": true
}
```

**Respuesta**: Notificación creada

---

### POST `/notifications/course-completed`
Notificar curso completado (uso interno).

**Permisos**: ADMIN

**Respuesta**: Notificación creada

---

### POST `/notifications/enrollment-created`
Notificar nueva matriculación (uso interno).

**Permisos**: ADMIN

**Respuesta**: Notificación creada

---

### POST `/notifications/live-session-reminder`
Recordatorio de sesión en vivo (uso interno).

**Permisos**: ADMIN

**Respuesta**: Notificación creada

---

## 16. 💳 Payment Receipts

### POST `/payment-receipts`
Crear recibo de pago.

**Permisos**: ADMIN

**Body**:
```json
{
  "amount": 99.99,
  "currency": "USD",
  "method": "Tarjeta de Crédito",
  "referenceNumber": "PAY-2024-001",
  "enrollmentId": "cuid020"
}
```

**Respuesta**:
```json
{
  "id": "cuid060",
  "amount": "99.99",
  "currency": "USD",
  "paidAt": "2024-01-01T12:00:00.000Z",
  "method": "Tarjeta de Crédito",
  "referenceNumber": "PAY-2024-001",
  "enrollmentId": "cuid020"
}
```

---

### GET `/payment-receipts`
Listar recibos de pago.

**Permisos**: ADMIN

**Query Params** (opcionales):
- `enrollmentId`: string
- `userId`: string
- `method`: string
- `dateFrom`: string (ISO date)
- `dateTo`: string (ISO date)

**Respuesta**: Lista de recibos

---

### GET `/payment-receipts/my-payments`
Mis pagos.

**Permisos**: Autenticado

**Respuesta**: Recibos del usuario autenticado

---

### GET `/payment-receipts/pending`
Pagos pendientes.

**Permisos**: ADMIN

**Respuesta**: Enrollments con pago pendiente

---

### GET `/payment-receipts/stats`
Estadísticas de pagos.

**Permisos**: ADMIN

**Query Params** (opcionales):
- `dateFrom`: string (ISO date)
- `dateTo`: string (ISO date)

**Respuesta**:
```json
{
  "totalRevenue": 49950.00,
  "totalPayments": 500,
  "averagePayment": 99.90,
  "paymentsByMethod": {
    "Tarjeta de Crédito": 300,
    "PayPal": 150,
    "Transferencia": 50
  }
}
```

---

### GET `/payment-receipts/payment-methods`
Métodos de pago disponibles.

**Permisos**: Público

**Respuesta**:
```json
{
  "methods": [
    "Tarjeta de Crédito",
    "Tarjeta de Débito",
    "PayPal",
    "Transferencia Bancaria",
    "Efectivo"
  ]
}
```

---

### POST `/payment-receipts/generate-reference`
Generar número de referencia.

**Permisos**: ADMIN

**Respuesta**:
```json
{
  "referenceNumber": "PAY-2024-001234"
}
```

---

### GET `/payment-receipts/enrollment/:enrollmentId`
Pagos de un enrollment.

**Permisos**: Autenticado (ADMIN o propio usuario)

**Parámetros URL**: `enrollmentId` (string)

**Respuesta**: Lista de pagos del enrollment

---

### GET `/payment-receipts/:id`
Obtener recibo por ID.

**Permisos**: Autenticado (ADMIN o propio usuario)

**Parámetros URL**: `id` (string)

**Respuesta**: Recibo completo

---

### PATCH `/payment-receipts/:id`
Actualizar recibo.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Body** (campos opcionales):
```json
{
  "amount": 120.00,
  "method": "PayPal",
  "referenceNumber": "PAY-2024-001-UPD"
}
```

**Respuesta**: Recibo actualizado

---

### DELETE `/payment-receipts/:id`
Eliminar recibo.

**Permisos**: ADMIN

**Parámetros URL**: `id` (string)

**Respuesta**: Recibo eliminado

---

## 📌 Notas Importantes

### Bunny.net

El sistema utiliza Bunny.net para almacenar:
- Videos de lecciones (hasta 500MB)
- PDFs y documentos (hasta 50MB)
- Resources adicionales (hasta 100MB)
- Imágenes de preguntas (hasta 10MB)

Los archivos se suben a través de endpoints específicos con `multipart/form-data`.

### Flujo de Trabajo Principal (Administrador)

1. **Crear estructura del curso**:
   - Crear instructor (`POST /instructors`)
   - Crear categoría (`POST /course-categories`)
   - Crear curso (`POST /courses`)
   - Crear módulos (`POST /modules`)
   - Crear lecciones (`POST /lessons/upload-video` o `/lessons/upload-text`)
   - Agregar resources (`POST /resources/upload`)
   - Crear quizzes (`POST /quizzes`)
   - Crear preguntas (`POST /questions`)

2. **Publicar curso**:
   - Publicar curso (`PATCH /courses/:id/publish`)

3. **Enrollar estudiantes**:
   - Crear usuario estudiante (`POST /users`)
   - Enrollar manualmente (`POST /enrollments/manual`)
   - Confirmar pago (`PATCH /enrollments/:id/confirm-payment`)

### Flujo de Trabajo Principal (Estudiante)

1. **Login**: `POST /auth/login`
2. **Ver mis cursos**: `GET /enrollments/my-courses`
3. **Ver contenido del curso**: `GET /courses/:id`
4. **Ver lecciones**: `GET /lessons/module/:moduleId`
5. **Marcar lección como completada**: `POST /progress/mark-complete`
6. **Ver mi progreso**: `GET /progress/my-course/:courseId`
7. **Tomar quiz**: `POST /quizzes/:id/submit`
8. **Ver sesiones en vivo**: `GET /live-sessions/my-sessions`

### Paginación

Los endpoints que retornan listas generalmente soportan paginación:

**Query Params**:
- `page`: número de página (default: 1)
- `limit`: elementos por página (default: 10)

**Respuesta**:
```json
{
  "data": [...],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "totalPages": 10
  }
}
```

### Manejo de Errores

Todas las respuestas de error siguen este formato:

```json
{
  "statusCode": 400,
  "message": "Descripción del error",
  "error": "Bad Request"
}
```

---

## 🚀 Ejemplos de Uso

### Ejemplo 1: Login y obtener perfil

```javascript
// 1. Login
const loginResponse = await fetch('http://localhost:3000/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'admin@ejemplo.com',
    password: 'password123'
  })
});

const { access_token } = await loginResponse.json();

// 2. Obtener perfil
const profileResponse = await fetch('http://localhost:3000/auth/profile', {
  headers: {
    'Authorization': `Bearer ${access_token}`
  }
});

const profile = await profileResponse.json();
console.log(profile);
```

### Ejemplo 2: Crear curso completo

```javascript
const token = 'tu_token_aqui';

// 1. Crear curso
const course = await fetch('http://localhost:3000/courses', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    title: 'React Avanzado',
    slug: 'react-avanzado',
    description: 'Curso avanzado de React',
    level: 'ADVANCED',
    categoryId: 'cuid001',
    instructorId: 'cuid002',
    price: 149.99
  })
}).then(r => r.json());

// 2. Crear módulo
const module = await fetch('http://localhost:3000/modules', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    title: 'Hooks Avanzados',
    courseId: course.id,
    order: 1
  })
}).then(r => r.json());

// 3. Subir lección con video
const formData = new FormData();
formData.append('video', videoFile);
formData.append('title', 'useReducer en detalle');
formData.append('moduleId', module.id);
formData.append('order', '1');

const lesson = await fetch('http://localhost:3000/lessons/upload-video', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
  body: formData
}).then(r => r.json());
```

### Ejemplo 3: Estudiante completando lección

```javascript
const studentToken = 'token_estudiante';

// Marcar lección como completada
const progress = await fetch('http://localhost:3000/progress/mark-complete', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${studentToken}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    courseId: 'cuid003',
    lessonId: 'cuid005'
  })
}).then(r => r.json());

// Ver progreso del curso
const courseProgress = await fetch('http://localhost:3000/progress/my-course/cuid003', {
  headers: {
    'Authorization': `Bearer ${studentToken}`
  }
}).then(r => r.json());

console.log(`Progreso: ${courseProgress.progress}%`);
```

---

## 📞 Soporte

Para más información o reportar problemas, contacta al equipo de desarrollo.

**Base URL de Producción**: A definir
**Base URL de Desarrollo**: `http://localhost:3000`

---

**Última actualización**: 2025-11-22
**Versión de la API**: 1.0
