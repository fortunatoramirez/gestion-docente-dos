# Gestion Docente Dos

Aplicacion ligera en Node.js, Express y MySQL para que docentes carguen evidencias por materia en tres reportes parciales por semestre.

## Semestre 2026-3

La fuente conciliada esta en `data/semester-2026-3.json`: 35 profesores,
82 asignaciones y 60 nombres de materia. La importacion no cambia contrasenas, nombres de cuentas existentes ni reportes historicos.
Completa un correo vacio con los datos confirmados de Fidel (2956) y Jesus (2957);
si ya existe un correo distinto o pertenece a otra cuenta, se detiene antes de
aplicar cambios. Reutiliza y corrige la materia `AUTOMTIZACION ROBOTICA` como
`AUTOMATIZACION ROBOTICA` cuando el catalogo solo contiene la errata, conservando
su ID, asociaciones y archivos. Esa correccion del nombre compartido tambien
se refleja en la consulta historica; no mueve ni renombra los archivos antiguos. Las cuentas nuevas
usan su numero de empleado como contrasena temporal y deben cambiarla al entrar.

Antes de importar, respalda la base de datos y los archivos de configuracion.
Verifica que `GOOGLE_DRIVE_ROOT_FOLDER_ID` siga apuntando a la raiz historica.
La importacion busca una sola hija llamada `evidencia-docente-2026-3` y comprueba
permiso de escritura; no crea otra carpeta de semestre ni escribe en la raiz
cuando no encuentra la hija.

```bash
# Solo prepara el esquema, sin eliminar datos.
npm run db:migrate-semesters
# Simulacion: muestra altas, reutilizaciones y asociaciones a desactivar.
npm run db:import-semester
# Aplicar la conciliacion y crear/reutilizar las carpetas de los 35 docentes.
npm run db:import-semester -- --apply
```

El semestre actual se guarda en `academic_semesters`; solo puede haber uno.
Las asociaciones de otros periodos conservan su identificador y sus archivos.
El docente solo accede a sus asociaciones activas del semestre actual,
incluyendo al solicitar enlaces directos. El administrador tiene un filtro por
semestre y consulta de reportes/archivos historicos en modo lectura.
No se puede cambiar la identidad de una asignacion que ya contiene reportes;
se debe desactivar y crear otra. Los creditos de la carga se guardan por
asignacion, sin sobrescribir el catalogo compartido.

Las carpetas y archivos de Drive guardan sus IDs reales en MySQL. Las nuevas
evidencias se organizan asi; los archivos anteriores conservan su ubicacion:

```text
evidencia-docente/
  evidencia-docente-2026-3/
    2289_ramirez_arzate_fortunato/
      reporte_1/
        tecnologias_de_bases_de_datos/
          bm5a/
            reporte_1_bm5a_ID.html
            evidencias/
          bm5b/
            evidencias/
```

Al guardar se actualiza una copia HTML imprimible del reporte en su propia
carpeta de materia/grupo, usando el mismo archivo en cada guardado. Los destinos
se resuelven por semestre; la raiz historica se conserva para los periodos
anteriores. Los archivos mantienen los permisos existentes de Drive.

`npm test` comprueba el renderizado. `npm run test:semesters` contiene las pruebas
de importacion repetida, conservacion, acceso docente/administrador, carga y
cambio inicial de contrasena. Esta prueba requiere una copia aislada de la base
anterior a la carga, llamada `gestion_docente_2026_3_test`, con credenciales y
`UPLOAD_DIR` de pruebas; rechaza ejecutarse en otra base. No usar `db:seed` para
actualizar una instalacion de produccion existente.

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

Si MySQL no esta disponible en desarrollo local, la app puede usar datos de prueba en memoria. En produccion este modo esta deshabilitado. Para exigir conexion real a MySQL tambien en desarrollo, configura:

```bash
DB_DEMO_FALLBACK=false
```

## Flujo docente

1. El docente entra con su numero de empleado y contrasena; las cuentas nuevas deben cambiar su contrasena temporal.
2. El tablero muestra solo sus materias actuales y los reportes `Reporte 1`, `Reporte 2` y `Reporte Final`.
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
