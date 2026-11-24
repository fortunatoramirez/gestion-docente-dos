# Gestion Docente Dos

Aplicacion ligera en Node.js, Express y MySQL para que docentes carguen evidencias por materia en tres reportes parciales por semestre.

## Evaluación departamental

Desde **Administración → Evaluación departamental**, la jefatura habilita un expediente por profesor de **tiempo completo** y semestre. La selección se hace con base en el nombramiento. El profesor entra desde **Mi perfil → Evaluación departamental**, incluso cuando no tiene grupos asignados.

El expediente contiene los 15 criterios del instrumento TecNM 2015, una guía de los seis niveles de cada criterio y ejemplos de comprobantes. Docencia y Gestión aplican a los docentes evaluados. La jefatura indica si corresponden Tutoría, Investigación y Vinculación según las actividades o el nombramiento del periodo.

| Aportación | Cómo llega al expediente |
| --- | --- |
| Reportes parciales y finales enviados, y sus exámenes | El criterio 2 enlaza los originales de las asignaturas del profesor y semestre. El reporte aporta información de avance y cierre del grupo. |
| Prácticas, ejercicios, presentaciones e investigaciones del alumnado en reportes enviados | El criterio 3 enlaza los archivos de la materia y conserva su grupo y parcial. |
| Comprobantes del profesor | El docente puede agregar archivos a cualquiera de los 15 criterios, incluidos los que ya tienen evidencia de plataforma. |
| Comprobantes de oficinas | La oficina elige un expediente y aporta desde su propia cuenta a los criterios que le corresponden. Por ejemplo, Vinculación puede aportar la designación de asesor de residencia al criterio 4 y Tutorías puede aportar el acuse del plan tutorial al 6. |

Cada aportación manual conserva el origen, el nombre de quien la registró, la fecha y el archivo. La jefatura revisa los comprobantes y registra el nivel de 0 a 5 y sus observaciones. **Por valorar**, **Por definir** y **No aplica** se distinguen del nivel cero. El reporte individual se puede imprimir o guardar como PDF desde el navegador. El concentrado CSV de Excel reúne una fila por docente y criterio, con nivel, aplicabilidad y número de aportaciones por origen.

### Activación en una instalación existente

Con el catálogo de semestres ya configurado, ejecuta una vez el siguiente comando en el servidor de la aplicación.

```bash
npm run db:migrate-department
```

La migración agrega tres tablas y se puede repetir. Para instalaciones nuevas están incluidas en `db/schema.sql`. Las cuentas con acceso a la jefatura se toman de `ADMIN_EMPLOYEE_NUMBERS`. Para acceso de oficinas, asigna en `.env` sus números de empleado, separados por comas, y reinicia la aplicación.

| Variable | Oficina |
| --- | --- |
| `DEPT_TUTORIAS_EMPLOYEES` | Coordinación de Tutorías |
| `DEPT_INVESTIGACION_EMPLOYEES` | Jefatura de Proyectos de Investigación |
| `DEPT_VINCULACION_EMPLOYEES` | Jefatura de Vinculación |

La oficina consulta sus propios comprobantes dentro de los criterios habilitados. El profesor consulta todo su expediente del periodo actual. La jefatura consulta también el histórico en modo lectura. Los archivos usan el proveedor configurado en `STORAGE_DRIVER` y quedan en la carpeta del docente, bajo `evaluacion_departamental/criterio_N`.

`npm run test:department` prueba el flujo HTTP en modo demo. Con `DEPARTMENT_TEST_SQL=1`, la misma prueba usa el servidor de pruebas configurado en `DB_HOST` y `DB_PORT` con sus credenciales, crea una base temporal de nombre aleatorio y la elimina al terminar.

## Semestre 2026-3

La fuente conciliada esta en `data/semester-2026-3.json`: 35 profesores,
82 asignaciones y 60 nombres de materia. La importacion no cambia contrasenas,
correos, nombres de cuentas existentes ni reportes historicos. Las cuentas nuevas
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
