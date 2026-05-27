# Gestion Docente Dos

Aplicacion ligera en Node.js, Express y MySQL para que docentes carguen evidencias por materia en tres reportes parciales por semestre.

## Stack

- Node.js + Express
- Vistas `.html` renderizadas con EJS
- CSS y JavaScript sin framework de frontend
- MySQL con `mysql2`
- Carga de archivos con `multer`
- Almacenamiento local o Google Drive para evidencias

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
2. El tablero muestra sus materias y los reportes `R1`, `R2` y `Final`.
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

Los archivos subidos se organizan por docente, reporte y materia:

```text
profesor_2289/
  reporte_1/
    sistemas_de_computo_y_redes/
  reporte_2/
    sistemas_de_computo_y_redes/
  reporte_final/
    sistemas_de_computo_y_redes/
```

Por defecto se guardan en `storage/uploads` y no se versionan en Git. Ajusta `MAX_UPLOAD_MB` en `.env` para controlar el limite por archivo.

Para guardar evidencias en Google Drive configura:

```bash
STORAGE_DRIVER=google_drive
GOOGLE_DRIVE_ROOT_FOLDER_ID=id_de_la_carpeta_raiz
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=/ruta/segura/service-account.json
```

Tambien puedes usar `GOOGLE_SERVICE_ACCOUNT_JSON` con el JSON completo si prefieres no guardar el archivo de credenciales en disco. La carpeta raiz debe estar compartida con el correo de la cuenta de servicio con permiso de editor.

Si la carpeta esta en "Mi unidad" y no en una unidad compartida, usa OAuth para que Drive guarde los archivos con la cuota de tu cuenta:

```bash
STORAGE_DRIVER=google_drive
GOOGLE_DRIVE_ROOT_FOLDER_ID=id_de_la_carpeta_raiz
GOOGLE_OAUTH_CLIENT_KEY_FILE=/ruta/segura/client_secret.json
GOOGLE_OAUTH_TOKEN_FILE=/ruta/segura/google-drive-oauth-token.json
GOOGLE_OAUTH_REDIRECT_URI=http://127.0.0.1:3031/oauth2callback
```

Autoriza la cuenta una sola vez con `node scripts/google-drive-oauth.js`; el comando imprime una URL de Google, guarda el token en `GOOGLE_OAUTH_TOKEN_FILE` y despues la aplicacion puede subir evidencias a Drive.

Si actualizas una base de datos existente, ejecuta la migracion:

```bash
mysql -u root -p < db/migrations/20260527_add_evidence_storage.sql
```
