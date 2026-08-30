import express from "express";
import { createManagerService, publicManagerError, readManagerConfig } from "./manager-api.mjs";

const notConfigured = {
  status: 503,
  body: { error: { code: "PERXONA_NOT_CONFIGURED", message: "Perxona 動態主管尚未設定。" } },
};

const invalidRequest = {
  error: { code: "INVALID_REQUEST", message: "請確認情境與逐字稿格式後再試一次。" },
};

const internalError = {
  error: { code: "INTERNAL_ERROR", message: "伺服器暫時無法完成請求。" },
};

export function createApp({ env = process.env, fetchImpl = fetch, staticDir, configureApp } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use((_request, response, next) => {
    response.set({
      "Content-Security-Policy": "frame-ancestors 'none'",
      "Permissions-Policy": "camera=(self), microphone=(self)",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
    });
    next();
  });
  app.use(express.json({ limit: "32kb", strict: true }));

  const config = readManagerConfig(env);
  const managerService = config ? createManagerService({ config, fetchImpl }) : null;

  app.get("/api/manager/status", (_request, response) => {
    response.json({ configured: Boolean(managerService) });
  });

  app.post("/api/manager/reply", async (request, response) => {
    if (!managerService) {
      response.status(notConfigured.status).json(notConfigured.body);
      return;
    }
    try {
      const replyText = await managerService.reply(request.body);
      response.json({ replyText, source: "perxona" });
    } catch (error) {
      const failure = publicManagerError(error);
      response.status(failure.status).json(failure.body);
    }
  });

  if (staticDir) {
    app.use(express.static(staticDir));
    app.use((request, response, next) => {
      if (request.method !== "GET" || !request.accepts("html")) {
        next();
        return;
      }
      response.sendFile("index.html", { root: staticDir });
    });
  }

  configureApp?.(app);

  app.use((error, _request, response, next) => {
    if (response.headersSent) {
      next(error);
      return;
    }
    if (error?.type === "entity.too.large" || error?.type === "entity.parse.failed") {
      response.status(400).json(invalidRequest);
      return;
    }
    response.status(500).json(internalError);
  });

  return app;
}
