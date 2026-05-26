# Gestion Docente Dos

Aplicacion ligera en Node.js, Express y MySQL para que docentes carguen evidencias por materia en tres reportes parciales por semestre.

## Stack

- Node.js + Express
- Vistas `.html` renderizadas con EJS
- CSS y JavaScript sin framework de frontend
- MySQL con `mysql2`
- Carga de archivos con `multer`

## Instalacion

```bash
npm install
cp .env.example .env
```

Crea la base de datos y tablas:

```bash
mysql -u root -p < db/schema.sql
```

Actualiza `.env` con tus credenciales de MySQL y carga los datos iniciales extraidos del PDF:

```bash
npm run db:seed
```

Levanta el servidor:

```bash
npm run dev
```

Abre `http://localhost:3000`.

## Acceso de prueba

Usa un numero de empleado cargado en la semilla, por ejemplo:

- `2289` Fortunato Ramirez Arzate
- `2982` Angelica Maria Garzon Fontecha

Si MySQL no esta disponible en desarrollo local, la app usa automaticamente esos mismos datos en memoria para que puedas entrar y revisar el flujo. Para exigir conexion real a MySQL, configura:

```bash
DB_DEMO_FALLBACK=false
```

## Flujo docente

1. El docente entra con su numero de empleado.
2. El tablero muestra sus materias y los reportes `R1`, `R2`, `R3`.
3. Cada reporte precarga docente, materia, grupo, carrera y semestre.
4. El docente captura alumnos inscritos, aprobados, ausentes, observaciones y avance.
5. Las evidencias se cargan por categoria y unidad.
6. El sistema forma el nombre del archivo con unidades, clave de materia si existe, grupo y tipo de evidencia.

## Base de datos

El modelo deja separadas estas entidades:

- `professors`
- `subjects`
- `teaching_assignments`
- `reports`
- `evidence_files`

`subjects.subject_code` es opcional porque el PDF no trae todas las claves formales de materia. Cuando tengan el archivo definitivo se puede actualizar la semilla o importar desde CSV/Excel.

## Archivos

Los archivos subidos se guardan en `storage/uploads` y no se versionan en Git. Ajusta `MAX_UPLOAD_MB` en `.env` para controlar el limite por archivo.
