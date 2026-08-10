<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Office;
use App\Models\User;
use App\Models\Ppmp;
use App\Models\PpmpItem;
use App\Models\CseCatalogItem;
use App\Services\PpmpExcelParser;
use App\Services\PpmpExcelExporter;
use Exception;

class OfficesController extends Controller
{
    public function listOfficesPublic()
    {
        return response()->json(
            Office::where('is_active', true)->orderBy('code')->get()
        );
    }

    public function getItemCatalog()
    {
        $rows = CseCatalogItem::orderBy('category')->orderBy('description')->get();

        if ($rows->count() > 0) {
            $items = $rows->map(fn($r) => [
                'code' => $r->code ?? '',
                'description' => $r->description,
                'unit_of_measure' => $r->unit_of_measure ?? 'piece',
                'category' => $r->category,
                'is_cse' => (bool)$r->is_cse,
            ]);

            return response()->json([
                'version' => 2,
                'source' => 'database',
                'updated_at' => $rows->max('updated_at'),
                'items' => $items,
                'count' => $items->count(),
            ]);
        }

        // Fallback JSON
        $jsonPath = base_path('data/item_catalog.json');
        if (file_exists($jsonPath)) {
            $data = json_decode(file_get_contents($jsonPath), true);
            return response()->json([
                'version' => $data['version'] ?? 1,
                'updated_at' => $data['updated_at'] ?? null,
                'source' => 'json',
                'items' => $data['items'] ?? [],
                'count' => count($data['items'] ?? []),
            ]);
        }

        return response()->json([
            'version' => 0,
            'source' => 'empty',
            'items' => [],
            'count' => 0,
        ]);
    }

    public function getSignatory(Request $request)
    {
        $user = $request->attributes->get('auth_user') ?: auth()->user();
        $officeId = $request->query('office_id') ?: $user->office_id;

        if (!$officeId) {
            return response()->json(['detail' => 'User is not assigned to any office'], 400);
        }

        if ($user->role === 'end_user' && (int)$officeId !== (int)$user->office_id) {
            return response()->json(['detail' => 'Access denied to this office\'s signatory'], 403);
        }

        $office = Office::find($officeId);
        if (!$office) {
            return response()->json(['detail' => 'Office not found'], 404);
        }

        return response()->json([
            'office_id' => $office->id,
            'office_name' => $office->name,
            'office_code' => $office->code,
            'submitted_by' => $office->submitted_by ?? '',
            'submitted_by_designation' => $office->submitted_by_designation ?? '',
            'prepared_by' => $office->prepared_by ?? '',
            'prepared_by_designation' => $office->prepared_by_designation ?? '',
            'aip_reference' => $office->aip_reference ?? '',
            'responsibility_center_no' => $office->responsibility_center_no ?? '',
            'office_code_from_pr' => $office->office_code_from_pr ?? '',
            'ppmp_template_path' => $office->ppmp_template_path ?? '',
        ]);
    }

    public function updateSignatory(Request $request)
    {
        $user = $request->attributes->get('auth_user') ?: auth()->user();
        $officeId = $request->input('office_id') ?: $user->office_id;

        if (!$officeId) {
            return response()->json(['detail' => 'User is not assigned to any office'], 400);
        }

        if ($user->role === 'end_user' && (int)$officeId !== (int)$user->office_id) {
            return response()->json(['detail' => 'Access denied to this office\'s signatory'], 403);
        }

        $office = Office::find($officeId);
        if (!$office) {
            return response()->json(['detail' => 'Office not found'], 404);
        }

        $office->submitted_by = $request->input('submitted_by');
        $office->submitted_by_designation = $request->input('submitted_by_designation');
        $office->prepared_by = $request->input('prepared_by');
        $office->prepared_by_designation = $request->input('prepared_by_designation');
        $office->aip_reference = $request->input('aip_reference');
        $office->responsibility_center_no = $request->input('responsibility_center_no');
        $office->office_code_from_pr = $request->input('office_code_from_pr');

        try {
            $templatePath = PpmpExcelExporter::writeSignatory($office);
            $office->ppmp_template_path = $templatePath;
        } catch (Exception $e) {
            return response()->json(['detail' => 'Failed to update PPMP template: ' . $e->getMessage()], 500);
        }

        $office->save();

        return response()->json([
            'message' => 'Signatory information updated successfully',
            'signatory' => [
                'office_id' => $office->id,
                'office_name' => $office->name,
                'office_code' => $office->code,
                'submitted_by' => $office->submitted_by ?? '',
                'submitted_by_designation' => $office->submitted_by_designation ?? '',
                'prepared_by' => $office->prepared_by ?? '',
                'prepared_by_designation' => $office->prepared_by_designation ?? '',
                'aip_reference' => $office->aip_reference ?? '',
                'responsibility_center_no' => $office->responsibility_center_no ?? '',
                'office_code_from_pr' => $office->office_code_from_pr ?? '',
                'ppmp_template_path' => $office->ppmp_template_path ?? '',
            ],
        ]);
    }

    public function getOfficeBudget(Request $request, int $office_id)
    {
        $user = $request->attributes->get('auth_user') ?: auth()->user();
        if ($user->role === 'end_user' && (int)$user->office_id !== $office_id) {
            return response()->json(['detail' => 'Access denied to this office\'s budget'], 403);
        }

        $office = Office::find($office_id);
        if (!$office) {
            return response()->json(['detail' => 'Office not found'], 404);
        }

        return response()->json(['budget_allocation' => (float)$office->budget_allocation]);
    }

    public function updateOfficeBudget(Request $request, int $office_id)
    {
        $user = $request->attributes->get('auth_user') ?: auth()->user();
        if ($user->role === 'end_user' && (int)$user->office_id !== $office_id) {
            return response()->json(['detail' => 'Access denied to update this office\'s budget'], 403);
        }

        $office = Office::find($office_id);
        if (!$office) {
            return response()->json(['detail' => 'Office not found'], 404);
        }

        $office->budget_allocation = (float)$request->input('budget_allocation', 0);
        $office->save();

        return response()->json([
            'message' => 'Budget allocation updated successfully',
            'budget_allocation' => (float)$office->budget_allocation,
        ]);
    }

    public function listPpmps(Request $request)
    {
        $user = $request->attributes->get('auth_user') ?: auth()->user();
        if (!$user->office_id) {
            return response()->json(['detail' => 'User is not assigned to any office'], 400);
        }

        return response()->json(
            Ppmp::where('office_id', $user->office_id)->get()
        );
    }

    public function uploadPpmp(Request $request)
    {
        $user = $request->attributes->get('auth_user') ?: auth()->user();
        if (!$user->office_id) {
            return response()->json(['detail' => 'User is not assigned to any office'], 400);
        }

        $office = Office::find($user->office_id);
        if (!$office || !$office->is_active) {
            return response()->json(['detail' => 'Office not found or inactive'], 400);
        }

        if (!$request->hasFile('file')) {
            return response()->json(['detail' => 'Upload must be an Excel file (.xls, .xlsx, or .xlsm)'], 400);
        }

        $file = $request->file('file');
        $ext = strtolower($file->getClientOriginalExtension());
        if (!in_array($ext, ['xls', 'xlsx', 'xlsm'])) {
            return response()->json(['detail' => 'Upload must be an Excel file (.xls, .xlsx, or .xlsm)'], 400);
        }

        $isCseStr = strtolower(trim($request->input('is_cse', 'false')));
        $isCseFlag = in_array($isCseStr, ['1', 'true', 'yes', 'on', 'cse'], true);

        $dirs = PpmpExcelParser::ensureItPpmpsDirs();
        $kindFolder = $isCseFlag ? $dirs['cse'] : $dirs['noncse'];
        $officeFolder = $kindFolder . DIRECTORY_SEPARATOR . $office->code;
        if (!file_exists($officeFolder)) mkdir($officeFolder, 0777, true);

        $destName = preg_replace('/[^\w\-]+/', '_', pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME)) . '.' . $ext;
        $destPath = $officeFolder . DIRECTORY_SEPARATOR . $destName;

        $file->move($officeFolder, $destName);

        try {
            $parsed = PpmpExcelParser::parseFile($destPath, $isCseFlag, $office->code);
            $itemsData = $parsed['items'];
            $meta = $parsed['meta'];
        } catch (Exception $e) {
            return response()->json(['detail' => 'Could not parse PPMP Excel: ' . $e->getMessage()], 400);
        }

        $fiscalYear = $request->input('fiscal_year') ?: ($meta['fiscal_year'] ?? date('Y'));
        $fiscalYear = (int)$fiscalYear;

        if (empty($itemsData)) {
            return response()->json(['detail' => 'No PPMP line items found in the uploaded Excel file'], 400);
        }

        $ppmpTitle = trim($request->input('title') ?: ($meta['title'] ?: pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME)));

        // Remove existing Draft / Returned for same office + year + is_cse
        $oldPpmps = Ppmp::where('office_id', $office->id)
            ->where('fiscal_year', $fiscalYear)
            ->where('is_cse', $isCseFlag)
            ->whereIn('status', ['Draft', 'Returned'])
            ->get();

        foreach ($oldPpmps as $old) {
            PpmpItem::where('ppmp_id', $old->id)->delete();
            $old->delete();
        }

        $newPpmp = Ppmp::create([
            'title' => $ppmpTitle,
            'fiscal_year' => $fiscalYear,
            'office_id' => $office->id,
            'status' => 'Draft',
            'type' => 'Indicative',
            'is_cse' => $isCseFlag,
            'remarks' => null,
        ]);

        foreach ($itemsData as $row) {
            $qty = $row['quantity'] ?? null;
            $unitCost = $row['unit_cost'] ?? null;
            $estimated = (float)($row['estimated_budget'] ?? 0);
            if ($estimated <= 0 && $qty !== null && $unitCost !== null) {
                $estimated = (float)$qty * (float)$unitCost;
            }

            PpmpItem::create([
                'ppmp_id' => $newPpmp->id,
                'description' => trim($row['description'] ?? '') ?: 'Item',
                'category' => $row['category'] ?? null,
                'is_cse' => (bool)($row['is_cse'] ?? $isCseFlag),
                'project_type' => $row['project_type'] ?? 'Goods',
                'quantity_size' => $row['quantity_size'] ?? null,
                'procurement_mode' => $row['procurement_mode'] ?? 'Competitive Bidding',
                'pre_proc_conf' => (bool)($row['pre_proc_conf'] ?? false),
                'proc_start' => $row['proc_start'] ?? null,
                'proc_end' => $row['proc_end'] ?? null,
                'delivery_period' => $row['delivery_period'] ?? null,
                'fund_source' => $row['fund_source'] ?? null,
                'estimated_budget' => $estimated,
                'supporting_docs' => $row['supporting_docs'] ?? null,
                'remarks' => $row['remarks'] ?? null,
                'quantity' => $row['quantity'] ?? null,
                'unit_of_measure' => $row['unit_of_measure'] ?? null,
                'unit_cost' => $row['unit_cost'] ?? null,
                'q1_qty' => (int)($row['q1_qty'] ?? 0),
                'q2_qty' => (int)($row['q2_qty'] ?? 0),
                'q3_qty' => (int)($row['q3_qty'] ?? 0),
                'q4_qty' => (int)($row['q4_qty'] ?? 0),
            ]);
        }

        return response()->json([
            'message' => 'PPMP uploaded successfully',
            'ppmp' => $newPpmp,
            'item_count' => count($itemsData),
            'saved_path' => $destPath,
        ]);
    }

    public function getPpmp(Request $request, int $id)
    {
        $ppmp = Ppmp::with('items')->find($id);
        if (!$ppmp) {
            return response()->json(['detail' => 'PPMP not found'], 404);
        }

        $user = $request->attributes->get('auth_user') ?: auth()->user();
        if ($user->role === 'end_user' && (int)$ppmp->office_id !== (int)$user->office_id) {
            return response()->json(['detail' => 'Access denied to this office\'s PPMP'], 403);
        }

        if ($user->role === 'end_user' && !in_array($ppmp->status, ['Approved', 'Returned'])) {
            return response()->json([
                'detail' => 'You can only view PPMPs that are Approved or Returned. Upload a new Excel file or wait for Budget Office review.'
            ], 403);
        }

        $office = Office::find($ppmp->office_id);
        $officePayload = $office ? [
            'id' => $office->id,
            'name' => $office->name,
            'code' => $office->code,
            'prepared_by' => $office->prepared_by ?? '',
            'prepared_by_designation' => $office->prepared_by_designation ?? '',
            'submitted_by' => $office->submitted_by ?? '',
            'submitted_by_designation' => $office->submitted_by_designation ?? '',
        ] : null;

        return response()->json([
            'ppmp' => $ppmp,
            'items' => $ppmp->items,
            'office' => $officePayload,
        ]);
    }

    public function exportPpmp(Request $request, int $id)
    {
        $ppmp = Ppmp::with('items')->find($id);
        if (!$ppmp) {
            return response()->json(['detail' => 'PPMP not found'], 404);
        }

        $user = $request->attributes->get('auth_user') ?: auth()->user();
        if ($user->role === 'end_user' && (int)$ppmp->office_id !== (int)$user->office_id) {
            return response()->json(['detail' => 'Access denied to this office\'s PPMP'], 403);
        }

        $office = Office::find($ppmp->office_id);
        if (!$office) {
            return response()->json(['detail' => 'Office for this PPMP not found'], 404);
        }

        try {
            $content = PpmpExcelExporter::exportPpmpXlsx($office, $ppmp, $ppmp->items);
        } catch (Exception $e) {
            return response()->json(['detail' => 'PPMP export failed: ' . $e->getMessage()], 500);
        }

        $safeTitle = preg_replace('/[^\w\-]+/', '_', $ppmp->title ?: 'PPMP');
        $filename = "NGPA_PPMP_{$safeTitle}_FY{$ppmp->fiscal_year}.xlsx";

        return response($content)
            ->header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
            ->header('Content-Disposition', "attachment; filename=\"{$filename}\"");
    }

    public function submitPpmp(Request $request, int $id)
    {
        $user = $request->attributes->get('auth_user') ?: auth()->user();
        $ppmp = Ppmp::find($id);

        if (!$ppmp) {
            return response()->json(['detail' => 'PPMP not found'], 404);
        }

        if ((int)$ppmp->office_id !== (int)$user->office_id) {
            return response()->json(['detail' => 'Access denied'], 403);
        }

        if (in_array($ppmp->status, ['Pending Budget Review', 'Approved'])) {
            return response()->json(['detail' => "PPMP is already {$ppmp->status} and locked"], 400);
        }

        $ppmp->status = 'Pending Budget Review';
        $ppmp->save();

        return response()->json([
            'message' => 'PPMP submitted for budget review successfully',
            'status' => $ppmp->status,
        ]);
    }

    public function deletePpmp(Request $request, int $id)
    {
        $user = $request->attributes->get('auth_user') ?: auth()->user();
        $ppmp = Ppmp::find($id);

        if (!$ppmp) {
            return response()->json(['detail' => 'PPMP not found'], 404);
        }

        if ((int)$ppmp->office_id !== (int)$user->office_id) {
            return response()->json(['detail' => 'Access denied'], 403);
        }

        if ($ppmp->status !== 'Draft') {
            return response()->json(['detail' => "PPMP cannot be deleted while status is '{$ppmp->status}'. Only Draft PPMPs may be deleted."], 400);
        }

        PpmpItem::where('ppmp_id', $id)->delete();
        $ppmp->delete();

        return response()->json(['message' => 'PPMP deleted successfully', 'ppmp_id' => $id]);
    }
}
