const fs = require('fs');
const fsp = require('fs/promises');
const http = require('http');
const path = require('path');
const { google } = require('googleapis');

require('dotenv').config();

const scopes = ['https://www.googleapis.com/auth/drive'];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
}

function oauthClient() {
  const clientPath = process.env.GOOGLE_OAUTH_CLIENT_KEY_FILE;
  if (!clientPath) {
    throw new Error('Configura GOOGLE_OAUTH_CLIENT_KEY_FILE antes de autorizar Drive.');
  }

  const credentials = readJson(clientPath);
  const config = credentials.installed || credentials.web;
  if (!config) {
    throw new Error('El archivo OAuth no contiene una seccion installed o web.');
  }

  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://127.0.0.1:3031/oauth2callback';
  return new google.auth.OAuth2(config.client_id, config.client_secret, redirectUri);
}

async function saveToken(token) {
  const tokenPath = process.env.GOOGLE_OAUTH_TOKEN_FILE;
  if (!tokenPath) {
    throw new Error('Configura GOOGLE_OAUTH_TOKEN_FILE para guardar el token.');
  }

  const resolvedTokenPath = path.resolve(tokenPath);
  await fsp.mkdir(path.dirname(resolvedTokenPath), { recursive: true });
  await fsp.writeFile(resolvedTokenPath, JSON.stringify(token, null, 2));
  await fsp.chmod(resolvedTokenPath, 0o600);
  return resolvedTokenPath;
}

async function main() {
  const client = oauthClient();
  const redirect = new URL(client.redirectUri);
  const expectedPath = redirect.pathname || '/';

  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes
  });

  const server = http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url, client.redirectUri);
      if (requestUrl.pathname !== expectedPath) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const code = requestUrl.searchParams.get('code');
      const error = requestUrl.searchParams.get('error');

      if (error) {
        throw new Error(error);
      }

      if (!code) {
        throw new Error('Google no devolvio un codigo de autorizacion.');
      }

      const { tokens } = await client.getToken(code);
      const tokenPath = await saveToken(tokens);

      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Autorizacion completada. Ya puedes cerrar esta pestana.');
      console.log(`TOKEN_SAVED ${tokenPath}`);
      server.close();
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`Error autorizando Google Drive: ${error.message}`);
      console.error(error.message);
      server.close(() => process.exit(1));
    }
  });

  server.listen(Number(redirect.port || 80), redirect.hostname, () => {
    console.log(`AUTH_URL ${authUrl}`);
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
