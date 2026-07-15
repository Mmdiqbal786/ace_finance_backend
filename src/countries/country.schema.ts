import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CountryDocument = Country & Document;

@Schema({ collection: 'countries', timestamps: true })
export class Country {
  @Prop({ required: true, unique: true, trim: true })
  name: string;

  /** ISO-style currency code, e.g. USD, INR, AED */
  @Prop({ required: true, trim: true, uppercase: true })
  currency: string;

  @Prop({ default: true })
  isActive: boolean;
}

export const CountrySchema = SchemaFactory.createForClass(Country);
