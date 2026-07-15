import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ProjectDocument = Project & Document;

@Schema({ collection: 'projects', timestamps: true })
export class Project {
  @Prop({ required: true, unique: true, trim: true })
  name: string;

  /** Auto-generated unique code, e.g. ACE-PR-000001 — not user-editable */
  @Prop({ required: true, trim: true })
  code: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const ProjectSchema = SchemaFactory.createForClass(Project);
// Unique index is ensured in ProjectsService.onModuleInit after codes are repaired.
