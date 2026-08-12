<?php

namespace App\Services;

use PhpOffice\PhpSpreadsheet\IOFactory;
use Exception;

class PpmpExcelParser
{
    public static function getItPpmpsDir(): string
    {
        return base_path('IT_ppmps');
    }

    public static function ensureItPpmpsDirs(): array
    {
        $root = self::getItPpmpsDir();
        // Combined uploads go under IT_ppmps/{office_code}/.
        // Legacy CSE/nonCSE paths are returned for backward reads only (not created).
        $cse = $root . DIRECTORY_SEPARATOR . 'CSE';
        $noncse = $root . DIRECTORY_SEPARATOR . 'nonCSE';

        if (!file_exists($root)) {
            mkdir($root, 0777, true);
        }

        return [
            'root' => $root,
            'cse' => $cse,
            'noncse' => $noncse,
        ];
    }

    /**
     * Expected PPMP upload filename stem for an office, e.g. "IT (IND PPMP)".
     */
    public static function expectedFilenameStem(string $officeCode): string
    {
        return trim($officeCode) . ' (IND PPMP)';
    }

    /**
     * Collapse whitespace and trim for filename comparisons.
     */
    public static function normalizeFilenameStem(string $stem): string
    {
        return trim(preg_replace('/\s+/u', ' ', $stem) ?? $stem);
    }

    /**
     * Map Column 13 text to is_cse boolean, or null if invalid/blank.
     */
    public static function parsePpmpTypeCell($val): ?bool
    {
        $text = strtoupper(self::cellStr($val));
        $text = preg_replace('/[\s_\-]+/', '', $text) ?? $text;

        if ($text === 'CSE') {
            return true;
        }
        if ($text === 'NONCSE') {
            return false;
        }

        return null;
    }

    public static function parseFile(string $filePath, bool $isCse = false, ?string $officeCode = null): array
    {
        if (!file_exists($filePath)) {
            throw new Exception("File not found: " . $filePath);
        }

        $spreadsheet = IOFactory::load($filePath);
        $allItems = [];
        $meta = [
            'fiscal_year' => null,
            'end_user' => null,
            'title' => null,
            'used_ngpa' => false,
        ];

        foreach ($spreadsheet->getAllSheets() as $sheet) {
            $rows = $sheet->toArray(null, true, true, false);

            if (empty($rows)) continue;

            $sheetMeta = self::extractMeta($rows);
            if ($sheetMeta['fiscal_year'] && !$meta['fiscal_year']) $meta['fiscal_year'] = $sheetMeta['fiscal_year'];
            if ($sheetMeta['end_user'] && !$meta['end_user']) $meta['end_user'] = $sheetMeta['end_user'];
            if ($sheetMeta['title'] && !$meta['title']) $meta['title'] = $sheetMeta['title'];

            if (self::findNgpaHeaderIndex($rows) !== null) {
                $meta['used_ngpa'] = true;
                $ngpaItems = self::parseNgpaItems($rows, $isCse, $officeCode);
                if (!empty($ngpaItems)) {
                    $allItems = array_merge($allItems, $ngpaItems);
                }
                continue;
            }

            $legacyItems = self::parseLegacyItems($rows, $isCse, $officeCode);
            if (!empty($legacyItems)) {
                $allItems = array_merge($allItems, $legacyItems);
            }
        }

        return [
            'meta' => $meta,
            'items' => $allItems,
        ];
    }

    private static function cellStr($val): string
    {
        if ($val === null) return '';
        return trim((string)$val);
    }

    private static function cellFloat($val): float
    {
        if ($val === null || $val === '') return 0.0;
        if (is_numeric($val)) return (float)$val;
        $clean = str_replace(',', '', trim((string)$val));
        return is_numeric($clean) ? (float)$clean : 0.0;
    }

    private static function yesNoBool($val): bool
    {
        $text = strtolower(self::cellStr($val));
        return in_array($text, ['yes', 'y', 'true', '1'], true);
    }

    private static function extractMeta(array $rows): array
    {
        $fiscalYear = null;
        $endUser = null;
        $title = null;

        $checkRows = array_slice($rows, 0, 20);
        foreach ($checkRows as $row) {
            $text0 = self::cellStr($row[0] ?? '');
            $joined = strtolower(implode(' ', array_map([self::class, 'cellStr'], $row)));

            if (preg_match('/fiscal\s*year\s*:?\s*(20\d{2})/i', $text0, $m) || preg_match('/(20\d{2})/', $text0, $m)) {
                $fiscalYear = (int)$m[1];
            }
            if (preg_match('/end[- ]user(?: unit)?\s*:?\s*(.+)$/i', $text0, $m)) {
                $endUser = trim($m[1]);
            }
            if (str_contains($joined, 'project procurement management plan')) {
                $title = $text0 ?: 'PPMP';
            }
        }

        return [
            'fiscal_year' => $fiscalYear,
            'end_user' => $endUser,
            'title' => $title,
        ];
    }

    private static function findNgpaHeaderIndex(array $rows): ?int
    {
        foreach ($rows as $i => $row) {
            $col1 = strtolower(self::cellStr($row[0] ?? ''));
            if ($col1 === 'column 1') {
                return $i;
            }
        }
        return null;
    }

    private static function parseNgpaItems(array $rows, bool $isCse, ?string $officeCode): array
    {
        $headerIdx = self::findNgpaHeaderIndex($rows);
        if ($headerIdx === null) return [];

        $headerRow = $rows[$headerIdx] ?? [];
        $col13Header = strtolower(self::cellStr($headerRow[12] ?? ''));
        if ($col13Header !== 'column 13') {
            throw new Exception(
                'PPMP Excel must include Column 13 (CSE / NONCSE). Update your template and set CSE or NONCSE for each item row.'
            );
        }

        $items = [];
        $dataRows = array_slice($rows, $headerIdx + 1);
        $rowNumber = $headerIdx + 2; // 1-based spreadsheet row for messages

        foreach ($dataRows as $row) {
            if (empty($row)) {
                $rowNumber++;
                continue;
            }

            $joined = strtolower(implode(' ', array_map([self::class, 'cellStr'], $row)));
            if (empty($joined) || str_starts_with($joined, 'refers to')) {
                $rowNumber++;
                continue;
            }
            if (str_contains($joined, 'submitted by') || str_contains($joined, 'approved by')) {
                break;
            }

            $description = self::cellStr($row[0] ?? '');
            if (empty($description) || str_starts_with(strtolower($description), 'column ')) {
                $rowNumber++;
                continue;
            }
            if (strlen($description) > 400 && str_contains(strtolower($description), 'refers to')) {
                $rowNumber++;
                continue;
            }

            $itemIsCse = self::parsePpmpTypeCell($row[12] ?? '');
            if ($itemIsCse === null) {
                $raw = self::cellStr($row[12] ?? '');
                throw new Exception(
                    'Row ' . $rowNumber . ': Column 13 must be CSE or NONCSE'
                    . ($raw !== '' ? " (found \"{$raw}\")" : ' (missing)')
                    . '.'
                );
            }

            $projectType = self::cellStr($row[1] ?? '') ?: 'Goods';
            $quantitySize = self::cellStr($row[2] ?? '');
            $procurementMode = self::cellStr($row[3] ?? '') ?: 'Competitive Bidding';
            $preProc = self::yesNoBool($row[4] ?? '');
            $procStart = self::cellStr($row[5] ?? '');
            $procEnd = self::cellStr($row[6] ?? '');
            $delivery = self::cellStr($row[7] ?? '');
            $fundSource = self::cellStr($row[8] ?? '');
            $budget = self::cellFloat($row[9] ?? 0);
            $supporting = self::cellStr($row[10] ?? '');
            $remarks = self::cellStr($row[11] ?? '');

            $items[] = [
                'description' => $description,
                'category' => $description,
                'is_cse' => $itemIsCse,
                'project_type' => $projectType,
                'quantity_size' => $quantitySize ?: null,
                'procurement_mode' => rtrim($procurementMode, ','),
                'pre_proc_conf' => $preProc,
                'proc_start' => $procStart ?: null,
                'proc_end' => $procEnd ?: null,
                'delivery_period' => $delivery ?: null,
                'fund_source' => rtrim($fundSource, ',') ?: null,
                'estimated_budget' => $budget,
                'supporting_docs' => $supporting ?: null,
                'remarks' => $remarks ?: null,
                'quantity' => null,
                'unit_of_measure' => null,
                'unit_cost' => null,
                'q1_qty' => 0,
                'q2_qty' => 0,
                'q3_qty' => 0,
                'q4_qty' => 0,
                'office_code' => $officeCode,
            ];
            $rowNumber++;
        }

        return $items;
    }

    private static function parseLegacyItems(array $rows, bool $isCse, ?string $officeCode): array
    {
        $startIdx = null;
        foreach ($rows as $i => $row) {
            $joined = strtolower(implode(' ', array_map([self::class, 'cellStr'], $row)));
            if (str_contains($joined, 'aip ref') && str_contains($joined, 'general description')) {
                $startIdx = $i + 1;
                if (isset($rows[$startIdx])) {
                    $nextJoined = strtolower(implode(' ', array_map([self::class, 'cellStr'], $rows[$startIdx])));
                    if (str_contains($nextJoined, 'size') && str_contains($nextJoined, 'budget')) {
                        $startIdx++;
                    }
                }
                break;
            }
        }

        if ($startIdx === null) return [];

        $items = [];
        $dataRows = array_slice($rows, $startIdx);

        foreach ($dataRows as $row) {
            if (empty($row)) continue;

            $code = self::cellStr($row[0] ?? '');
            $description = self::cellStr($row[1] ?? '');
            $qtySize = self::cellStr($row[2] ?? '');
            $budget = self::cellFloat($row[3] ?? 0);
            $mode = self::cellStr($row[4] ?? '') ?: 'Competitive Bidding';

            if (!$description && !$code) continue;
            if (!$description) $description = $code;

            if ($budget <= 0 && empty($description)) continue;

            $items[] = [
                'description' => $description,
                'category' => $code ?: $description,
                'is_cse' => $isCse,
                'project_type' => 'Goods',
                'quantity_size' => $qtySize ?: null,
                'procurement_mode' => $mode,
                'pre_proc_conf' => false,
                'proc_start' => null,
                'proc_end' => null,
                'delivery_period' => null,
                'fund_source' => null,
                'estimated_budget' => $budget,
                'supporting_docs' => null,
                'remarks' => null,
                'quantity' => null,
                'unit_of_measure' => null,
                'unit_cost' => null,
                'q1_qty' => 0,
                'q2_qty' => 0,
                'q3_qty' => 0,
                'q4_qty' => 0,
                'office_code' => $officeCode,
            ];
        }

        return $items;
    }
}
