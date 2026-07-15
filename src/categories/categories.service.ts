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
import { Category, CategoryDocument } from './category.schema';

const DEFAULT_CATEGORIES = [
  { name: 'Travel', label: 'Travel & Lodging', icon: '✈️' },
  { name: 'Meals', label: 'Meals & Entertainment', icon: '🍔' },
  { name: 'Office', label: 'Office Supplies', icon: '📎' },
  { name: 'Software', label: 'Software & SaaS', icon: '💻' },
  { name: 'Other', label: 'Other Expenses', icon: '📦' },
];

@Injectable()
export class CategoriesService implements OnModuleInit {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
  ) {}

  async onModuleInit() {
    const result = await this.ensureDefaults();
    if (result.created) this.logger.log(result.message);
  }

  async findAll(): Promise<any[]> {
    return this.categoryModel.find().sort({ name: 1 }).lean().exec();
  }

  async findActive(): Promise<any[]> {
    return this.categoryModel
      .find({ isActive: true })
      .sort({ name: 1 })
      .lean()
      .exec();
  }

  async findById(id: string): Promise<any> {
    const category = await this.categoryModel.findById(id).lean().exec();
    if (!category) throw new NotFoundException(`Category ${id} not found`);
    return category;
  }

  async findActiveByName(name: string): Promise<CategoryDocument | null> {
    return this.categoryModel
      .findOne({ name: name.trim(), isActive: true })
      .exec();
  }

  async assertActiveName(name: string): Promise<string> {
    const trimmed = (name || '').trim();
    if (!trimmed) {
      throw new BadRequestException('Category is required');
    }
    const found = await this.findActiveByName(trimmed);
    if (!found) {
      throw new BadRequestException(
        `Category "${trimmed}" is not an active category`,
      );
    }
    return found.name;
  }

  async create(data: {
    name: string;
    label: string;
    icon?: string;
  }): Promise<any> {
    const name = data.name.trim();
    const label = data.label.trim();
    if (!name || !label) {
      throw new BadRequestException('Name and label are required');
    }
    const existing = await this.categoryModel.findOne({ name }).exec();
    if (existing) {
      throw new ConflictException(`Category "${name}" already exists`);
    }
    const category = new this.categoryModel({
      name,
      label,
      icon: data.icon?.trim() || '📦',
      isActive: true,
    });
    return (await category.save()).toObject();
  }

  async update(
    id: string,
    data: {
      name?: string;
      label?: string;
      icon?: string;
      isActive?: boolean;
    },
  ): Promise<any> {
    const update: Record<string, unknown> = {};
    if (data.name !== undefined) {
      const name = data.name.trim();
      if (!name) throw new BadRequestException('Name cannot be empty');
      const conflict = await this.categoryModel
        .findOne({ name, _id: { $ne: id } })
        .exec();
      if (conflict) {
        throw new ConflictException(`Category "${name}" already exists`);
      }
      update.name = name;
    }
    if (data.label !== undefined) {
      const label = data.label.trim();
      if (!label) throw new BadRequestException('Label cannot be empty');
      update.label = label;
    }
    if (data.icon !== undefined) update.icon = data.icon.trim() || '📦';
    if (data.isActive !== undefined) update.isActive = data.isActive;

    const category = await this.categoryModel
      .findByIdAndUpdate(id, { $set: update }, { new: true })
      .lean()
      .exec();
    if (!category) throw new NotFoundException(`Category ${id} not found`);
    return category;
  }

  async delete(id: string): Promise<void> {
    const result = await this.categoryModel.deleteOne({ _id: id }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Category ${id} not found`);
    }
  }

  async ensureDefaults(): Promise<{ created: boolean; message: string }> {
    const count = await this.categoryModel.countDocuments().exec();
    if (count > 0) {
      return { created: false, message: 'Categories already exist. Seed skipped.' };
    }
    await this.categoryModel.insertMany(
      DEFAULT_CATEGORIES.map((c) => ({ ...c, isActive: true })),
    );
    return {
      created: true,
      message: `Seeded ${DEFAULT_CATEGORIES.length} default categories.`,
    };
  }
}
