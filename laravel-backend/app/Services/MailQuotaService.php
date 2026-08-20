<?php

namespace App\Services;

use App\Models\MailSendBatch;
use App\Models\User;
use Illuminate\Support\Carbon;

/**
 * Keeps app-sent mail within Resend free-tier caps (100/day, 3,000/month by default).
 * Counts every queued batch logged in mail_send_batches.
 */
class MailQuotaService
{
    public function dailyLimit(): int
    {
        return max(0, (int) env('MAIL_DAILY_LIMIT', 100));
    }

    public function monthlyLimit(): int
    {
        return max(0, (int) env('MAIL_MONTHLY_LIMIT', 3000));
    }

    public function sentToday(): int
    {
        return (int) MailSendBatch::query()
            ->whereDate('created_at', Carbon::today())
            ->sum('emails_queued');
    }

    public function sentThisMonth(): int
    {
        $start = Carbon::now()->startOfMonth();
        $end = Carbon::now()->endOfMonth();

        return (int) MailSendBatch::query()
            ->whereBetween('created_at', [$start, $end])
            ->sum('emails_queued');
    }

    public function remainingToday(): int
    {
        return max(0, $this->dailyLimit() - $this->sentToday());
    }

    public function remainingThisMonth(): int
    {
        return max(0, $this->monthlyLimit() - $this->sentThisMonth());
    }

    /** Hard cap for the next send batch (never exceed free tier). */
    public function remaining(): int
    {
        return min($this->remainingToday(), $this->remainingThisMonth());
    }

    public function recipientCount(): int
    {
        return (int) User::query()
            ->where('role', 'end_user')
            ->where('is_active', true)
            ->whereNotNull('email')
            ->where('email', '!=', '')
            ->count();
    }

    public function canSend(int $needed): bool
    {
        if ($needed <= 0) {
            return true;
        }

        return $needed <= $this->remaining();
    }

    public function recordBatch(string $channel, ?int $referenceId, int $emailsQueued): void
    {
        if ($emailsQueued <= 0) {
            return;
        }

        MailSendBatch::create([
            'channel' => $channel,
            'reference_id' => $referenceId,
            'emails_queued' => $emailsQueued,
            'created_at' => now(),
        ]);
    }

    public function snapshot(): array
    {
        $dailyLimit = $this->dailyLimit();
        $monthlyLimit = $this->monthlyLimit();
        $sentToday = $this->sentToday();
        $sentMonth = $this->sentThisMonth();
        $remainingToday = max(0, $dailyLimit - $sentToday);
        $remainingMonth = max(0, $monthlyLimit - $sentMonth);
        $remaining = min($remainingToday, $remainingMonth);
        $recipients = $this->recipientCount();

        return [
            'provider' => 'resend_free_tier',
            'daily_limit' => $dailyLimit,
            'monthly_limit' => $monthlyLimit,
            'sent_today' => $sentToday,
            'sent_this_month' => $sentMonth,
            'remaining_today' => $remainingToday,
            'remaining_this_month' => $remainingMonth,
            'remaining' => $remaining,
            'active_end_user_recipients' => $recipients,
            'can_email_all_recipients' => $recipients <= $remaining,
        ];
    }

    public function blockMessage(int $needed): string
    {
        $snap = $this->snapshot();
        return sprintf(
            'Email blocked to stay within Resend free tier (%d/day, %d/month). Need %d, remaining %d today / %d this month. Notice is still published on dashboards — try email again tomorrow, or choose Publish without email.',
            $snap['daily_limit'],
            $snap['monthly_limit'],
            $needed,
            $snap['remaining_today'],
            $snap['remaining_this_month']
        );
    }
}
