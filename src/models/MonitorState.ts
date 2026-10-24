import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const MonitorStateSchema = new Schema({
  monitorId: { type: String, required: true, unique: true },
  state: { type: String, enum: ["up", "down"], required: true, default: "up" },
  consecutiveFails: { type: Number, required: true, default: 0 },
  lastCheckedAt: Date,
});

export type MonitorStateDoc = InferSchemaType<typeof MonitorStateSchema>;
export const MonitorState: Model<MonitorStateDoc> =
  (mongoose.models.MonitorState as Model<MonitorStateDoc>) ??
  mongoose.model<MonitorStateDoc>("MonitorState", MonitorStateSchema);
