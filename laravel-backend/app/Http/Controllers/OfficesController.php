<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Models\Office;
use App\Models\Ppmp;
use App\Models\PpmpItem;
use App\Models\CseCatalogItem;
use App\Services\PpmpExcelParser;
use App\Services\PpmpExcelExporter;
use App\Services\AppExcelExporter;
use App\Services\OfficeResolver;
use Exception;
use Throwable;

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
        $user = $this->authUser($request);
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
        $user = $this->authUser($request);
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
        $user = $this->authUser($request);
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
        $user = $this->authUser($request);
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
        $user = $this->authUser($request);
        $office = OfficeResolver::ensureUserOffice($user);
        if (!$office) {
            return response()->json(['detail' => 'User is not assigned to any office'], 400);
        }

        return response()->json(
            Ppmp::where('office_id', $office->id)
                ->select([
                    'id', 'title', 'fiscal_year', 'office_id', 'status', 'type', 'is_cse',
                    'remarks', 'excel_path', 'excel_filename', 'excel_mime', 'excel_size',
                    'created_at', 'updated_at',
                ])
                ->orderByDesc('fiscal_year')
                ->orderByDesc('id')
                ->get()
        );
    }

    public function uploadPpmp(Request $request)
    {
        $user = $this->authUser($request);
        $office = OfficeResolver::ensureUserOffice($user);
        if (!$office || !$office->is_active) {
            return response()->json(['detail' => 'User is not assigned to any office'], 400);
        }

        if (!$request->hasFile('file')) {
            return response()->json(['detail' => 'Upload must be an Excel file (.xls, .xlsx, or .xlsm)'], 400);
        }

        $file = $request->file('file');
        $ext = strtolower($file->getClientOriginalExtension());
        if (!in_array($ext, ['xls', 'xlsx', 'xlsm'])) {
            return response()->json(['detail' => 'Upload must be an Excel file (.xls, .xlsx, or .xlsm)'], 400);
        }

        $originalName = $file->getClientOriginalName() ?: ('PPMP.' . $ext);
        $expectedStem = PpmpExcelParser::expectedFilenameStem($office->code);
        $actualStem = PpmpExcelParser::normalizeFilenameStem(
            (string) pathinfo($originalName, PATHINFO_FILENAME)
        );
        if (strcasecmp($actualStem, $expectedStem) !== 0) {
            return response()->json([
                'detail' => 'Filename must be "' . $expectedStem . '.' . $ext . '"',
            ], 400);
        }

        $tempPath = $file->getRealPath();
        if (!$tempPath || !is_file($tempPath)) {
            return response()->json(['detail' => 'Uploaded file is empty or unreadable'], 400);
        }

        $excelBytes = file_get_contents($tempPath);
        if ($excelBytes === false || $excelBytes === '') {
            return response()->json(['detail' => 'Uploaded file is empty or unreadable'], 400);
        }

        try {
            $parsed = PpmpExcelParser::parseFile($tempPath, false, $office->code);
            $itemsData = $parsed['items'];
            $meta = $parsed['meta'];
        } catch (Exception $e) {
            return response()->json(['detail' => $e->getMessage()], 400);
        }

        $fiscalYear = $request->input('fiscal_year') ?: ($meta['fiscal_year'] ?? date('Y'));
        $fiscalYear = (int) $fiscalYear;

        if (empty($itemsData)) {
            return response()->json(['detail' => 'No PPMP line items found in the uploaded Excel file'], 400);
        }

        // Persist signatories from the Excel footer onto the office record.
        // Labels move with item count, so values come from parser meta (not fixed rows).
        $signatoryTouched = false;
        foreach ([
            'prepared_by',
            'prepared_by_designation',
            'submitted_by',
            'submitted_by_designation',
        ] as $field) {
            $value = isset($meta[$field]) ? trim((string) $meta[$field]) : '';
            if ($value !== '') {
                $office->{$field} = $value;
                $signatoryTouched = true;
            }
        }
        if ($signatoryTouched) {
            try {
                $templatePath = PpmpExcelExporter::writeSignatory($office);
                $office->ppmp_template_path = $templatePath;
            } catch (Exception $e) {
                Log::warning('PPMP upload: signatory template refresh failed', [
                    'office_id' => $office->id,
                    'error' => $e->getMessage(),
                ]);
            }
            $office->save();
        }

        // Parent is_cse true only when every item is CSE (mixed → false)
        $isCseFlag = !empty($itemsData) && collect($itemsData)->every(
            fn ($row) => (bool) ($row['is_cse'] ?? false)
        );

        // Combined CSE + NONCSE PPMP: one folder per office (no CSE/nonCSE split).
        $dirs = PpmpExcelParser::ensureItPpmpsDirs();
        $officeFolder = $dirs['root'] . DIRECTORY_SEPARATOR . $office->code;
        if (!file_exists($officeFolder)) {
            mkdir($officeFolder, 0777, true);
        }

        $destName = preg_replace('/[^\w\-]+/', '_', $expectedStem) . '.' . $ext;
        $destPath = $officeFolder . DIRECTORY_SEPARATOR . $destName;
        $relativePath = $office->code . '/' . $destName;

        $excelMime = $file->getClientMimeType()
            ?: ($ext === 'xls'
                ? 'application/vnd.ms-excel'
                : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        $excelSize = strlen($excelBytes);

        if (file_put_contents($destPath, $excelBytes) === false) {
            return response()->json(['detail' => 'Failed to save uploaded Excel file to disk'], 500);
        }

        $ppmpTitle = mb_convert_encoding($expectedStem, 'UTF-8', 'UTF-8');

        // Replace all Draft / Returned for same office + year (mixed CSE/NONCSE in one file)
        $oldPpmps = Ppmp::where('office_id', $office->id)
            ->where('fiscal_year', $fiscalYear)
            ->whereIn('status', ['Draft', 'Returned'])
            ->get();

        foreach ($oldPpmps as $old) {
            $oldPath = $old->absoluteExcelPath();
            PpmpItem::where('ppmp_id', $old->id)->delete();
            $old->delete();
            if ($oldPath && is_file($oldPath) && realpath($oldPath) !== realpath($destPath)) {
                @unlink($oldPath);
            }
        }

        $storedInDb = false;
        $newPpmp = null;

        try {
            // Keep metadata + items in a short transaction (NO blob here).
            // Large LONGBLOB updates can kill the MySQL connection (max_allowed_packet).
            DB::transaction(function () use (
                &$newPpmp,
                $ppmpTitle,
                $fiscalYear,
                $office,
                $isCseFlag,
                $relativePath,
                $originalName,
                $excelMime,
                $excelSize,
                $itemsData
            ) {
                $newPpmp = Ppmp::create([
                    'title' => $ppmpTitle,
                    'fiscal_year' => $fiscalYear,
                    'office_id' => $office->id,
                    'status' => 'Draft',
                    'type' => 'Indicative',
                    'is_cse' => $isCseFlag,
                    'remarks' => null,
                    'excel_path' => $relativePath,
                    'excel_filename' => $originalName,
                    'excel_mime' => $excelMime,
                    'excel_size' => $excelSize,
                ]);

                foreach ($itemsData as $row) {
                    $qty = $row['quantity'] ?? null;
                    $unitCost = $row['unit_cost'] ?? null;
                    $estimated = (float) ($row['estimated_budget'] ?? 0);
                    if ($estimated <= 0 && $qty !== null && $unitCost !== null) {
                        $estimated = (float) $qty * (float) $unitCost;
                    }

                    PpmpItem::create([
                        'ppmp_id' => $newPpmp->id,
                        'description' => $this->safeUtf8(trim((string) ($row['description'] ?? '')) ?: 'Item'),
                        'category' => $this->nullableUtf8($row['category'] ?? null),
                        'is_cse' => (bool) ($row['is_cse'] ?? false),
                        'project_type' => $this->safeUtf8($row['project_type'] ?? 'Goods'),
                        'quantity_size' => $this->nullableUtf8($row['quantity_size'] ?? null),
                        'procurement_mode' => $this->safeUtf8($row['procurement_mode'] ?? 'Competitive Bidding'),
                        'pre_proc_conf' => (bool) ($row['pre_proc_conf'] ?? false),
                        'proc_start' => $this->nullableUtf8($row['proc_start'] ?? null),
                        'proc_end' => $this->nullableUtf8($row['proc_end'] ?? null),
                        'delivery_period' => $this->nullableUtf8($row['delivery_period'] ?? null),
                        'fund_source' => $this->nullableUtf8($row['fund_source'] ?? null),
                        'estimated_budget' => $estimated,
                        'supporting_docs' => $this->nullableUtf8($row['supporting_docs'] ?? null),
                        'remarks' => $this->nullableUtf8($row['remarks'] ?? null),
                        'quantity' => $row['quantity'] ?? null,
                        'unit_of_measure' => $this->nullableUtf8($row['unit_of_measure'] ?? null),
                        'unit_cost' => $row['unit_cost'] ?? null,
                        'q1_qty' => (int) ($row['q1_qty'] ?? 0),
                        'q2_qty' => (int) ($row['q2_qty'] ?? 0),
                        'q3_qty' => (int) ($row['q3_qty'] ?? 0),
                        'q4_qty' => (int) ($row['q4_qty'] ?? 0),
                    ]);
                }
            });
        } catch (Throwable $e) {
            Log::error('PPMP upload save failed', ['error' => $this->safeErrorMessage($e)]);
            return response()->json([
                'detail' => 'Failed to save PPMP: ' . $this->safeErrorMessage($e),
            ], 500);
        }

        if (!$newPpmp) {
            return response()->json(['detail' => 'Failed to save PPMP'], 500);
        }

        // Store LONGBLOB AFTER commit, on a fresh connection.
        $storedInDb = $this->storeExcelBlob($newPpmp->id, $excelBytes);

        // Reload without excel_blob for a clean JSON payload
        try {
            DB::reconnect();
        } catch (Throwable $ignored) {
            // ignore
        }

        $ppmpPayload = Ppmp::query()
            ->select([
                'id', 'title', 'fiscal_year', 'office_id', 'status', 'type', 'is_cse',
                'remarks', 'excel_path', 'excel_filename', 'excel_mime', 'excel_size',
                'created_at', 'updated_at',
            ])
            ->find($newPpmp->id);

        return response()->json([
            'message' => 'PPMP uploaded successfully',
            'ppmp' => $ppmpPayload,
            'item_count' => count($itemsData),
            'saved_path' => $destPath,
            'excel_path' => $relativePath,
            'excel_filename' => $originalName,
            'excel_size' => $excelSize,
            'stored_in_database' => $storedInDb,
            'stored_on_disk' => file_exists($destPath),
        ]);
    }

    /**
     * Persist Excel bytes into LONGBLOB without breaking the main upload.
     */
    private function storeExcelBlob(int $ppmpId, string $excelBytes): bool
    {
        $bytes = strlen($excelBytes);

        try {
            DB::reconnect();

            // Avoid killing the connection when packet limit is too small.
            try {
                $row = DB::selectOne('SELECT @@session.max_allowed_packet AS cap');
                $cap = (int) ($row->cap ?? 0);
                if ($cap > 0 && $bytes >= $cap) {
                    Log::warning('PPMP excel_blob skipped; file larger than max_allowed_packet', [
                        'ppmp_id' => $ppmpId,
                        'bytes' => $bytes,
                        'max_allowed_packet' => $cap,
                    ]);
                    return false;
                }
            } catch (Throwable $ignored) {
                // continue and attempt store
            }

            DB::table('ppmp')->where('id', $ppmpId)->update([
                'excel_blob' => $excelBytes,
            ]);

            return true;
        } catch (Throwable $blobError) {
            Log::warning('PPMP excel_blob store failed; kept disk path only', [
                'ppmp_id' => $ppmpId,
                'bytes' => $bytes,
                'error' => $this->safeErrorMessage($blobError),
            ]);
            try {
                DB::reconnect();
            } catch (Throwable $ignored) {
                // ignore
            }
            return false;
        }
    }

    private function safeErrorMessage(Throwable $e): string
    {
        $msg = $e->getMessage();
        $msg = $this->safeUtf8($msg);
        // Strip control/binary leftovers from PDO/MySQL messages
        $msg = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]+/', '', $msg) ?: 'Unexpected server error';
        return mb_substr($msg, 0, 500);
    }

    private function safeUtf8(?string $value): string
    {
        if ($value === null || $value === '') {
            return '';
        }
        if (!mb_check_encoding($value, 'UTF-8')) {
            $value = mb_convert_encoding($value, 'UTF-8', 'UTF-8, ISO-8859-1, Windows-1252');
        }
        $clean = iconv('UTF-8', 'UTF-8//IGNORE', $value);
        return $clean === false ? '' : $clean;
    }

    private function nullableUtf8($value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        $clean = $this->safeUtf8((string) $value);
        return $clean === '' ? null : $clean;
    }

    public function getPpmp(Request $request, int $id)
    {
        // Omit excel_blob from detail view (download/export loads it separately).
        $ppmp = Ppmp::with('items')
            ->select([
                'id', 'title', 'fiscal_year', 'office_id', 'status', 'type', 'is_cse',
                'remarks', 'excel_path', 'excel_filename', 'excel_mime', 'excel_size',
                'created_at', 'updated_at',
            ])
            ->find($id);
        if (!$ppmp) {
            return response()->json(['detail' => 'PPMP not found'], 404);
        }

        $user = $this->authUser($request);
        if ($user->role === 'end_user' && (int)$ppmp->office_id !== (int)$user->office_id) {
            return response()->json(['detail' => 'Access denied to this office\'s PPMP'], 403);
        }

        // End users may preview any status for their own office (view-only UI).

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
        // Include blob only for this download endpoint
        $ppmp = Ppmp::with('items')->find($id);
        if (!$ppmp) {
            return response()->json(['detail' => 'PPMP not found'], 404);
        }

        $user = $this->authUser($request);
        if ($user->role === 'end_user' && (int)$ppmp->office_id !== (int)$user->office_id) {
            return response()->json(['detail' => 'Access denied to this office\'s PPMP'], 403);
        }

        $office = Office::find($ppmp->office_id);
        if (!$office) {
            return response()->json(['detail' => 'Office for this PPMP not found'], 404);
        }

        $filename = $ppmp->excel_filename
            ?: ('NGPA_PPMP_' . preg_replace('/[^\w\-]+/', '_', $ppmp->title ?: 'PPMP') . "_FY{$ppmp->fiscal_year}.xlsx");
        $mime = $ppmp->excel_mime
            ?: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        if (!str_contains(strtolower($filename), '.xls')) {
            $filename .= '.xlsx';
        }

        // Prefer original uploaded file: disk path first, then MySQL LONGBLOB
        $diskPath = $ppmp->absoluteExcelPath();
        $diskBytes = ($diskPath && is_file($diskPath)) ? file_get_contents($diskPath) : false;
        if ($diskBytes !== false && AppExcelExporter::isExcelBinary($diskBytes)) {
            return response()->download($diskPath, $filename, [
                'Content-Type' => $mime,
                'Cache-Control' => 'no-store, no-cache, must-revalidate',
                'Access-Control-Expose-Headers' => 'Content-Disposition, Content-Type',
            ]);
        }

        $blobRow = \Illuminate\Support\Facades\DB::table('ppmp')
            ->where('id', $ppmp->id)
            ->select('excel_blob')
            ->first();
        $blob = $blobRow->excel_blob ?? null;
        if ($blob !== null && $blob !== '' && AppExcelExporter::isExcelBinary((string) $blob)) {
            try {
                return AppExcelExporter::excelDownload((string) $blob, $filename, $mime);
            } catch (Exception $e) {
                return response()->json(['detail' => $e->getMessage()], 500);
            }
        }

        // Fallback: regenerate Excel from DB line items
        try {
            $content = PpmpExcelExporter::exportPpmpXlsx($office, $ppmp, $ppmp->items);
        } catch (Exception $e) {
            return response()->json(['detail' => 'PPMP export failed: ' . $e->getMessage()], 500);
        }

        if (!AppExcelExporter::isExcelBinary($content)) {
            return response()->json(['detail' => 'PPMP export produced an invalid Excel file'], 500);
        }

        try {
            return AppExcelExporter::excelDownload($content, $filename, $mime);
        } catch (Exception $e) {
            return response()->json(['detail' => $e->getMessage()], 500);
        }
    }

    public function submitPpmp(Request $request, int $id)
    {
        $user = $this->authUser($request);
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
        $user = $this->authUser($request);
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

        $diskPath = $ppmp->absoluteExcelPath();
        PpmpItem::where('ppmp_id', $id)->delete();
        $ppmp->delete();

        if ($diskPath && is_file($diskPath)) {
            @unlink($diskPath);
        }

        return response()->json(['message' => 'PPMP deleted successfully', 'ppmp_id' => $id]);
    }
}
