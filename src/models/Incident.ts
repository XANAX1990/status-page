import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const IncidentSchema = new Schema({
  monitorId: { type: String, required: true },
  startedAt: { type: Date, required: true },
  resolvedAt: Date,
  cause: String,
});

IncidentSchema.index({ monitorId: 1, startedAt: 1 });

export type IncidentDoc = InferSchemaType<typeof IncidentSchema>;
export const Incident: Model<IncidentDoc> =
  (mongoose.models.Incident as Model<IncidentDoc>) ??
  mongoose.model<IncidentDoc>("Incident", IncidentSchema);
