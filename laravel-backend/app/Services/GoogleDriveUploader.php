<?php

namespace App\Services;

use App\Models\App as AppModel;
use App\Models\AppRow;
use App\Models\Office;
use App\Models\Ppmp;
use App\Models\PpmpItem;
use Google\Client as GoogleClient;
use Google\Service\Drive as GoogleDrive;
use Google\Service\Drive\DriveFile;
use Illuminate\Support\Facades\DB;
use Exception;

class GoogleDriveUploader
{
    private const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    private const MIME_FOLDER = 'application/vnd.google-apps.folder';

    private GoogleDrive $drive;
    private string $rootFolderId;

    public function __construct(?GoogleDrive $drive = null, ?string $rootFolderId = null)
    {
        $this->rootFolderId = $rootFolderId ?: (string) config('google.drive_root_folder_id', '');
        if ($this->rootFolderId === '') {
            throw new Exception(
                'GOOGLE_DRIVE_ROOT_FOLDER_ID is not set. Use the folder ID of "APP SYSTEM FILES".'
            );
        }

        if ($drive) {
            $this->drive = $drive;
            return;
        }

        $keyPath = self::resolveServiceAccountPath();
        if (!$keyPath || !is_file($keyPath)) {
            throw new Exception(
                'Google service account JSON not found. Set GOOGLE_SERVICE_ACCOUNT_FILE ' .
                '(e.g. ../credentials/google-service-account.json).'
            );
        }

        $client = new GoogleClient();
        $client->setAuthConfig($keyPath);
        $client->setScopes([GoogleDrive::DRIVE]);
        $this->drive = new GoogleDrive($client);
    }

    public static function resolveServiceAccountPath(): ?string
    {
        $configured = trim((string) config('google.service_account_file', ''));
        if ($configured === '') {
            return null;
        }

        if (is_file($configured)) {
            return $configured;
        }

        $fromBase = base_path($configured);
        if (is_file($fromBase)) {
            return $fromBase;
        }

        $fromRepo = dirname(base_path()) . DIRECTORY_SEPARATOR . ltrim(
            str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $configured),
            DIRECTORY_SEPARATOR
        );
        // Handle ../credentials/... relative to laravel-backend
        $normalized = realpath(base_path($configured));
        if ($normalized && is_file($normalized)) {
            return $normalized;
        }

        if (is_file($fromRepo)) {
            return $fromRepo;
        }

        return null;
    }

    /**
     * Upload verified PPMPs and CSE/nonCSE APP Excels for a fiscal year.
     *
     * @return array{ok: bool, fiscal_year: int, uploaded: list<array>, errors: list<array>}
     */
    public function uploadFiscalYearArtifacts(int $fiscalYear): array
    {
        $uploaded = [];
        $errors = [];

        $fyFolderId = $this->ensureFolderPath($this->rootFolderId, [(string) $fiscalYear]);
        $csePpmpRoot = $this->ensureFolderPath($fyFolderId, ['CSE-PPMP']);
        $nonCsePpmpRoot = $this->ensureFolderPath($fyFolderId, ['nonCSE-PPMP']);
        $cseAppFolder = $this->ensureFolderPath($fyFolderId, ['CSE-APP']);
        $nonCseAppFolder = $this->ensureFolderPath($fyFolderId, ['nonCSE-APP']);

        $approved = Ppmp::where('fiscal_year', $fiscalYear)
            ->where('status', 'Approved')
            ->get();

        $offices = Office::all()->keyBy('id');

        foreach ($approved as $ppmp) {
            $office = $offices->get($ppmp->office_id);
            $officeCode = $office
                ? trim((string) ($office->code ?: $office->name ?: 'office-' . $ppmp->office_id))
                : ('office-' . $ppmp->office_id);
            $officeCode = preg_replace('/[^\w\-]+/', '_', $officeCode) ?: ('office-' . $ppmp->office_id);

            $items = PpmpItem::where('ppmp_id', $ppmp->id)->get();
            $hasCse = $items->contains(fn($it) => (bool) $it->is_cse);
            $hasNonCse = $items->contains(fn($it) => !(bool) $it->is_cse);
            // Parent flag fallback when items missing type
            if (!$hasCse && !$hasNonCse) {
                if ((bool) $ppmp->is_cse) {
                    $hasCse = true;
                } else {
                    $hasNonCse = true;
                }
            }

            try {
                $bytes = $this->resolvePpmpExcelBytes($ppmp, $office);
                $filename = $ppmp->excel_filename
                    ?: sprintf('%s_PPMP_FY%d.xlsx', $officeCode, $fiscalYear);

                if ($hasCse) {
                    $folderId = $this->ensureFolderPath($csePpmpRoot, [$officeCode]);
                    $file = $this->uploadOrReplace($folderId, $filename, $bytes, self::MIME_XLSX);
                    $uploaded[] = [
                        'type' => 'ppmp',
                        'kind' => 'cse',
                        'office_code' => $officeCode,
                        'ppmp_id' => $ppmp->id,
                        'name' => $filename,
                        'drive_file_id' => $file->getId(),
                        'path' => "APP SYSTEM FILES/{$fiscalYear}/CSE-PPMP/{$officeCode}/{$filename}",
                    ];
                }

                if ($hasNonCse) {
                    $folderId = $this->ensureFolderPath($nonCsePpmpRoot, [$officeCode]);
                    $file = $this->uploadOrReplace($folderId, $filename, $bytes, self::MIME_XLSX);
                    $uploaded[] = [
                        'type' => 'ppmp',
                        'kind' => 'noncse',
                        'office_code' => $officeCode,
                        'ppmp_id' => $ppmp->id,
                        'name' => $filename,
                        'drive_file_id' => $file->getId(),
                        'path' => "APP SYSTEM FILES/{$fiscalYear}/nonCSE-PPMP/{$officeCode}/{$filename}",
                    ];
                }
            } catch (Exception $e) {
                $errors[] = [
                    'type' => 'ppmp',
                    'ppmp_id' => $ppmp->id,
                    'office_code' => $officeCode,
                    'error' => $e->getMessage(),
                ];
            }
        }

        // Consolidated APP Excels
        $app = AppModel::where('fiscal_year', $fiscalYear)->first();
        if (!$app) {
            $errors[] = [
                'type' => 'app',
                'kind' => 'all',
                'error' => "No consolidated APP for FY {$fiscalYear}. Run consolidation first.",
            ];
        } else {
            $rows = AppRow::where('app_id', $app->id)->get();
            $hasCseRows = $rows->contains(fn($r) => (bool) $r->is_cse);
            $hasNonCseRows = $rows->contains(fn($r) => !(bool) $r->is_cse);

            if ($hasCseRows) {
                try {
                    $bytes = AppExcelExporter::exportCseApp($fiscalYear);
                    $name = "APP-CSE-FY{$fiscalYear}.xlsx";
                    $file = $this->uploadOrReplace($cseAppFolder, $name, $bytes, self::MIME_XLSX);
                    $uploaded[] = [
                        'type' => 'app',
                        'kind' => 'cse',
                        'name' => $name,
                        'drive_file_id' => $file->getId(),
                        'path' => "APP SYSTEM FILES/{$fiscalYear}/CSE-APP/{$name}",
                    ];
                } catch (Exception $e) {
                    $errors[] = [
                        'type' => 'app',
                        'kind' => 'cse',
                        'error' => $e->getMessage(),
                    ];
                }
            }

            if ($hasNonCseRows) {
                try {
                    $bytes = AppExcelExporter::exportNonCseApp($fiscalYear);
                    $name = "APP-nonCSE-FY{$fiscalYear}.xlsx";
                    $file = $this->uploadOrReplace($nonCseAppFolder, $name, $bytes, self::MIME_XLSX);
                    $uploaded[] = [
                        'type' => 'app',
                        'kind' => 'noncse',
                        'name' => $name,
                        'drive_file_id' => $file->getId(),
                        'path' => "APP SYSTEM FILES/{$fiscalYear}/nonCSE-APP/{$name}",
                    ];
                } catch (Exception $e) {
                    $errors[] = [
                        'type' => 'app',
                        'kind' => 'noncse',
                        'error' => $e->getMessage(),
                    ];
                }
            }

            if (!$hasCseRows && !$hasNonCseRows) {
                $errors[] = [
                    'type' => 'app',
                    'kind' => 'all',
                    'error' => "APP for FY {$fiscalYear} has no consolidated rows.",
                ];
            }
        }

        return [
            'ok' => count($errors) === 0,
            'fiscal_year' => $fiscalYear,
            'uploaded' => $uploaded,
            'errors' => $errors,
        ];
    }

    /**
     * Walk/create folders under $parentId for each name in $names. Returns leaf folder ID.
     *
     * @param  list<string>  $names
     */
    public function ensureFolderPath(string $parentId, array $names): string
    {
        $current = $parentId;
        foreach ($names as $name) {
            $name = trim((string) $name);
            if ($name === '') {
                continue;
            }
            $current = $this->findOrCreateFolder($current, $name);
        }
        return $current;
    }

    public function findOrCreateFolder(string $parentId, string $name): string
    {
        $escaped = str_replace("'", "\\'", $name);
        $q = sprintf(
            "mimeType='%s' and name='%s' and '%s' in parents and trashed=false",
            self::MIME_FOLDER,
            $escaped,
            $parentId
        );

        $list = $this->drive->files->listFiles([
            'q' => $q,
            'spaces' => 'drive',
            'fields' => 'files(id, name)',
            'pageSize' => 1,
            'supportsAllDrives' => true,
            'includeItemsFromAllDrives' => true,
        ]);

        $files = $list->getFiles();
        if ($files && count($files) > 0) {
            return $files[0]->getId();
        }

        $meta = new DriveFile([
            'name' => $name,
            'mimeType' => self::MIME_FOLDER,
            'parents' => [$parentId],
        ]);

        $created = $this->drive->files->create($meta, [
            'fields' => 'id',
            'supportsAllDrives' => true,
        ]);

        return $created->getId();
    }

    public function uploadOrReplace(string $folderId, string $filename, string $bytes, string $mime): DriveFile
    {
        $escaped = str_replace("'", "\\'", $filename);
        $q = sprintf(
            "name='%s' and '%s' in parents and trashed=false and mimeType!='%s'",
            $escaped,
            $folderId,
            self::MIME_FOLDER
        );

        $list = $this->drive->files->listFiles([
            'q' => $q,
            'spaces' => 'drive',
            'fields' => 'files(id, name)',
            'pageSize' => 1,
            'supportsAllDrives' => true,
            'includeItemsFromAllDrives' => true,
        ]);

        $existing = $list->getFiles();
        if ($existing && count($existing) > 0) {
            return $this->drive->files->update(
                $existing[0]->getId(),
                new DriveFile(['name' => $filename]),
                [
                    'data' => $bytes,
                    'mimeType' => $mime,
                    'uploadType' => 'multipart',
                    'fields' => 'id, name',
                    'supportsAllDrives' => true,
                ]
            );
        }

        $meta = new DriveFile([
            'name' => $filename,
            'parents' => [$folderId],
        ]);

        return $this->drive->files->create($meta, [
            'data' => $bytes,
            'mimeType' => $mime,
            'uploadType' => 'multipart',
            'fields' => 'id, name',
            'supportsAllDrives' => true,
        ]);
    }

    private function resolvePpmpExcelBytes(Ppmp $ppmp, ?Office $office): string
    {
        $diskPath = $ppmp->absoluteExcelPath();
        if ($diskPath && is_file($diskPath)) {
            $content = file_get_contents($diskPath);
            if ($content !== false && $content !== '') {
                return $content;
            }
        }

        $blobRow = DB::table('ppmp')->where('id', $ppmp->id)->select('excel_blob')->first();
        $blob = $blobRow->excel_blob ?? null;
        if ($blob !== null && $blob !== '') {
            return (string) $blob;
        }

        if (!$office) {
            throw new Exception("Office missing for PPMP #{$ppmp->id}; cannot regenerate Excel.");
        }

        $items = PpmpItem::where('ppmp_id', $ppmp->id)->get();
        return PpmpExcelExporter::exportPpmpXlsx($office, $ppmp, $items);
    }
}
