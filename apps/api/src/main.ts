import "reflect-metadata";
import { join } from "path";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import type { Request, Response, NextFunction } from "express";
import { AppModule } from "./app.module";
import { validateEnv } from "./config/env.validation";

async function bootstrap() {
  validateEnv(process.env);
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix("api");
  app.use(cookieParser());
  app.use(
    helmet({
      // helmet's own defaults (style-src 'self' https: 'unsafe-inline', font-src 'self'
      // https: data:, script-src 'self', connect-src via default-src 'self', etc.) already
      // cover this app as-is: the Google Fonts stylesheet/font files load over https:, the
      // Vite build has no inline scripts, and every fetch is same-origin (VITE_API_URL=/api).
      // The one directive worth tightening beyond the default is frame-ancestors: this app
      // has no legitimate reason to ever be framed, including by itself, so 'none' instead
      // of helmet's default 'self'.
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          "frame-ancestors": ["'none'"],
        },
      },
    }),
  );
  app.enableCors({ origin: process.env.WEB_ORIGIN, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  // Serves the web app's build (see docs/adr/0002-single-docker-image.md). Plain
  // Express static + a manual SPA fallback, not @nestjs/serve-static: that package
  // pulls in a path-to-regexp version with a known HIGH-severity advisory, and this
  // app doesn't need anything the package offers beyond what Express already does.
  const publicDir = join(__dirname, "..", "public");
  app.useStaticAssets(publicDir);
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method === "GET" && !req.path.startsWith("/api")) {
      res.sendFile(join(publicDir, "index.html"));
    } else {
      next();
    }
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
