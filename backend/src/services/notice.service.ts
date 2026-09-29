import { Types } from "mongoose";
import { Class } from "../models/Class.js";
import { Notice } from "../models/Notice.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/errors.js";
import { parsePagination } from "../utils/pagination.js";
import { assertObjectId } from "../utils/scope.js";

/** Scoped feed: student all+student+own-class; teacher all+teacher+own-classes; admin all. */
export async function listNotices(
  instituteId: string,
  query: { audience?: string; classId?: string; limit?: unknown; page?: unknown },
  viewer: { role: string; id: string },
) {
  const { page, limit, skip } = parsePagination({ page: query.page, limit: query.limit ?? query.limit ?? 20 });
  const filter: Record<string, unknown> = { instituteId: new Types.ObjectId(instituteId), active: true };

  if (viewer.role === "student") {
    const me = await User.findById(viewer.id).select("classId");
    const audiences = ["all", "student"];
    const or: Record<string, unknown>[] = [{ audience: { $in: audiences }, classId: null }];
    if (me?.classId) or.push({ audience: "class", classId: me.classId }, { audience: "all" });
    else or.push({ audience: "all" });
    // Own-class + global only; other classes excluded. Teacher-audience excluded.
    filter.$or = [{ audience: { $in: ["all", "student"] } }, ...(me?.classId ? [{ audience: "class", classId: me.classId }] : [])];
    void or;
  } else if (viewer.role === "teacher") {
    const owned = await Class.find({ teacherId: new Types.ObjectId(viewer.id), instituteId: new Types.ObjectId(instituteId) }).select("_id");
    const ownedIds = owned.map((c) => c._id);
    filter.$or = [{ audience: { $in: ["all", "teacher"] } }, { audience: "class", classId: { $in: ownedIds } }];
  }
  // Admin: no extra filter (all audiences). Optional narrow-down:
  if (query.audience && viewer.role === "admin") filter.audience = query.audience;
  if (query.classId && viewer.role === "admin") {
    assertObjectId(query.classId);
    filter.classId = new Types.ObjectId(query.classId);
  }

  const [total, rows] = await Promise.all([
    Notice.countDocuments(filter),
    Notice.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
  ]);
  const data = rows.map((n) => ({
    id: String(n._id),
    title: n.title,
    body: n.body,
    audience: n.audience,
    classId: n.classId ? String(n.classId) : null,
    type: n.type,
    createdAt: n.createdAt,
  }));
  return { data, page, total };
}

export async function createNotice(actor: { id: string; role: string }, instituteId: string, input: { title: string; body: string; audience: "all" | "student" | "teacher" | "class"; classId?: string }) {
  if (actor.role === "teacher") {
    if (input.audience !== "class" || !input.classId) throw ApiError.forbidden("Teachers can only post class notices for their own class");
    assertObjectId(input.classId);
    const klass = await Class.findById(input.classId);
    if (!klass || String(klass.instituteId) !== instituteId) throw ApiError.forbidden("Cross-institute access denied");
    if (String(klass.teacherId ?? "") !== actor.id) throw ApiError.forbidden("Forbidden for this class");
  }
  if (input.classId) assertObjectId(input.classId);
  const n = await Notice.create({
    instituteId: new Types.ObjectId(instituteId),
    title: input.title.trim(),
    body: input.body.trim(),
    audience: input.audience,
    classId: input.classId ? new Types.ObjectId(input.classId) : null,
    type: "general",
    createdBy: new Types.ObjectId(actor.id),
  });
  return { id: String(n._id), title: n.title };
}

export async function updateNotice(actor: { id: string; role: string }, instituteId: string, noticeId: string, input: { title?: string; body?: string }) {
  assertObjectId(noticeId);
  const n = await Notice.findById(noticeId);
  if (!n || !n.active) throw ApiError.notFound("Notice not found");
  if (String(n.instituteId) !== instituteId) throw ApiError.forbidden("Cross-institute access denied");
  if (actor.role === "teacher" && String(n.createdBy ?? "") !== actor.id) throw ApiError.forbidden("You can only edit your own posts");
  if (actor.role === "student") throw ApiError.forbidden("Forbidden for this role");
  if (input.title !== undefined) n.title = input.title.trim();
  if (input.body !== undefined) n.body = input.body.trim();
  await n.save();
  return { id: String(n._id), title: n.title };
}

export async function deleteNotice(actor: { id: string; role: string }, instituteId: string, noticeId: string) {
  assertObjectId(noticeId);
  const n = await Notice.findById(noticeId);
  if (!n || !n.active) throw ApiError.notFound("Notice not found");
  if (String(n.instituteId) !== instituteId) throw ApiError.forbidden("Cross-institute access denied");
  if (actor.role === "teacher" && String(n.createdBy ?? "") !== actor.id) throw ApiError.forbidden("You can only delete your own posts");
  if (actor.role === "student") throw ApiError.forbidden("Forbidden for this role");
  n.active = false;
  await n.save();
  return { id: String(n._id), active: false };
}
