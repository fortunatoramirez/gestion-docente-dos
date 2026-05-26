require('dotenv').config();

const path = require('path');
const ejs = require('ejs');
const express = require('express');
const session = require('express-session');

const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const reportRoutes = require('./routes/reportRoutes');

const app = express();

app.engine('html', ejs.renderFile);
app.set('view engine', 'html');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use(
  session({
    name: 'gestion_docente_sid',
    secret: process.env.APP_SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

app.use((req, res, next) => {
  res.locals.appName = process.env.APP_NAME || 'Gestion Docente';
  res.locals.currentPath = req.path;
  res.locals.professor = req.session.professor || null;
  next();
});

app.use('/', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/reportes', reportRoutes);

app.use((req, res) => {
  res.status(404).render('error.html', {
    title: 'No encontrado',
    message: 'La pagina solicitada no esta disponible.'
  });
});

app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).render('error.html', {
      title: 'Archivo demasiado grande',
      message: `El archivo excede el limite configurado de ${process.env.MAX_UPLOAD_MB || 512} MB.`
    });
  }

  console.error(err);
  return res.status(500).render('error.html', {
    title: 'Error',
    message: 'Ocurrio un problema al procesar la solicitud.'
  });
});

module.exports = app;
