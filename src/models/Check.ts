import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const CheckSchema = new Schema({
  monitorId: { type: String, required: true },
  at: { type: Date, required: true, default: () => new Date() },
  ok: { type: Boolean, required: true },
  statusCode: Number,
  latencyMs: Number,
  error: String,
});

CheckSchema.index({ at: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });
CheckSchema.index({ monitorId: 1, at: 1 });

export type CheckDoc = InferSchemaType<typeof CheckSchema>;
export const Check: Model<CheckDoc> =
  (mongoose.models.Check as Model<CheckDoc>) ?? mongoose.model<CheckDoc>("Check", CheckSchema);
