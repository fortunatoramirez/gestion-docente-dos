require('dotenv').config();

const path = require('path');
const ejs = require('ejs');
const express = require('express');
const session = require('express-session');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const profileRoutes = require('./routes/profileRoutes');
const reportRoutes = require('./routes/reportRoutes');
const { isAdminProfessor } = require('./middleware/auth');
const { basePath, prefixRedirect, urlFor } = require('./config/basePath');
const {
  MAX_FILES_PER_UPLOAD_FIELD,
  MAX_UPLOAD_MB
} = require('./utils/uploadLimits');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

app.engine('html', ejs.renderFile);
app.set('view engine', 'html');
app.set('views', path.join(__dirname, 'views'));
if (isProduction) app.set('trust proxy', 1);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public'), { redirect: false }));
if (basePath) app.use(basePath, express.static(path.join(__dirname, '..', 'public'), { redirect: false }));

app.use(
  session({
    name: 'gestion_docente_sid',
    secret: process.env.APP_SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

app.use((req, res, next) => {
  const originalRedirect = res.redirect.bind(res);
  res.redirect = (statusOrUrl, maybeUrl) => {
    if (typeof statusOrUrl === 'string') return originalRedirect(prefixRedirect(statusOrUrl));
    if (typeof maybeUrl === 'string') return originalRedirect(statusOrUrl, prefixRedirect(maybeUrl));
    return originalRedirect(statusOrUrl);
  };

  res.locals.appName = process.env.APP_NAME || 'Gestión Docente';
  res.locals.basePath = basePath;
  res.locals.urlFor = urlFor;
  res.locals.currentPath = req.path;
  res.locals.professor = req.session.professor || null;
  res.locals.isAdmin = isAdminProfessor(req.session.professor);
  res.locals.passwordChangeRequired = Boolean(req.session.professor && req.session.professor.must_change_password);
  next();
});

if (basePath) {
  app.get('/', (req, res) => {
    res.redirect(urlFor('/'));
  });
}

const appRoutes = express.Router();
appRoutes.use('/', authRoutes);
appRoutes.use('/perfil', profileRoutes);
appRoutes.use('/admin', adminRoutes);
appRoutes.use('/dashboard', dashboardRoutes);
appRoutes.use('/reportes', reportRoutes);

app.use(basePath || '/', appRoutes);

if (basePath) {
  app.use((req, res, next) => {
    const legacyPaths = ['/perfil', '/admin', '/dashboard', '/reportes', '/login', '/logout'];
    if (req.method === 'GET' && legacyPaths.some((legacyPath) => req.path === legacyPath || req.path.startsWith(`${legacyPath}/`))) {
      return res.redirect(urlFor(req.originalUrl));
    }
    return next();
  });
}

app.use((req, res) => {
  res.status(404).render('error.html', {
    title: 'No encontrado',
    message: 'La página solicitada no está disponible.'
  });
});

app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).render('error.html', {
      title: 'Archivo demasiado grande',
      message: `Cada archivo de evidencia puede pesar hasta ${MAX_UPLOAD_MB} MB.`
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT') {
    return res.status(413).render('error.html', {
      title: 'Demasiados archivos',
      message: `Cada caja de evidencia acepta hasta ${MAX_FILES_PER_UPLOAD_FIELD} archivos.`
    });
  }

  console.error(err);
  return res.status(500).render('error.html', {
    title: 'Error',
    message: 'Ocurrió un problema al procesar la solicitud.'
  });
});

module.exports = app;
