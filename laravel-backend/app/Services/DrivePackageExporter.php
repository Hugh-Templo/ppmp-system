<?php

namespace App\Services;

use App\Models\App as AppModel;
use App\Models\AppRow;
use App\Models\Office;
use App\Models\Ppmp;
use App\Models\PpmpItem;
use Illuminate\Support\Facades\DB;
use Exception;
use ZipArchive;

/**
 * Builds the APP SYSTEM FILES/{fy}/… tree as a ZIP for rclone on a PC.
 * Personal Gmail cannot upload via service account (0 quota); rclone uses the user's login.
 */
class DrivePackageExporter
{
    /**
     * @return array{path: string, filename: string, files: list<array>, errors: list<array>}
     */
    public function buildZip(int $fiscalYear): array
    {
        if (!class_exists(ZipArchive::class)) {
            throw new Exception('PHP ZipArchive extension is required to build the Drive package.');
        }

        $files = [];
        $errors = [];
        $entries = [];

        $approved = Ppmp::where('fiscal_year', $fiscalYear)
            ->where('status', 'Approved')
            ->whereNull('superseded_at')
            ->get();

        foreach ($approved as $ppmp) {
            $office = Office::find($ppmp->office_id);
            $officeCode = $office
                ? trim((string) ($office->code ?: $office->name ?: 'office-' . $ppmp->office_id))
                : ('office-' . $ppmp->office_id);
            $officeCode = preg_replace('/[^\w\-]+/', '_', $officeCode) ?: ('office-' . $ppmp->office_id);

            try {
                $bytes = $this->resolvePpmpExcelBytes($ppmp, $office);
                $filename = $this->buildPpmpFilename($ppmp, $officeCode, $bytes);
                $relative = "{$fiscalYear}/PPMP/{$officeCode}/{$filename}";
                $entries[] = ['path' => $relative, 'bytes' => $bytes];
                $files[] = [
                    'type' => 'ppmp',
                    'office_code' => $officeCode,
                    'ppmp_id' => $ppmp->id,
                    'path' => "APP SYSTEM FILES/{$relative}",
                ];
            } catch (Exception $e) {
                $errors[] = [
                    'type' => 'ppmp',
                    'ppmp_id' => $ppmp->id,
                    'office_code' => $officeCode,
                    'error' => $e->getMessage(),
                ];
            }
        }

        $app = AppModel::where('fiscal_year', $fiscalYear)->first();
        if ($app) {
            $rows = AppRow::where('app_id', $app->id)->get();
            $hasCseRows = $rows->contains(fn ($r) => (bool) $r->is_cse);
            $hasNonCseRows = $rows->contains(fn ($r) => !(bool) $r->is_cse);

            if ($hasCseRows) {
                try {
                    $bytes = AppExcelExporter::exportCseApp($fiscalYear);
                    $name = "APP-CSE-FY{$fiscalYear}.xlsx";
                    $relative = "{$fiscalYear}/CSE-APP/{$name}";
                    $entries[] = ['path' => $relative, 'bytes' => $bytes];
                    $files[] = [
                        'type' => 'app',
                        'kind' => 'cse',
                        'path' => "APP SYSTEM FILES/{$relative}",
                    ];
                } catch (Exception $e) {
                    $errors[] = ['type' => 'app', 'kind' => 'cse', 'error' => $e->getMessage()];
                }
            }

            if ($hasNonCseRows) {
                try {
                    $bytes = AppExcelExporter::exportNonCseApp($fiscalYear);
                    $name = "APP-nonCSE-FY{$fiscalYear}.xlsx";
                    $relative = "{$fiscalYear}/nonCSE-APP/{$name}";
                    $entries[] = ['path' => $relative, 'bytes' => $bytes];
                    $files[] = [
                        'type' => 'app',
                        'kind' => 'noncse',
                        'path' => "APP SYSTEM FILES/{$relative}",
                    ];
                } catch (Exception $e) {
                    $errors[] = ['type' => 'app', 'kind' => 'noncse', 'error' => $e->getMessage()];
                }
            }
        } else {
            $errors[] = [
                'type' => 'app',
                'kind' => 'all',
                'error' => "No consolidated APP for FY {$fiscalYear} (PPMP files still included). Run consolidation if you need CSE-APP / nonCSE-APP.",
            ];
        }

        if (count($entries) === 0) {
            throw new Exception(
                count($errors) > 0
                    ? ($errors[0]['error'] ?? 'No files to package')
                    : "No verified PPMPs for FY {$fiscalYear}."
            );
        }

        $tmp = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'appbac_drive_' . uniqid('', true) . '.zip';
        $zip = new ZipArchive();
        if ($zip->open($tmp, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new Exception('Could not create Drive package ZIP.');
        }

        foreach ($entries as $entry) {
            $zip->addFromString($entry['path'], $entry['bytes']);
        }
        $zip->close();

        return [
            'path' => $tmp,
            'filename' => "APP-SYSTEM-FILES-FY{$fiscalYear}-rclone.zip",
            'files' => $files,
            'errors' => $errors,
        ];
    }

    private function resolvePpmpExcelBytes(Ppmp $ppmp, ?Office $office): string
    {
        $diskPath = $ppmp->absoluteExcelPath();
        if ($diskPath && is_file($diskPath)) {
            $content = file_get_contents($diskPath);
            if ($content !== false && AppExcelExporter::isExcelBinary($content)) {
                return $content;
            }
        }

        $blobRow = DB::table('ppmp')->where('id', $ppmp->id)->select('excel_blob')->first();
        $blob = $blobRow->excel_blob ?? null;
        if ($blob !== null && $blob !== '' && AppExcelExporter::isExcelBinary((string) $blob)) {
            return (string) $blob;
        }

        if (!$office) {
            throw new Exception("Office missing for PPMP #{$ppmp->id}; cannot regenerate Excel.");
        }

        $items = PpmpItem::where('ppmp_id', $ppmp->id)->get();

        return PpmpExcelExporter::exportPpmpXlsx($office, $ppmp, $items);
    }

    private function buildPpmpFilename(Ppmp $ppmp, string $officeCode, string $bytes): string
    {
        $ext = $this->detectExcelExtension($bytes, $ppmp->excel_filename, $ppmp->excel_path);
        $stem = PpmpExcelParser::expectedFilenameStem($officeCode);

        return $stem . '.' . $ext;
    }

    private function detectExcelExtension(string $bytes, ?string $filename, ?string $path): string
    {
        $magic = substr($bytes, 0, 4);
        if ($magic === "\xD0\xCF\x11\xE0") {
            return 'xls';
        }
        if ($magic === "PK\x03\x04" || $magic === "PK\x05\x06") {
            return 'xlsx';
        }

        foreach ([$filename, $path] as $candidate) {
            if (!$candidate) {
                continue;
            }
            $ext = strtolower(pathinfo((string) $candidate, PATHINFO_EXTENSION));
            if (in_array($ext, ['xls', 'xlsx'], true)) {
                return $ext;
            }
        }

        return 'xlsx';
    }
}
