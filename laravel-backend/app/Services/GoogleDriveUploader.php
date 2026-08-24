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
use Google\Service\Exception as GoogleServiceException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Exception;

class GoogleDriveUploader
{
    private const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    private const MIME_XLS = 'application/vnd.ms-excel';
    private const MIME_FOLDER = 'application/vnd.google-apps.folder';
    /** Multipart is unreliable above ~5MB; use resumable for larger payloads. */
    private const RESUMABLE_THRESHOLD = 5 * 1024 * 1024;

    private GoogleDrive $drive;
    private string $rootFolderId;
    private bool $uploadCapabilityChecked = false;

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

        // Optional: domain-wide delegation so uploads use a real user's Drive quota.
        $impersonate = trim((string) config('google.drive_impersonate_user', ''));
        if ($impersonate !== '') {
            $client->setSubject($impersonate);
        }

        $this->drive = new GoogleDrive($client);
    }

    /**
     * Cheap check before constructing the uploader (avoids throwing when unset).
     */
    public static function isConfigured(): bool
    {
        $rootId = trim((string) config('google.drive_root_folder_id', ''));
        if ($rootId === '') {
            return false;
        }

        $keyPath = self::resolveServiceAccountPath();

        return $keyPath !== null && is_file($keyPath);
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

        // Fallback: any service-account JSON under repo credentials/
        $credDir = dirname(base_path()) . DIRECTORY_SEPARATOR . 'credentials';
        if (is_dir($credDir)) {
            $preferred = $credDir . DIRECTORY_SEPARATOR . 'google-service-account.json';
            if (is_file($preferred)) {
                return $preferred;
            }
            $matches = glob($credDir . DIRECTORY_SEPARATOR . '*.json') ?: [];
            foreach ($matches as $match) {
                if (is_file($match)) {
                    return $match;
                }
            }
        }

        return null;
    }

    /**
     * Upload one verified PPMP Excel into PPMP/{officeCode}/ (combined CSE + non-CSE workbook).
     *
     * @return array{ok: bool, uploaded: list<array>, errors: list<array>}
     */
    public function uploadVerifiedPpmp(Ppmp $ppmp): array
    {
        $uploaded = [];
        $errors = [];

        $fiscalYear = (int) $ppmp->fiscal_year;
        $office = Office::find($ppmp->office_id);
        $officeCode = $office
            ? trim((string) ($office->code ?: $office->name ?: 'office-' . $ppmp->office_id))
            : ('office-' . $ppmp->office_id);
        $officeCode = preg_replace('/[^\w\-]+/', '_', $officeCode) ?: ('office-' . $ppmp->office_id);

        try {
            $this->assertCanUploadFiles();

            // Resolve Excel BEFORE creating folders so a missing file does not leave empty office dirs.
            $bytes = $this->resolvePpmpExcelBytes($ppmp, $office);
            $filename = $this->buildPpmpDriveFilename($ppmp, $officeCode, $bytes);
            $mime = $this->detectExcelMime($bytes, $ppmp->excel_mime, $filename);

            $fyFolderId = $this->ensureFolderPath($this->rootFolderId, [(string) $fiscalYear]);
            $ppmpRoot = $this->ensureFolderPath($fyFolderId, ['PPMP']);
            $folderId = $this->ensureFolderPath($ppmpRoot, [$officeCode]);

            $file = $this->uploadOrReplace($folderId, $filename, $bytes, $mime);
            $uploaded[] = [
                'type' => 'ppmp',
                'kind' => 'combined',
                'office_code' => $officeCode,
                'ppmp_id' => $ppmp->id,
                'name' => $filename,
                'drive_file_id' => $file->getId(),
                'path' => "APP SYSTEM FILES/{$fiscalYear}/PPMP/{$officeCode}/{$filename}",
            ];
        } catch (Exception $e) {
            $message = $this->friendlyDriveError($e);
            Log::warning('Drive PPMP upload failed', [
                'ppmp_id' => $ppmp->id,
                'office_code' => $officeCode,
                'error' => $message,
                'raw' => $e->getMessage(),
            ]);
            $errors[] = [
                'type' => 'ppmp',
                'ppmp_id' => $ppmp->id,
                'office_code' => $officeCode,
                'error' => $message,
            ];
        }

        return [
            'ok' => count($errors) === 0 && count($uploaded) > 0,
            'uploaded' => $uploaded,
            'errors' => $errors,
        ];
    }

    /**
     * Upload verified PPMPs and CSE/nonCSE APP Excels for a fiscal year.
     *
     * @return array{ok: bool, fiscal_year: int, uploaded: list<array>, errors: list<array>, detail?: string}
     */
    public function uploadFiscalYearArtifacts(int $fiscalYear): array
    {
        $uploaded = [];
        $errors = [];

        try {
            $this->assertCanUploadFiles();
        } catch (Exception $e) {
            $message = $this->friendlyDriveError($e);
            Log::warning('Drive upload blocked by quota/Shared Drive check', ['error' => $message]);

            return [
                'ok' => false,
                'fiscal_year' => $fiscalYear,
                'uploaded' => [],
                'errors' => [['type' => 'setup', 'error' => $message]],
                'detail' => $message,
            ];
        }

        $fyFolderId = $this->ensureFolderPath($this->rootFolderId, [(string) $fiscalYear]);
        $cseAppFolder = $this->ensureFolderPath($fyFolderId, ['CSE-APP']);
        $nonCseAppFolder = $this->ensureFolderPath($fyFolderId, ['nonCSE-APP']);

        $approved = Ppmp::where('fiscal_year', $fiscalYear)
            ->where('status', 'Approved')
            ->whereNull('superseded_at')
            ->get();

        foreach ($approved as $ppmp) {
            $result = $this->uploadVerifiedPpmp($ppmp);
            $uploaded = array_merge($uploaded, $result['uploaded']);
            $errors = array_merge($errors, $result['errors']);
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
                    $message = $this->friendlyDriveError($e);
                    Log::warning('Drive CSE-APP upload failed', [
                        'fiscal_year' => $fiscalYear,
                        'error' => $message,
                    ]);
                    $errors[] = [
                        'type' => 'app',
                        'kind' => 'cse',
                        'error' => $message,
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
                    $message = $this->friendlyDriveError($e);
                    Log::warning('Drive nonCSE-APP upload failed', [
                        'fiscal_year' => $fiscalYear,
                        'error' => $message,
                    ]);
                    $errors[] = [
                        'type' => 'app',
                        'kind' => 'noncse',
                        'error' => $message,
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

        $detail = null;
        if (count($errors) > 0) {
            $detail = $errors[0]['error'] ?? 'Drive upload failed';
        }

        return [
            'ok' => count($errors) === 0,
            'fiscal_year' => $fiscalYear,
            'uploaded' => $uploaded,
            'errors' => $errors,
            'detail' => $detail,
        ];
    }

    /**
     * Service accounts have 0 My Drive quota: folders can be created, but file uploads fail.
     * Always probe a tiny file upload (do not trust driveId alone — a folder can look shared
     * while the SA is only an "Editor" on a My Drive folder / shortcut).
     */
    private function assertCanUploadFiles(): void
    {
        if ($this->uploadCapabilityChecked) {
            return;
        }
        $this->uploadCapabilityChecked = true;

        try {
            $root = $this->drive->files->get($this->rootFolderId, [
                'fields' => 'id,name,mimeType,driveId,shortcutDetails',
                'supportsAllDrives' => true,
            ]);
        } catch (Exception $e) {
            throw new Exception(
                'Cannot read GOOGLE_DRIVE_ROOT_FOLDER_ID. Open the Shared Drive → Manage members '
                . 'and add appbac-drive@app-consolidation.iam.gserviceaccount.com as Content manager. '
                . $this->friendlyDriveError($e),
                0,
                $e
            );
        }

        $mime = (string) ($root->getMimeType() ?? '');
        if ($mime === 'application/vnd.google-apps.shortcut') {
            throw new Exception(
                'GOOGLE_DRIVE_ROOT_FOLDER_ID points to a shortcut, not a real folder. '
                . 'Open the Shared Drive itself, open the real "APP SYSTEM FILES" folder, '
                . 'copy that folder ID from the browser URL, and update .env.'
            );
        }

        $hasSharedDriveId = (string) ($root->getDriveId() ?? '') !== '';

        // Always probe a real FILE create. Folder create succeeding does not prove file uploads work.
        $probeName = '_appbac_quota_probe_' . uniqid('', true) . '.txt';
        try {
            $probe = $this->drive->files->create(
                new DriveFile([
                    'name' => $probeName,
                    'mimeType' => 'text/plain',
                    'parents' => [$this->rootFolderId],
                ]),
                [
                    'data' => 'appbac-quota-probe',
                    'mimeType' => 'text/plain',
                    'uploadType' => 'multipart',
                    'fields' => 'id',
                    'supportsAllDrives' => true,
                ]
            );
            try {
                $this->drive->files->delete($probe->getId(), ['supportsAllDrives' => true]);
            } catch (Exception $cleanup) {
                Log::warning('Drive quota probe cleanup failed', ['error' => $cleanup->getMessage()]);
            }
        } catch (Exception $e) {
            Log::warning('Drive file probe failed', [
                'root_id' => $this->rootFolderId,
                'root_name' => $root->getName(),
                'drive_id' => $root->getDriveId(),
                'has_shared_drive_id' => $hasSharedDriveId,
                'error' => $e->getMessage(),
            ]);
            throw new Exception(
                $this->quotaExceededMessage($hasSharedDriveId, $this->friendlyDriveError($e)),
                0,
                $e
            );
        }

        if (!$hasSharedDriveId) {
            // Probe worked on My Drive (rare / legacy SA). Warn in logs; allow continue.
            Log::warning('Drive root has no driveId (not a Shared Drive), but file probe succeeded', [
                'root_id' => $this->rootFolderId,
                'root_name' => $root->getName(),
            ]);
        }
    }

    private function quotaExceededMessage(bool $reportedSharedDrive = false, string $apiError = ''): string
    {
        $sa = 'appbac-drive@app-consolidation.iam.gserviceaccount.com';
        $parts = [
            'Google Drive rejected the Excel file upload (office folders can still be created).',
            'Sharing a folder as "Editor" is NOT enough for a service account.',
            "Do this: drive.google.com → left menu Shared drives (not Shared with me) → open the Shared Drive → Manage members → add {$sa} as Content manager.",
            'Then put "APP SYSTEM FILES" inside that Shared Drive, copy its folder ID into GOOGLE_DRIVE_ROOT_FOLDER_ID, and retry.',
        ];
        if ($reportedSharedDrive) {
            $parts[] = 'Note: the folder reports a Shared Drive id, but file create still failed — the SA is probably not a Shared Drive member (only folder Editor), or .env points at the wrong folder.';
        }
        if ($apiError !== '') {
            $parts[] = 'API: ' . $apiError;
        }

        return implode(' ', $parts);
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
            'corpora' => 'allDrives',
            'fields' => 'files(id, name)',
            'pageSize' => 1,
            'supportsAllDrives' => true,
            'includeItemsFromAllDrives' => true,
        ]);

        $files = $list->getFiles();
        if ($files && count($files) > 0) {
            return $files[0]->getId();
        }

        try {
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
        } catch (Exception $e) {
            throw new Exception($this->friendlyDriveError($e), 0, $e);
        }
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
            'corpora' => 'allDrives',
            'fields' => 'files(id, name)',
            'pageSize' => 1,
            'supportsAllDrives' => true,
            'includeItemsFromAllDrives' => true,
        ]);

        $uploadType = strlen($bytes) > self::RESUMABLE_THRESHOLD ? 'resumable' : 'multipart';

        try {
            $existing = $list->getFiles();
            if ($existing && count($existing) > 0) {
                return $this->drive->files->update(
                    $existing[0]->getId(),
                    new DriveFile([
                        'name' => $filename,
                        'mimeType' => $mime,
                    ]),
                    [
                        'data' => $bytes,
                        'mimeType' => $mime,
                        'uploadType' => $uploadType,
                        'fields' => 'id, name',
                        'supportsAllDrives' => true,
                    ]
                );
            }

            $meta = new DriveFile([
                'name' => $filename,
                'mimeType' => $mime,
                'parents' => [$folderId],
            ]);

            return $this->drive->files->create($meta, [
                'data' => $bytes,
                'mimeType' => $mime,
                'uploadType' => $uploadType,
                'fields' => 'id, name',
                'supportsAllDrives' => true,
            ]);
        } catch (Exception $e) {
            throw new Exception($this->friendlyDriveError($e), 0, $e);
        }
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

    /**
     * Prefer "{CODE} (IND PPMP).{ext}" matching the office upload stem.
     */
    private function buildPpmpDriveFilename(Ppmp $ppmp, string $officeCode, string $bytes): string
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

    private function detectExcelMime(string $bytes, ?string $storedMime, string $filename): string
    {
        $magic = substr($bytes, 0, 4);
        if ($magic === "\xD0\xCF\x11\xE0") {
            return self::MIME_XLS;
        }
        if ($magic === "PK\x03\x04" || $magic === "PK\x05\x06") {
            return self::MIME_XLSX;
        }

        $stored = trim((string) $storedMime);
        if ($stored !== '') {
            return $stored;
        }

        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        return $ext === 'xls' ? self::MIME_XLS : self::MIME_XLSX;
    }

    /**
     * Map Drive API errors (especially storageQuotaExceeded) to actionable messages.
     */
    private function friendlyDriveError(Exception $e): string
    {
        $raw = $e->getMessage();
        $body = '';

        if ($e instanceof GoogleServiceException) {
            $body = (string) $e->getMessage();
        } elseif ($e->getPrevious() instanceof GoogleServiceException) {
            $body = (string) $e->getPrevious()->getMessage();
        }

        $haystack = $body !== '' ? $body : $raw;

        if (
            stripos($haystack, 'storageQuotaExceeded') !== false
            || stripos($haystack, 'storage quota') !== false
            || stripos($haystack, '0 My Drive') !== false
            || stripos($haystack, 'do not have storage quota') !== false
            || stripos($haystack, 'Service Accounts do not have storage quota') !== false
        ) {
            return $this->quotaExceededMessage(false, '');
        }

        // Prefer structured Google API errors when present
        if ($e instanceof GoogleServiceException) {
            $errors = $e->getErrors();
            if (is_array($errors) && isset($errors[0])) {
                $reason = (string) ($errors[0]['reason'] ?? '');
                $message = (string) ($errors[0]['message'] ?? '');
                if ($reason === 'storageQuotaExceeded' || stripos($message, 'storage quota') !== false) {
                    return $this->quotaExceededMessage(false, $message !== '' ? $message : $reason);
                }
                if ($message !== '') {
                    return $reason !== '' ? "{$reason}: {$message}" : $message;
                }
            }
        }
        if ($e->getPrevious() instanceof GoogleServiceException) {
            return $this->friendlyDriveError($e->getPrevious());
        }

        return $raw !== '' ? $raw : 'Drive upload failed';
    }
}
