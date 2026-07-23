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
import { Project, ProjectDocument } from './project.schema';

const PROJECT_CODE_PREFIX = 'ACE-PR-';
const PROJECT_CODE_PAD = 6;
const PROJECT_CODE_PATTERN = /^ACE-PR-(\d{6})$/;

/** Canonical project catalog names (ensured on boot). */
export const REQUIRED_PROJECT_NAMES = [
  'Google Art and culture (GAC)',
  'Google News Lab (GNL)',
  'Google News Program (GNP)',
  'Google Information system (GIS) - Bothel',
  'GDO - Google ops (location)',
  'Google for Education - Chrome',
  'SV Warehouse - ID & JP',
  'Reimbursements - revenue',
  'Field data collection (FDR) - Global logic',
  'One-time fee (project)',
] as const;

@Injectable()
export class ProjectsService implements OnModuleInit {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    @InjectModel(Project.name) private projectModel: Model<ProjectDocument>,
  ) {}

  async onModuleInit() {
    await this.ensureUniqueProjectCodes();
    await this.ensureRequiredProjects();
    try {
      await this.projectModel.collection.createIndex({ code: 1 }, { unique: true });
    } catch (err: any) {
      this.logger.warn(`Project code unique index: ${err?.message || err}`);
    }
  }

  /** Create any missing catalog projects (idempotent). */
  async ensureRequiredProjects(): Promise<void> {
    for (const name of REQUIRED_PROJECT_NAMES) {
      const existing = await this.projectModel.findOne({ name }).exec();
      if (existing) {
        if (!existing.isActive) {
          existing.isActive = true;
          await existing.save();
          this.logger.log(`Reactivated project "${name}"`);
        }
        continue;
      }
      try {
        await this.create({ name });
        this.logger.log(`Created required project "${name}"`);
      } catch (err: any) {
        if (err instanceof ConflictException) continue;
        this.logger.warn(`Could not ensure project "${name}": ${err?.message || err}`);
      }
    }
  }

  /** Backfill / repair codes so every project has a unique ACE-PR-###### value. */
  async ensureUniqueProjectCodes(): Promise<void> {
    const projects = await this.projectModel
      .find()
      .sort({ createdAt: 1, _id: 1 })
      .exec();

    const used = new Set<string>();
    let nextSeq = 1;

    for (const project of projects) {
      const current = (project.code || '').trim();
      const match = PROJECT_CODE_PATTERN.exec(current);
      if (match && !used.has(current)) {
        used.add(current);
        nextSeq = Math.max(nextSeq, parseInt(match[1], 10) + 1);
        continue;
      }
      // Needs a new unique code (empty, wrong format, or duplicate)
      let code = this.formatCode(nextSeq);
      while (used.has(code)) {
        nextSeq += 1;
        code = this.formatCode(nextSeq);
      }
      project.code = code;
      used.add(code);
      nextSeq += 1;
      await project.save();
      this.logger.log(`Assigned project code ${code} to "${project.name}"`);
    }
  }

  private formatCode(seq: number): string {
    return `${PROJECT_CODE_PREFIX}${String(seq).padStart(PROJECT_CODE_PAD, '0')}`;
  }

  private async nextProjectCode(): Promise<string> {
    const projects = await this.projectModel
      .find({ code: { $regex: '^ACE-PR-\\d{6}$' } })
      .select('code')
      .lean()
      .exec();

    let max = 0;
    for (const p of projects) {
      const match = PROJECT_CODE_PATTERN.exec(p.code || '');
      if (match) {
        max = Math.max(max, parseInt(match[1], 10));
      }
    }
    return this.formatCode(max + 1);
  }

  async findAll(): Promise<any[]> {
    return this.projectModel.find().sort({ name: 1 }).lean().exec();
  }

  async findActive(): Promise<any[]> {
    return this.projectModel
      .find({ isActive: true })
      .sort({ name: 1 })
      .lean()
      .exec();
  }

  async findById(id: string): Promise<any> {
    const project = await this.projectModel.findById(id).lean().exec();
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    return project;
  }

  async findActiveByName(name: string): Promise<ProjectDocument | null> {
    return this.projectModel
      .findOne({ name: name.trim(), isActive: true })
      .exec();
  }

  async assertActiveName(name: string): Promise<string> {
    const trimmed = (name || '').trim();
    if (!trimmed) {
      throw new BadRequestException('Project is required');
    }
    const found = await this.findActiveByName(trimmed);
    if (!found) {
      throw new BadRequestException(
        `Project "${trimmed}" is not an active project`,
      );
    }
    return found.name;
  }

  async create(data: { name: string }): Promise<any> {
    const name = data.name.trim();
    if (!name) {
      throw new BadRequestException('Name is required');
    }
    const existing = await this.projectModel.findOne({ name }).exec();
    if (existing) {
      throw new ConflictException(`Project "${name}" already exists`);
    }

    // Retry if two creates race on the same next code
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = await this.nextProjectCode();
      try {
        const project = new this.projectModel({
          name,
          code,
          isActive: true,
        });
        return (await project.save()).toObject();
      } catch (err: any) {
        if (err?.code === 11000 && String(err?.message || '').includes('code')) {
          continue;
        }
        if (err?.code === 11000) {
          throw new ConflictException(`Project "${name}" already exists`);
        }
        throw err;
      }
    }
    throw new ConflictException('Could not allocate a unique project code. Try again.');
  }

  async update(
    id: string,
    data: { name?: string; isActive?: boolean },
  ): Promise<any> {
    const update: Record<string, unknown> = {};
    if (data.name !== undefined) {
      const name = data.name.trim();
      if (!name) throw new BadRequestException('Name cannot be empty');
      const conflict = await this.projectModel
        .findOne({ name, _id: { $ne: id } })
        .exec();
      if (conflict) {
        throw new ConflictException(`Project "${name}" already exists`);
      }
      update.name = name;
    }
    // code is never updated — system-generated and immutable
    if (data.isActive !== undefined) update.isActive = data.isActive;

    const project = await this.projectModel
      .findByIdAndUpdate(id, { $set: update }, { new: true })
      .lean()
      .exec();
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    return project;
  }

  async delete(id: string): Promise<void> {
    const result = await this.projectModel.deleteOne({ _id: id }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Project ${id} not found`);
    }
  }
}
