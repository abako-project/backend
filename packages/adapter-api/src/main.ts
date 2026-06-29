import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { VersioningType } from '@nestjs/common';
import cors from 'cors';
import bodyParser from 'body-parser';
import morgan from 'morgan';
import http from 'http';
import { ConfigService } from './config/config.service';
import { setupSwagger } from './config/swagger.config';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  // Ensure SQLite data directory exists
  const dbPath = process.env.SQLITE_PATH || './data/abako.sqlite';
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  const configService = app.get(ConfigService);
  const port = configService.getPort();

  // API Versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Middleware
  const corsOrigin = configService.getCorsOrigin();
  if (corsOrigin) {
    app.use(cors({
      origin: corsOrigin.split(',').map((origin) => origin.trim()).filter(Boolean),
      credentials: true,
    }));
  } else {
    app.use(cors());
  }
  app.use(bodyParser.json());
  app.use(morgan('dev'));

  // Swagger UI
  setupSwagger(app);

  // In dev mode, proxy /api/* and contracts paths to mock-api
  const mockUrl = process.env.FEDERATE_SERVER?.replace(/\/api$/, '');
  if (process.env.USE_MOCK_AUTH === 'true' && mockUrl) {
    const expressApp = app.getHttpAdapter().getInstance();
    const proxyToMock = (req: any, res: any) => {
      const target = new URL(req.originalUrl, mockUrl);
      const proxyReq = http.request(target, { method: req.method, headers: req.headers }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
        proxyRes.pipe(res);
      });
      proxyReq.on('error', () => res.status(502).json({ error: 'mock-api unavailable' }));
      if (req.body && Object.keys(req.body).length > 0) {
        proxyReq.write(JSON.stringify(req.body));
      }
      proxyReq.end();
    };
    // Proxy /adapter/* to self (strips prefix) and external mock paths to mock-api
    const proxyToSelf = (req: any, res: any) => {
      const stripped = req.originalUrl.replace(/^\/adapter/, '');
      const target = new URL(stripped, `http://localhost:${port}`);
      const proxyReq = http.request(target, { method: req.method, headers: req.headers }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
        proxyRes.pipe(res);
      });
      proxyReq.on('error', () => res.status(502).json({ error: 'self-proxy failed' }));
      if (req.body && Object.keys(req.body).length > 0) {
        proxyReq.write(JSON.stringify(req.body));
      }
      proxyReq.end();
    };
    expressApp.all('/adapter/{*path}', proxyToSelf);
    expressApp.all('/api/{*path}', proxyToMock);
    expressApp.all('/health', proxyToMock);
    expressApp.all('/auth/me', proxyToMock);
    expressApp.all('/projects', proxyToMock);
    expressApp.all('/projects/{*path}', proxyToMock);
    expressApp.all('/calendar/{*path}', proxyToMock);
    expressApp.all('/kreivo', proxyToMock);
  }

  await app.listen(port);
  console.log(`
  Adapter API :${port}
  Docs     http://localhost:${port}/api-docs
`);
}

bootstrap();
