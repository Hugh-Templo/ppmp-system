<?php

namespace App\Mail;

use App\Models\OfficeNotification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class OfficeNotificationMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    public function __construct(
        public OfficeNotification $notification,
        public string $recipientName = ''
    ) {
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->notification->title,
        );
    }

    public function content(): Content
    {
        $deadline = $this->notification->deadline_at
            ? $this->notification->deadline_at->format('F j, Y')
            : '';

        $appUrl = rtrim((string) env('FRONTEND_URL', env('APP_URL', '')), '/');

        return new Content(
            markdown: 'emails.office-notification',
            with: [
                'title' => $this->notification->title,
                'message' => $this->notification->message,
                'fiscalYear' => $this->notification->fiscal_year,
                'deadline' => $deadline,
                'recipientName' => $this->recipientName,
                'appUrl' => $appUrl,
            ],
        );
    }
}
