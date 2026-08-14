<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use App\Models\Office;
use App\Models\User;
use App\Models\App as AppModel;
use App\Models\AppRow;
use App\Models\AppSignatory;
use App\Models\Ppmp;
use App\Models\PpmpItem;
use App\Models\IndicativePpmp;
use App\Services\PpmpExcelParser;
use App\Services\AppExcelExporter;
use App\Services\GoogleDriveUploader;
use Exception;

class BacController extends Controller
{
    private function getOrCreateAppSignatory(): AppSignatory
    {
        $row = AppSignatory::find(1);
        if (!$row) {
            $row = AppSignatory::create([
                'id' => 1,
                'prepared_by' => '',
                'prepared_by_designation' => '',
                'recommended_by' => '',
                'recommended_by_designation' => '',
                'approved_by_name' => '',
                'approved_by_designation' => '',
            ]);
        }
        return $row;
    }

    public function getAppSignatory()
    {
        $row = $this->getOrCreateAppSignatory();
        return response()->json([
            'id' => $row->id,
            'prepared_by' => $row->prepared_by ?? '',
            'prepared_by_designation' => $row->prepared_by_designation ?? '',
            'recommended_by' => $row->recommended_by ?? '',
            'recommended_by_designation' => $row->recommended_by_designation ?? '',
            'approved_by_name' => $row->approved_by_name ?? '',
            'approved_by_designation' => $row->approved_by_designation ?? '',
            'updated_at' => $row->updated_at ? $row->updated_at->toIso8601String() : null,
        ]);
    }

    public function updateAppSignatory(Request $request)
    {
        $row = $this->getOrCreateAppSignatory();

        $row->prepared_by = mb_strtoupper(trim((string) $request->input('prepared_by', '')), 'UTF-8') ?: null;
        $row->prepared_by_designation = mb_strtoupper(trim((string) $request->input('prepared_by_designation', '')), 'UTF-8') ?: null;
        $row->recommended_by = mb_strtoupper(trim((string) $request->input('recommended_by', '')), 'UTF-8') ?: null;
        $row->recommended_by_designation = mb_strtoupper(trim((string) $request->input('recommended_by_designation', '')), 'UTF-8') ?: null;
        $row->approved_by_name = mb_strtoupper(trim((string) $request->input('approved_by_name', '')), 'UTF-8') ?: null;
        $row->approved_by_designation = mb_strtoupper(trim((string) $request->input('approved_by_designation', '')), 'UTF-8') ?: null;
        $row->save();

        return response()->json([
            'message' => 'APP signatory updated successfully',
            'signatory' => [
                'id' => $row->id,
                'prepared_by' => $row->prepared_by ?? '',
                'prepared_by_designation' => $row->prepared_by_designation ?? '',
                'recommended_by' => $row->recommended_by ?? '',
                'recommended_by_designation' => $row->recommended_by_designation ?? '',
                'approved_by_name' => $row->approved_by_name ?? '',
                'approved_by_designation' => $row->approved_by_designation ?? '',
                'updated_at' => $row->updated_at ? $row->updated_at->toIso8601String() : null,
            ],
        ]);
    }

    public function listOffices(Request $request)
    {
        $includeInactive = filter_var($request->query('include_inactive', false), FILTER_VALIDATE_BOOLEAN);
        $query = Office::orderBy('code');
        if (!$includeInactive) {
            $query->where('is_active', true);
        }
        return response()->json($query->get());
    }

    public function createOffice(Request $request)
    {
        $code = mb_strtoupper(trim($request->input('code', '')), 'UTF-8');
        $name = mb_strtoupper(trim($request->input('name', '')), 'UTF-8');
        $budget = (float)$request->input('budget_allocation', 0);

        if (!$code || !$name) {
            return response()->json(['detail' => 'Office name and code are required'], 400);
        }

        $existing = Office::whereRaw('UPPER(code) = ?', [$code])->first();
        if ($existing) {
            if ($existing->is_active) {
                return response()->json(['detail' => 'Office code already exists'], 400);
            }
            $existing->name = $name;
            $existing->budget_allocation = $budget;
            $existing->is_active = true;
            $existing->save();
            return response()->json($existing);
        }

        $nameClash = Office::whereRaw('UPPER(name) = ?', [$name])->first();
        if ($nameClash) {
            if ($nameClash->is_active) {
                return response()->json(['detail' => 'Office name already exists'], 400);
            }
            $nameClash->name = "{$name} (ARCHIVED-{$nameClash->id})";
            $nameClash->save();
        }

        $office = Office::create([
            'name' => $name,
            'code' => $code,
            'budget_allocation' => $budget,
            'is_active' => true,
            'created_at' => now(),
        ]);

        return response()->json($office);
    }

    public function updateOffice(Request $request, int $id)
    {
        $office = Office::find($id);
        if (!$office) {
            return response()->json(['detail' => 'Office not found'], 404);
        }
        if (!$office->is_active) {
            return response()->json(['detail' => 'Office is inactive. Recreate it with the same code to restore.'], 400);
        }

        if ($request->has('code') && $request->input('code') !== $office->code) {
            $code = mb_strtoupper(trim($request->input('code')), 'UTF-8');
            if (Office::whereRaw('UPPER(code) = ?', [$code])->where('id', '!=', $id)->exists()) {
                return response()->json(['detail' => 'Office code already exists'], 400);
            }
            $office->code = $code;
        }

        if ($request->has('name') && $request->input('name') !== $office->name) {
            $name = mb_strtoupper(trim($request->input('name')), 'UTF-8');
            $clash = Office::whereRaw('UPPER(name) = ?', [$name])->where('id', '!=', $id)->first();
            if ($clash && $clash->is_active) {
                return response()->json(['detail' => 'Office name already exists'], 400);
            }
            $office->name = $name;
        }

        if ($request->has('budget_allocation')) {
            $office->budget_allocation = (float)$request->input('budget_allocation');
        }

        $office->save();
        return response()->json($office);
    }

    public function deleteOffice(int $id)
    {
        $office = Office::find($id);
        if (!$office) {
            return response()->json(['detail' => 'Office not found'], 404);
        }
        if (!$office->is_active) {
            return response()->json(['detail' => 'Office is already inactive'], 400);
        }

        User::where('office_id', $id)->update(['office_id' => null]);
        $office->is_active = false;
        $office->save();

        return response()->json([
            'message' => 'Office removed from active list. Created PPMPs and local template files were kept. Recreate this office with the same code to restore access.',
            'office_id' => $id,
            'office_code' => $office->code,
            'ppmps_retained' => true,
        ]);
    }

    public function consolidatePpmps(int $fiscal_year)
    {
        $approvedPpmps = Ppmp::where('fiscal_year', $fiscal_year)->where('status', 'Approved')->get();

        $app = AppModel::where('fiscal_year', $fiscal_year)->first();

        if ($approvedPpmps->isEmpty()) {
            if ($app) {
                AppRow::where('app_id', $app->id)->delete();
                return response()->json($app);
            }
            return response()->json(['detail' => "No approved PPMPs found for fiscal year {$fiscal_year} to consolidate"], 400);
        }

        if (!$app) {
            $app = AppModel::create([
                'title' => "Consolidated Annual Procurement Plan (APP) FY {$fiscal_year}",
                'fiscal_year' => $fiscal_year,
            ]);
        } else {
            AppRow::where('app_id', $app->id)->delete();
        }

        $ppmpIds = $approvedPpmps->pluck('id');
        $offices = Office::all()->keyBy('id');
        $allItems = PpmpItem::whereIn('ppmp_id', $ppmpIds)->get();

        $consolidationMap = [];

        foreach ($allItems as $item) {
            $isCse = (bool)$item->is_cse;
            $desc = trim($item->description);
            $key = $isCse . '|' . strtolower($desc) . '|' . ($item->project_type ?? '') . '|' . ($item->procurement_mode ?? '') . '|' . ($item->fund_source ?? '');

            if (!isset($consolidationMap[$key])) {
                $ppmp = $approvedPpmps->firstWhere('id', $item->ppmp_id);
                $office = $ppmp ? $offices->get($ppmp->office_id) : null;
                $officeCode = $office ? ($office->code ?: $office->name) : '';

                $consolidationMap[$key] = [
                    'description' => $item->description,
                    'is_cse' => $isCse,
                    'project_type' => $item->project_type,
                    'procurement_mode' => $item->procurement_mode ?: 'Competitive Bidding',
                    'fund_source' => $item->fund_source,
                    'quantity_size' => $item->quantity_size,
                    'proc_start' => $item->proc_start,
                    'proc_end' => $item->proc_end,
                    'delivery_period' => $item->delivery_period,
                    'pre_proc_conf' => (bool)$item->pre_proc_conf,
                    'total_estimated_budget' => 0.0,
                    'offices' => [],
                    'total_quantity' => 0,
                    'q1_qty' => 0,
                    'q2_qty' => 0,
                    'q3_qty' => 0,
                    'q4_qty' => 0,
                    'category' => $item->category,
                    'unit_of_measure' => $item->unit_of_measure,
                    'unit_cost' => $item->unit_cost,
                ];

                if ($officeCode) {
                    $consolidationMap[$key]['offices'][] = $officeCode;
                }
            }

            $consolidationMap[$key]['total_estimated_budget'] += (float)($item->estimated_budget ?? 0);
            $consolidationMap[$key]['total_quantity'] += (int)($item->quantity ?? 0);
            $consolidationMap[$key]['q1_qty'] += (int)($item->q1_qty ?? 0);
            $consolidationMap[$key]['q2_qty'] += (int)($item->q2_qty ?? 0);
            $consolidationMap[$key]['q3_qty'] += (int)($item->q3_qty ?? 0);
            $consolidationMap[$key]['q4_qty'] += (int)($item->q4_qty ?? 0);
        }

        foreach ($consolidationMap as $group) {
            AppRow::create([
                'app_id' => $app->id,
                'description' => $group['description'],
                'is_cse' => $group['is_cse'],
                'project_type' => $group['project_type'],
                'procurement_mode' => $group['procurement_mode'],
                'fund_source' => $group['fund_source'],
                'quantity_size' => $group['quantity_size'],
                'proc_start' => $group['proc_start'],
                'proc_end' => $group['proc_end'],
                'delivery_period' => $group['delivery_period'],
                'pre_proc_conf' => $group['pre_proc_conf'],
                'total_estimated_budget' => $group['total_estimated_budget'],
                'end_user_offices' => implode(', ', array_unique($group['offices'])) ?: null,
                'category' => $group['category'],
                'total_quantity' => $group['total_quantity'],
                'unit_of_measure' => $group['unit_of_measure'],
                'unit_cost' => $group['unit_cost'],
                'q1_qty' => $group['q1_qty'],
                'q2_qty' => $group['q2_qty'],
                'q3_qty' => $group['q3_qty'],
                'q4_qty' => $group['q4_qty'],
            ]);
        }

        return response()->json($app);
    }

    /**
     * All office PPMPs for BAC download page (any status).
     * Never SELECT excel_blob in list endpoints.
     */
    public function listAllPpmps(Request $request)
    {
        $fy = (int) $request->query('fiscal_year', date('Y') + 1);

        $rows = Ppmp::query()
            ->join('office', 'office.id', '=', 'ppmp.office_id')
            ->where('ppmp.fiscal_year', $fy)
            ->orderBy('office.name')
            ->orderByDesc('ppmp.fiscal_year')
            ->orderByDesc('ppmp.id')
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
                'ppmp.created_at',
                'ppmp.updated_at',
                'office.name as office_name',
                'office.code as office_code',
            ])
            ->get();

        return response()->json($rows->map(function ($r) {
            $hasExcel = !empty($r->excel_path) || !empty($r->excel_filename);
            return [
                'id' => $r->id,
                'title' => $r->title,
                'fiscal_year' => $r->fiscal_year,
                'office_id' => $r->office_id,
                'office_name' => $r->office_name,
                'office_code' => $r->office_code ?? null,
                'status' => $r->status,
                'type' => $r->type,
                'is_cse' => (bool) $r->is_cse,
                'remarks' => $r->remarks,
                'excel_filename' => $r->excel_filename,
                'excel_size' => $r->excel_size,
                'has_excel_file' => $hasExcel,
                'created_at' => $r->created_at,
                'updated_at' => $r->updated_at,
            ];
        }));
    }

    public function listApprovedPpmps(Request $request)
    {
        $fy = (int)$request->query('fiscal_year', date('Y'));
        $kind = strtolower(trim($request->query('kind', 'cse')));
        $wantCse = $kind === 'cse';

        $approved = Ppmp::where('fiscal_year', $fy)->where('status', 'Approved')->get();
        if ($approved->isEmpty()) return response()->json([]);

        $offices = Office::all()->keyBy('id');
        $res = [];

        foreach ($approved as $p) {
            $items = PpmpItem::where('ppmp_id', $p->id)->get();
            $matching = $items->filter(fn($it) => (bool)$it->is_cse === $wantCse);
            if ($matching->isEmpty() && (bool)$p->is_cse === $wantCse && $items->isNotEmpty()) {
                $matching = $items;
            }
            if ($matching->isEmpty()) continue;

            $office = $offices->get($p->office_id);
            $res[] = [
                'id' => $p->id,
                'title' => $p->title,
                'fiscal_year' => $p->fiscal_year,
                'status' => $p->status,
                'office_id' => $p->office_id,
                'office_name' => $office->name ?? '',
                'office_code' => $office->code ?? '',
                'item_count' => $matching->count(),
                'total_estimated_budget' => $matching->sum(fn($it) => (float)($it->estimated_budget ?? 0)),
                'is_cse_kind' => $wantCse,
            ];
        }

        usort($res, fn($a, $b) => strcmp($a['office_name'], $b['office_name']));
        return response()->json($res);
    }

    public function approveIndicativePpmp(Request $request, int $id)
    {
        $user = $this->authUser($request);
        $ppmp = IndicativePpmp::find($id);

        if (!$ppmp) {
            return response()->json(['detail' => 'Indicative PPMP not found'], 404);
        }
        if ($ppmp->posting_status !== 'Posted') {
            return response()->json(['detail' => 'Only Posted PPMPs can be approved'], 400);
        }

        $ppmp->posting_status = 'Approved';
        $ppmp->approved_at = Carbon::now();
        $ppmp->approved_by = $user->id;
        $ppmp->save();

        return response()->json([
            'message' => 'Indicative PPMP approved successfully',
            'status' => $ppmp->posting_status,
            'approved_at' => $ppmp->approved_at,
            'remarks' => $request->input('remarks', ''),
        ]);
    }

    public function rejectIndicativePpmp(Request $request, int $id)
    {
        $user = $this->authUser($request);
        $ppmp = IndicativePpmp::find($id);

        if (!$ppmp) {
            return response()->json(['detail' => 'Indicative PPMP not found'], 404);
        }
        if ($ppmp->posting_status !== 'Posted') {
            return response()->json(['detail' => 'Only Posted PPMPs can be rejected'], 400);
        }

        $ppmp->posting_status = 'Rejected';
        $ppmp->rejected_at = Carbon::now();
        $ppmp->rejected_by = $user->id;
        $ppmp->rejection_remarks = $request->input('remarks', '');
        $ppmp->save();

        return response()->json([
            'message' => 'Indicative PPMP rejected successfully',
            'status' => $ppmp->posting_status,
            'rejected_at' => $ppmp->rejected_at,
            'remarks' => $ppmp->rejection_remarks,
        ]);
    }

    public function listApps()
    {
        return response()->json(AppModel::all());
    }

    public function getAppByYear(Request $request, int $fiscal_year)
    {
        $app = AppModel::where('fiscal_year', $fiscal_year)->first();
        if (!$app) {
            return response()->json(['app' => null, 'rows' => []]);
        }

        $rows = AppRow::where('app_id', $app->id)->get();
        $kind = $request->query('kind');

        if ($kind) {
            $wantCse = strtolower(trim($kind)) === 'cse';
            $rows = $rows->filter(fn($r) => (bool)$r->is_cse === $wantCse)->values();
        }

        return response()->json(['app' => $app, 'rows' => $rows]);
    }

    public function getApp(int $id)
    {
        $app = AppModel::with('rows')->find($id);
        if (!$app) {
            return response()->json(['detail' => 'APP not found'], 404);
        }
        return response()->json(['app' => $app, 'rows' => $app->rows]);
    }

    public function exportApp(int $fiscal_year, string $kind)
    {
        $kind = strtolower(trim($kind));
        if (!in_array($kind, ['cse', 'noncse'], true)) {
            return response()->json([
                'detail' => "Invalid kind '{$kind}'. Use cse or noncse.",
            ], 400);
        }

        try {
            $content = $kind === 'cse'
                ? AppExcelExporter::exportCseApp($fiscal_year)
                : AppExcelExporter::exportNonCseApp($fiscal_year);
        } catch (Exception $e) {
            return response()->json(['detail' => $e->getMessage()], 400);
        }

        $label = $kind === 'cse' ? 'CSE' : 'nonCSE';
        $filename = "APP-{$label}-FY{$fiscal_year}.xlsx";

        return response($content)
            ->header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            ->header('Content-Disposition', 'attachment; filename="' . $filename . '"');
    }

    public function uploadToDrive(Request $request)
    {
        $fy = (int) $request->query('fiscal_year', date('Y') + 1);
        if ($fy < 2000 || $fy > 2100) {
            return response()->json(['detail' => 'Invalid fiscal_year'], 400);
        }

        try {
            $uploader = new GoogleDriveUploader();
            $result = $uploader->uploadFiscalYearArtifacts($fy);
        } catch (Exception $e) {
            return response()->json([
                'ok' => false,
                'detail' => $e->getMessage(),
                'fiscal_year' => $fy,
                'uploaded' => [],
                'errors' => [['type' => 'setup', 'error' => $e->getMessage()]],
            ], 500);
        }

        $status = $result['ok'] ? 200 : (count($result['uploaded']) > 0 ? 207 : 400);
        return response()->json($result, $status);
    }
}
