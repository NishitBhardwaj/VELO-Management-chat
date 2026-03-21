import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    OneToMany,
} from 'typeorm';
import { Device } from './device.entity';
import { SocialLink } from './social-link.entity';

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 15, unique: true, nullable: true })
    phone: string;

    @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
    email: string;

    @Column({ type: 'varchar', length: 50, unique: true })
    username: string;

    @Column({ type: 'varchar', length: 100, nullable: true })
    display_name: string;

    @Column({ type: 'text', nullable: true })
    avatar_url: string;

    @Column({ type: 'varchar', length: 200, nullable: true })
    status_text: string;

    @Column({ type: 'varchar', length: 200, nullable: true })
    organization: string;

    @Column({ type: 'varchar', length: 200, nullable: true })
    position: string;

    @Column({ type: 'text', nullable: true })
    bio: string;

    // Password hash — NOT in the system design (auth via OTP/social later)
    // For now we use email+password for dev simplicity
    @Column({ type: 'varchar', length: 255, nullable: true })
    password_hash: string;

    @Column({ type: 'text', nullable: true })
    google_refresh_token: string;

    @Column({ type: 'text', nullable: true })
    google_access_token: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;

    @OneToMany(() => Device, (device) => device.user)
    devices: Device[];

    @OneToMany(() => SocialLink, (link) => link.user)
    social_links: SocialLink[];
}
