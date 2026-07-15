import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Country, CountryDocument } from './country.schema';
import DEFAULT_COUNTRIES from './countries.seed.json';

const CURRENCY_PATTERN = /^[A-Za-z]{3}$/;

@Injectable()
export class CountriesService implements OnModuleInit {
  private readonly logger = new Logger(CountriesService.name);

  constructor(
    @InjectModel(Country.name) private countryModel: Model<CountryDocument>,
  ) {}

  async onModuleInit() {
    const result = await this.ensureDefaults();
    if (result.created) this.logger.log(result.message);
  }

  /** Insert any missing seed countries; never overwrite existing rows. */
  async ensureDefaults(): Promise<{ created: boolean; message: string }> {
    const existing = await this.countryModel.find().select('name').lean().exec();
    const existingNames = new Set(existing.map((c) => c.name.toLowerCase()));

    const toInsert = (DEFAULT_COUNTRIES as { name: string; currency: string }[])
      .filter((c) => c.name && c.currency && !existingNames.has(c.name.toLowerCase()))
      .map((c) => ({
        name: c.name.trim(),
        currency: c.currency.trim().toUpperCase(),
        isActive: true,
      }));

    if (toInsert.length === 0) {
      return {
        created: false,
        message: `Country catalog already has ${existing.length} entries`,
      };
    }

    await this.countryModel.insertMany(toInsert, { ordered: false });
    return {
      created: true,
      message: `Added ${toInsert.length} countries (catalog total ~${existing.length + toInsert.length})`,
    };
  }

  private normalizeCurrency(value: string): string {
    const currency = (value || '').trim().toUpperCase();
    if (!currency) {
      throw new BadRequestException('Currency is required');
    }
    if (!CURRENCY_PATTERN.test(currency)) {
      throw new BadRequestException(
        'Currency must be a 3-letter code like USD, INR, or AED',
      );
    }
    return currency;
  }

  async findAll(): Promise<any[]> {
    return this.countryModel.find().sort({ name: 1 }).lean().exec();
  }

  async findActive(): Promise<any[]> {
    return this.countryModel
      .find({ isActive: true })
      .sort({ name: 1 })
      .lean()
      .exec();
  }

  async findById(id: string): Promise<any> {
    const country = await this.countryModel.findById(id).lean().exec();
    if (!country) throw new NotFoundException(`Country ${id} not found`);
    return country;
  }

  async findActiveByName(name: string): Promise<CountryDocument | null> {
    return this.countryModel
      .findOne({ name: name.trim(), isActive: true })
      .exec();
  }

  async assertActiveCountry(
    name: string,
  ): Promise<{ name: string; currency: string }> {
    const trimmed = (name || '').trim();
    if (!trimmed) {
      throw new BadRequestException('Country is required');
    }
    const found = await this.findActiveByName(trimmed);
    if (!found) {
      throw new BadRequestException(
        `Country "${trimmed}" is not an active country`,
      );
    }
    return { name: found.name, currency: found.currency };
  }

  async create(data: { name: string; currency: string }): Promise<any> {
    const name = data.name.trim();
    const currency = this.normalizeCurrency(data.currency);
    if (!name) {
      throw new BadRequestException('Name is required');
    }
    const existing = await this.countryModel.findOne({ name }).exec();
    if (existing) {
      throw new ConflictException(`Country "${name}" already exists`);
    }
    const country = new this.countryModel({
      name,
      currency,
      isActive: true,
    });
    return (await country.save()).toObject();
  }

  async update(
    id: string,
    data: { name?: string; currency?: string; isActive?: boolean },
  ): Promise<any> {
    const update: Record<string, unknown> = {};
    if (data.name !== undefined) {
      const name = data.name.trim();
      if (!name) throw new BadRequestException('Name cannot be empty');
      const conflict = await this.countryModel
        .findOne({ name, _id: { $ne: id } })
        .exec();
      if (conflict) {
        throw new ConflictException(`Country "${name}" already exists`);
      }
      update.name = name;
    }
    if (data.currency !== undefined) {
      update.currency = this.normalizeCurrency(data.currency);
    }
    if (data.isActive !== undefined) update.isActive = data.isActive;

    const country = await this.countryModel
      .findByIdAndUpdate(id, { $set: update }, { new: true })
      .lean()
      .exec();
    if (!country) throw new NotFoundException(`Country ${id} not found`);
    return country;
  }

  async delete(id: string): Promise<void> {
    const result = await this.countryModel.deleteOne({ _id: id }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Country ${id} not found`);
    }
  }
}
