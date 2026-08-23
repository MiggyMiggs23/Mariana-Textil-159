import express, { type ErrorRequestHandler, type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import { ZodError } from "zod";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export const apiErrorHandler: ErrorRequestHandler = (
  error,
  req,
  res,
  next,
) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof ZodError) {
    req.log.warn(
      {
        issues: error.issues.map((issue) => ({
          code: issue.code,
          path: issue.path.join("."),
        })),
      },
      "Invalid API request",
    );
    res.status(400).json({
      error: "Revisa los datos enviados e intenta de nuevo.",
      code: "VALIDATION_ERROR",
    });
    return;
  }

  if (error instanceof SyntaxError && "body" in error) {
    req.log.warn("Invalid JSON request body");
    res.status(400).json({
      error: "La solicitud contiene datos inválidos.",
      code: "INVALID_JSON",
    });
    return;
  }

  req.log.error({ err: error }, "Unhandled API error");
  res.status(500).json({
    error: "Ocurrió un error inesperado. Intenta de nuevo.",
    code: "INTERNAL_ERROR",
  });
};

app.use(apiErrorHandler);

export default app;
