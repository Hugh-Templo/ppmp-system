<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use App\Models\Ppmp;
use App\Models\Office;
use App\Models\IndicativePpmp;
use App\Models\FinalPpmp;

class BudgetController extends Controller
{
    public function listPendingPpmps()
    {
        return response()->json(
            Ppmp::where('status', 'Pending Budget Review')
                ->select([
                    'id', 'title', 'fiscal_year', 'office_id', 'status', 'type', 'is_cse',
                    'remarks', 'excel_path', 'excel_filename', 'excel_size',
                    'created_at', 'updated_at',
                ])
                ->orderByDesc('id')
                ->get()
        );
    }

    /**
     * Office PPMP compliance tracker for a fiscal year.
     * One status per active office based on its latest PPMP (id desc).
     */
    public function officeTracker(Request $request)
    {
        $fiscalYear = (int) ($request->query('fiscal_year') ?: (date('Y') + 1));

        $offices = Office::where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        $ppmps = Ppmp::query()
            ->where('fiscal_year', $fiscalYear)
            ->whereIn('office_id', $offices->pluck('id'))
            ->select([
                'id', 'title', 'fiscal_year', 'office_id', 'status',
                'created_at', 'updated_at',
            ])
            ->orderByDesc('id')
            ->get()
            ->groupBy('office_id');

        $totals = [
            'offices' => $offices->count(),
            'submitted' => 0,
            'verified' => 0,
            'uploaded_not_submitted' => 0,
            'needs_revision' => 0,
            'not_started' => 0,
            'pending_review' => 0,
        ];

        $rows = $offices->map(function (Office $office) use ($ppmps, &$totals) {
            $latest = $ppmps->get($office->id)?->first();
            $rawStatus = $latest?->status;

            [$statusKey, $statusLabel] = match ($rawStatus) {
                'Draft' => ['uploaded_not_submitted', 'Uploaded, not submitted'],
                'Returned' => ['needs_revision', 'Needs revision'],
                'Pending Budget Review' => ['submitted', 'Submitted'],
                'Approved' => ['verified', 'Verified'],
                default => ['not_started', 'Not started'],
            };

            if ($statusKey === 'submitted') {
                $totals['pending_review']++;
                $totals['submitted']++;
            } elseif ($statusKey === 'verified') {
                $totals['verified']++;
                $totals['submitted']++;
            } else {
                $totals[$statusKey]++;
            }

            return [
                'id' => $office->id,
                'name' => $office->name,
                'code' => $office->code,
                'status_key' => $statusKey,
                'status_label' => $statusLabel,
                'ppmp' => $latest ? [
                    'id' => $latest->id,
                    'title' => $latest->title,
                    'status' => $latest->status,
                    'updated_at' => $latest->updated_at,
                ] : null,
            ];
        })->values();

        return response()->json([
            'fiscal_year' => $fiscalYear,
            'totals' => $totals,
            'offices' => $rows,
        ]);
    }

    /**
     * Budget-validated (Approved) PPMPs for Post-to-BAC and BAC Verified dashboard.
     */
    public function listPostingPpmps()
    {
        $hasPostingStatus = \Illuminate\Support\Facades\Schema::hasColumn('ppmp', 'posting_status');

        // Never SELECT excel_blob in list endpoints (can be several MB per row).
        $rows = Ppmp::query()
            ->join('office', 'office.id', '=', 'ppmp.office_id')
            ->where('ppmp.status', 'Approved')
            ->orderByDesc('ppmp.fiscal_year')
            ->orderBy('office.name')
            ->orderByDesc('ppmp.is_cse')
            ->select([
                'ppmp.id',
                'ppmp.title',
                'ppmp.fiscal_year',
                'ppmp.office_id',
                'ppmp.status',
                'ppmp.type',
                'ppmp.is_cse',
                'ppmp.remarks',
                'ppmp.excel_path',
                'ppmp.excel_filename',
                'ppmp.excel_size',
                'office.name as office_name',
                'office.code as office_code',
            ])
            ->when($hasPostingStatus, function ($q) {
                $q->addSelect('ppmp.posting_status', 'ppmp.posted_at');
            })
            ->get();

        return response()->json($rows->map(function ($r) use ($hasPostingStatus) {
            return [
                'id' => $r->id,
                'title' => $r->title,
                'fiscal_year' => $r->fiscal_year,
                'office_id' => $r->office_id,
                'office_name' => $r->office_name,
                'office_code' => $r->office_code ?? null,
                'is_cse' => (bool) $r->is_cse,
                'status' => $r->status,
                'posting_status' => $hasPostingStatus
                    ? ($r->posting_status ?: 'Draft')
                    : 'Draft',
                'posted_at' => $hasPostingStatus ? ($r->posted_at ?? null) : null,
                'remarks' => $r->remarks,
            ];
        }));
    }

    public function listPendingIndicativePpmps()
    {
        return response()->json(
            IndicativePpmp::where('posting_status', 'Posted')->get()
        );
    }

    public function listIndicativePpmps()
    {
        return response()->json(
            IndicativePpmp::all()
        );
    }

    public function listFinalPpmps()
    {
        $rows = FinalPpmp::join('office', 'office.id', '=', 'final_ppmp.office_id')
            ->whereIn('final_ppmp.approval_status', ['Submitted', 'Approved'])
            ->orderBy('final_ppmp.office_id')
            ->orderByDesc('final_ppmp.fiscal_year')
            ->orderByDesc('final_ppmp.version')
            ->select('final_ppmp.*', 'office.name as office_name')
            ->get();

        return response()->json($rows->map(fn($r) => [
            'id' => $r->id,
            'title' => $r->title,
            'fiscal_year' => $r->fiscal_year,
            'office_id' => $r->office_id,
            'office_name' => $r->office_name,
            'version' => $r->version,
            'is_supplemental' => $r->version >= 2,
            'approval_status' => $r->approval_status,
            'submitted_at' => $r->submitted_at,
            'approved_at' => $r->approved_at,
            'remarks' => $r->remarks,
        ]));
    }

    public function postIndicativePpmp(Request $request, int $id)
    {
        $user = $this->authUser($request);
        $ppmp = IndicativePpmp::find($id);

        if (!$ppmp) {
            return response()->json(['detail' => 'Indicative PPMP not found'], 404);
        }

        if ($ppmp->status !== 'Draft') {
            return response()->json(['detail' => 'Only Draft PPMPs can be posted'], 400);
        }

        $ppmp->posting_status = 'Posted';
        $ppmp->posted_at = Carbon::now();
        $ppmp->posted_by = $user->id;
        $ppmp->save();

        return response()->json([
            'message' => 'Indicative PPMP posted successfully',
            'status' => $ppmp->posting_status,
            'posted_at' => $ppmp->posted_at,
        ]);
    }

    public function unpostIndicativePpmp(Request $request, int $id)
    {
        $ppmp = IndicativePpmp::find($id);

        if (!$ppmp) {
            return response()->json(['detail' => 'Indicative PPMP not found'], 404);
        }

        if ($ppmp->posting_status !== 'Posted') {
            return response()->json(['detail' => 'Only Posted PPMPs can be unposted'], 400);
        }

        $ppmp->posting_status = 'Draft';
        $ppmp->posted_at = null;
        $ppmp->posted_by = null;
        $ppmp->save();

        return response()->json([
            'message' => 'Indicative PPMP unposted successfully',
            'status' => $ppmp->posting_status,
        ]);
    }

    public function auditPpmp(int $id)
    {
        $ppmp = Ppmp::with('items')->find($id);
        if (!$ppmp) {
            return response()->json(['detail' => 'PPMP not found'], 404);
        }

        $office = Office::find($ppmp->office_id);
        if (!$office) {
            return response()->json(['detail' => 'Office not found'], 404);
        }

        $totalPpmpCost = (float) $ppmp->items()->sum('estimated_budget');

        return response()->json([
            'ppmp_id' => $ppmp->id,
            'ppmp_title' => $ppmp->title,
            'office_name' => $office->name,
            'office_budget_allocation' => (float)$office->budget_allocation,
            'total_ppmp_cost' => $totalPpmpCost,
            'is_within_budget' => $totalPpmpCost <= (float)$office->budget_allocation,
            'remaining_budget' => (float)$office->budget_allocation - $totalPpmpCost,
        ]);
    }

    public function reviewPpmp(Request $request, int $id)
    {
        $ppmp = Ppmp::find($id);
        if (!$ppmp) {
            return response()->json(['detail' => 'PPMP not found'], 404);
        }

        $action = strtolower(trim($request->input('action', '')));
        $remarks = trim($request->input('remarks', ''));

        if ($action === 'approve') {
            $ppmp->status = 'Approved';
        } elseif ($action === 'return') {
            $ppmp->status = 'Returned';
            $ppmp->remarks = $remarks;
        } else {
            return response()->json(['detail' => "Invalid action. Use 'approve' or 'return'"], 400);
        }

        $ppmp->save();

        return response()->json([
            'message' => "PPMP has been successfully {$ppmp->status}",
            'status' => $ppmp->status,
            'remarks' => $remarks,
        ]);
    }
}
