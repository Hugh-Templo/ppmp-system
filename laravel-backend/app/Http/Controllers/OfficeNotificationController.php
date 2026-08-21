<?php

namespace App\Http\Controllers;

use App\Mail\OfficeNotificationMail;
use App\Models\OfficeNotification;
use App\Models\User;
use App\Services\MailQuotaService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Validator;
use Throwable;

class OfficeNotificationController extends Controller
{
    public function list(Request $request)
    {
        $rows = OfficeNotification::query()
            ->orderByDesc('updated_at')
            ->orderByDesc('id')
            ->limit(100)
            ->get();

        return response()->json($rows->map(fn (OfficeNotification $n) => $this->serialize($n))->values());
    }

    public function mailQuota(Request $request, MailQuotaService $quota)
    {
        return response()->json($quota->snapshot());
    }

    public function active(Request $request)
    {
        $row = OfficeNotification::query()
            ->where('status', 'published')
            ->orderByDesc('updated_at')
            ->orderByDesc('id')
            ->first();

        if (!$row) {
            return response()->json(null);
        }

        return response()->json($this->serialize($row));
    }

    public function create(Request $request)
    {
        $data = $this->validatedPayload($request);
        if ($data instanceof \Illuminate\Http\JsonResponse) {
            return $data;
        }

        $user = $this->authUser($request);

        $row = OfficeNotification::create([
            'fiscal_year' => $data['fiscal_year'],
            'title' => $data['title'],
            'message' => $data['message'],
            'deadline_at' => $data['deadline_at'] ?? null,
            'status' => 'draft',
            'created_by' => $user->id,
            'emails_queued' => 0,
        ]);

        return response()->json([
            'message' => 'Office notification saved as draft',
            'notification' => $this->serialize($row),
        ], 201);
    }

    public function update(Request $request, int $id)
    {
        $row = OfficeNotification::find($id);
        if (!$row) {
            return response()->json(['detail' => 'Notification not found'], 404);
        }

        $data = $this->validatedPayload($request);
        if ($data instanceof \Illuminate\Http\JsonResponse) {
            return $data;
        }

        $row->fiscal_year = $data['fiscal_year'];
        $row->title = $data['title'];
        $row->message = $data['message'];
        $row->deadline_at = $data['deadline_at'] ?? null;
        $row->save();

        return response()->json([
            'message' => 'Office notification updated',
            'notification' => $this->serialize($row->fresh()),
        ]);
    }

    public function destroy(int $id)
    {
        $row = OfficeNotification::find($id);
        if (!$row) {
            return response()->json(['detail' => 'Notification not found'], 404);
        }

        $row->delete();

        return response()->json(['message' => 'Office notification deleted']);
    }

    public function publish(Request $request, int $id, MailQuotaService $quota)
    {
        $row = OfficeNotification::find($id);
        if (!$row) {
            return response()->json(['detail' => 'Notification not found'], 404);
        }

        $sendEmail = filter_var($request->input('send_email', true), FILTER_VALIDATE_BOOLEAN);

        $row->status = 'published';
        $row->save();

        $recipients = $this->endUserRecipients();
        $needed = $recipients->count();
        $quotaSnap = $quota->snapshot();

        if (!$sendEmail) {
            return response()->json([
                'message' => 'Notification published to dashboards (email skipped).',
                'notification' => $this->serialize($row->fresh()),
                'emails_queued' => 0,
                'email_skipped' => true,
                'mail_quota' => $quotaSnap,
            ]);
        }

        if ($needed === 0) {
            return response()->json([
                'message' => 'Notification published. No active end-user emails found to notify.',
                'notification' => $this->serialize($row->fresh()),
                'emails_queued' => 0,
                'mail_quota' => $quotaSnap,
            ]);
        }

        // Never queue a partial blast; block email if it would exceed free-tier caps.
        if (!$quota->canSend($needed)) {
            return response()->json([
                'detail' => $quota->blockMessage($needed),
                'message' => $quota->blockMessage($needed),
                'notification' => $this->serialize($row->fresh()),
                'emails_queued' => 0,
                'email_blocked' => true,
                'mail_quota' => $quota->snapshot(),
            ], 422);
        }

        $queued = $this->queueEmailsToEndUsers($row, $recipients, $quota->remaining());

        $row->emailed_at = now();
        $row->emails_queued = $queued;
        $row->save();

        $quota->recordBatch('office_notification', $row->id, $queued);

        return response()->json([
            'message' => $queued > 0
                ? "Notification published. Email queued for {$queued} end user(s) (within Resend free-tier limits)."
                : 'Notification published. No emails were queued.',
            'notification' => $this->serialize($row->fresh()),
            'emails_queued' => $queued,
            'mail_quota' => $quota->snapshot(),
        ]);
    }

    private function endUserRecipients()
    {
        return User::query()
            ->where('role', 'end_user')
            ->where('is_active', true)
            ->whereNotNull('email')
            ->where('email', '!=', '')
            ->get(['id', 'username', 'email']);
    }

    private function queueEmailsToEndUsers(OfficeNotification $notification, $recipients, int $hardCap): int
    {
        $count = 0;
        foreach ($recipients as $user) {
            if ($count >= $hardCap) {
                break;
            }
            try {
                Mail::to($user->email)->queue(
                    new OfficeNotificationMail($notification, (string) $user->username)
                );
                $count++;
            } catch (Throwable $e) {
                report($e);
            }
        }

        return $count;
    }

    private function validatedPayload(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'fiscal_year' => 'required|integer|min:2000|max:2100',
            'title' => 'required|string|max:255',
            'message' => 'required|string|max:5000',
            'deadline_at' => 'nullable|date',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'detail' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        $data = $validator->validated();
        $data['title'] = trim($data['title']);
        $data['message'] = trim($data['message']);
        $data['fiscal_year'] = (int) $data['fiscal_year'];
        $data['deadline_at'] = !empty($data['deadline_at']) ? $data['deadline_at'] : null;

        return $data;
    }

    private function serialize(OfficeNotification $n): array
    {
        return [
            'id' => $n->id,
            'fiscal_year' => $n->fiscal_year,
            'title' => $n->title,
            'message' => $n->message,
            'deadline_at' => $n->deadline_at ? $n->deadline_at->format('Y-m-d') : null,
            'status' => $n->status,
            'emailed_at' => $n->emailed_at ? $n->emailed_at->toIso8601String() : null,
            'emails_queued' => (int) ($n->emails_queued ?? 0),
            'created_by' => $n->created_by,
            'created_at' => $n->created_at ? $n->created_at->toIso8601String() : null,
            'updated_at' => $n->updated_at ? $n->updated_at->toIso8601String() : null,
        ];
    }
}
