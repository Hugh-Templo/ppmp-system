<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Ppmp;
use App\Models\Office;
use App\Models\IndicativePpmp;
use App\Models\FinalPpmp;

class BudgetController extends Controller
{
    public function listPendingPpmps()
    {
        return response()->json(
            Ppmp::where('status', 'Pending Budget Review')->get()
        );
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
        $rows = FinalPpmp::join('offices', 'offices.id', '=', 'final_ppmp.office_id')
            ->whereIn('final_ppmp.approval_status', ['Submitted', 'Approved'])
            ->orderBy('final_ppmp.office_id')
            ->orderByDesc('final_ppmp.fiscal_year')
            ->orderByDesc('final_ppmp.version')
            ->select('final_ppmp.*', 'offices.name as office_name')
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
        $user = $request->attributes->get('auth_user') ?: auth()->user();
        $ppmp = IndicativePpmp::find($id);

        if (!$ppmp) {
            return response()->json(['detail' => 'Indicative PPMP not found'], 404);
        }

        if ($ppmp->status !== 'Draft') {
            return response()->json(['detail' => 'Only Draft PPMPs can be posted'], 400);
        }

        $ppmp->posting_status = 'Posted';
        $ppmp->posted_at = now();
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

        $totalPpmpCost = $ppmp->items->sum(fn($it) => (float)$it->estimated_budget);

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
