import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Device } from './entities/device.entity';
import { UpdateProfileDto } from '../auth/dto';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(Device)
        private readonly deviceRepo: Repository<Device>,
    ) { }

    async findByEmail(email: string): Promise<User | null> {
        return this.userRepo.findOne({ where: { email } });
    }

    async findById(id: string): Promise<User | null> {
        return this.userRepo.findOne({ where: { id } });
    }

    async findByPhone(phone: string): Promise<User | null> {
        return this.userRepo.findOne({ where: { phone } });
    }

    async createUser(data: Partial<User>): Promise<User> {
        const user = this.userRepo.create(data);
        return this.userRepo.save(user);
    }

    async updateProfile(userId: string, dto: UpdateProfileDto): Promise<User> {
        const user = await this.findById(userId);
        if (!user) throw new NotFoundException('User not found');

        Object.assign(user, dto);
        return this.userRepo.save(user);
    }

    // ─── Device Management ─────────────────────────────────

    async registerDevice(
        userId: string,
        deviceName: string,
        platform: string,
        deviceToken?: string,
    ): Promise<Device> {
        const device = this.deviceRepo.create({
            user_id: userId,
            device_name: deviceName,
            platform,
            device_token: deviceToken,
            last_active: new Date(),
        });
        return this.deviceRepo.save(device);
    }

    async updateDeviceActivity(deviceId: string): Promise<void> {
        await this.deviceRepo.update(deviceId, { last_active: new Date() });
    }

    async getUserDevices(userId: string): Promise<Device[]> {
        return this.deviceRepo.find({ where: { user_id: userId } });
    }

    async removeDevice(deviceId: string, userId: string): Promise<void> {
        await this.deviceRepo.delete({ id: deviceId, user_id: userId });
    }
}
