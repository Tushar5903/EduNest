import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import "express-async-errors";
import helmet from "helmet";
import morgan from "morgan";
import { corsOptions } from "./config/cors.js";
import { databaseState } from "./config/database.js";
import { errorHandler, notFound } from "./middleware/error.middleware.js";
import authRoutes from "./routes/auth.routes.js";
import superRoutes from "./routes/super.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import classRoutes from "./routes/class.routes.js";
import teacherRoutes from "./routes/teacher.routes.js";
import timetableRoutes from "./routes/timetable.routes.js";
import attendanceRoutes from "./routes/attendance.routes.js";
import studentRoutes from "./routes/student.routes.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors(corsOptions()));
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use(morgan("dev"));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, data: { service: "edunest-api", db: databaseState(), time: new Date().toISOString() } });
  });

  // Phase 4+ routers mount here (admin, teacher, student, ...).
  app.use("/api/auth", authRoutes);
  app.use("/api/super", superRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/classes", classRoutes);
  app.use("/api/teacher", teacherRoutes);
  app.use("/api/timetables", timetableRoutes);
  app.use("/api/attendance", attendanceRoutes);
  app.use("/api/students", studentRoutes);

  app.use("/api", notFound);
  app.use(errorHandler);
  return app;
}
