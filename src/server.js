const app = require('./app');

const host = process.env.APP_HOST || '127.0.0.1';
const port = Number(process.env.APP_PORT || 3000);

app.listen(port, host, () => {
  console.log(`Gestion Docente disponible en http://${host}:${port}`);
});
