import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { User, UserDocument, UserRole } from './user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async findAll(): Promise<any[]> {
    return this.userModel
      .find({}, { password: 0 })
      .sort({ createdAt: -1 })
      .lean()
      .exec();
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async create(data: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
  }): Promise<any> {
    const existing = await this.findByEmail(data.email);
    if (existing) {
      throw new ConflictException(`User with email ${data.email} already exists`);
    }
    const hashed = await bcrypt.hash(data.password, 10);
    const user = new this.userModel({
      name: data.name,
      email: data.email.toLowerCase(),
      password: hashed,
      role: data.role,
    });
    const saved = await user.save();
    const { password: _, ...result } = saved.toObject();
    return result;
  }

  async update(
    id: string,
    data: { name?: string; role?: UserRole; isActive?: boolean },
  ): Promise<any> {
    const user = await this.userModel
      .findByIdAndUpdate(id, { $set: data }, { new: true, projection: { password: 0 } })
      .lean()
      .exec();
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async updatePassword(id: string, newPassword: string): Promise<void> {
    const hashed = await bcrypt.hash(newPassword, 10);
    await this.userModel.findByIdAndUpdate(id, { $set: { password: hashed } }).exec();
  }

  async delete(id: string): Promise<void> {
    const result = await this.userModel.deleteOne({ _id: id }).exec();
    if (result.deletedCount === 0) throw new NotFoundException(`User ${id} not found`);
  }

  async countAll(): Promise<number> {
    return this.userModel.countDocuments().exec();
  }

  async seedAdmin(): Promise<{ created: boolean; message: string }> {
    const count = await this.countAll();
    if (count > 0) {
      return { created: false, message: 'Users already exist. Seed skipped.' };
    }
    await this.create({
      name: 'Admin',
      email: 'admin@acefinance.com',
      password: 'Admin@1234',
      role: 'ADMIN',
    });
    return {
      created: true,
      message: 'Admin account created: admin@acefinance.com / Admin@1234',
    };
  }
}
