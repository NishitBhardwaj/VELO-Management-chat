import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PointsTransaction, PointsBalance, HrAuditLog } from '../entities';

@Injectable()
export class PointsService {
    private readonly logger = new Logger(PointsService.name);

    constructor(
        @InjectRepository(PointsTransaction)
        private readonly txnRepo: Repository<PointsTransaction>,
        @InjectRepository(PointsBalance)
        private readonly balanceRepo: Repository<PointsBalance>,
        @InjectRepository(HrAuditLog)
        private readonly auditRepo: Repository<HrAuditLog>,
    ) { }

    /**
     * Add or deduct points for a user.
     */
    async changePoints(
        targetUserId: string,
        amount: number,
        reason: string,
        issuedBy: string,
        description?: string,
        relatedAttendanceId?: string,
    ): Promise<{ transaction: PointsTransaction; balance: PointsBalance }> {
        // Create transaction
        const txn = this.txnRepo.create({
            user_id: targetUserId,
            change_amount: amount,
            reason,
            description,
            issued_by: issuedBy,
            related_attendance_id: relatedAttendanceId,
        });
        const savedTxn = await this.txnRepo.save(txn);

        // Update or create balance
        let balance = await this.balanceRepo.findOne({ where: { user_id: targetUserId } });
        if (!balance) {
            balance = this.balanceRepo.create({
                user_id: targetUserId,
                total_points: 100 + amount, // Start with 100
            });
        } else {
            balance.total_points += amount;
        }
        balance.last_updated = new Date();
        const savedBalance = await this.balanceRepo.save(balance);

        // Audit
        await this.auditRepo.save(
            this.auditRepo.create({
                actor_id: issuedBy,
                action: amount >= 0 ? 'add_points' : 'deduct_points',
                target_user_id: targetUserId,
                new_value: { amount, reason, new_balance: savedBalance.total_points },
            }),
        );

        this.logger.log(`Points: ${targetUserId} ${amount >= 0 ? '+' : ''}${amount} (${reason}) → total: ${savedBalance.total_points}`);
        return { transaction: savedTxn, balance: savedBalance };
    }

    /**
     * Get current points balance for a user.
     */
    async getBalance(userId: string): Promise<number> {
        const balance = await this.balanceRepo.findOne({ where: { user_id: userId } });
        return balance?.total_points ?? 100;
    }

    /**
     * Get points transaction history for a user.
     */
    async getHistory(userId: string, limit = 50): Promise<PointsTransaction[]> {
        return this.txnRepo.find({
            where: { user_id: userId },
            order: { created_at: 'DESC' },
            take: limit,
        });
    }
}
