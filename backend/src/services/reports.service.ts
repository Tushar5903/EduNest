import { Types } from "mongoose";
import { Attendance } from "../models/Attendance.js";
import { Class } from "../models/Class.js";
import { Complaint } from "../models/Complaint.js";
import { Fee } from "../models/Fee.js";
import { Result } from "../models/Result.js";
import { Test } from "../models/Test.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/errors.js";
import { assertObjectId } from "../utils/scope.js";

export async function schoolReport(instituteId: string) {
  const iid = new Types.ObjectId(instituteId);
  const [students, teachers, classes] = await Promise.all([
    User.countDocuments({ instituteId: iid, role: "student", active: true }),
    User.countDocuments({ instituteId: iid, role: "teacher", active: true }),
    Class.countDocuments({ instituteId: iid }),
  ]);
  const genderAgg = await User.aggregate([
    { $match: { instituteId: iid, role: "student", active: true } },
    { $group: { _id: "$gender", n: { $sum: 1 } } },
  ]);
  const gender: Record<string, number> = { M: 0, F: 0, O: 0 };
  for (const g of genderAgg as { _id?: string; n: number }[]) {
    if (g._id) gender[g._id] = g.n;
  }
  const fees = await Fee.aggregate([
    { $match: { instituteId: iid } },
    { $group: { _id: "$status", total: { $sum: "$amount" }, n: { $sum: 1 } } },
  ]);
  let collected = 0;
  let totalDue = 0;
  for (const f of fees as { _id: string; total: number }[]) {
    totalDue += f.total;
    if (f._id === "paid") collected += f.total;
  }
  const [attendanceCount, complaintCount] = await Promise.all([
    Attendance.countDocuments({ instituteId: iid }),
    Complaint.countDocuments({ instituteId: iid }),
  ]);
  const avgMarksAgg = await Result.aggregate([
    { $match: { instituteId: iid } },
    { $unwind: "$subjects" },
    { $group: { _id: null, avg: { $avg: { $divide: ["$subjects.marks", "$subjects.max"] } } } },
  ]);
  const avgMarks = (avgMarksAgg[0] as { avg?: number } | undefined)?.avg ?? 0;
  return {
    headcounts: { students, teachers, classes },
    gender,
    fees: { collected, totalDue, percent: totalDue ? Math.round((collected / totalDue) * 100) : 0 },
    attendanceDocs: attendanceCount,
    complaints: complaintCount,
    avgMarks: Math.round(avgMarks * 100),
  };
}

export async function teacherReport(instituteId: string, teacherId: string) {
  assertObjectId(teacherId);
  const teacher = await User.findById(teacherId).select("instituteId role");
  if (!teacher || teacher.role !== "teacher") throw ApiError.notFound("Teacher not found");
  if (!teacher.instituteId || String(teacher.instituteId) !== instituteId) throw ApiError.forbidden("Cross-institute access denied");
  const classes = await Class.find({ instituteId: new Types.ObjectId(instituteId), teacherId: teacher._id }).select("_id");
  const classIds = classes.map((c) => c._id);
  const [marked, tests] = await Promise.all([
    Attendance.countDocuments({ instituteId: new Types.ObjectId(instituteId), markedBy: teacher._id }),
    Test.countDocuments({ classId: { $in: classIds } }),
  ]);
  const complaints = await Complaint.aggregate([
    { $match: { instituteId: new Types.ObjectId(instituteId), toTeacherId: teacher._id } },
    { $group: { _id: "$status", n: { $sum: 1 } } },
  ]);
  return {
    teacherId,
    classLoad: classIds.length,
    attendanceMarked: marked,
    tests,
    complaints,
  };
}
